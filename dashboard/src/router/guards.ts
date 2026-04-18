// dashboard/src/router/guards.ts
import type { RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export async function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
) {
  const auth = useAuthStore()

  await auth.init()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return '/login'
  } else if (to.path === '/login' && auth.isLoggedIn) {
    return '/apps'
  }
}
