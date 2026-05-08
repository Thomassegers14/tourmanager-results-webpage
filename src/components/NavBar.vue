<template>
  <nav class="navbar">
    <div class="nav-links">
      <router-link to="/" class="nav-link">Ranking</router-link>
      <router-link to="/selections" class="nav-link">Selecties</router-link>
      <router-link to="/performance" class="nav-link">Performance</router-link>
    </div>

    <select class="event-select" :value="store.activeEvent.event_id + store.activeEvent.event_year" @change="onEventChange">
      <option v-for="event in EVENTS" :key="event.event_id + event.event_year" :value="event.event_id + event.event_year">
        {{ event.label }}
      </option>
    </select>
  </nav>
</template>

<script setup>
import { useRankingStore } from '@/stores/rankingStore'
import { EVENTS } from '@/config'

const store = useRankingStore()

function onEventChange(e) {
  const selected = EVENTS.find(ev => ev.event_id + ev.event_year === e.target.value)
  if (selected) store.setEvent(selected)
}
</script>

<style scoped>
nav {
  height: 48px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: var(--background);
  color: var(--primary);
  border-bottom: 1px solid var(--border);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 11;
  padding: 0 1.5rem;
  box-sizing: border-box;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex: 1;
  justify-content: center;
}

nav a {
  color: var(--primary);
  line-height: 48px;
}

a.router-link-exact-active {
  font-weight: var(--font-weight-bold);
  border-bottom: 2px solid var(--primary);
}

.event-select {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  color: var(--primary);
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  outline: none;

  &:hover {
    border-color: var(--primary);
  }
}
</style>
