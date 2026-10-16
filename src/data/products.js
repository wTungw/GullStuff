import { db } from './db.js'
import { identityPart } from './identity.js'

const clean = value => typeof value === 'string' ? value.trim() : ''

export function normalizeProductInput(input) {
  const product = {
    name: clean(input.name),
    brand: clean(input.brand),
    category: clean(input.category),
    model: clean(input.model),
    notes: clean(input.notes)
  }
  if (!product.name) throw new Error('請填寫商品名稱。')
  if (product.name.length > 150) throw new Error('商品名稱最多 150 個字。')
  return product
}

export async function listProducts() {
  return db.products.orderBy('updatedAt').reverse().toArray()
}

export async function getProduct(id) {
  return db.products.get(id)
}

export async function getImage(id) {
  if (!id) return null
  return (await db.images.get(id))?.blob ?? null
}

export async function saveProduct(input, imageChange, id) {
  const fields = normalizeProductInput(input)
  if (imageChange !== undefined && imageChange !== null && !(imageChange instanceof Blob)) {
    throw new Error('圖片格式無效。')
  }
  const now = new Date().toISOString()
  return db.transaction('rw', db.products, db.images, async () => {
    const existing = id ? await db.products.get(id) : null
    if (id && !existing) throw new Error('找不到這項商品，可能已被刪除。')
    if (!existing || identityPart(existing.name) !== identityPart(fields.name)) {
      const sameName = (await db.products.toArray()).some(product => product.id !== id && identityPart(product.name) === identityPart(fields.name))
      if (sameName) throw new Error('已有同名商品，請使用不同名稱。')
    }
    const productId = id ?? crypto.randomUUID()
    let imageReference = existing?.imageReference ?? null
    if (imageChange !== undefined) {
      if (imageReference) await db.images.delete(imageReference)
      imageReference = imageChange ? crypto.randomUUID() : null
      if (imageReference) await db.images.put({ id: imageReference, blob: imageChange })
    }
    const product = {
      ...fields,
      id: productId,
      imageReference,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    await db.products.put(product)
    return product
  })
}

export async function deleteProduct(id) {
  return db.transaction('rw', db.products, db.images, db.locationProducts, async () => {
    const existing = await db.products.get(id)
    if (!existing) return false
    await db.locationProducts.where('productId').equals(id).delete()
    if (existing.imageReference) await db.images.delete(existing.imageReference)
    await db.products.delete(id)
    return true
  })
}

export function filterProducts(products, query, category) {
  const needle = clean(query).toLocaleLowerCase('zh-TW')
  return products.filter(product =>
    (!needle || product.name.toLocaleLowerCase('zh-TW').includes(needle)) &&
    (!category || product.category === category)
  )
}
