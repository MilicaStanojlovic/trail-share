import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import type { TrailRoute, Difficulty } from '../types/domain'

export const useRoutesStore = defineStore('routes', () => {
  const list = ref<TrailRoute[]>([])
  const current = ref<TrailRoute | null>(null)
  const filter = ref<Difficulty | 'All'>('All')
  const search = ref('')
  const loading = ref(false)

  // The total count of fetched routes, always — the Discover header subline
  // shows this number even while the user filters the list.
  const totalCount = computed(() => list.value.length)

  // Filtering is client-side because the catalog is fetched once and small
  // enough to keep in memory. This makes the filter controls feel instant
  // while the header count stays equal to the total fetched catalog size.
  const visibleRoutes = computed<TrailRoute[]>(() => {
    const term = search.value.trim().toLowerCase()
    return list.value.filter((route) => {
      const matchesFilter = filter.value === 'All' || route.difficulty === filter.value
      if (!matchesFilter) return false

      if (term === '') return true
      return (
        route.name.toLowerCase().includes(term) ||
        route.description.toLowerCase().includes(term)
      )
    })
  })

  async function fetchRoutes(): Promise<void> {
    loading.value = true
    try {
      list.value = await api.get<TrailRoute[]>('/routes')
    } finally {
      loading.value = false
    }
  }

  async function fetchRoute(id: string): Promise<void> {
    // Clear the previous route immediately so a stale route never renders
    // while the new one is still loading.
    current.value = null
    loading.value = true
    try {
      current.value = await api.get<TrailRoute>('/routes/' + id)
    } finally {
      loading.value = false
    }
  }

  return {
    list,
    current,
    filter,
    search,
    loading,
    totalCount,
    visibleRoutes,
    fetchRoutes,
    fetchRoute,
  }
})
