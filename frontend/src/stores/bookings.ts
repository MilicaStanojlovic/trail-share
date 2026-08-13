import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import type { Booking } from '../types/domain'

export const useBookingsStore = defineStore('bookings', () => {
  const mine = ref<Booking[]>([])

  /**
   * Pinia stores outlive a sign-out, which is client-side only. Without this
   * the next account to sign in on the same tab sees the previous hiker's
   * bookings painted for one frame before their own fetch resolves.
   */
  function reset(): void {
    mine.value = []
  }
  const loading = ref(false)

  async function fetchMine(): Promise<void> {
    loading.value = true
    try {
      mine.value = await api.get<Booking[]>('/bookings/mine')
    } finally {
      loading.value = false
    }
  }

  // Errors are intentionally left to bubble up so the calling dialog can
  // toast the server message and close.
  async function bookSeat(tourId: string): Promise<Booking> {
    return await api.post<Booking>('/tours/' + tourId + '/bookings')
  }

  return {
    mine,
    loading,
    reset,
    fetchMine,
    bookSeat,
  }
})