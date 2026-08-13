<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div v-if="toast.message" class="toast">
    <span class="toast__dot" />
    <span>{{ toast.message }}</span>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 32px;
  bottom: 28px;
  z-index: 950;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 22px;
  border-radius: 999px;
  background: var(--color-accent-2-800);
  color: var(--color-neutral-100);
  box-shadow: var(--shadow-lg);
  animation: ts-rise 0.25s ease both;
  font-size: 14px;
}

.toast__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-accent-2-300);
}
</style>
