<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  date: string
}>()

const d = computed(() => new Date(props.date + 'T00:00:00'))

const month = computed(() =>
  d.value.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
)

const day = computed(() => d.value.getDate())
</script>

<template>
  <div class="date-badge">
    <div class="date-badge__month">{{ month }}</div>
    <div class="date-badge__day">{{ day }}</div>
  </div>
</template>

<style scoped>
.date-badge {
  width: 56px;
  text-align: center;
  padding: 8px 0;
  border-radius: 16px;
  background: var(--color-accent-2-200);
}

.date-badge__month {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.date-badge__day {
  font-family: var(--font-heading);
  font-size: 22px;
  line-height: 1;
}
</style>
