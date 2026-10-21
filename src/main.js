import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme.css'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import { requestPersistentStorage } from './platform/persistentStorage.js'

if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
  void requestPersistentStorage()
}
createApp(App).mount('#app')
