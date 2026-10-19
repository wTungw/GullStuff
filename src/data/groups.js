import { db } from './db.js'
import { identityPart } from './identity.js'

const clean = value => typeof value === 'string' ? value.trim() : ''
export const GROUP_ICONS = [
  { id: 'folder', label: '資料夾' }, { id: 'gift', label: '禮物' },
  { id: 'star', label: '星星' }, { id: 'bag', label: '購物袋' },
  { id: 'plane', label: '旅行' }, { id: 'heart', label: '愛心' }
]
export const GROUP_COLORS = [
  { id: 'forest', label: '森林綠', accent: '#3f7258', tint: '#e9eee9' },
  { id: 'ocean', label: '海洋藍', accent: '#477c9a', tint: '#e7f1f6' },
  { id: 'coral', label: '珊瑚橘', accent: '#ad6958', tint: '#f7ebe7' },
  { id: 'gold', label: '暖金色', accent: '#9a7636', tint: '#f6f0df' },
  { id: 'violet', label: '薰衣紫', accent: '#806b9d', tint: '#f0ecf6' }
]
export function groupAppearance(group) {
  const color = GROUP_COLORS.find(item => item.id === group?.color) ?? GROUP_COLORS[0]
  return { '--group-accent': color.accent, '--group-tint': color.tint }
}

export function normalizeGroupInput(input) {
  const name = clean(input?.name)
  const notes = clean(input?.notes)
  const icon = clean(input?.icon) || GROUP_ICONS[0].id
  const color = clean(input?.color) || GROUP_COLORS[0].id
  if (!name) throw new Error('請填寫群組名稱。')
  if (name.length > 150) throw new Error('群組名稱最多 150 個字。')
  if (notes.length > 1000) throw new Error('群組說明最多 1000 個字。')
  if (!GROUP_ICONS.some(item => item.id === icon)) throw new Error('群組圖示無效。')
  if (!GROUP_COLORS.some(item => item.id === color)) throw new Error('群組顏色無效。')
  return { name, notes, icon, color }
}

export async function listGroups() {
  return db.transaction('r', db.groups, db.groupProducts, async () => {
    const [groups, links] = await Promise.all([
      db.groups.orderBy('updatedAt').reverse().toArray(),
      db.groupProducts.toArray()
    ])
    const counts = new Map()
    for (const link of links) counts.set(link.groupId, (counts.get(link.groupId) ?? 0) + 1)
    return groups.map(group => ({ ...group, productCount: counts.get(group.id) ?? 0 }))
  })
}

export async function listProductsForGroup(groupId) {
  return db.transaction('r', db.products, db.groupProducts, async () => {
    const links = await db.groupProducts.where('groupId').equals(groupId).toArray()
    links.sort((a, b) => a.position - b.position || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    const products = await db.products.bulkGet(links.map(link => link.productId))
    return products.filter(Boolean)
  })
}

export async function listGroupIdsForProduct(productId) {
  return (await db.groupProducts.where('productId').equals(productId).toArray()).map(link => link.groupId)
}

export async function saveGroup(input, id, productIds = []) {
  const fields = normalizeGroupInput(input)
  if (!Array.isArray(productIds) || productIds.some(productId => typeof productId !== 'string' || !productId)) {
    throw new Error('商品選擇資料無效，請重新選取。')
  }
  const ids = [...new Set(productIds)]
  const now = new Date().toISOString()
  return db.transaction('rw', db.groups, db.groupProducts, db.products, async () => {
    const existing = id ? await db.groups.get(id) : null
    if (id && !existing) throw new Error('群組已不存在，請重新整理。')
    const duplicate = (await db.groups.toArray()).some(group => group.id !== id && identityPart(group.name) === identityPart(fields.name))
    if (duplicate) throw new Error('已有同名群組，請使用不同名稱。')
    const products = await db.products.bulkGet(ids)
    if (products.some(product => !product)) throw new Error('部分商品已不存在，請重新選取。')
    const group = { ...fields, id: id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    const links = await db.groupProducts.where('groupId').equals(group.id).toArray()
    const current = new Map(links.map(link => [link.productId, link]))
    const selected = new Set(ids)
    await db.groupProducts.bulkDelete(links.filter(link => !selected.has(link.productId)).map(link => link.id))
    await db.groupProducts.bulkPut(ids.map((productId, position) => ({
      id: current.get(productId)?.id ?? crypto.randomUUID(),
      groupId: group.id,
      productId,
      position,
      createdAt: current.get(productId)?.createdAt ?? now
    })))
    await db.groups.put(group)
    return group
  })
}

export async function addProductToGroup(productId, groupId) {
  return db.transaction('rw', db.products, db.groups, db.groupProducts, async () => {
    if (!(await db.products.get(productId))) throw new Error('商品已不存在，請重新整理。')
    const group = await db.groups.get(groupId)
    if (!group) throw new Error('群組已不存在，請重新選擇。')
    const existing = await db.groupProducts.where('[groupId+productId]').equals([groupId, productId]).first()
    if (existing) return existing
    const links = await db.groupProducts.where('groupId').equals(groupId).toArray()
    const now = new Date().toISOString()
    const link = { id: crypto.randomUUID(), groupId, productId, position: Math.max(-1, ...links.map(item => item.position)) + 1, createdAt: now }
    await db.groupProducts.add(link)
    await db.groups.update(groupId, { updatedAt: now })
    return link
  })
}

export async function removeProductFromGroup(productId, groupId) {
  return db.transaction('rw', db.groups, db.groupProducts, async () => {
    const link = await db.groupProducts.where('[groupId+productId]').equals([groupId, productId]).first()
    if (!link) return false
    await db.groupProducts.delete(link.id)
    await db.groups.update(groupId, { updatedAt: new Date().toISOString() })
    return true
  })
}

export async function deleteGroup(id) {
  return db.transaction('rw', db.groups, db.groupProducts, async () => {
    if (!(await db.groups.get(id))) return false
    await db.groupProducts.where('groupId').equals(id).delete()
    await db.groups.delete(id)
    return true
  })
}
