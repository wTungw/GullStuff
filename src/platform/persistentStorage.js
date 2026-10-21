export async function getPersistentStorageStatus() {
  if (!navigator.storage?.persisted) return 'unsupported'

  try {
    return await navigator.storage.persisted() ? 'granted' : 'not-granted'
  } catch {
    return 'unavailable'
  }
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return 'unsupported'

  try {
    return await navigator.storage.persist() ? 'granted' : 'not-granted'
  } catch {
    return 'unavailable'
  }
}
