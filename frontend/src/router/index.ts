import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'

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
        { path: '/routes', name: 'routes', component: PlaceholderView },
        { path: '/tours', name: 'tours', component: PlaceholderView },
        { path: '/my', name: 'my', component: PlaceholderView },
        { path: '/dashboard', name: 'dashboard', component: PlaceholderView },
        { path: '/routes/new', name: 'draw', component: PlaceholderView },
      ],
    },
    {
      path: '/_kit',
      name: 'kit',
      component: () => import('@/views/KitView.vue'),
    },
  ],
})

export default router
