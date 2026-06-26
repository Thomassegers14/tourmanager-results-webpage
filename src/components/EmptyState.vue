<template>
  <div class="empty-state">
    <p class="empty-title">{{ title }}</p>
    <p v-if="message" class="empty-message">{{ message }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Nog geen data beschikbaar' },
  message: { type: String, default: '' },
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted-foreground);
}

.empty-title {
  font-weight: var(--font-weight-medium);
  margin: 0;
}

.empty-message {
  font-size: var(--text-sm);
  margin: 0;
}
</style>
