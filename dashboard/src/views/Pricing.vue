<template>
  <div class="min-h-[100svh] relative bg-brand-bg text-brand-text font-sans pb-24 selection:bg-[#22C55E] selection:text-[#020617] flex flex-col transition-colors duration-300">
    <Navbar />

    <!-- Ambient Subtleties -->
    <div class="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#22C55E]/5 dark:bg-[#22C55E]/10 blur-[150px] rounded-full pointer-events-none"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 dark:bg-purple-500/10 blur-[150px] rounded-full pointer-events-none"></div>

    <main class="relative z-10 max-w-6xl mx-auto px-6 pt-16 lg:pt-24 w-full">
      <div class="text-center mb-16">
        <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-b from-foreground to-muted">
          Scale your growth
        </h1>
        <p class="text-lg text-muted max-w-2xl mx-auto">
          Choose the plan that fits your attribution scale. Self-hosted is always free, but our cloud managed service provides reliability and ease of use.
        </p>
      </div>

      <!-- Pricing Plans -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <!-- Free Plan -->
        <div class="glass-panel flex flex-col p-8 rounded-3xl border border-border relative group hover:border-[#22C55E]/30 transition-all">
          <div v-if="quota?.plan === 'FREE'" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22C55E] text-[#020617] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)]">Current Plan</div>
          <p class="text-sm font-bold text-[#22C55E] tracking-widest uppercase mb-4">Free</p>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-bold font-mono text-brand-text">$0</span>
            <span class="text-muted text-sm">/month</span>
          </div>
          <p class="text-sm text-muted mb-8">Perfect for early stage projects and SDK testing.</p>
          
          <ul class="space-y-4 mb-10 flex-1">
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              500 Monthly Installs
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              1 Application
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              7-Day Data Retention
            </li>
          </ul>
          
          <button disabled class="w-full py-3 rounded-xl font-bold bg-white/10 dark:bg-white/5 text-muted border border-border opacity-50">
            Selected
          </button>
        </div>

        <!-- Pro Plan -->
        <div class="glass-panel flex flex-col p-8 rounded-3xl border border-[#22C55E]/50 relative scale-105 shadow-2xl group dark:shadow-[0_0_50px_rgba(34,197,94,0.1)]">
          <div v-if="quota?.plan === 'PRO'" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22C55E] text-[#020617] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)]">Current Plan</div>
          <div v-else class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Popular</div>
          
          <p class="text-sm font-bold text-purple-500 dark:text-purple-400 tracking-widest uppercase mb-4">Pro</p>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-bold font-mono text-brand-text">$19</span>
            <span class="text-muted text-sm">/month</span>
          </div>
          <p class="text-sm text-muted mb-8">For scaling products that need higher limits and longer history.</p>
          
          <ul class="space-y-4 mb-10 flex-1">
            <li class="text-sm text-muted flex items-center gap-3 font-bold">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              10,000 Monthly Installs
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              5 Applications
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              90-Day Data Retention
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Priority Support
            </li>
          </ul>
          
          <button v-if="quota?.plan === 'PRO'" disabled class="w-full py-3 rounded-xl font-bold bg-white/10 dark:bg-white/5 text-muted border border-border opacity-50">Locked</button>
          <button v-else class="w-full py-3 rounded-xl font-bold bg-[#22C55E] text-[#020617] hover:bg-[#16a34a] transition-all shadow-[0_4px_20px_rgba(34,197,94,0.3)]">
            Upgrade Now
          </button>
        </div>

        <!-- Unlimited Plan -->
        <div class="glass-panel flex flex-col p-8 rounded-3xl border border-border relative group hover:border-purple-500/30 transition-all">
          <div v-if="quota?.plan === 'UNLIMITED'" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22C55E] text-[#020617] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)]">Current Plan</div>
          <p class="text-sm font-bold text-muted tracking-widest uppercase mb-4">Unlimited</p>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-bold font-mono text-brand-text">$99</span>
            <span class="text-muted text-sm">/month</span>
          </div>
          <p class="text-sm text-muted mb-8">Unrestricted growth tracking for large-scale operations.</p>
          
          <ul class="space-y-4 mb-10 flex-1">
            <li class="text-sm text-muted flex items-center gap-3 font-bold">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Unlimited Installs
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Unlimited Applications
            </li>
            <li class="text-sm text-muted flex items-center gap-3">
              <svg class="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              1-Year Data Retention
            </li>
          </ul>
          
          <button v-if="quota?.plan === 'UNLIMITED'" disabled class="w-full py-3 rounded-xl font-bold bg-white/10 dark:bg-white/5 text-muted border border-border opacity-50">Locked</button>
          <button v-else class="w-full py-3 rounded-xl font-bold bg-white/10 dark:bg-white/5 text-brand-text hover:bg-white/20 border border-border transition-all">
            Contact Sales
          </button>
        </div>
      </div>

      <!-- FAQ Summary -->
      <div class="glass-panel p-12 rounded-3xl text-center border border-border">
        <h3 class="text-2xl font-bold mb-4 text-brand-text">Looking for self-hosting?</h3>
        <p class="text-muted mb-8 max-w-xl mx-auto">
          share-installs is fully open-source. You can download the source and run it on your own infrastructure for free with no tracking limits.
        </p>
        <a href="https://github.com/ceeyang/share-installs" target="_blank" class="inline-flex items-center gap-2 text-[#22C55E] font-bold hover:underline">
          Visit GitHub Repository
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </main>
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Navbar from '../components/Navbar.vue';
import api from '../api';

const quota = ref<any>(null);

const fetchQuota = async () => {
  try {
    const { data } = await api.get('/quota');
    quota.value = data;
  } catch (error) {
    console.error('Failed to load quota');
  }
};

onMounted(fetchQuota);
</script>
