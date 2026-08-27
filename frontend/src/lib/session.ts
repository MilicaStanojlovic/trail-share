import type { Router } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBookingsStore } from '../stores/bookings'
import { useDashboardStore } from '../stores/dashboard'
import { useProfileStore } from '../stores/profile'
import { useRoutesStore } from '../stores/routes'
import { useToursStore } from '../stores/tours'
import { useToastStore } from '../stores/toast'

// Lives here rather than in AppLayout because the profile page is the only
// place that signs out now, and the layout no longer has a trigger of its own.
// The stores are resolved inside the call, not at module scope, so this file
// can be imported before Pinia is installed.
export async function signOut(router: Router): Promise<void> {
  useAuthStore().logout()
  // Sign-out is client-side, so Pinia state survives it. Per-user data has to
  // be dropped explicitly or the next account on this tab sees the previous
  // one's bookings, tours, routes, dashboard and profile until its own fetch
  // resolves.
  useBookingsStore().reset()
  useDashboardStore().reset()
  useProfileStore().reset()
  useRoutesStore().reset()
  useToursStore().reset()
  useToastStore().show('Signed out')
  await router.push('/auth')
}
