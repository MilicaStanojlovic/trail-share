<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

interface Props {
  open: boolean
  title: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown)
    } else {
      window.removeEventListener('keydown', onKeyDown)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop"
      style="z-index: 900"
      @click.self="$emit('close')"
    >
      <div class="dialog" style="animation: ts-pop 0.2s ease both">
        <div class="dialog-title">{{ title }}</div>
        <slot />
        <div v-if="$slots.actions" class="dialog-actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
