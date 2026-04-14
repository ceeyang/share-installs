<template>
  <div class="min-h-[100svh] relative bg-brand-bg text-brand-text font-sans pb-24 selection:bg-[#22C55E] selection:text-[#020617] flex flex-col transition-colors duration-300">
    <Navbar />

    <!-- Ambient Subtleties -->
    <div class="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#22C55E]/5 dark:bg-[#22C55E]/10 blur-[150px] rounded-full pointer-events-none"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none"></div>

    <!-- Navbar Header (Sub-nav for app console) -->
    <header class="border-b border-border bg-background/30 backdrop-blur-sm relative z-40">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <router-link to="/apps" class="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </router-link>
          <span class="text-sm font-bold tracking-tight text-brand-text">Application Console</span>
        </div>
        
        <div class="flex bg-surface p-1 rounded-lg border border-border">
          <button @click="activeTab = 'stats'" :class="[activeTab === 'stats' ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5', 'px-3 py-1 text-xs font-semibold rounded-md transition-all']">Metrics</button>
          <button @click="activeTab = 'keys'" :class="[activeTab === 'keys' ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5', 'px-3 py-1 text-xs font-semibold rounded-md transition-all']">API Keys</button>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-6xl mx-auto px-6 py-10 w-full relative z-10">
      
      <!-- Stats Tab / Executive Summary -->
      <div v-if="activeTab === 'stats'" class="animate-in fade-in zoom-in-95 duration-300">
        <div class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 class="text-3xl font-bold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted">Attribution Analytics</h2>
            <p class="text-muted">High-precision tracking metrics for deferred deep link conversions.</p>
          </div>
          <div class="px-4 py-2 bg-white/10 dark:bg-white/5 border border-border rounded-xl">
            <span class="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Application ID</span>
            <code class="text-xs font-mono text-[#22C55E]">{{ appId }}</code>
          </div>
        </div>
        
        <!-- Key Metrics -->
        <div v-if="stats" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
              <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-[100px] transition-transform group-hover:scale-110"></div>
              <h3 class="text-xs font-semibold text-muted mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Total Clicks
              </h3>
              <p class="text-4xl font-bold tracking-tighter text-brand-text font-mono">{{ stats.totalClicks || 0 }}</p>
            </div>
            
            <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
              <div class="absolute top-0 right-0 w-24 h-24 bg-[#22C55E]/5 rounded-bl-[100px] transition-transform group-hover:scale-110"></div>
              <h3 class="text-xs font-semibold text-muted mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></span> Matches (Installs)
              </h3>
              <p class="text-4xl font-bold tracking-tighter text-brand-text font-mono">{{ stats.totalInstalls || 0 }}</p>
            </div>

            <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
              <div class="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-[100px] transition-transform group-hover:scale-110"></div>
              <h3 class="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> Conversion Rate
              </h3>
              <p class="text-4xl font-bold tracking-tighter text-[#F8FAFC] font-mono">
                {{ stats.totalClicks > 0 ? ((stats.totalInstalls / stats.totalClicks) * 100).toFixed(1) : '0.0' }}%
              </p>
            </div>
          </div>

          <!-- Secondary Metrics -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Channel Breakdown -->
            <div class="glass-card rounded-2xl p-8">
              <h3 class="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest">Match Channel Distribution</h3>
              <div class="space-y-6">
                <div v-for="(count, channel) in stats.byChannel" :key="channel" class="relative">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-slate-400 capitalize">{{ channel }} Channel</span>
                    <span class="text-sm font-mono font-bold text-[#F8FAFC]">{{ count }}</span>
                  </div>
                  <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      class="h-full bg-[#22C55E]/60 rounded-full transition-all duration-1000"
                      :style="{ width: stats.totalInstalls > 0 ? (count / stats.totalInstalls * 100) + '%' : '0%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Platform Breakdown -->
            <div class="glass-card rounded-2xl p-8">
              <h3 class="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest">Platform Split</h3>
              <div class="flex items-center justify-around h-full pb-8">
                <div class="text-center">
                  <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 mb-4 mx-auto">
                    <svg class="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.1 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.24-2.02 1.1-3.22-1.02.04-2.25.68-2.98 1.54-.65.76-1.23 1.93-1.09 3.12 1.13.08 2.24-.63 2.97-1.44z" />
                    </svg>
                  </div>
                  <p class="text-2xl font-bold font-mono text-[#F8FAFC]">{{ stats.byPlatform.ios || 0 }}</p>
                  <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">iOS Matches</p>
                </div>
                <div class="w-px h-16 bg-white/5"></div>
                <div class="text-center">
                  <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 mb-4 mx-auto">
                    <svg class="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.523 15.3414L18.3509 18.2323C18.4239 18.5255 18.2514 18.8282 17.9582 18.9102C17.658 18.9832 17.3553 18.8107 17.2733 18.5175L16.4454 15.6267C15.933 15.8675 14.8878 16.0303 13.6874 16.0303V16.8913H15.068C15.3562 16.8913 15.5873 17.1234 15.5873 17.4115C15.5873 17.6997 15.3562 17.9317 15.068 17.9317H13.6874V19.6644C13.6874 19.9525 13.4554 20.1846 13.1672 20.1846H10.8328C10.5446 20.1846 10.3126 19.9525 10.3126 19.6644V17.9317H8.93198C8.6438 17.9317 8.41175 17.6997 8.41175 17.4115C8.41175 17.1234 8.6438 16.8913 8.93198 16.8913H10.3126V16.0303C9.11219 16.0303 8.06704 15.8675 7.55462 15.6267L6.72674 18.5175C6.6447 18.8107 6.34199 18.9832 6.0418 18.9102C5.74859 18.8282 5.57608 18.5255 5.64912 18.2323L6.47699 15.3414C5.10906 14.4996 4.19231 13.0421 4.19231 11.3732V8.40939C4.19231 8.1212 4.42436 7.88916 4.71255 7.88916H19.2875C19.5756 7.88916 19.8077 8.1212 19.8077 8.40939V11.3732C19.8077 12.9814 18.8959 14.4996 17.523 15.3414ZM14.0243 4.88729L15.3414 2.80938C15.4855 2.56942 15.4182 2.25303 15.1782 2.08378C14.9383 1.93966 14.6219 2.00693 14.4526 2.24688L13.1355 4.3248H10.8645L9.54739 2.24688C9.37814 2.00693 9.06175 1.93966 8.82179 2.08378C8.58184 2.25303 8.51457 2.56942 8.65868 2.80938L9.97576 4.88729C8.0772 5.48008 6.69769 7.2384 6.69769 9.3248V9.33649H17.3117V9.3248C17.3117 7.2384 15.9228 5.48008 14.0243 4.88729Z" />
                    </svg>
                  </div>
                  <p class="text-2xl font-bold font-mono text-[#F8FAFC]">{{ stats.byPlatform.android || 0 }}</p>
                  <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Android Matches</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="i in 3" :key="i" class="glass-card rounded-2xl h-32 animate-pulse bg-white/5"></div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div v-for="i in 2" :key="i" class="glass-card rounded-2xl h-64 animate-pulse bg-white/5"></div>
          </div>
        </div>
      </div>

      <!-- API Keys Tab -->
      <div v-else-if="activeTab === 'keys'" class="animate-in fade-in zoom-in-95 duration-300">
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h2 class="text-3xl font-bold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted">Security Credentials</h2>
            <p class="text-muted">Manage and revoke API keys used for authenticating SDK requests.</p>
          </div>
          <button @click="showCreateModal = true" class="group shrink-0 inline-flex items-center gap-2 bg-[#22C55E] text-[#020617] px-5 py-2.5 rounded-xl hover:bg-[#16a34a] transition-all shadow-[0_4px_14px_rgba(34,197,94,0.2)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.3)] font-semibold">
            <span class="text-sm">Generate Key</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <!-- Newly Generated Key Alert -->
        <div v-if="newlyCreatedKey" class="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl p-6 mb-8 backdrop-blur-md">
          <div class="flex items-start gap-4">
            <div class="p-2 bg-[#22C55E]/20 rounded-lg text-[#22C55E]">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-brand-text mb-1">Secret Key Generated</h3>
              <p class="text-sm text-muted mb-4 max-w-2xl">This is the only time the full key will be displayed. Please copy and store it securely.</p>
              
              <div class="flex flex-col sm:flex-row gap-3">
                <input type="text" readonly :value="newlyCreatedKey.key" class="flex-1 bg-surface-2 font-mono text-sm border border-border rounded-lg px-4 py-2.5 outline-none text-brand-text" />
                <button @click="copy(newlyCreatedKey.key)" class="shrink-0 bg-white/10 dark:bg-white/5 hover:bg-white/20 text-brand-text px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-border">
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Key List -->
        <div class="glass-panel rounded-2xl overflow-hidden border border-border">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr class="bg-surface border-b border-border">
                  <th class="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-widest">Environment</th>
                  <th class="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-widest">Prefix</th>
                  <th class="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-widest">Created</th>
                  <th class="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="keys.length === 0">
                  <td colspan="4" class="px-6 py-12 text-center text-muted text-sm">No API keys found for this application.</td>
                </tr>
                <tr v-for="k in keys" :key="k.id" class="hover:bg-white/10 dark:hover:bg-white/5 transition-colors">
                  <td class="px-6 py-5 font-semibold text-brand-text">{{ k.name }}</td>
                  <td class="px-6 py-5 font-mono text-sm text-muted">{{ k.prefix }}••••••••</td>
                  <td class="px-6 py-5 text-muted text-sm">{{ new Date(k.createdAt).toLocaleDateString() }}</td>
                  <td class="px-6 py-5 text-right">
                    <button v-if="!k.revokedAt" @click="revokeKey(k.id)" class="text-rose-500 hover:text-white hover:bg-rose-500/20 bg-rose-500/10 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border border-rose-500/20">Revoke</button>
                    <span v-else class="text-muted text-xs font-semibold uppercase bg-white/10 dark:bg-white/5 px-3 py-1.5 rounded-md">Revoked</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Create Modal Overlays -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm" @click="showCreateModal = false"></div>
      
      <div class="glass-panel relative w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 class="text-2xl font-bold mb-6 text-[#F8FAFC]">Generate Key</h2>
        
        <form @submit.prevent="generateKey">
          <div class="mb-8">
            <label class="block text-sm font-medium text-slate-300 mb-2">Key Environment</label>
            <input v-model="newKeyName" type="text" required class="w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-3 text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] transition-all" placeholder="e.g. Production iOS">
          </div>
          
          <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-4">
            <button type="button" @click="showCreateModal = false" class="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors text-sm">Cancel</button>
            <button type="submit" :disabled="generating" class="bg-[#22C55E] text-[#020617] px-6 py-2.5 rounded-xl hover:bg-[#16a34a] disabled:opacity-50 transition-all font-semibold text-sm flex items-center justify-center shadow-[0_2px_10px_rgba(34,197,94,0.2)] cursor-pointer">
              {{ generating ? 'Generating...' : 'Generate Key' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import api from '../api';

const route = useRoute();
const appId = route.params.id;

const activeTab = ref<'stats' | 'keys'>('stats');
const keys = ref<any[]>([]);
const stats = ref<any>(null);

const showCreateModal = ref(false);
const newKeyName = ref('');
const generating = ref(false);
const newlyCreatedKey = ref<any>(null);

const fetchKeys = async () => {
  try {
    const { data } = await api.get(`/apps/${appId}/keys`);
    keys.value = data;
  } catch (error) {
    console.error('Failed to load keys');
  }
};

const fetchStats = async () => {
  try {
    const { data } = await api.get(`/apps/${appId}/stats`);
    stats.value = data;
  } catch (error) {
    console.error('Failed to load stats');
  }
};

const generateKey = async () => {
  if (!newKeyName.value) return;
  generating.value = true;
  try {
    const { data } = await api.post(`/apps/${appId}/keys`, { name: newKeyName.value });
    newlyCreatedKey.value = data;
    showCreateModal.value = false;
    newKeyName.value = '';
    fetchKeys(); // refresh list
  } catch (error) {
    console.error('Failed to generate key');
  } finally {
    generating.value = false;
  }
};

const revokeKey = async (keyId: string) => {
  if (!confirm('Revoking this key immediately disables deep link attribution strictly bound to it. Proceed?')) return;
  try {
    await api.delete(`/apps/${appId}/keys/${keyId}`);
    fetchKeys();
  } catch (error) {
    console.error('Failed to revoke key');
  }
};

const copy = async (text: string) => {
  await navigator.clipboard.writeText(text);
};

watch(activeTab, (val) => {
  if (val === 'keys' && keys.value.length === 0) fetchKeys();
  if (val === 'stats' && !stats.value) fetchStats();
});

onMounted(() => {
  fetchStats();
});
</script>
