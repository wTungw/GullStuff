import { ref, watch } from 'vue'

const THEME_KEY = 'gullstuff:theme'

function savedTheme() {
  try { return window.localStorage.getItem(THEME_KEY) === 'dark' }
  catch { return false }
}

export function useTheme() {
  const darkMode = ref(savedTheme())

  watch(darkMode, enabled => {
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', enabled ? '#1a2634' : '#f7f9fc')
    try { window.localStorage.setItem(THEME_KEY, enabled ? 'dark' : 'light') }
    catch { /* The visual preference still works when storage is unavailable. */ }
  }, { immediate: true })

  return { darkMode }
}
