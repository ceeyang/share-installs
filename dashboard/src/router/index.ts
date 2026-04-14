import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', component: () => import('../views/Login.vue') },
  { path: '/apps', component: () => import('../views/AppList.vue') },
  { path: '/apps/:id', component: () => import('../views/AppDetail.vue') },
  { path: '/pricing', component: () => import('../views/Pricing.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
