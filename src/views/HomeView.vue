<template>
  <main>
    <h1>Resultaten <span class="grey">{{ store.activeEvent.label }}</span></h1>
    <p class="intro">
      Overzicht van de ranking na elke etappe.
    </p>
    <section>
      <h2 class="section-title">Ranking</h2>
      <Heatmap />
    </section>
    <section>
      <h2 class="section-title">Verdeling punten</h2>
      <PointsMultiples/>
    </section>
  </main>
</template>

<script setup>
import { useRankingStore } from '@/stores/rankingStore'
import Heatmap from '../components/Heatmap.vue'
import PointsMultiples from '../components/PointsMultiples.vue'

const store = useRankingStore()
</script>