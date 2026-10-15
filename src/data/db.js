import Dexie from 'dexie'

// Keep upgrades additive so existing on-device collections remain available.
export const db = new Dexie('gullstuff')
db.version(1).stores({
  products: 'id, name, category, createdAt, updatedAt',
  images: 'id',
  locations: 'id, name, country, city, updatedAt',
  locationProducts: 'id, productId, locationId, &[locationId+productId]'
})
db.version(2).stores({
  locations: 'id, name, country, city, area, updatedAt'
}).upgrade(transaction => transaction.table('locations').toCollection().modify(location => {
  const now = new Date().toISOString()
  for (const field of ['country', 'city', 'area', 'address', 'notes']) {
    if (typeof location[field] !== 'string') location[field] = ''
  }
  location.createdAt ??= location.updatedAt ?? now
  location.updatedAt ??= location.createdAt
}))
