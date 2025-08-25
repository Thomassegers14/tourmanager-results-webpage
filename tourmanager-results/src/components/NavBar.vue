<template>
  <nav class="navbar">
    <router-link to="/" class="nav-link">Ranking</router-link>

    <router-link to="/selections" class="nav-link">
      Selecties
    </router-link>
  </nav>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
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
}

nav a {
  color: var(--primary);
  line-height: 48px;
}

a.router-link-exact-active {
  font-weight: var(--font-weight-bold);
  border-bottom: 2px solid var(--primary);
}
</style>