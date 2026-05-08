<template>
  <main>
    <h1>Performance <span class="grey">{{ store.activeEvent.label }}</span></h1>
    <section>
      <h2 class="section-title">Analyse performance</h2>
      <p>Welke renners presteren boven of onder de verwachting?</p>
      <RiderScatter />
    </section>
  </main>
</template>

<script setup>
import { useRankingStore } from '@/stores/rankingStore'
import RiderScatter from '../components/RiderScatter.vue'

const store = useRankingStore()
</script>

<style>
</style>
