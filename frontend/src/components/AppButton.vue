<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost'
  block?: boolean
  type?: 'button' | 'submit'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  block: false,
  type: 'button',
})
</script>

<template>
  <button :type="type" :class="['btn', 'btn-' + variant, { 'btn-block': block }]">
    <slot />
  </button>
</template>
