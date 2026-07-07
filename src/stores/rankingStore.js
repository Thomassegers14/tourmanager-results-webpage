import { defineStore } from 'pinia'
import Papa from 'papaparse'
import { EVENTS } from '@/config.js'

const GITHUB_RAW =
  'https://raw.githubusercontent.com/Thomassegers14/tourmanager-scraper/main/data/processed'

const STORAGE_KEY = 'tourmanager_active_event'

// Lopende fetches per dataset, zodat gelijktijdige aanroepen niet dubbel downloaden
const inflight = {}

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
    transform: (value) => {
      if (value === 'NaN') return null
      if (value === 'True') return true
      if (value === 'False') return false
      return value
    },
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
    pending: 0,
    error: null,
  }),
  getters: {
    loading: (state) => state.pending > 0,
  },
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

    // Laadt een dataset één keer per event: setEvent() leegt de arrays,
    // waarna de eerstvolgende aanroep opnieuw fetcht. Gelijktijdige aanroepen
    // (meerdere componenten op één pagina) delen dezelfde request.
    async _load(key, url) {
      if (this[key].length) return
      if (inflight[key]) return inflight[key]
      this.pending++
      inflight[key] = (async () => {
        try {
          this[key] = await fetchCSV(url)
        } catch (err) {
          this.error = err
        } finally {
          this.pending--
          delete inflight[key]
        }
      })()
      return inflight[key]
    },

    async fetchStages() {
      const { event_id, event_year } = this.activeEvent
      await this._load('stages', `${GITHUB_RAW}/stages/stages_${event_id}_${event_year}.csv`)
    },

    async fetchRankings() {
      const { event_id, event_year } = this.activeEvent
      await this._load('rankings', `${GITHUB_RAW}/ranking/ranking_by_stage_${event_id}_${event_year}.csv`)
    },

    async fetchSelections() {
      const { event_id, event_year } = this.activeEvent
      await this._load('selections', `${GITHUB_RAW}/selections/selections_${event_id}_${event_year}.csv`)
    },

    async fetchPoints() {
      const { event_id, event_year } = this.activeEvent
      await this._load('points', `${GITHUB_RAW}/points/rider_stage_summary_${event_id}_${event_year}.csv`)
    },

    async fetchFavorites() {
      const { event_id, event_year } = this.activeEvent
      await this._load('favorites', `${GITHUB_RAW}/startlists_favorites/startlist_${event_id}_${event_year}.csv`)
    },
  },
})
