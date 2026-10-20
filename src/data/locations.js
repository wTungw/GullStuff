import { db } from './db.js'
import { locationIdentity } from './identity.js'

const clean = value => typeof value === 'string' ? value.trim() : ''
const limits = { name: 150, country: 100, city: 100, area: 100, address: 300, notes: 1000 }

export function normalizePurchaseInput(input) {
  const rawPrice = String(input?.price ?? '').trim()
  if (rawPrice && !/^\d{1,9}(?:\.\d{1,2})?$/.test(rawPrice)) throw new Error('價格請輸入最多 9 位整數及 2 位小數。')
  const price = rawPrice ? Number(rawPrice) : null
  const currency = clean(input?.currency).toUpperCase()
  if (price !== null && !/^[A-Z]{3}$/.test(currency)) throw new Error('有價格時，幣別請輸入 3 個英文字母。')
  const notes = clean(input?.notes)
  if (notes.length > 500) throw new Error('購買備註最多 500 個字。')
  return { price, currency: price === null ? '' : currency, notes }
}

function purchaseFromLink(link) {
  return {
    price: typeof link.price === 'number' && Number.isFinite(link.price) ? link.price : null,
    currency: clean(link.currency),
    notes: clean(link.notes)
  }
}

export function normalizeLocationInput(input) {
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

export async function listLocationsForProduct(productId) {
  return db.transaction('r', db.locations, db.locationProducts, async () => {
    const links = await db.locationProducts.where('productId').equals(productId).toArray()
    const locations = await db.locations.bulkGet(links.map(link => link.locationId))
    return locations.flatMap((location, index) => location ? [{ ...location, purchase: purchaseFromLink(links[index]) }] : [])
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  })
}

export async function listProductsForLocation(locationId) {
  return db.transaction('r', db.products, db.locationProducts, async () => {
    const links = await db.locationProducts.where('locationId').equals(locationId).toArray()
    const products = await db.products.bulkGet(links.map(link => link.productId))
    return products.flatMap((product, index) => product ? [{ ...product, purchase: purchaseFromLink(links[index]) }] : [])
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
  })
}

export async function saveLocationPurchase(productId, locationId, input) {
  if (!productId || !locationId) throw new Error('請選擇商品與地點。')
  const purchase = normalizePurchaseInput(input)
  return db.transaction('rw', db.locationProducts, async () => {
    const link = await db.locationProducts.where('[locationId+productId]').equals([locationId, productId]).first()
    if (!link) throw new Error('商品與地點的連結已不存在，請重新整理頁面。')
    await db.locationProducts.update(link.id, { ...purchase, updatedAt: new Date().toISOString() })
    return purchase
  })
}

export async function linkProductToLocation(productId, locationId) {
  if (!productId || !locationId) throw new Error('請選擇商品與地點。')
  return db.transaction('rw', db.products, db.locations, db.locationProducts, async () => {
    if (!(await db.products.get(productId))) throw new Error('商品已不存在，請重新整理頁面。')
    if (!(await db.locations.get(locationId))) throw new Error('地點已不存在，請重新選擇。')
    const pair = [locationId, productId]
    const existing = await db.locationProducts.where('[locationId+productId]').equals(pair).first()
    if (existing) return existing
    const now = new Date().toISOString()
    const link = { id: crypto.randomUUID(), locationId, productId, createdAt: now }
    await db.locationProducts.add(link)
    await db.locations.update(locationId, { updatedAt: now })
    return link
  })
}

export async function unlinkProductFromLocation(productId, locationId) {
  if (!productId || !locationId) throw new Error('請選擇商品與地點。')
  return db.transaction('rw', db.locations, db.locationProducts, async () => {
    const link = await db.locationProducts.where('[locationId+productId]').equals([locationId, productId]).first()
    if (!link) return false
    await db.locationProducts.delete(link.id)
    await db.locations.update(locationId, { updatedAt: new Date().toISOString() })
    return true
  })
}

export async function saveLocation(input, id, productIds) {
  const fields = normalizeLocationInput(input)
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
