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
    // Clear the previous tour immediately so a stale tour never renders
    // while the new one is still loading.
    current.value = null
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
