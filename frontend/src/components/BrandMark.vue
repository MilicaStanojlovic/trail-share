<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
})

const style = computed(() => {
  const inset = props.size <= 24 ? 6 : 7
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    borderRadius: '999px',
    background: 'var(--color-accent-2)',
    boxShadow: `inset -${inset}px -${inset}px 0 var(--color-accent)`,
  }
})
</script>

<template>
  <div aria-hidden="true" :style="style" />
</template>
