import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { createLocation, deleteLocation, linkProductToLocation, listLocations, listLocationsForProduct, listProductIdsForLocation, listProductsForLocation, saveLocation, saveLocationPurchase, unlinkProductFromLocation } from './locations.js'

beforeEach(async () => {
  await db.open()
  await Promise.all([db.products.clear(), db.images.clear(), db.locations.clear(), db.locationProducts.clear()])
})
afterAll(async () => { await db.delete() })

describe('local location management', () => {
  it('stores a new location for the list', async () => {
    const created = await createLocation({ name: ' 松本清 ', city: ' 東京 ', country: '日本' })
    expect(created.name).toBe('松本清')
    expect((await listLocations()).map(location => location.id)).toContain(created.id)
    expect((await db.locations.get(created.id)).city).toBe('東京')
    expect(await listProductsForLocation(created.id)).toEqual([])
  })

  it('requires a name', async () => {
    await expect(createLocation({ name: ' ' })).rejects.toThrow('地點名稱')
    expect(await listLocations()).toHaveLength(0)
  })

  it('edits a location without changing its identity or creation time', async () => {
    const original = await createLocation({ name: '舊店名', city: '東京' })
    const updated = await saveLocation({ name: '新店名', country: '日本', city: '大阪', area: '中央區', address: '1-2-3', notes: '營業至 22:00' }, original.id)
    expect(updated.id).toBe(original.id)
    expect(updated.createdAt).toBe(original.createdAt)
    expect((await db.locations.get(original.id)).notes).toBe('營業至 22:00')
    await expect(saveLocation({ name: '不存在' }, 'missing')).rejects.toThrow('找不到')
  })

  it('validates field lengths', async () => {
    await expect(createLocation({ name: '店', city: 'x'.repeat(101) })).rejects.toThrow('城市最多 100 個字')
    expect(await listLocations()).toHaveLength(0)
  })
  it('keeps a location unique by name, country, city and address', async () => {
    const first = await createLocation({ name: '松本清', country: '日本', city: '東京', address: '新宿 1-2-3' })
    await expect(createLocation({ name: ' 松本清 ', country: '日本', city: '東京', address: '新宿 1-2-3 ' })).rejects.toThrow('相同名稱')
    expect((await saveLocation({ name: '松本清', country: '日本', city: '東京', address: '新宿 1-2-3' }, first.id)).id).toBe(first.id)
    const second = await createLocation({ name: '松本清', country: '日本', city: '大阪', address: '新宿 1-2-3' })
    expect(second.id).not.toBe(first.id)
  })
  it('allows editing an existing legacy duplicate without changing its identity', async () => {
    await db.locations.bulkPut([{ id: 'old-1', name: '舊地點' }, { id: 'old-2', name: '舊地點' }])
    const edited = await saveLocation({ name: '舊地點', notes: '已更新' }, 'old-1')
    expect(edited.notes).toBe('已更新')
    expect(await db.locations.count()).toBe(2)
  })

  it('deletes a location and its links while retaining products', async () => {
    const location = await createLocation({ name: '商店' })
    await db.products.put({ id: 'product-1', name: '商品' })
    await db.locationProducts.put({ id: 'link-1', locationId: location.id, productId: 'product-1' })
    expect(await deleteLocation(location.id)).toBe(true)
    expect(await db.locationProducts.count()).toBe(0)
    expect(await db.products.get('product-1')).toBeTruthy()
    expect(await deleteLocation(location.id)).toBe(false)
  })

  it('links existing products when creating a location and updates selections atomically', async () => {
    await db.products.bulkAdd([{ id: 'product-1', name: '商品一' }, { id: 'product-2', name: '商品二' }])
    const location = await saveLocation({ name: '商店' }, undefined, ['product-1', 'product-2'])
    expect((await listProductIdsForLocation(location.id)).sort()).toEqual(['product-1', 'product-2'])
    expect((await listLocations())[0].productCount).toBe(2)

    const originalLink = await db.locationProducts.where('[locationId+productId]').equals([location.id, 'product-2']).first()
    await db.locationProducts.update(originalLink.id, { price: 200, currency: 'TWD' })
    await saveLocation({ name: '商店新名' }, location.id, ['product-2'])
    expect(await listProductIdsForLocation(location.id)).toEqual(['product-2'])
    expect((await db.locationProducts.get(originalLink.id)).price).toBe(200)
    expect((await listLocations())[0].productCount).toBe(1)
    await saveLocation({ name: '商店新名' }, location.id, [])
    expect(await listProductIdsForLocation(location.id)).toEqual([])
    expect((await listLocations())[0].productCount).toBe(0)
  })

  it('allows one product in multiple locations while keeping each pair unique', async () => {
    await db.products.put({ id: 'product-1', name: '商品一' })
    const first = await saveLocation({ name: '第一間店' }, undefined, ['product-1', 'product-1'])
    const second = await saveLocation({ name: '第二間店' }, undefined, ['product-1'])
    expect(await listProductIdsForLocation(first.id)).toEqual(['product-1'])
    expect(await listProductIdsForLocation(second.id)).toEqual(['product-1'])
    expect(await db.locationProducts.count()).toBe(2)
  })

  it('finds every location for a product and reflects link or location deletion', async () => {
    await db.products.put({ id: 'product-1', name: '商品一' })
    const first = await saveLocation({ name: '第一間店', city: '東京' }, undefined, ['product-1'])
    const second = await saveLocation({ name: '第二間店', city: '大阪' }, undefined, ['product-1'])
    expect((await listLocationsForProduct('product-1')).map(location => location.id).sort()).toEqual([first.id, second.id].sort())
    expect(await listLocationsForProduct('missing')).toEqual([])

    await saveLocation({ name: '第一間店', city: '東京' }, first.id, [])
    expect((await listLocationsForProduct('product-1')).map(location => location.id)).toEqual([second.id])
    await deleteLocation(second.id)
    expect(await listLocationsForProduct('product-1')).toEqual([])
  })

  it('ignores a stale relation when its location no longer exists', async () => {
    await db.locationProducts.put({ id: 'stale', locationId: 'missing', productId: 'product-1' })
    expect(await listLocationsForProduct('product-1')).toEqual([])
    const location = await createLocation({ name: '既有店' })
    await db.locationProducts.put({ id: 'stale-product', locationId: location.id, productId: 'missing' })
    expect(await listProductsForLocation(location.id)).toEqual([])
  })

  it('links an existing location once and keeps its other product links', async () => {
    await db.products.bulkAdd([{ id: 'product-1', name: '商品一' }, { id: 'product-2', name: '商品二' }])
    const location = await saveLocation({ name: '既有店' }, undefined, ['product-2'])
    const link = await linkProductToLocation('product-1', location.id)
    expect((await linkProductToLocation('product-1', location.id)).id).toBe(link.id)
    expect((await listProductIdsForLocation(location.id)).sort()).toEqual(['product-1', 'product-2'])
    expect((await listLocationsForProduct('product-1')).map(item => item.id)).toEqual([location.id])
    expect((await listLocations())[0].productCount).toBe(2)
  })

  it('rejects linking a deleted product or location without an orphan relation', async () => {
    const location = await createLocation({ name: '既有店' })
    await expect(linkProductToLocation('missing', location.id)).rejects.toThrow('商品已不存在')
    await db.products.put({ id: 'product-1', name: '商品一' })
    await expect(linkProductToLocation('product-1', 'missing')).rejects.toThrow('地點已不存在')
    expect(await db.locationProducts.count()).toBe(0)
  })

  it('unlinks only the selected product and keeps the location available', async () => {
    await db.products.bulkAdd([{ id: 'product-1', name: '商品一' }, { id: 'product-2', name: '商品二' }])
    const location = await saveLocation({ name: '既有店' }, undefined, ['product-1', 'product-2'])
    expect(await unlinkProductFromLocation('product-1', location.id)).toBe(true)
    expect(await unlinkProductFromLocation('product-1', location.id)).toBe(false)
    expect(await listLocationsForProduct('product-1')).toEqual([])
    expect(await listProductIdsForLocation(location.id)).toEqual(['product-2'])
    expect((await listLocations())[0].productCount).toBe(1)
    expect(await db.products.get('product-1')).toBeTruthy()
    expect(await db.locations.get(location.id)).toBeTruthy()
  })

  it('stores purchase details on one relation without changing the location or other links', async () => {
    await db.products.bulkAdd([{ id: 'product-1', name: '商品一' }, { id: 'product-2', name: '商品二' }])
    const location = await saveLocation({ name: '既有店', notes: '地點備註' }, undefined, ['product-1', 'product-2'])
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual({ price: null, currency: '', notes: '' })
    await saveLocationPurchase('product-1', location.id, { price: '125.50', currency: 'jpy', notes: ' 二樓櫃檯 ' })
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual({ price: 125.5, currency: 'JPY', notes: '二樓櫃檯' })
    expect((await listLocationsForProduct('product-2'))[0].purchase).toEqual({ price: null, currency: '', notes: '' })
    expect((await listProductsForLocation(location.id)).map(product => [product.id, product.purchase])).toEqual([
      ['product-1', { price: 125.5, currency: 'JPY', notes: '二樓櫃檯' }],
      ['product-2', { price: null, currency: '', notes: '' }]
    ])
    expect((await db.locations.get(location.id)).notes).toBe('地點備註')
    await saveLocation({ name: '既有店', notes: '更新地點備註' }, location.id, ['product-1', 'product-2'])
    expect((await listLocationsForProduct('product-1'))[0].purchase.price).toBe(125.5)
    await saveLocationPurchase('product-1', location.id, { price: '', currency: 'TWD', notes: '先確認庫存' })
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual({ price: null, currency: '', notes: '先確認庫存' })
  })

  it('validates purchase details and requires an existing relation', async () => {
    await db.products.put({ id: 'product-1', name: '商品一' })
    const location = await createLocation({ name: '既有店' })
    await expect(saveLocationPurchase('product-1', location.id, { price: '12.345', currency: 'TWD' })).rejects.toThrow('價格')
    await expect(saveLocationPurchase('product-1', location.id, { price: '12', currency: 'NT' })).rejects.toThrow('幣別')
    await expect(saveLocationPurchase('product-1', location.id, { notes: 'x'.repeat(501) })).rejects.toThrow('購買備註')
    await expect(saveLocationPurchase('product-1', location.id, { price: '12', currency: 'TWD' })).rejects.toThrow('連結已不存在')
    expect(await db.locationProducts.count()).toBe(0)
  })

  it('accepts zero and the maximum price while rejecting values outside the supported range', async () => {
    await db.products.put({ id: 'product-1', name: '商品一' })
    const location = await saveLocation({ name: '既有店' }, undefined, ['product-1'])
    await saveLocationPurchase('product-1', location.id, { price: '0', currency: 'TWD' })
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual({ price: 0, currency: 'TWD', notes: '' })
    await saveLocationPurchase('product-1', location.id, { price: '999999999.99', currency: 'CHF', notes: 'x'.repeat(500) })
    const beforeInvalidInput = (await listLocationsForProduct('product-1'))[0].purchase
    expect(beforeInvalidInput).toEqual({ price: 999999999.99, currency: 'CHF', notes: 'x'.repeat(500) })
    for (const price of ['-1', '1.001', '1000000000', '1,000', '1e3']) {
      await expect(saveLocationPurchase('product-1', location.id, { price, currency: 'TWD' })).rejects.toThrow('價格')
    }
    await expect(saveLocationPurchase('product-1', location.id, { price: '1', currency: '' })).rejects.toThrow('幣別')
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual(beforeInvalidInput)
    await saveLocationPurchase('product-1', location.id, { price: ' ', currency: 'CHF', notes: ' ' })
    expect((await listLocationsForProduct('product-1'))[0].purchase).toEqual({ price: null, currency: '', notes: '' })
  })

  it('rejects missing product links without storing a location', async () => {
    await expect(saveLocation({ name: '商店' }, undefined, ['missing'])).rejects.toThrow('商品已不存在')
    expect(await listLocations()).toHaveLength(0)
    expect(await db.locationProducts.count()).toBe(0)
  })

  it('migrates existing v1 locations without losing them', async () => {
    await db.delete()
    const legacy = new Dexie('gullstuff')
    legacy.version(1).stores({
      products: 'id, name, category, createdAt, updatedAt',
      images: 'id',
      locations: 'id, name, country, city, updatedAt',
      locationProducts: 'id, productId, locationId, &[locationId+productId]'
    })
    await legacy.locations.add({ id: 'old-location', name: '舊地點', city: '東京' })
    await legacy.products.add({ id: 'old-product', name: '舊商品' })
    await legacy.locationProducts.add({ id: 'old-link', locationId: 'old-location', productId: 'old-product' })
    legacy.close()
    await db.open()
    const migrated = await db.locations.get('old-location')
    expect(migrated.name).toBe('舊地點')
    expect(migrated.area).toBe('')
    expect(migrated.createdAt).toBeTruthy()
    expect((await listLocations()).map(location => location.id)).toContain('old-location')
    expect(await db.products.get('old-product')).toBeTruthy()
    expect(await db.locationProducts.get('old-link')).toBeTruthy()
  })
})
