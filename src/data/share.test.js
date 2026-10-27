import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { exportBackup, exportShare, validateShare } from './backup.js'
import { importBackupAdditive, importShare, previewBackupAdditiveImport, previewShareImport } from './share.js'
import { saveProduct } from './products.js'
import { saveLocation, saveLocationPurchase } from './locations.js'
import { saveGroup } from './groups.js'

async function clearDatabase() {
  await Promise.all([db.products.clear(), db.images.clear(), db.locations.clear(), db.locationProducts.clear(), db.groups.clear(), db.groupProducts.clear()])
}
const mergeChoices = preview => Object.fromEntries(preview.conflicts.map(conflict => [
  `${conflict.type}:${conflict.sourceId}`, { action: 'merge', existingId: conflict.matches[0].id }
]))

beforeEach(async () => { await db.open(); await clearDatabase() })
afterAll(async () => { await db.delete() })

describe('sharing and additive import', () => {
  it('exports only the chosen entity and its required dependencies', async () => {
    const cup = await saveProduct({ name: '旅行杯' }, new Blob(['photo'], { type: 'image/webp' }))
    const bag = await saveProduct({ name: '背包' })
    const location = await saveLocation({ name: '商店' }, undefined, [cup.id])
    await saveLocationPurchase(cup.id, location.id, { price: '250', currency: 'TWD' })
    const group = await saveGroup({ name: '旅行', icon: 'plane' }, undefined, [bag.id, cup.id])

    const product = validateShare((await exportShare({ type: 'product', id: cup.id })).bytes)
    expect(product.ok).toBe(true)
    expect(product.dataset.products.map(item => item.id)).toEqual([cup.id])
    expect(product.dataset.images).toHaveLength(1)
    expect(product.dataset.locations).toHaveLength(0)
    expect(product.dataset.groups).toHaveLength(0)

    const place = validateShare((await exportShare({ type: 'location', id: location.id })).bytes)
    expect(place.ok).toBe(true)
    expect(place.dataset.products.map(item => item.id)).toEqual([cup.id])
    expect(place.dataset.locationProducts).toMatchObject([{ price: 250, currency: 'TWD' }])
    expect(place.dataset.groups).toHaveLength(0)

    const list = validateShare((await exportShare({ type: 'group', id: group.id })).bytes)
    expect(list.ok).toBe(true)
    expect(list.dataset.products.map(item => item.id).sort()).toEqual([bag.id, cup.id].sort())
    expect(list.dataset.groupProducts.map(item => item.position).sort()).toEqual([0, 1])
    expect(list.dataset.locations).toHaveLength(0)

    const all = validateShare((await exportShare({ type: 'all' })).bytes)
    expect(all.ok).toBe(true)
    expect(all.manifest.counts).toMatchObject({ products: 2, locations: 1, groups: 1, locationProducts: 1, groupProducts: 2 })
  })

  it('requires conflict decisions and merges only missing data and links', async () => {
    const cup = await saveProduct({ name: '旅行杯', notes: '來源備註' }, new Blob(['photo'], { type: 'image/webp' }))
    const bag = await saveProduct({ name: '背包' })
    const location = await saveLocation({ name: '商店' }, undefined, [cup.id, bag.id])
    const group = await saveGroup({ name: '旅行' }, undefined, [cup.id, bag.id])
    const { bytes } = await exportShare({ type: 'all' })

    await clearDatabase()
    const localCup = await saveProduct({ name: '旅行杯', notes: '本機內容' })
    const localGroup = await saveGroup({ name: '旅行', notes: '本機群組' }, undefined, [localCup.id])
    await db.products.add({ id: bag.id, name: '原有 ID 的其他商品', brand: '', category: '', model: '', notes: '保留', imageReference: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' })

    const preview = await previewShareImport(bytes)
    expect(preview.conflicts.map(item => item.type)).toEqual(['products', 'groups'])
    await expect(importShare(bytes)).rejects.toThrow('同名衝突')
    expect(await db.products.count()).toBe(2)
    const result = await importShare(bytes, { resolutions: mergeChoices(preview) })
    expect(result.added).toMatchObject({ products: 1, locations: 1, groups: 0, locationProducts: 2, groupProducts: 1, images: 1 })
    expect(result.merged).toMatchObject({ products: 1, groups: 1 })
    expect((await db.products.get(localCup.id)).notes).toBe('本機內容')
    expect((await db.products.get(bag.id)).name).toBe('原有 ID 的其他商品')
    expect((await db.groups.get(localGroup.id)).notes).toBe('本機群組')
    expect(await db.images.count()).toBe(1)
    const importedBag = (await db.products.toArray()).find(item => item.name === '背包')
    expect(importedBag.id).not.toBe(bag.id)
    const importedLocation = (await db.locations.toArray()).find(item => item.name === location.name)
    const links = await db.locationProducts.where('locationId').equals(importedLocation.id).toArray()
    expect(links.map(item => item.productId).sort()).toEqual([localCup.id, importedBag.id].sort())
    expect(await db.groupProducts.where('groupId').equals(localGroup.id).count()).toBe(2)

    const repeatPreview = await previewShareImport(bytes)
    const repeat = await importShare(bytes, { resolutions: mergeChoices(repeatPreview) })
    expect(repeat.added).toEqual({ products: 0, locations: 0, groups: 0, images: 0, locationProducts: 0, groupProducts: 0 })
    expect(await db.products.count()).toBe(3)
  })

  it('imports a group and image without replacing unrelated local records', async () => {
    const product = await saveProduct({ name: '相機' }, new Blob(['image'], { type: 'image/webp' }))
    const group = await saveGroup({ name: '攝影', icon: 'star' }, undefined, [product.id])
    const { bytes } = await exportShare({ type: 'group', id: group.id })
    await clearDatabase()
    await saveProduct({ name: '原有商品' })

    const result = await importShare(bytes)
    expect(result.added).toMatchObject({ products: 1, images: 1, groups: 1, groupProducts: 1 })
    expect(await db.products.count()).toBe(2)
    const imported = (await db.products.toArray()).find(item => item.name === '相機')
    expect((await db.images.get(imported.imageReference)).blob.size).toBe(5)
    expect((await db.groups.toArray())[0]).toMatchObject({ name: '攝影', icon: 'star' })
  })

  it('leaves an existing location and its purchase details untouched', async () => {
    const sourceProduct = await saveProduct({ name: '旅行杯', notes: '來源版本' })
    const sourceLocation = await saveLocation({ name: '商店', city: '東京' }, undefined, [sourceProduct.id])
    await saveLocationPurchase(sourceProduct.id, sourceLocation.id, { price: '300', currency: 'JPY', notes: '來源價格' })
    const { bytes } = await exportShare({ type: 'location', id: sourceLocation.id })
    await clearDatabase()

    const localProduct = await saveProduct({ name: '旅行杯', notes: '本機版本' })
    const localLocation = await saveLocation({ name: '商店', city: '東京', notes: '本機地點' }, undefined, [localProduct.id])
    await saveLocationPurchase(localProduct.id, localLocation.id, { price: '100', currency: 'JPY', notes: '本機價格' })
    const beforeLink = (await db.locationProducts.toArray())[0]

    const preview = await previewShareImport(bytes)
    expect(preview.conflicts.map(item => item.type)).toEqual(['products', 'locations'])
    const result = await importShare(bytes, { resolutions: mergeChoices(preview) })
    expect(result.added).toEqual({ products: 0, locations: 0, groups: 0, images: 0, locationProducts: 0, groupProducts: 0 })
    expect((await db.products.get(localProduct.id)).notes).toBe('本機版本')
    expect((await db.locations.get(localLocation.id)).notes).toBe('本機地點')
    expect(await db.locationProducts.toArray()).toEqual([beforeLink])
  })

  it('renames conflicting items and keeps both copies with their own links', async () => {
    const product = await saveProduct({ name: '杯子', notes: '分享版本' })
    const location = await saveLocation({ name: '商店', city: '台北' }, undefined, [product.id])
    const group = await saveGroup({ name: '收藏' }, undefined, [product.id])
    const { bytes } = await exportShare({ type: 'all' })
    await clearDatabase()
    const localProduct = await saveProduct({ name: '杯子', notes: '本機版本' })
    const localLocation = await saveLocation({ name: '商店', city: '台中' }, undefined, [localProduct.id])
    const localGroup = await saveGroup({ name: '收藏' }, undefined, [localProduct.id])
    const preview = await previewShareImport(bytes)
    expect(preview.conflicts).toHaveLength(3)
    const resolutions = Object.fromEntries(preview.conflicts.map(conflict => [
      `${conflict.type}:${conflict.sourceId}`, { action: 'rename', name: `${conflict.name} 分享版` }
    ]))
    const result = await importShare(bytes, { resolutions })
    expect(result.added).toMatchObject({ products: 1, locations: 1, groups: 1, locationProducts: 1, groupProducts: 1 })
    const importedProduct = (await db.products.toArray()).find(item => item.name === '杯子 分享版')
    const importedLocation = (await db.locations.toArray()).find(item => item.name === '商店 分享版')
    const importedGroup = (await db.groups.toArray()).find(item => item.name === '收藏 分享版')
    expect((await db.locationProducts.where('locationId').equals(importedLocation.id).first()).productId).toBe(importedProduct.id)
    expect((await db.groupProducts.where('groupId').equals(importedGroup.id).first()).productId).toBe(importedProduct.id)
    expect((await db.products.get(localProduct.id)).notes).toBe('本機版本')
    expect(await db.locationProducts.where('locationId').equals(localLocation.id).count()).toBe(1)
    expect(await db.groupProducts.where('groupId').equals(localGroup.id).count()).toBe(1)
  })

  it('rejects a new name that still collides without changing local data', async () => {
    const product = await saveProduct({ name: '杯子' })
    const { bytes } = await exportShare({ type: 'product', id: product.id })
    await clearDatabase()
    await saveProduct({ name: '杯子' })
    const preview = await previewShareImport(bytes)
    const key = `products:${preview.conflicts[0].sourceId}`
    await expect(importShare(bytes, { resolutions: { [key]: { action: 'rename', name: ' 杯子 ' } } })).rejects.toThrow('已存在')
    expect(await db.products.count()).toBe(1)
  })

  it('lets the user choose which same-name local location receives links', async () => {
    const product = await saveProduct({ name: '相機' })
    const source = await saveLocation({ name: '商店', city: '東京' }, undefined, [product.id])
    const { bytes } = await exportShare({ type: 'location', id: source.id })
    await clearDatabase()
    const first = await saveLocation({ name: '商店', city: '台北' })
    const second = await saveLocation({ name: '商店', city: '大阪' })
    const preview = await previewShareImport(bytes)
    expect(preview.conflicts[0].matches).toHaveLength(2)
    const key = `locations:${source.id}`
    await importShare(bytes, { resolutions: { [key]: { action: 'merge', existingId: second.id } } })
    expect(await db.locationProducts.where('locationId').equals(first.id).count()).toBe(0)
    expect(await db.locationProducts.where('locationId').equals(second.id).count()).toBe(1)
    expect((await db.locations.get(second.id)).city).toBe('大阪')
  })

  it('adds a backup without replacing local records and requires conflict choices', async () => {
    const sourceProduct = await saveProduct({ name: '杯子', brand: '來源品牌' })
    const sourceGroup = await saveGroup({ name: '旅行' }, undefined, [sourceProduct.id])
    const { bytes } = await exportBackup()
    await clearDatabase()
    const localProduct = await saveProduct({ name: '杯子', notes: '本機備註' })
    await saveProduct({ name: '本機限定' })
    const preview = await previewBackupAdditiveImport(bytes)
    expect(preview.title).toBe('備份資料')
    expect(preview.conflicts).toHaveLength(1)
    await expect(importBackupAdditive(bytes)).rejects.toThrow('同名衝突')
    const result = await importBackupAdditive(bytes, { resolutions: mergeChoices(preview) })
    expect(result.added).toMatchObject({ products: 0, groups: 1, groupProducts: 1 })
    expect((await db.products.get(localProduct.id))).toMatchObject({ brand: '來源品牌', notes: '本機備註' })
    expect(await db.products.count()).toBe(2)
    const importedGroup = (await db.groups.toArray()).find(group => group.name === sourceGroup.name)
    expect((await db.groupProducts.where('groupId').equals(importedGroup.id).first()).productId).toBe(localProduct.id)
    await expect(importShare(bytes)).rejects.toThrow('不是 GullStuff 分享檔')
  })

  it('rejects other files and leaves the collection unchanged', async () => {
    await saveProduct({ name: '保留' })
    await expect(importShare(new Uint8Array([1, 2, 3]))).rejects.toThrow()
    const backup = await exportBackup()
    await expect(importShare(backup.bytes)).rejects.toThrow('不是 GullStuff 分享檔')
    expect((await db.products.toArray()).map(item => item.name)).toEqual(['保留'])
  })
})
