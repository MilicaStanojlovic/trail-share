<script setup lang="ts">
import { useId } from 'vue'

interface Option {
  label: string
  value: string
}

const props = defineProps<{
  options: Option[]
  modelValue: string
  block?: boolean
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
  <div class="seg" :class="{ 'seg--block': props.block }">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="seg-opt"
      style="white-space: nowrap"
    >
      <input
        type="radio"
        :name="name"
        :value="opt.value"
        :checked="opt.value === modelValue"
        @change="select(opt.value)"
      />
      {{ opt.label }}
    </label>
  </div>
</template>

<style scoped>
.seg--block {
  display: flex;
  width: 100%;
}

.seg--block .seg-opt {
  flex: 1;
  justify-content: center;
}
</style>
