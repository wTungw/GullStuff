import { db } from './db.js'
import { identityPart } from './identity.js'
import { normalizeProductInput } from './products.js'
import { normalizeLocationInput } from './locations.js'
import { normalizeGroupInput } from './groups.js'
import { validateBackup, validateShare } from './backup.js'

const entityTypes = ['products', 'locations', 'groups']
const emptyCounts = () => ({ products: 0, locations: 0, groups: 0, images: 0, locationProducts: 0, groupProducts: 0 })
const conflictKey = (type, id) => `${type}:${id}`

function validatedDataset(bytes, format) {
  const validation = format === 'backup' ? validateBackup(bytes) : validateShare(bytes)
  if (!validation.ok) throw new Error(validation.errors.join(' '))
  return validation
}

async function readExisting() {
  const [products, locations, groups, locationProducts, groupProducts] = await Promise.all([
    db.products.toArray(), db.locations.toArray(), db.groups.toArray(),
    db.locationProducts.toArray(), db.groupProducts.toArray()
  ])
  return { products, locations, groups, locationProducts, groupProducts }
}

function findConflicts(dataset, existing) {
  return entityTypes.flatMap(type => dataset[type].flatMap(source => {
    const matches = existing[type].filter(item => identityPart(item.name) === identityPart(source.name))
    return matches.length ? [{ type, sourceId: source.id, name: source.name, matches: matches.map(item => ({
      id: item.id, name: item.name,
      detail: type === 'locations' ? [item.country, item.city, item.address].filter(Boolean).join(' · ') : ''
    })) }] : []
  }))
}

function renamedRecord(type, source, name) {
  const fields = type === 'products' ? normalizeProductInput({ ...source, name })
    : type === 'locations' ? normalizeLocationInput({ ...source, name })
      : normalizeGroupInput({ ...source, name })
  return { ...source, ...fields }
}

function fillEmpty(local, source, fields) {
  const patch = {}
  for (const field of fields) {
    if (!local[field] && source[field]) patch[field] = source[field]
  }
  return patch
}

