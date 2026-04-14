<template>
  <nav class="glass-panel sticky top-0 z-50 border-b border-border bg-background/50 backdrop-blur-xl transition-colors duration-300">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <!-- Left: Logo & Core Links -->
      <div class="flex items-center gap-8">
        <router-link to="/apps" class="flex items-center gap-2 group">
          <div class="w-8 h-8 bg-[#22C55E]/10 rounded-lg flex items-center justify-center border border-[#22C55E]/20 group-hover:border-[#22C55E]/40 transition-colors">
            <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span class="font-mono italic font-bold text-foreground tracking-tight">share-installs</span>
        </router-link>

        <div class="hidden md:flex items-center gap-1">
          <router-link 
            to="/apps" 
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="[route.path.startsWith('/apps') ? 'text-foreground bg-white/10 dark:bg-white/5 shadow-sm' : 'text-slate-500 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5']"
          >
            Applications
          </router-link>
          <router-link 
            to="/pricing" 
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="[route.path === '/pricing' ? 'text-foreground bg-white/10 dark:bg-white/5 shadow-sm' : 'text-slate-500 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5']"
          >
            Pricing
          </router-link>
          <a href="#" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-foreground transition-colors cursor-not-allowed opacity-50">Docs</a>
        </div>
      </div>

      <!-- Right: User Menu & Theme Toggle -->
      <div class="flex items-center gap-4">
        <ThemeToggle />
        
        <div v-if="user" class="flex items-center gap-3 pl-4 border-l border-border">
          <div class="text-right hidden sm:block">
            <p class="text-xs font-bold text-foreground">{{ user.githubLogin }}</p>
            <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{{ quota?.plan || 'Free' }} Plan</p>
          </div>
          <div class="relative group">
            <button class="w-9 h-9 rounded-full border border-border overflow-hidden hover:border-brand-cta transition-colors">
              <img :src="user.avatarUrl" :alt="user.githubLogin" class="w-full h-full object-cover">
            </button>
            
            <!-- Dropdown -->
            <div class="absolute right-0 mt-2 w-48 glass-panel rounded-xl border border-border p-1 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0">
              <div class="px-3 py-2 border-b border-border mb-1">
                <p class="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Account</p>
                <p class="text-xs font-semibold text-muted truncate">{{ user.email || user.githubLogin }}</p>
              </div>
              <router-link to="/pricing" class="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:bg-white/10 dark:hover:bg-white/5 hover:text-foreground rounded-lg transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Billing & Plans
              </router-link>
              <a :href="logoutUrl" class="flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api';
import ThemeToggle from './ThemeToggle.vue';

const route = useRoute();
const user = ref<any>(null);
const quota = ref<any>(null);

const logoutUrl = computed(() => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseUrl}/auth/logout`;
});

const loadData = async () => {
  try {
    const [userRes, quotaRes] = await Promise.all([
      api.get('/me'),
      api.get('/quota')
    ]);
    user.value = userRes.data;
    quota.value = quotaRes.data;
  } catch (error) {
    console.error('Failed to load navigation data');
  }
};

onMounted(loadData);
</script>
