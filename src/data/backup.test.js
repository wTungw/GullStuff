import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { saveProduct } from './products.js'
import { saveLocation, saveLocationPurchase } from './locations.js'
import { saveGroup } from './groups.js'
import { exportBackup, restoreBackup, validateBackup } from './backup.js'

beforeEach(async () => {
  await db.open()
  await Promise.all([db.products.clear(), db.images.clear(), db.locations.clear(), db.locationProducts.clear(), db.groups.clear(), db.groupProducts.clear()])
})
afterAll(async () => { await db.delete() })

// A minimal-but-real WebP header, so Blobs round-trip with the right MIME type
// and a non-zero byte length instead of a placeholder string.
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x00, 0x00, 0x00, 0x00
])
const webpBlob = () => new Blob([WEBP_BYTES], { type: 'image/webp' })

const ISO = '2026-01-01T00:00:00.000Z'

function productRecord(overrides = {}) {
  return {
    id: 'product-1', name: '商品一', brand: '', category: '', model: '', notes: '',
    imageReference: null, createdAt: ISO, updatedAt: ISO, ...overrides
  }
}
function locationRecord(overrides = {}) {
  return {
    id: 'location-1', name: '地點一', country: '', city: '', area: '', address: '', notes: '',
    createdAt: ISO, updatedAt: ISO, ...overrides
  }
}
function relationRecord(overrides = {}) {
  return {
    id: 'relation-1', locationId: 'location-1', productId: 'product-1',
    price: null, currency: '', notes: '', createdAt: ISO, ...overrides
  }
}

function makeManifest(overrides = {}) {
  return {
    format: 'gullstuff-backup',
    schemaVersion: 2,
    appVersion: '0.1.0',
    dbSchemaVersion: 3,
    createdAt: ISO,
    platform: 'web',
    counts: { products: 0, images: 0, locations: 0, locationProducts: 0, groups: 0, groupProducts: 0 },
    products: [],
    locations: [],
    locationProducts: [],
    groups: [],
    groupProducts: [],
    images: [],
    ...overrides
  }
}

// Packs a raw manifest (plus optional binary entries) into an archive the way
// exportBackup would, so negative cases exercise the exact shipping container.
function pack(manifest, extraFiles = {}) {
  return zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), ...extraFiles })
}

// Re-opens a real exported archive, lets the caller mutate the parsed manifest
// and entry map, then re-zips. Keeping the real image bytes avoids hand-built
// fixtures drifting from the production format.
function rebuild(bytes, mutate) {
  const entries = unzipSync(bytes)
  const manifest = JSON.parse(strFromU8(entries['manifest.json']))
  mutate(manifest, entries)
  entries['manifest.json'] = strToU8(JSON.stringify(manifest))
  return zipSync(entries)
}

const hasError = (result, fragment) => result.errors.some(error => error.includes(fragment))
const hasWarning = (result, fragment) => result.warnings.some(warning => warning.includes(fragment))

const snapshot = async () => ({
  products: await db.products.toArray(),
  locations: await db.locations.toArray(),
  locationProducts: await db.locationProducts.toArray(),
  groups: await db.groups.toArray(),
  groupProducts: await db.groupProducts.toArray(),
  images: await db.images.toArray()
})

