<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    coords: [number, number][]
    strokeWidth?: number
  }>(),
  {
    strokeWidth: 1.6,
  }
)

const points = computed(() => {
  if (props.coords.length === 0) return ''

  const la = props.coords.map((p) => p[0])
  const lo = props.coords.map((p) => p[1])

  const y0 = Math.min(...la)
  const y1 = Math.max(...la)
  const x0 = Math.min(...lo)
  const x1 = Math.max(...lo)

  const sx = x1 - x0 || 1
  const sy = y1 - y0 || 1

  return props.coords
    .map(
      (p) =>
        `${(14 + ((p[1] - x0) / sx) * 72).toFixed(1)},${(
          36 -
          ((p[0] - y0) / sy) * 28
        ).toFixed(1)}`
    )
    .join(' ')
})
</script>

<template>
  <svg
    class="route-sparkline"
    viewBox="0 0 100 44"
    preserveAspectRatio="none"
  >
    <polyline
      fill="none"
      stroke="var(--color-accent)"
      :stroke-width="strokeWidth"
      stroke-linejoin="round"
      stroke-linecap="round"
      :points="points"
    />
  </svg>
</template>

<style scoped>
.route-sparkline {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
