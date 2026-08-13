<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main style="padding: 26px 32px; text-align: center">
    <!-- The global h2 rule already supplies the heading font. -->
    <h2>{{ route.path }}</h2>
    <p class="text-muted">Coming in a later slice.</p>
  </main>
</template>
