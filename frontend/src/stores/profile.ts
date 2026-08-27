import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import type { Profile } from '../types/domain'

export const useProfileStore = defineStore('profile', () => {
  const data = ref<Profile | null>(null)
  const loading = ref(false)

  // The whole payload is per-user. Same reason as the reset in stores/bookings.ts.
  function reset(): void {
    data.value = null
  }

  async function fetchProfile(): Promise<void> {
    loading.value = true
    try {
      data.value = await api.get<Profile>('/profile')
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    reset,
    fetchProfile,
  }
})
