import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { db } from './db.js'
import { normalizeProductInput } from './products.js'
import { normalizeLocationInput, normalizePurchaseInput } from './locations.js'
import { identityPart, locationIdentity } from './identity.js'

// Pure backup core: archive build/parse, validation and atomic restore.
// No Capacitor, DOM or download logic lives here so the same module can be
// reused from web and native layers.

export const BACKUP_FORMAT = 'gullstuff-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const MAX_BACKUP_BYTES = 500 * 1024 * 1024

// Kept in sync with db.js (Dexie version 2) and package.json version.
const DB_SCHEMA_VERSION = 2
const APP_VERSION = '0.1.0'
const DEFAULT_IMAGE_TYPE = 'image/webp'
const MANIFEST_ENTRY = 'manifest.json'
const IMAGE_DIRECTORY = 'images'

const EXTENSION_BY_TYPE = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg'
}

const pad = value => String(value).padStart(2, '0')

function timestampLabel(date = new Date()) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${day}-${time}`
}

// Images are stored as WebP already, so we only need a short extension hint.
function extensionForType(type) {
  if (EXTENSION_BY_TYPE[type]) return EXTENSION_BY_TYPE[type]
  const subtype = (type.split('/')[1] ?? '').replace(/[^a-z0-9]/gi, '')
  return subtype || 'webp'
}

// Builds the zip container. Image entries are stored without deflate (level 0)
// because WebP/JPEG/PNG are already compressed; the manifest uses a normal
// level. Sync compression is fine for typical collections - switch to the async
// `zip`/`unzip` API if backups of very large libraries become common.
function buildArchive(manifest, imageFiles) {
  const files = {}
  for (const { path, bytes } of imageFiles) files[path] = [bytes, { level: 0 }]
  files[MANIFEST_ENTRY] = strToU8(JSON.stringify(manifest))
  return zipSync(files, { level: 6 })
}

// Serializes the whole database into a single zip byte array.
// Accepts an optional platform hint (defaults to 'web') so callers may record
// the originating environment; the core itself never inspects the platform.
export async function exportBackup({ platform = 'web' } = {}) {
  const [products, locations, locationProducts, imageRecords] = await Promise.all([
    db.products.toArray(),
    db.locations.toArray(),
    db.locationProducts.toArray(),
    db.images.toArray()
  ])

  const imageFiles = []
  const imageEntries = []
  for (const { id, blob } of imageRecords) {
    if (!blob) continue
    const type = blob.type || DEFAULT_IMAGE_TYPE
    const path = `${IMAGE_DIRECTORY}/${id}.${extensionForType(type)}`
    const bytes = new Uint8Array(await blob.arrayBuffer())
    imageFiles.push({ path, bytes })
    imageEntries.push({ id, path, type, bytes: bytes.length })
  }

  const manifest = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    dbSchemaVersion: DB_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    platform,
    counts: {
      products: products.length,
      images: imageEntries.length,
      locations: locations.length,
      locationProducts: locationProducts.length
    },
    products,
    locations,
    locationProducts,
    images: imageEntries
  }

  return {
    bytes: buildArchive(manifest, imageFiles),
    filename: `gullstuff-backup-${timestampLabel()}.gullstuff`,
    manifest
  }
}

// Validates a backup byte array without writing anything. Errors are collected
// across the whole file (two-phase: container/envelope, then records) so the
// caller can show every problem at once. `dataset` is only trustworthy when
// `ok` is true; `manifest` is the parsed manifest or null.
export function validateBackup(bytes) {
  const errors = []
  const warnings = []
  const dataset = { products: [], locations: [], locationProducts: [], images: [] }
  const fail = () => ({ ok: false, errors, warnings, dataset, manifest: null })

  // --- Phase 1: container integrity -----------------------------------------
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    errors.push('備份檔案是空的。')
    return fail()
  }
  if (bytes.length > MAX_BACKUP_BYTES) {
    errors.push('備份檔案超過 500 MB 上限。')
    return fail()
  }

  let entries
  try {
    entries = unzipSync(bytes)
  } catch {
    errors.push('無法讀取備份檔案，可能已損毀。')
    return fail()
  }

  const manifestBytes = entries[MANIFEST_ENTRY]
  if (!manifestBytes) {
    errors.push('備份缺少 manifest.json。')
    return fail()
  }

  let manifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes))
  } catch {
    errors.push('manifest.json 無法解析。')
    return fail()
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('manifest.json 內容格式錯誤。')
    return fail()
  }

  // --- Phase 2: envelope ----------------------------------------------------
  if (manifest.format !== BACKUP_FORMAT) errors.push('此檔案不是 GullStuff 備份。')
  if (!Number.isInteger(manifest.schemaVersion)) {
    errors.push('備份格式版本無效。')
  } else if (manifest.schemaVersion > BACKUP_SCHEMA_VERSION) {
    errors.push('此備份由較新版本建立，請更新 App。')
  }
  if (!Number.isInteger(manifest.dbSchemaVersion) || manifest.dbSchemaVersion > DB_SCHEMA_VERSION) {
    errors.push('此備份的資料庫版本不受支援。')
  }

  // --- Phase 3: per-record shape/type reuse existing normalizers ------------
  const rawProducts = Array.isArray(manifest.products) ? manifest.products : null
  if (!rawProducts) errors.push('備份缺少商品清單。')
  const products = []
  for (const [index, record] of (rawProducts ?? []).entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`第 ${index + 1} 筆商品格式錯誤。`)
      continue
    }
    if (typeof record.id !== 'string' || !record.id) {
      errors.push(`第 ${index + 1} 筆商品缺少有效 ID。`)
      continue
    }
    try {
      // Normalizer strips/validates the editable fields; metadata (id, image
      // reference, timestamps) is preserved from the file.
      products.push({ ...record, ...normalizeProductInput(record) })
    } catch (error) {
      errors.push(`第 ${index + 1} 筆商品無效：${error.message}`)
    }
  }

  const rawLocations = Array.isArray(manifest.locations) ? manifest.locations : null
  if (!rawLocations) errors.push('備份缺少地點清單。')
  const locations = []
  for (const [index, record] of (rawLocations ?? []).entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`第 ${index + 1} 筆地點格式錯誤。`)
      continue
    }
    if (typeof record.id !== 'string' || !record.id) {
      errors.push(`第 ${index + 1} 筆地點缺少有效 ID。`)
      continue
    }
    try {
      locations.push({ ...record, ...normalizeLocationInput(record) })
    } catch (error) {
      errors.push(`第 ${index + 1} 筆地點無效：${error.message}`)
    }
  }

  const rawRelations = Array.isArray(manifest.locationProducts) ? manifest.locationProducts : null
  if (!rawRelations) errors.push('備份缺少商品地點關聯清單。')
  const locationProducts = []
  for (const [index, record] of (rawRelations ?? []).entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`第 ${index + 1} 筆關聯格式錯誤。`)
      continue
    }
    if (typeof record.id !== 'string' || !record.id) {
      errors.push(`第 ${index + 1} 筆關聯缺少有效 ID。`)
      continue
    }
    if (typeof record.productId !== 'string' || !record.productId || typeof record.locationId !== 'string' || !record.locationId) {
      errors.push(`第 ${index + 1} 筆關聯缺少商品或地點。`)
      continue
    }
    try {
      locationProducts.push({ ...record, ...normalizePurchaseInput(record) })
    } catch (error) {
      errors.push(`第 ${index + 1} 筆關聯無效：${error.message}`)
    }
  }

  const rawImages = Array.isArray(manifest.images) ? manifest.images : null
  if (!rawImages) errors.push('備份缺少圖片清單。')
  const declaredImages = []
  const seenImageIds = new Set()
  for (const [index, entry] of (rawImages ?? []).entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.id !== 'string' || !entry.id || typeof entry.path !== 'string' || !entry.path) {
      errors.push(`第 ${index + 1} 筆圖片項目格式錯誤。`)
      continue
    }
    if (seenImageIds.has(entry.id)) {
      errors.push(`圖片 ID 重複：${entry.id}。`)
      continue
    }
    seenImageIds.add(entry.id)
    declaredImages.push(entry)
  }

  // --- Phase 4: ID uniqueness within each collection ------------------------
  const checkIds = (list, label) => {
    const seen = new Set()
    for (const record of list) {
      if (seen.has(record.id)) errors.push(`${label} ID 重複：${record.id}。`)
      seen.add(record.id)
    }
  }
  checkIds(products, '商品')
  checkIds(locations, '地點')
  checkIds(locationProducts, '關聯')

  // --- Phase 5: identity uniqueness -----------------------------------------
  const checkIdentity = (list, keyOf, label, describe) => {
    const seen = new Set()
    for (const record of list) {
      const key = keyOf(record)
      if (seen.has(key)) errors.push(`${label}重複：${describe(record)}。`)
      seen.add(key)
    }
  }
  checkIdentity(products, product => identityPart(product.name), '商品名稱', product => product.name)
  checkIdentity(locations, locationIdentity, '地點', location => location.name)

  // --- Phase 6: relation uniqueness (id handled above, plus pair) ------------
  const seenPairs = new Set()
  for (const relation of locationProducts) {
    const pair = `${relation.locationId}\u0000${relation.productId}`
    if (seenPairs.has(pair)) errors.push(`商品與地點的關聯重複：${relation.locationId}／${relation.productId}。`)
    seenPairs.add(pair)
  }

  // --- Phase 7: referential integrity ---------------------------------------
  const productIds = new Set(products.map(product => product.id))
  const locationIds = new Set(locations.map(location => location.id))
  for (const relation of locationProducts) {
    if (!productIds.has(relation.productId) || !locationIds.has(relation.locationId)) {
      errors.push(`關聯指向不存在的商品或地點：${relation.id}。`)
    }
  }

  // Images declared but missing from the zip are warned about and treated as
  // absent, so a product pointing at them falls back to no image.
  const availableImages = new Map()
  for (const entry of declaredImages) {
    const data = entries[entry.path]
    if (!data) {
      warnings.push(`備份中缺少圖片檔案：${entry.path}。`)
      continue
    }
    availableImages.set(entry.id, {
      id: entry.id,
      type: typeof entry.type === 'string' && entry.type ? entry.type : DEFAULT_IMAGE_TYPE,
      bytes: data
    })
  }

  const referencedImageIds = new Set()
  for (const product of products) {
    const reference = typeof product.imageReference === 'string' && product.imageReference ? product.imageReference : null
    if (reference && !availableImages.has(reference)) {
      // Missing image is not fatal: drop the reference so the product survives.
      warnings.push(`商品「${product.name}」的圖片不存在，已略過。`)
      product.imageReference = null
      continue
    }
    product.imageReference = reference
    if (reference) referencedImageIds.add(reference)
  }

  dataset.products = products
  dataset.locations = locations
  dataset.locationProducts = locationProducts
  dataset.images = [...availableImages.values()]
    .filter(image => referencedImageIds.has(image.id))
    .map(image => ({ id: image.id, blob: new Blob([image.bytes], { type: image.type }) }))

  return { ok: errors.length === 0, errors, warnings, dataset, manifest }
}

// Atomically replaces the current database with the backup contents.
// Replace-all is destructive by design (MVP): the current data is cleared first.
// Only Dexie operations run inside the transaction - all unzip/JSON/Blob work
// happens in validateBackup before the transaction opens. Awaiting a non-Dexie
// promise inside the transaction would let IndexedDB auto-commit and leave the
// database half-written.
export async function restoreBackup(bytes, { mode = 'replace' } = {}) {
  if (mode !== 'replace') throw new Error('目前僅支援完整還原模式。')

  const { ok, errors, warnings, dataset } = validateBackup(bytes)
  if (!ok) throw new Error(errors.join(' '))

  // Blobs were already built during validation; map to rows before the tx.
  const imageRows = dataset.images.map(({ id, blob }) => ({ id, blob }))

  await db.transaction('rw', db.products, db.images, db.locations, db.locationProducts, async () => {
    await Promise.all([
      db.products.clear(),
      db.images.clear(),
      db.locations.clear(),
      db.locationProducts.clear()
    ])
    if (imageRows.length) await db.images.bulkPut(imageRows)
    if (dataset.products.length) await db.products.bulkPut(dataset.products)
    if (dataset.locations.length) await db.locations.bulkPut(dataset.locations)
    if (dataset.locationProducts.length) await db.locationProducts.bulkPut(dataset.locationProducts)
  })

  return {
    restored: {
      products: dataset.products.length,
      images: imageRows.length,
      locations: dataset.locations.length,
      locationProducts: dataset.locationProducts.length
    },
    warnings
  }
}
