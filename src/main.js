import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme.css'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true })
createApp(App).mount('#app')
