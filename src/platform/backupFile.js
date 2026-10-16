// Selects the backup file adapter for the current platform.
// Web and native implementations share the same interface:
//   readBackupFile() -> { name, bytes: Uint8Array } | null
//   saveBackupFile(bytes, filename, mime) -> void | { shared: true }

import { Capacitor } from '@capacitor/core'
import * as webAdapter from './webBackupFile.js'
import * as nativeAdapter from './nativeBackupFile.js'

export function getBackupFileAdapter() {
  return Capacitor.isNativePlatform() ? nativeAdapter : webAdapter
}

export function readBackupFile() {
  return getBackupFileAdapter().readBackupFile()
}

export function saveBackupFile(bytes, filename, mime) {
  return getBackupFileAdapter().saveBackupFile(bytes, filename, mime)
}

export { webAdapter as webBackupFile, nativeAdapter as nativeBackupFile }
