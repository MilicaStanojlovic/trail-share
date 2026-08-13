<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  booked: number
  capacity: number
}>()

const width = computed(() => {
  if (props.capacity === 0) return 0
  return Math.min(100, Math.round((props.booked / props.capacity) * 100))
})

const fillColor = computed(() =>
  props.booked >= props.capacity ? 'var(--color-accent)' : 'var(--color-accent-2)'
)
</script>

<template>
  <div class="capacity-bar">
    <div
      class="capacity-bar__fill"
      :style="{
        width: `${width}%`,
        background: fillColor,
      }"
    />
  </div>
</template>

<style scoped>
.capacity-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--color-neutral-300);
  overflow: hidden;
}

.capacity-bar__fill {
  height: 100%;
  border-radius: 999px;
}
</style>
