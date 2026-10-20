import { ref, watch, onUnmounted } from 'vue'
import { getImage } from '../data/products.js'

export function useImageUrl(imageReference) {
  const url = ref('')
  let current = ''
  watch(imageReference, async (id, _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    if (current) URL.revokeObjectURL(current)
    current = ''
    url.value = ''
    if (!id) return
    try {
      const blob = await getImage(id)
      if (!blob || cancelled) return
      current = URL.createObjectURL(blob)
      url.value = current
    } catch { /* missing image uses placeholder */ }
  }, { immediate: true })
  onUnmounted(() => { if (current) URL.revokeObjectURL(current) })
  return url
}
