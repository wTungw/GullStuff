import Dexie from 'dexie'

// v1 already includes the independent Location and join stores. Only Product APIs are
// exposed in Phase 1; later phases can add indexes and fields through new versions.
export const db = new Dexie('gullstuff')
db.version(1).stores({
  products: 'id, name, category, createdAt, updatedAt',
  images: 'id',
  locations: 'id, name, country, city, updatedAt',
  locationProducts: 'id, productId, locationId, &[locationId+productId]'
})
