<script setup lang="ts">
// Label-to-control association (for/id) is intentionally left to the caller,
// since the actual control is provided through the default slot.

defineProps<{
  label: string
  hint?: string
  error?: string
}>()
</script>

<template>
  <div class="field">
    <label>{{ label }}</label>
    <slot />
    <div v-if="hint" class="field__hint">{{ hint }}</div>
    <div v-if="error" class="field__error">{{ error }}</div>
  </div>
</template>

<style scoped>
.field__hint {
  margin-top: 5px;
  font-size: 11px;
  color: var(--color-accent-2-700);
}

.field__error {
  margin-top: 5px;
  font-size: 12px;
  color: var(--color-accent-700);
}
</style>
