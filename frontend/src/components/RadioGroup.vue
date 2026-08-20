<script setup lang="ts">
import { useId } from 'vue'

interface Option {
  label: string
  value: string
}

defineProps<{
  options: Option[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const name = useId()

function select(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="radio-group">
    <label v-for="opt in options" :key="opt.value" class="radio">
      <input
        type="radio"
        :name="name"
        :value="opt.value"
        :checked="opt.value === modelValue"
        @change="select(opt.value)"
      />
      <span class="dot"></span>
      {{ opt.label }}
    </label>
  </div>
</template>

<style scoped>
.radio-group {
  display: flex;
  gap: 18px;
}
</style>
