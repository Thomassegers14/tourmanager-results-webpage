<template>
  <main>
    <h1>Selecties <span class="grey">{{ EVENT_CONFIG.event_id }} {{ EVENT_CONFIG.event_year }}</span></h1>
    <section>
      <h2 class="section-title">Geselecteerde renners per deelnemer</h2>
      <SankeyChart />
    </section>
  </main>
</template>

<script setup>
import { EVENT_CONFIG } from '@/config';
import SankeyChart from '../components/SankeyChart.vue';
</script>

<style>
</style>
