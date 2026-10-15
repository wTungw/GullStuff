import { db } from './db.js'
import { locationIdentity } from './identity.js'

const clean = value => typeof value === 'string' ? value.trim() : ''
const limits = { name: 150, country: 100, city: 100, area: 100, address: 300, notes: 1000 }

function normalize(input) {
  const fields = Object.fromEntries(Object.keys(limits).map(key => [key, clean(input[key])]))
  if (!fields.name) throw new Error('請填寫地點名稱。')
  for (const [key, limit] of Object.entries(limits)) {
    if (fields[key].length > limit) throw new Error(`${{ name: '地點名稱', country: '國家', city: '城市', area: '區域', address: '地址', notes: '備註' }[key]}最多 ${limit} 個字。`)
  }
  return fields
}

export async function listLocations() {
  return db.transaction('r', db.locations, db.locationProducts, async () => {
    const [locations, links] = await Promise.all([
      db.locations.orderBy('updatedAt').reverse().toArray(),
      db.locationProducts.toArray()
    ])
    const counts = new Map()
    for (const link of links) counts.set(link.locationId, (counts.get(link.locationId) ?? 0) + 1)
    return locations.map(location => ({ ...location, productCount: counts.get(location.id) ?? 0 }))
  })
}

export async function listProductIdsForLocation(locationId) {
  return (await db.locationProducts.where('locationId').equals(locationId).toArray()).map(link => link.productId)
}

export async function saveLocation(input, id, productIds) {
  const fields = normalize(input)
  if (productIds !== undefined && (!Array.isArray(productIds) || productIds.some(productId => typeof productId !== 'string' || !productId))) {
    throw new Error('商品選擇資料無效，請重新選取。')
  }
  const selectedIds = productIds === undefined ? undefined : [...new Set(productIds)]
  const now = new Date().toISOString()
  return db.transaction('rw', db.locations, db.locationProducts, db.products, async () => {
    const existing = id ? await db.locations.get(id) : null
    if (id && !existing) throw new Error('找不到這個地點，可能已被刪除。')
    if (!existing || locationIdentity(existing) !== locationIdentity(fields)) {
      const sameLocation = (await db.locations.toArray()).some(location => location.id !== id && locationIdentity(location) === locationIdentity(fields))
      if (sameLocation) throw new Error('已有相同名稱、國家、城市／地區與地址的地點，請確認是否重複。')
    }
    const location = { ...fields, id: id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    if (selectedIds !== undefined) {
      const products = await db.products.bulkGet(selectedIds)
      if (products.some(product => !product)) throw new Error('部分商品已不存在，請重新整理商品列表。')
      const links = await db.locationProducts.where('locationId').equals(location.id).toArray()
      const selected = new Set(selectedIds)
      const current = new Set(links.map(link => link.productId))
      await db.locationProducts.bulkDelete(links.filter(link => !selected.has(link.productId)).map(link => link.id))
      await db.locationProducts.bulkAdd(selectedIds.filter(productId => !current.has(productId)).map(productId => ({
        id: crypto.randomUUID(), locationId: location.id, productId, createdAt: now
      })))
    }
    await db.locations.put(location)
    return location
  })
}

export const createLocation = input => saveLocation(input)

export async function deleteLocation(id) {
  return db.transaction('rw', db.locations, db.locationProducts, async () => {
    if (!(await db.locations.get(id))) return false
    await db.locationProducts.where('locationId').equals(id).delete()
    await db.locations.delete(id)
    return true
  })
}
