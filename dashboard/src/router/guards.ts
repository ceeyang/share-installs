// dashboard/src/router/guards.ts
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export async function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const auth = useAuthStore()

  // Lazy-initialize: calls GET /dashboard/me once, then caches in store.
  await auth.init()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    // Not logged in → send to login
    next('/login')
  } else if (to.path === '/login' && auth.isLoggedIn) {
    // Already logged in → skip login page
    next('/apps')
  } else {
    next()
  }
}
