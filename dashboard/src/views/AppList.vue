<template>
  <div class="min-h-[100svh] relative bg-brand-bg text-brand-text font-sans pb-24 selection:bg-[#22C55E] selection:text-[#020617] flex flex-col transition-colors duration-300">
    <Navbar />

    <!-- Ambient Subtleties -->
    <div class="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#22C55E]/5 dark:bg-[#22C55E]/10 blur-[150px] rounded-full pointer-events-none"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none"></div>

    <main class="relative z-10 max-w-6xl mx-auto px-6 pt-16 lg:pt-24 w-full">
      
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-4 font-mono text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted">Applications</h1>
          <p class="text-lg text-muted max-w-xl">
            High-precision deferred deep link attribution. Manage your app instance SDK keys and monitor install conversions.
          </p>
        </div>
        
        <button @click="showCreateModal = true" class="group shrink-0 inline-flex items-center gap-3 bg-[#22C55E] text-[#020617] px-6 py-3 rounded-xl hover:bg-[#16a34a] transition-all shadow-[0_4px_14px_rgba(34,197,94,0.2)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.3)] font-semibold">
          <span class="text-sm">Create Application</span>
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="i in 3" :key="i" class="glass-card rounded-2xl h-48 animate-pulse p-6 flex flex-col justify-between">
          <div class="w-12 h-12 bg-white/10 dark:bg-white/5 rounded-xl"></div>
          <div class="space-y-3">
            <div class="h-6 bg-white/10 dark:bg-white/5 rounded w-1/2"></div>
            <div class="h-4 bg-white/10 dark:bg-white/5 rounded w-1/4"></div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="apps.length === 0" class="glass-panel rounded-2xl p-12 lg:p-24 text-center border-dashed border-border">
        <div class="w-16 h-16 bg-white/10 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-muted">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-xl font-bold mb-2 text-brand-text">No internal apps found</h3>
        <p class="text-muted mb-8 max-w-sm mx-auto">Create your first application to start tracking deferred deep link conversions and managing SDK attribution keys.</p>
        <button @click="showCreateModal = true" class="text-sm font-semibold tracking-wide text-[#22C55E] hover:text-[#16a34a] inline-flex items-center gap-2 transition-colors">
          Initialize First App
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      <!-- App Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <router-link v-for="app in apps" :key="app.id" :to="`/apps/${app.id}`" class="group glass-card rounded-2xl p-6 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-[#22C55E]/5 dark:bg-[#22C55E]/10 rounded-bl-[100px] transition-transform group-hover:scale-110"></div>
          
          <div class="w-12 h-12 bg-surface-2 border border-border rounded-xl flex items-center justify-center text-xl font-bold mb-8 transition-colors group-hover:border-[#22C55E]/30 text-brand-text">
            {{ app.name.charAt(0).toUpperCase() }}
          </div>
          
          <h3 class="text-xl font-bold tracking-tight mb-2 truncate text-brand-text">{{ app.name }}</h3>
          <div class="flex items-center justify-between text-muted text-sm border-t border-border mt-4 pt-4">
            <span class="font-mono text-[10px] tracking-widest uppercase opacity-70">ID: {{ app.id.split('-')[0] }}</span>
            <span class="text-[10px] uppercase tracking-tighter">{{ new Date(app.createdAt).toLocaleDateString() }}</span>
          </div>
        </router-link>
      </div>

    </main>

    <!-- Create Modal Overlays -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="showCreateModal = false"></div>
      
      <div class="glass-panel relative w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 class="text-2xl font-bold mb-6 text-brand-text">Initialize Application</h2>
        <p class="text-sm text-muted mb-6">Applications scope your attribution data. Each app gets its own separate SDK API keys.</p>
        
        <form @submit.prevent="createApp">
          <div class="mb-8">
            <label class="block text-sm font-medium text-muted mb-2">Application Name</label>
            <input v-model="newAppName" type="text" required class="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-brand-text placeholder-muted/50 focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] transition-all" placeholder="e.g. Share Installs Demo">
          </div>
          
          <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-4">
            <button type="button" @click="showCreateModal = false" class="px-5 py-2.5 rounded-xl font-medium text-muted hover:bg-white/10 dark:hover:bg-white/5 transition-colors text-sm">Cancel</button>
            <button type="submit" :disabled="creating" class="bg-[#22C55E] text-[#020617] px-6 py-2.5 rounded-xl hover:bg-[#16a34a] disabled:opacity-50 transition-all font-semibold text-sm flex items-center justify-center shadow-[0_2px_10px_rgba(34,197,94,0.2)]">
              {{ creating ? 'Creating...' : 'Create Application' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Navbar from '../components/Navbar.vue';
import api from '../api';

const apps = ref<any[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const newAppName = ref('');
const creating = ref(false);

const fetchApps = async () => {
  try {
    const { data } = await api.get('/apps');
    apps.value = data;
  } catch (error) {
    console.error('Failed to load apps');
  } finally {
    loading.value = false;
  }
};

const createApp = async () => {
  if (!newAppName.value) return;
  creating.value = true;
  try {
    const { data } = await api.post('/apps', { name: newAppName.value });
    apps.value.unshift(data);
    showCreateModal.value = false;
    newAppName.value = '';
  } catch (error) {
    console.error('Failed to create app');
  } finally {
    creating.value = false;
  }
};

onMounted(fetchApps);
</script>
