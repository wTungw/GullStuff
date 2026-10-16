// Capacitor (Android) implementation of the backup file adapter.
// Capacitor plugins are imported dynamically inside each function so the web
// build never statically depends on them and stays safe if they are absent.

import * as webAdapter from './webBackupFile.js'

// btoa() only accepts a binary string, and spreading a whole Array into
// String.fromCharCode overflows the call stack for large backups. Encode in
// fixed-size chunks instead.
const CHUNK_SIZE = 0x8000

function bytesToBase64(uint8) {
  let binary = ''
  for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export async function saveBackupFile(bytes, filename, mime) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    const data = bytesToBase64(bytes)

    // Documents is user-visible and preferred; scoped storage or missing
    // permissions can reject it, so we retry in the app's private Cache dir.
    let directory = Directory.Documents
    try {
      await Filesystem.writeFile({ path: filename, data, directory, recursive: true })
    } catch {
      directory = Directory.Cache
      await Filesystem.writeFile({ path: filename, data, directory, recursive: true })
    }

    const { uri } = await Filesystem.getUri({ path: filename, directory })
    // The system share sheet lets the user move the backup to Drive, email it
    // to themselves, or store it elsewhere.
    await Share.share({ title: 'GullStuff 備份', url: uri })
    return { shared: true }
  } catch {
    // Any native failure (missing plugin, denied permission) degrades to the
    // browser download path instead of silently losing the backup.
    return webAdapter.saveBackupFile(bytes, filename, mime)
  }
}

export async function readBackupFile() {
  // MVP: no native file-picker plugin yet. The Android WebView forwards a
  // hidden <input type="file"> to the system document picker, so the web
  // adapter already works here. A dedicated native picker plugin is a
  // possible later improvement.
  return webAdapter.readBackupFile()
}
