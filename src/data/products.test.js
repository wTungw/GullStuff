import 'fake-indexeddb/auto'
import { beforeEach, afterAll, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { deleteProduct, filterProducts, getImage, getProduct, listProducts, saveProduct } from './products.js'

beforeEach(async () => {
  await db.open()
  await Promise.all([db.products.clear(), db.images.clear(), db.locations.clear(), db.locationProducts.clear()])
})
afterAll(async () => { await db.delete() })

const sample = { name: '旅行杯', brand: '品牌 A', category: '生活用品', model: '藍色', notes: '朋友推薦' }

describe('local product management', () => {
  it('creates, persists, edits and searches a product', async () => {
    const created = await saveProduct(sample)
    expect(created.id).toBeTruthy()
    expect((await listProducts()).map(p => p.name)).toEqual(['旅行杯'])
    const updated = await saveProduct({ ...sample, name: '新旅行杯' }, undefined, created.id)
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect((await getProduct(created.id)).name).toBe('新旅行杯')
    expect(filterProducts(await listProducts(), '新旅行', '生活用品')).toHaveLength(1)
    expect(filterProducts(await listProducts(), '沒有', '')).toHaveLength(0)
    expect(filterProducts(await listProducts(), '', '其他')).toHaveLength(0)
  })
  it('rejects a missing required name', async () => {
    await expect(saveProduct({ ...sample, name: '  ' })).rejects.toThrow('商品名稱')
    expect(await listProducts()).toHaveLength(0)
  })
  it('stores, replaces and removes image blobs without orphans', async () => {
    const first = new Blob(['first'], { type: 'image/webp' })
    const second = new Blob(['second'], { type: 'image/webp' })
    const created = await saveProduct(sample, first)
    expect((await getImage(created.imageReference)).size).toBe(first.size)
    const replaced = await saveProduct(sample, second, created.id)
    expect(await getImage(created.imageReference)).toBeNull()
    expect((await getImage(replaced.imageReference)).size).toBe(second.size)
    expect(await db.images.count()).toBe(1)
    const removed = await saveProduct(sample, null, created.id)
    expect(removed.imageReference).toBeNull()
    expect(await db.images.count()).toBe(0)
  })
  it('deletes related image and future location links with the product', async () => {
    const product = await saveProduct(sample, new Blob(['image'], { type: 'image/webp' }))
    await db.locations.put({ id: 'location-1', name: 'Shinjuku' })
    await db.locationProducts.put({ id: 'link-1', locationId: 'location-1', productId: product.id })
    expect(await deleteProduct(product.id)).toBe(true)
    expect(await getProduct(product.id)).toBeUndefined()
    expect(await db.images.count()).toBe(0)
    expect(await db.locationProducts.count()).toBe(0)
    expect(await db.locations.count()).toBe(1)
  })
})
