<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  size?: number
  bg?: 'neutral' | 'accent-2'
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  bg: 'neutral',
})

const initials = computed(() =>
  props.name
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join('')
    .toUpperCase(),
)

const background = computed(() => {
  switch (props.bg) {
    case 'accent-2':
      return 'var(--color-accent-2-300)'
    case 'neutral':
    default:
      return 'var(--color-neutral-300)'
  }
})

const fontSize = computed(() => {
  if (props.size <= 24) return '9px'
  if (props.size <= 34) return '12px'
  return '13px'
})

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 700,
  background: background.value,
  fontSize: fontSize.value,
}))
</script>

<template>
  <div :style="style">
    {{ initials }}
  </div>
</template>
