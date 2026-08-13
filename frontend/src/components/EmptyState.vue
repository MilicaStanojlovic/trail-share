<script setup lang="ts">
import AppButton from './AppButton.vue'

interface Props {
  message: string
  ctaLabel?: string
  compact?: boolean
}

defineProps<Props>()
defineEmits<{
  cta: []
}>()
</script>

<template>
  <div
    class="empty-state"
    :style="
      compact
        ? {
            border: '1px dashed var(--color-divider)',
            borderRadius: '20px',
            padding: '18px',
            textAlign: 'left',
            fontSize: '13px',
          }
        : {
            border: '1px dashed var(--color-divider)',
            borderRadius: '24px',
            padding: '26px',
            textAlign: 'center',
          }
    "
  >
    <p
      :style="{
        fontSize: compact ? '13px' : '14px',
        opacity: 0.7,
        margin: 0,
      }"
    >
      {{ message }}
    </p>
    <AppButton v-if="ctaLabel" @click="$emit('cta')">{{ ctaLabel }}</AppButton>
  </div>
</template>

<style scoped>
.empty-state > * + * {
  margin-top: 12px;
}
</style>
