import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'
import { inject as injectAnalytics } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

injectAnalytics()
injectSpeedInsights()

// Pinia importeren en gebruiken
import { createPinia } from 'pinia'
const pinia = createPinia()

// Vue Router import (optioneel)
import router from './router'

const app = createApp(App)
app.use(pinia)   // ✅ Pinia koppelen voordat je stores gebruikt
app.use(router)  // router optioneel
app.mount('#app')
