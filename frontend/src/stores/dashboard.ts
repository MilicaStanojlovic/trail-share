import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import type { GuideDashboard } from '../types/domain'

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref<GuideDashboard | null>(null)
  const loading = ref(false)

  // The whole payload is per-user. Same reason as the reset in stores/bookings.ts.
  function reset(): void {
    data.value = null
  }

  async function fetchDashboard(): Promise<void> {
    loading.value = true
    try {
      data.value = await api.get<GuideDashboard>('/guide/dashboard')
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    reset,
    fetchDashboard,
  }
})
