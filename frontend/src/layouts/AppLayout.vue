<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNav from '@/components/AppNav.vue'

// Auth wires this up in slice 2; for now the nav's defaults stand in for a
// signed-in user and signing out is a no-op.
function onSignOut() {}
</script>

<template>
  <div>
    <AppNav @sign-out="onSignOut" />
    <RouterView />
  </div>
</template>
