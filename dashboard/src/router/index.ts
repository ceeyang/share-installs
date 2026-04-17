import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from './guards'

const routes = [
  {
    path: '/login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/apps',
    component: () => import('@/views/AppsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/apps/:id',
    component: () => import('@/views/AppDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pricing',
    component: () => import('@/views/PricingView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/', redirect: '/apps' },
  { path: '/:pathMatch(.*)*', redirect: '/apps' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(authGuard)

export default router
