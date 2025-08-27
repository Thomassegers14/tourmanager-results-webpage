<template>
  <main>
    <h1>Performance <span class="grey">{{ EVENT_CONFIG.event_id }} {{ EVENT_CONFIG.event_year }}</span></h1>
    <section>
      <h2 class="section-title">Analyse performance</h2>
      <p>Welke renners presteren boven of onder de verwachting?</p>
      <RiderScatter />
    </section>
  </main>
</template>

<script setup>
import { EVENT_CONFIG } from '@/config';
import RiderScatter from '../components/RiderScatter.vue';
</script>

<style>
</style>
