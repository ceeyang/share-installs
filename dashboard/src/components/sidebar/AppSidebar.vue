<!-- dashboard/src/components/sidebar/AppSidebar.vue -->
<template>
  <aside class="w-56 flex-shrink-0 flex flex-col h-screen bg-surface border-r border-border">

    <!-- Logo -->
    <div class="flex items-center gap-2 px-4 h-14 border-b border-border">
      <RouterLink to="/apps" class="flex items-center gap-2">
        <div class="w-7 h-7 bg-brand-cta/10 border border-brand-cta/20 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-brand-cta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <span class="font-mono font-bold text-sm text-brand-text">share-installs</span>
      </RouterLink>
    </div>

    <!-- Nav links -->
    <nav class="flex-1 px-2 py-3 space-y-0.5">
      <SidebarNavItem to="/apps" label="Applications">
        <template #icon>
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </template>
      </SidebarNavItem>

      <SidebarNavItem to="/pricing" label="Pricing">
        <template #icon>
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </template>
      </SidebarNavItem>
    </nav>

    <!-- User section -->
    <div class="px-2 py-3 border-t border-border space-y-1">
      <!-- User info row -->
      <div v-if="auth.user" class="flex items-center gap-2 px-2 py-1.5 mb-1">
        <img
          :src="auth.user.avatarUrl ?? undefined"
          :alt="auth.user.displayName ?? auth.user.githubLogin ?? auth.user.email ?? ''"
          class="w-7 h-7 rounded-full border border-border flex-shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-brand-text truncate">{{ auth.user.displayName ?? auth.user.githubLogin ?? auth.user.email }}</p>
          <p class="text-[10px] uppercase tracking-wider text-muted font-medium">{{ auth.planName }}</p>
        </div>
        <ThemeToggle />
      </div>

      <!-- Sign out -->
      <button
        @click="auth.logout()"
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-500 hover:bg-red-500/5 transition-colors cursor-pointer"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import SidebarNavItem from './SidebarNavItem.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const auth = useAuthStore()
</script>
