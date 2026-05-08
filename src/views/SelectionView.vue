<template>
  <main>
    <h1>Selecties <span class="grey">{{ store.activeEvent.label }}</span></h1>
    <section>
      <h2 class="section-title">Geselecteerde renners per deelnemer</h2>
      <SankeyChart />
    </section>
    <section>
      <h2 class="section-title">Analyse selectie</h2>
      <p>Welke selectie zou het meeste punten hebben opgeleverd?</p>
      <DreamTeam />
    </section>
  </main>
</template>

<script setup>
import { useRankingStore } from '@/stores/rankingStore'
import SankeyChart from '../components/SankeyChart.vue'
import DreamTeam from '../components/DreamTeam.vue'

const store = useRankingStore()
</script>

<style>
</style>
