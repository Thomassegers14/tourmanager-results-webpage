import { defineStore } from 'pinia'
import { EVENT_CONFIG } from '@/config.js'

export const useRankingStore = defineStore('ranking', {
  state: () => ({
    rankings: [],
    selections: [],   // ✅ nieuw stuk state
    loading: false,
    error: null,
  }),
  actions: {
    async fetchRankings() {
      this.loading = true
      try {
        const url = `https://tourmanager-scraper.onrender.com/ranking/${EVENT_CONFIG.event_id}/${EVENT_CONFIG.event_year}`
        const res = await fetch(url)
        this.rankings = await res.json()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchSelections() {
      this.loading = true
      try {
        const url = `https://tourmanager-scraper.onrender.com/selections/${EVENT_CONFIG.event_id}/${EVENT_CONFIG.event_year}`
        const res = await fetch(url)
        this.selections = await res.json()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    }
  }
})
