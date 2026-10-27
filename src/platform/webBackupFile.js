// Web (browser) implementation of the backup file adapter.
// Uses only standard browser APIs, so it is safe to import on any platform.
// On native it doubles as the fallback when Capacitor plugins are unavailable.

export async function saveBackupFile(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Some mobile browsers claim downloads asynchronously after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export async function readBackupFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.gullstuff,.zip,application/zip'
    input.style.display = 'none'

    let settled = false
    const cleanup = () => {
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      input.remove()
    }
    const finish = (value, error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(value)
    }

    const onChange = async () => {
      const file = input.files?.[0]
      if (!file) return finish(null)
      try {
        const buffer = await file.arrayBuffer()
        finish({ name: file.name, bytes: new Uint8Array(buffer) })
      } catch {
        try {
          const buffer = await new Promise((resolveRead, rejectRead) => {
            const reader = new FileReader()
            reader.onload = () => resolveRead(reader.result)
            reader.onerror = () => rejectRead(reader.error)
            reader.readAsArrayBuffer(file)
          })
          finish({ name: file.name, bytes: new Uint8Array(buffer) })
        } catch {
          finish(null, new Error(`無法讀取「${file.name}」。請確認檔案已完整下載，並選擇 .gullstuff 原始檔。`))
        }
      }
    }
    // Modern browsers fire 'cancel' when the picker is dismissed with no file.
    const onCancel = () => finish(null)

    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    document.body.appendChild(input)
    input.click()
  })
}
