<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    note?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  }
)

const tileStyle = computed(() => {
  const map = {
    sm: { borderRadius: '18px', padding: '14px 16px' },
    md: { borderRadius: '20px', padding: '14px 16px' },
    lg: { borderRadius: '24px', padding: '18px 20px' },
  }
  return {
    background: 'var(--color-surface)',
    ...map[props.size],
  }
})

const valueStyle = computed(() => {
  const map = {
    sm: { fontSize: '22px' },
    md: { fontSize: '22px' },
    lg: { fontSize: '30px' },
  }
  return {
    fontFamily: 'var(--font-heading)',
    ...map[props.size],
  }
})
</script>

<template>
  <div class="stat-tile" :style="tileStyle">
    <div class="stat-tile__label">{{ label }}</div>
    <div class="stat-tile__value" :style="valueStyle">{{ value }}</div>
    <div v-if="note" class="stat-tile__note">{{ note }}</div>
  </div>
</template>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-tile__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.55;
}

.stat-tile__note {
  font-size: 12px;
  color: var(--color-accent-2-700);
}
</style>