function planImport(dataset, existing, resolutions) {
  const conflicts = findConflicts(dataset, existing)
  const conflictMap = new Map(conflicts.map(item => [conflictKey(item.type, item.sourceId), item]))
  const usedNames = Object.fromEntries(entityTypes.map(type => [type, new Set([
    ...existing[type].map(item => identityPart(item.name)),
    ...dataset[type].map(item => identityPart(item.name))
  ])]))
  const added = emptyCounts()
  const skipped = emptyCounts()
  const merged = { products: 0, locations: 0, groups: 0 }
  const now = new Date().toISOString()
  const rows = { products: [], locations: [], groups: [], images: [], locationProducts: [], groupProducts: [] }
  const updates = { products: [], locations: [], groups: [] }
  const sourceImages = new Map(dataset.images.map(image => [image.id, image.blob]))
  const mappedIds = Object.fromEntries(entityTypes.map(type => [type, new Map()]))

  for (const type of entityTypes) {
    for (const source of dataset[type]) {
      const conflict = conflictMap.get(conflictKey(type, source.id))
      const choice = conflict && resolutions?.[conflictKey(type, source.id)]
      if (conflict && !['merge', 'rename'].includes(choice?.action)) {
        throw new Error(`請先處理「${source.name}」的同名衝突。`)
      }
      if (choice?.action === 'merge') {
        const target = existing[type].find(item => item.id === choice.existingId && conflict.matches.some(match => match.id === item.id))
        if (!target) throw new Error(`「${source.name}」的合併對象已不存在，請重新選擇。`)
        mappedIds[type].set(source.id, target.id)
        const fields = type === 'products' ? ['brand', 'category', 'model', 'notes']
          : type === 'locations' ? ['country', 'city', 'area', 'address', 'notes'] : ['notes']
        const patch = fillEmpty(target, source, fields)
        if (type === 'products' && !target.imageReference && sourceImages.has(source.imageReference)) {
          patch.imageReference = crypto.randomUUID()
          rows.images.push({ id: patch.imageReference, blob: sourceImages.get(source.imageReference) })
          added.images++
        }
        if (Object.keys(patch).length) {
          updates[type].push({ id: target.id, patch: { ...patch, updatedAt: now } })
          Object.assign(target, patch)
        }
        merged[type]++
        continue
      }
      let record = source
      if (choice?.action === 'rename') {
        record = renamedRecord(type, source, choice.name)
        const key = identityPart(record.name)
        if (usedNames[type].has(key)) throw new Error(`「${record.name}」已存在，請為「${source.name}」輸入不同的新名稱。`)
        usedNames[type].add(key)
      }
      const id = crypto.randomUUID()
      mappedIds[type].set(source.id, id)
      if (type === 'products') {
        const image = sourceImages.get(source.imageReference)
        const imageReference = image ? crypto.randomUUID() : null
        if (imageReference) { rows.images.push({ id: imageReference, blob: image }); added.images++ }
        rows.products.push({ ...record, id, imageReference, createdAt: now, updatedAt: now })
      } else rows[type].push({ ...record, id, createdAt: now, updatedAt: now })
      added[type]++
    }
  }

  const existingLocationPairs = new Set(existing.locationProducts.map(link => `${link.locationId}\u0000${link.productId}`))
  for (const link of dataset.locationProducts) {
    const locationId = mappedIds.locations.get(link.locationId)
    const productId = mappedIds.products.get(link.productId)
    const pair = `${locationId}\u0000${productId}`
    if (existingLocationPairs.has(pair)) { skipped.locationProducts++; continue }
    existingLocationPairs.add(pair)
    rows.locationProducts.push({ ...link, id: crypto.randomUUID(), locationId, productId, createdAt: now, updatedAt: now })
    added.locationProducts++
  }
  const existingGroupPairs = new Set(existing.groupProducts.map(link => `${link.groupId}\u0000${link.productId}`))
  const nextGroupPosition = new Map()
  for (const link of existing.groupProducts) nextGroupPosition.set(link.groupId, Math.max(nextGroupPosition.get(link.groupId) ?? 0, link.position + 1))
  for (const link of dataset.groupProducts) {
    const groupId = mappedIds.groups.get(link.groupId)
    const productId = mappedIds.products.get(link.productId)
    const pair = `${groupId}\u0000${productId}`
    if (existingGroupPairs.has(pair)) { skipped.groupProducts++; continue }
    existingGroupPairs.add(pair)
    const position = nextGroupPosition.get(groupId) ?? 0
    nextGroupPosition.set(groupId, position + 1)
    rows.groupProducts.push({ ...link, id: crypto.randomUUID(), groupId, productId, position, createdAt: now })
    added.groupProducts++
  }
  return { rows, updates, added, skipped, merged }
}

async function previewAdditiveImport(bytes, format) {
  const validation = validatedDataset(bytes, format)
  const existing = await readExisting()
  const conflicts = findConflicts(validation.dataset, existing)
  const plan = conflicts.length ? null : planImport(validation.dataset, existing, {})
  const scope = validation.manifest.scope
  const title = format === 'backup' ? '備份資料'
    : scope.type === 'product' ? validation.dataset.products[0].name
      : scope.type === 'location' ? validation.dataset.locations[0].name
        : scope.type === 'group' ? validation.dataset.groups[0].name : '所有資料'
  return { added: plan?.added ?? null, skipped: plan?.skipped ?? null, conflicts, warnings: validation.warnings, scope, title }
}

export const previewShareImport = bytes => previewAdditiveImport(bytes, 'share')
export const previewBackupAdditiveImport = bytes => previewAdditiveImport(bytes, 'backup')

async function importAdditive(bytes, format, { resolutions = {} } = {}) {
  const validation = validatedDataset(bytes, format)
  const result = await db.transaction('rw', db.products, db.locations, db.groups, db.images, db.locationProducts, db.groupProducts, async () => {
    const existing = await readExisting()
    const plan = planImport(validation.dataset, existing, resolutions)
    for (const name of ['images', 'products', 'locations', 'groups', 'locationProducts', 'groupProducts']) {
      if (plan.rows[name].length) await db[name].bulkAdd(plan.rows[name])
    }
    for (const type of entityTypes) {
      for (const update of plan.updates[type]) await db[type].update(update.id, update.patch)
    }
    return { added: plan.added, skipped: plan.skipped, merged: plan.merged }
  })
  return { ...result, warnings: validation.warnings }
}

export const importShare = (bytes, options) => importAdditive(bytes, 'share', options)
export const importBackupAdditive = (bytes, options) => importAdditive(bytes, 'backup', options)
