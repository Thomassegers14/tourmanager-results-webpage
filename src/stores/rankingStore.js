import { defineStore } from 'pinia'
import Papa from 'papaparse'
import { EVENT_CONFIG } from '@/config.js'

const GITHUB_RAW =
  'https://raw.githubusercontent.com/Thomassegers14/tourmanager-scraper/main/data/processed'

async function fetchCSV(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  return Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transform: (value) => (value === 'NaN' ? null : value),
  }).data
}

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
        const { event_id, event_year } = EVENT_CONFIG
        this.stages = await fetchCSV(
          `${GITHUB_RAW}/stages/stages_${event_id}_${event_year}.csv`,
        )
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchRankings() {
      this.loading = true
      try {
        const { event_id, event_year } = EVENT_CONFIG
        this.rankings = await fetchCSV(
          `${GITHUB_RAW}/ranking/ranking_by_stage_${event_id}_${event_year}.csv`,
        )
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchSelections() {
      this.loading = true
      try {
        const { event_id, event_year } = EVENT_CONFIG
        this.selections = await fetchCSV(
          `${GITHUB_RAW}/selections/selections_${event_id}_${event_year}.csv`,
        )
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchPoints() {
      this.loading = true
      try {
        const { event_id, event_year } = EVENT_CONFIG
        this.points = await fetchCSV(
          `${GITHUB_RAW}/points/rider_stage_summary_${event_id}_${event_year}.csv`,
        )
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    async fetchFavorites() {
      this.loading = true
      try {
        const { event_id, event_year } = EVENT_CONFIG
        this.favorites = await fetchCSV(
          `${GITHUB_RAW}/startlists_favorites/startlist_${event_id}_${event_year}.csv`,
        )
      } catch (err) {
        this.error = err
      } finally {
        this.loading = false
      }
    },
  },
})
