import { defineStore } from 'pinia'
import { EVENT_CONFIG } from '@/config.js'

export const useRankingStore = defineStore('ranking', {
  state: () => ({
    stages: [],
    rankings: [],
    selections: [],
    points: [],
    favorites: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchStages() {
      this.loading = true
      try {
        const url = `https://tourmanager-scraper.onrender.com/stages/${EVENT_CONFIG.event_id}/${EVENT_CONFIG.event_year}`
        const res = await fetch(url)
        this.stages = await res.json()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

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
    },

    async fetchPoints() {
      this.loading = true
      try {
        const url = `https://tourmanager-scraper.onrender.com/points/${EVENT_CONFIG.event_id}/${EVENT_CONFIG.event_year}`
        const res = await fetch(url)
        this.points = await res.json()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchFavorites() {
      this.loading = true
      try {
        const url = `https://tourmanager-scraper.onrender.com/startlist_favorites/${EVENT_CONFIG.event_id}/${EVENT_CONFIG.event_year}`
        const res = await fetch(url)
        this.favorites = await res.json()
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    }
  }
})
