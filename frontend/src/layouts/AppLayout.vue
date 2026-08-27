<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div>
    <!-- The router guard means this layout only renders for authenticated users,
         so the fallbacks are purely defensive. Sign-out lives on /profile, which
         the nav avatar links to — see lib/session.ts. -->
    <AppNav :role="auth.user?.role ?? 'HIKER'" :user-name="auth.user?.displayName ?? ''" />
    <RouterView />
  </div>
</template>
