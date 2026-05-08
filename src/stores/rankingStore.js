import { defineStore } from 'pinia'
import Papa from 'papaparse'
import { EVENTS } from '@/config.js'

const GITHUB_RAW =
  'https://raw.githubusercontent.com/Thomassegers14/tourmanager-scraper/main/data/processed'

const STORAGE_KEY = 'tourmanager_active_event'

function loadActiveEvent() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return EVENTS.find(e => e.event_id === parsed.event_id && e.event_year === parsed.event_year) || EVENTS[0]
    }
  } catch {}
  return EVENTS[0]
}

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
    activeEvent: loadActiveEvent(),
    stages: [],
    rankings: [],
    selections: [],
    points: [],
    favorites: [],
    loading: false,
    error: null,
  }),
  actions: {
    setEvent(event) {
      this.activeEvent = event
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event))
      this.stages = []
      this.rankings = []
      this.selections = []
      this.points = []
      this.favorites = []
      this.fetchAll()
    },

    async fetchAll() {
      await Promise.all([
        this.fetchStages(),
        this.fetchRankings(),
        this.fetchSelections(),
        this.fetchPoints(),
        this.fetchFavorites(),
      ])
    },

    async fetchStages() {
      this.loading = true
      try {
        const { event_id, event_year } = this.activeEvent
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
        const { event_id, event_year } = this.activeEvent
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
        const { event_id, event_year } = this.activeEvent
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
        const { event_id, event_year } = this.activeEvent
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
        const { event_id, event_year } = this.activeEvent
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
