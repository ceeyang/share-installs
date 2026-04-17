// dashboard/src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMe, getQuota } from '@/api/auth'
import type { User, Quota } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const quota = ref<Quota | null>(null)
  /** True after the first /me call has resolved (success or 401). */
  const initialized = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const planName = computed(() => quota.value?.plan ?? 'FREE')
  const usagePercent = computed(() => {
    if (!quota.value || quota.value.limit <= 0) return 0
    return Math.min(Math.round((quota.value.used / quota.value.limit) * 100), 100)
  })

  /** Fetches user + quota from the backend. Idempotent — skips if already initialized. */
  async function init() {
    if (initialized.value) return
    try {
      user.value = await getMe()
      quota.value = await getQuota()
    } catch {
      user.value = null
      quota.value = null
    } finally {
      initialized.value = true
    }
  }

  async function refresh() {
    try {
      quota.value = await getQuota()
    } catch {
      // non-critical
    }
  }

  function logout() {
    const base = import.meta.env.VITE_API_BASE_URL ?? ''
    window.location.href = `${base}/auth/logout`
  }

  return { user, quota, initialized, isLoggedIn, planName, usagePercent, init, refresh, logout }
})