describe('backup export, validation and restore', () => {
  it('round-trips groups and shared product memberships', async () => {
    const product = await saveProduct({ name: '同時收藏的商品' })
    const first = await saveGroup({ name: '旅行清單' }, undefined, [product.id])
    const second = await saveGroup({ name: '禮物清單' }, undefined, [product.id])
    const { bytes, manifest } = await exportBackup()
    expect(manifest.counts.groups).toBe(2)
    expect(manifest.counts.groupProducts).toBe(2)
    expect(validateBackup(bytes).ok).toBe(true)

    await db.groups.clear()
    await db.groupProducts.clear()
    await restoreBackup(bytes)
    expect((await db.groupProducts.where('productId').equals(product.id).toArray()).map(link => link.groupId).sort()).toEqual([first.id, second.id].sort())
  })

  it('accepts legacy backups without groups and rejects orphan group memberships', async () => {
    const legacy = pack(makeManifest({ schemaVersion: 1, dbSchemaVersion: 2, groups: undefined, groupProducts: undefined }))
    expect(validateBackup(legacy).ok).toBe(true)
    const invalid = pack(makeManifest({
      groups: [{ id: 'g1', name: '群組', notes: '', createdAt: ISO, updatedAt: ISO }],
      groupProducts: [{ id: 'gp1', groupId: 'g1', productId: 'missing', position: 0, createdAt: ISO }]
    }))
    const result = validateBackup(invalid)
    expect(result.ok).toBe(false)
    expect(hasError(result, '群組關聯指向不存在')).toBe(true)
  })

  it('round-trips products, images, locations and purchase-linked relations', async () => {
    const product = await saveProduct(
      { name: '旅行杯', brand: '品牌 A', category: '生活用品', model: '藍色', notes: '朋友推薦' },
      webpBlob()
    )
    const location = await saveLocation(
      { name: '松本清', country: '日本', city: '東京', address: '新宿 1-2-3' },
      undefined,
      [product.id]
    )
    await saveLocationPurchase(product.id, location.id, { price: '125.50', currency: 'jpy', notes: '二樓櫃檯' })

    const before = await snapshot()
    const { bytes, filename, manifest } = await exportBackup()

    expect(manifest.format).toBe('gullstuff-backup')
    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.dbSchemaVersion).toBe(3)
    expect(manifest.counts).toEqual({ products: 1, images: 1, locations: 1, locationProducts: 1, groups: 0, groupProducts: 0 })
    expect(filename).toMatch(/^gullstuff-backup-\d{8}-\d{6}\.gullstuff$/)
    expect(validateBackup(bytes).ok).toBe(true)

    // Records added after the export must be wiped, proving replace-all.
    await saveProduct({ name: '備份後新增商品' })
    await saveLocation({ name: '備份後新增地點' })

    const result = await restoreBackup(bytes)
    expect(result.restored).toEqual({ products: 1, images: 1, locations: 1, locationProducts: 1, groups: 0, groupProducts: 0 })
    expect(result.warnings).toEqual([])

    const after = await snapshot()
    expect(after.products).toEqual(before.products)
    expect(after.locations).toEqual(before.locations)
    expect(after.locationProducts).toEqual(before.locationProducts)

    // Metadata and the binary payload survive the trip intact.
    expect(after.products[0].createdAt).toBe(before.products[0].createdAt)
    expect(after.products[0].updatedAt).toBe(before.products[0].updatedAt)
    const image = await db.images.get(before.products[0].imageReference)
    expect(image.blob.type).toBe('image/webp')
    expect(image.blob.size).toBe(WEBP_BYTES.length)
  })

  it('rejects duplicate product names (normalized) without touching the database', async () => {
    await saveProduct({ name: '原有商品' })
    const bad = pack(makeManifest({
      products: [
        productRecord({ id: 'a', name: 'Travel Cup' }),
        productRecord({ id: 'b', name: '  travel   cup ' })
      ]
    }))

    const result = validateBackup(bad)
    expect(result.ok).toBe(false)
    expect(hasError(result, '商品名稱重複')).toBe(true)
    expect(hasError(result, 'travel')).toBe(true)

    await expect(restoreBackup(bad)).rejects.toThrow('商品名稱重複')
    expect(await db.products.count()).toBe(1)
    expect((await db.products.toArray())[0].name).toBe('原有商品')
  })

  it('rejects duplicate location identities', async () => {
    const result = validateBackup(pack(makeManifest({
      locations: [
        locationRecord({ id: 'l1', name: '松本清', country: '日本', city: '東京', address: '新宿 1-2-3' }),
        locationRecord({ id: 'l2', name: ' 松本清 ', country: '日本', city: '東京', address: '新宿 1-2-3 ' })
      ]
    })))

    expect(result.ok).toBe(false)
    expect(hasError(result, '地點重複')).toBe(true)
  })

  it('rejects duplicate relation ids and duplicate location/product pairs', async () => {
    const products = [productRecord({ id: 'p1', name: '商品一' }), productRecord({ id: 'p2', name: '商品二' })]
    const locations = [locationRecord({ id: 'l1', name: '地點一' })]

    const dupId = validateBackup(pack(makeManifest({
      products,
      locations,
      locationProducts: [
        relationRecord({ id: 'r1', productId: 'p1' }),
        relationRecord({ id: 'r1', productId: 'p2' })
      ]
    })))
    expect(dupId.ok).toBe(false)
    expect(hasError(dupId, '關聯 ID 重複')).toBe(true)

    const dupPair = validateBackup(pack(makeManifest({
      products,
      locations,
      locationProducts: [
        relationRecord({ id: 'r1', productId: 'p1' }),
        relationRecord({ id: 'r2', productId: 'p1' })
      ]
    })))
    expect(dupPair.ok).toBe(false)
    expect(hasError(dupPair, '關聯重複')).toBe(true)
  })

  it('rejects orphan relations and leaves the database untouched', async () => {
    const existing = await saveProduct({ name: '受保護商品' })
    const products = [productRecord({ id: 'p1', name: '商品一' })]
    const locations = [locationRecord({ id: 'l1', name: '地點一' })]

    const missingProduct = validateBackup(pack(makeManifest({
      products,
      locations,
      locationProducts: [relationRecord({ id: 'r1', locationId: 'l1', productId: 'missing' })]
    })))
    expect(missingProduct.ok).toBe(false)
    expect(hasError(missingProduct, '關聯指向不存在的商品或地點')).toBe(true)

    const missingLocation = validateBackup(pack(makeManifest({
      products,
      locations,
      locationProducts: [relationRecord({ id: 'r2', locationId: 'missing', productId: 'p1' })]
    })))
    expect(missingLocation.ok).toBe(false)
    expect(hasError(missingLocation, '關聯指向不存在的商品或地點')).toBe(true)

    const bad = pack(makeManifest({
      products,
      locations,
      locationProducts: [relationRecord({ id: 'r3', locationId: 'l1', productId: 'missing' })]
    }))
    await expect(restoreBackup(bad)).rejects.toThrow('關聯指向不存在的商品或地點')
    expect(await db.products.count()).toBe(1)
    expect((await db.products.get(existing.id)).name).toBe('受保護商品')
  })

  it('rejects duplicate ids inside a collection', async () => {
    const result = validateBackup(pack(makeManifest({
      products: [productRecord({ id: 'dup', name: '商品一' }), productRecord({ id: 'dup', name: '商品二' })]
    })))

    expect(result.ok).toBe(false)
    expect(hasError(result, '商品 ID 重複')).toBe(true)
  })

  it('rejects unsupported envelopes and unreadable containers', () => {
    const newer = validateBackup(pack(makeManifest({ schemaVersion: 999 })))
    expect(newer.ok).toBe(false)
    expect(hasError(newer, '較新版本')).toBe(true)

    const wrongFormat = validateBackup(pack(makeManifest({ format: 'something-else' })))
    expect(wrongFormat.ok).toBe(false)
    expect(hasError(wrongFormat, '不是 GullStuff 備份')).toBe(true)

    const noManifest = validateBackup(zipSync({ 'images/x.webp': strToU8('x') }))
    expect(noManifest.ok).toBe(false)
    expect(hasError(noManifest, '缺少 manifest.json')).toBe(true)

    const garbage = validateBackup(strToU8('this is definitely not a zip archive'))
    expect(garbage.ok).toBe(false)
    expect(hasError(garbage, '無法讀取備份檔案')).toBe(true)

    const empty = validateBackup(new Uint8Array(0))
    expect(empty.ok).toBe(false)
    expect(hasError(empty, '空的')).toBe(true)
  })

  it('drops a product image reference to a missing image with a warning', async () => {
    const product = await saveProduct({ name: '有圖商品' }, webpBlob())
    const { bytes, manifest } = await exportBackup()
    const missing = rebuild(bytes, (_manifest, entries) => { delete entries[manifest.images[0].path] })

    const result = validateBackup(missing)
    expect(result.ok).toBe(true)
    expect(hasWarning(result, '圖片不存在')).toBe(true)
    expect(result.dataset.products.find(item => item.id === product.id).imageReference).toBeNull()

    await restoreBackup(missing)
    const restored = await db.products.get(product.id)
    expect(restored).toBeTruthy()
    expect(restored.imageReference).toBeNull()
    expect(await db.images.count()).toBe(0)
  })

  it('does not import image entries that no product references', async () => {
    const { bytes } = await exportBackup()
    const orphan = rebuild(bytes, (manifest, entries) => {
      manifest.images.push({ id: 'orphan-image', path: 'images/orphan-image.webp', type: 'image/webp', bytes: 3 })
      entries['images/orphan-image.webp'] = strToU8('abc')
    })

    const result = validateBackup(orphan)
    expect(result.ok).toBe(true)
    expect(result.dataset.images).toHaveLength(0)

    await restoreBackup(orphan)
    expect(await db.images.count()).toBe(0)
  })

  it('exports and restores an empty dataset, replacing existing data', async () => {
    const { bytes, manifest } = await exportBackup()
    expect(manifest.counts).toEqual({ products: 0, images: 0, locations: 0, locationProducts: 0, groups: 0, groupProducts: 0 })
    expect(validateBackup(bytes).ok).toBe(true)

    await saveProduct({ name: '稍後新增' })
    await saveLocation({ name: '稍後地點' })
    await db.images.put({ id: 'later-image', blob: webpBlob() })

    const result = await restoreBackup(bytes)
    expect(result.restored).toEqual({ products: 0, images: 0, locations: 0, locationProducts: 0, groups: 0, groupProducts: 0 })
    expect(await db.products.count()).toBe(0)
    expect(await db.images.count()).toBe(0)
    expect(await db.locations.count()).toBe(0)
    expect(await db.locationProducts.count()).toBe(0)
  })

  it('reuses the products and relations field validators on backup records', () => {
    const longName = validateBackup(pack(makeManifest({
      products: [productRecord({ id: 'p1', name: 'x'.repeat(151) })]
    })))
    expect(longName.ok).toBe(false)
    expect(hasError(longName, '商品名稱最多 150 個字')).toBe(true)

    const badPrice = validateBackup(pack(makeManifest({
      products: [productRecord({ id: 'p1', name: '商品一' })],
      locations: [locationRecord({ id: 'l1', name: '地點一' })],
      locationProducts: [relationRecord({ id: 'r1', price: '12.345' })]
    })))
    expect(badPrice.ok).toBe(false)
    expect(hasError(badPrice, '價格')).toBe(true)
  })

  it('keeps the original database intact when a later record in the file is invalid', async () => {
    const product = await saveProduct({ name: '原商品' }, webpBlob())
    const location = await saveLocation({ name: '原地點', city: '東京' }, undefined, [product.id])
    const before = await snapshot()

    const bad = pack(makeManifest({
      products: [productRecord({ id: 'new-p1', name: '新商品' })],
      locations: [locationRecord({ id: 'new-l1', name: '新地點' })],
      locationProducts: [relationRecord({ id: 'new-r1', locationId: 'new-l1', productId: 'ghost' })]
    }))

    await expect(restoreBackup(bad)).rejects.toThrow('關聯指向不存在的商品或地點')

    const after = await snapshot()
    expect(after.products).toEqual(before.products)
    expect(after.locations).toEqual(before.locations)
    expect(after.locationProducts).toEqual(before.locationProducts)
    expect(after.images.map(image => image.id)).toEqual(before.images.map(image => image.id))
    expect(await db.products.get(product.id)).toBeTruthy()
    expect(await db.locations.get(location.id)).toBeTruthy()
  })

  it('refuses restore modes other than replace', async () => {
    const { bytes } = await exportBackup()
    await expect(restoreBackup(bytes, { mode: 'merge' })).rejects.toThrow('完整還原模式')
  })
})
