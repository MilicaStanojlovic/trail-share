import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import DiscoverView from '@/views/DiscoverView.vue'
import RouteDetailView from '@/views/RouteDetailView.vue'
import DrawRouteView from '@/views/DrawRouteView.vue'
import AuthView from '@/views/AuthView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      // Child paths are written absolute so they resolve to exactly these URLs
      // and stay siblings — /routes/new must not be swallowed by /routes.
      children: [
        { path: '', redirect: '/routes' },
        { path: '/routes', name: 'routes', component: DiscoverView },
        { path: '/tours', name: 'tours', component: PlaceholderView },
        { path: '/my', name: 'my', component: PlaceholderView },
        {
          path: '/dashboard',
          name: 'dashboard',
          component: PlaceholderView,
          meta: { guideOnly: true },
        },
        { path: '/routes/new', name: 'draw', component: DrawRouteView },
        { path: '/routes/:id', name: 'route-detail', component: RouteDetailView },
      ],
    },
    {
      path: '/_kit',
      name: 'kit',
      component: () => import('@/views/KitView.vue'),
    },
    { path: '/auth', name: 'auth', component: AuthView },
  ],
})

router.beforeEach(async (to) => {
  // The kit showcase is a dev-only page and stays reachable signed out.
  if (to.name === 'kit') return true

  // Restore the session BEFORE any auth check: on a cold load the store has a
  // token from localStorage but user is still null, so checking first would
  // bounce a signed-in user to /auth on every refresh. restore() caches its
  // promise and never rejects on an ApiError, so this is cheap and safe.
  const auth = useAuthStore()
  await auth.restore()

  if (!auth.isAuthenticated) {
    // Returning a redirect to the route we are already on would loop forever.
    return to.name === 'auth' ? true : { name: 'auth' }
  }

  if (to.name === 'auth') return auth.isGuide ? '/dashboard' : '/routes'
  if (to.meta.guideOnly && !auth.isGuide) return '/routes'

  return true
})

export default router
