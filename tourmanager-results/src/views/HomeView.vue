<template>
  <main>
    <h1>Resultaten <span class="grey">{{ EVENT_CONFIG.event_id }} {{ EVENT_CONFIG.event_year }}</span></h1>
    <p class="intro">
      Overzicht van de ranking na elke etappe.
    </p>
    <section>
      <h2 class="section-title">Ranking</h2>
      <Heatmap />
    </section>
    <section>
      <h2 class="section-title">Analyse</h2>
      <p>Coming soon!</p>
    </section>
  </main>
</template>

<script setup>
import { EVENT_CONFIG } from '@/config';
import Heatmap from '../components/Heatmap.vue'
</script>