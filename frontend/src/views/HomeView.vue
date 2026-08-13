<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '@/lib/api'

const backendStatus = ref<string>('checking…')

onMounted(async () => {
  try {
    const health = await api.get<{ status: string }>('/health')
    backendStatus.value = health.status
  } catch (error) {
    backendStatus.value = error instanceof ApiError ? `error (${error.status})` : 'unreachable'
  }
})
</script>

<template>
  <main class="shell">
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <span class="wordmark">TrailShare</span>
    </div>
    <h1>Draw the trail. Bring people along.</h1>
    <p class="text-muted">
      Scaffold is up. Screens are built from the TrailShare design, one feature at a time.
    </p>
    <p class="card-meta">Backend health: {{ backendStatus }}</p>
  </main>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  max-width: 640px;
  margin: 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mark {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--color-accent-2);
  box-shadow: inset -7px -7px 0 var(--color-accent);
}

.wordmark {
  font-family: var(--font-heading);
  font-size: 21px;
}
</style>
