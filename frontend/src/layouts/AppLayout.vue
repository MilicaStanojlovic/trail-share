<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useBookingsStore } from '@/stores/bookings'
import { useDashboardStore } from '@/stores/dashboard'
import { useRoutesStore } from '@/stores/routes'
import { useToursStore } from '@/stores/tours'

const auth = useAuthStore()
const toast = useToastStore()
const bookings = useBookingsStore()
const dashboard = useDashboardStore()
const routes = useRoutesStore()
const tours = useToursStore()
const router = useRouter()

async function onSignOut() {
  auth.logout()
  // Sign-out is client-side, so Pinia state survives it. Per-user data has to
  // be dropped explicitly or the next account on this tab sees the previous
  // one's bookings, tours, routes and dashboard until its own fetch resolves.
  bookings.reset()
  dashboard.reset()
  routes.reset()
  tours.reset()
  toast.show('Signed out')
  await router.push('/auth')
}
</script>

<template>
  <div>
    <!-- The router guard means this layout only renders for authenticated users,
         so the fallbacks are purely defensive. -->
    <AppNav
      :role="auth.user?.role ?? 'HIKER'"
      :user-name="auth.user?.displayName ?? ''"
      @sign-out="onSignOut"
    />
    <RouterView />
  </div>
</template>
