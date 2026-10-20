const MAX_BYTES = 15 * 1024 * 1024
const MAX_SIDE = 1600

export async function prepareImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('請選擇圖片檔案。')
  if (file.size > MAX_BYTES) throw new Error('圖片不可超過 15 MB。')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob) throw new Error('圖片處理失敗。')
    return blob
  } catch {
    throw new Error('無法讀取這張圖片，請換一張試試。')
  } finally {
    bitmap?.close()
  }
}
