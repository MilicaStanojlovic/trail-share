import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import type { Tour, CreateTourPayload } from '../types/domain'

export const useToursStore = defineStore('tours', () => {
  const list = ref<Tour[]>([])
  const current = ref<Tour | null>(null)
  const routeTours = ref<Tour[]>([])
  const loading = ref(false)

  async function fetchTours(): Promise<void> {
    loading.value = true
    try {
      list.value = await api.get<Tour[]>('/tours')
    } finally {
      loading.value = false
    }
  }

  async function fetchTour(id: string): Promise<void> {
    // Clear only when switching to a different tour, so a stale one never
    // renders while the new one loads. Refreshing the tour already on screen
    // must not blank it: the detail view is behind a v-if on this value, so
    // nulling it would unmount the page and re-initialise Leaflet mid-request,
    // which is what a booking or a dismissed dialog triggers.
    if (current.value?.id !== id) {
      current.value = null
    }
    loading.value = true
    try {
      current.value = await api.get<Tour>('/tours/' + id)
    } finally {
      loading.value = false
    }
  }

  async function fetchRouteTours(routeId: string): Promise<void> {
    loading.value = true
    try {
      routeTours.value = await api.get<Tour[]>('/routes/' + routeId + '/tours')
    } finally {
      loading.value = false
    }
  }

  // Errors are intentionally left to bubble up so the calling dialog can
  // show validation feedback and keep the form state intact.
  async function scheduleTour(routeId: string, payload: CreateTourPayload): Promise<Tour> {
    const tour = await api.post<Tour>('/routes/' + routeId + '/tours', payload)
    return tour
  }

  return {
    list,
    current,
    routeTours,
    loading,
    fetchTours,
    fetchTour,
    fetchRouteTours,
    scheduleTour,
  }
})
