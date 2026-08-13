import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError, TOKEN_STORAGE_KEY } from '../lib/api'
import type { AuthUser, AuthResponse, Role } from '../types/domain'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))

  const isAuthenticated = computed(() => user.value !== null)
  const isGuide = computed(() => user.value?.role === 'GUIDE')

  function applyAuth(res: AuthResponse) {
    token.value = res.token
    user.value = res.user
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<AuthResponse>('/auth/login', { email, password })
    applyAuth(res)
  }

  async function register(payload: {
    displayName: string
    email: string
    password: string
    role: Role
  }): Promise<void> {
    const res = await api.post<AuthResponse>('/auth/register', payload)
    applyAuth(res)
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    // Allow a future sign-in to attempt session restoration again.
    restorePromise = null
  }

  // Cache the restore call so concurrent router/navigation guards share one
  // attempt and do not each trigger a separate `/auth/me` request.
  let restorePromise: Promise<void> | null = null

  async function restore(): Promise<void> {
    if (restorePromise !== null) {
      return restorePromise
    }
    restorePromise = runRestore()
    return restorePromise
  }

  async function runRestore(): Promise<void> {
    if (token.value === null) {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (stored) {
        token.value = stored
      }
    }

    if (!token.value) {
      return
    }

    try {
      user.value = await api.get<AuthUser>('/auth/me')
    } catch (err) {
      // An expired/invalid 24-hour token is expected over time; treat it as
      // signed-out rather than surfacing an error to the caller.
      if (err instanceof ApiError) {
        logout()
        return
      }
      throw err
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isGuide,
    login,
    register,
    logout,
    restore,
  }
})
