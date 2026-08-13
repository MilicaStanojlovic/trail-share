<script setup lang="ts">
import type { TagVariant } from '@/types/ui'

interface Props {
  variant?: TagVariant
}

withDefaults(defineProps<Props>(), {
  variant: 'neutral',
})
</script>

<template>
  <span :class="['tag', 'tag-' + variant]">
    <slot />
  </span>
</template>
