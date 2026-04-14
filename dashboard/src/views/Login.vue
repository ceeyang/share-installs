<template>
  <div class="min-h-screen bg-brand-bg text-brand-text selection:bg-[#22C55E] selection:text-[#020617] overflow-x-hidden transition-colors duration-300">
    <!-- Background Accents -->
    <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#22C55E]/10 blur-[120px] rounded-full pointer-events-none"></div>
    <div class="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none"></div>

    <!-- Header / Navbar -->
    <nav class="relative z-50 flex items-center justify-between px-6 md:px-12 py-8 max-w-7xl mx-auto">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 bg-[#22C55E]/20 rounded-xl flex items-center justify-center border border-[#22C55E]/30">
          <svg class="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <span class="text-2xl font-black tracking-tight font-mono italic text-brand-text">share-installs</span>
      </div>
      <div class="flex items-center gap-4 md:gap-8">
        <a href="https://github.com/ceeyang/share-installs" target="_blank" class="hidden sm:flex text-sm font-semibold text-muted hover:text-foreground transition-colors items-center gap-2">
          GitHub
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z"/></svg>
        </a>
        <div class="w-px h-6 bg-border hidden sm:block"></div>
        <ThemeToggle />
        <button @click="signInWithGitHub" class="bg-[#22C55E] text-[#020617] px-6 py-2.5 rounded-xl font-black text-sm hover:bg-[#16a34a] transition-all shadow-[0_4px_14px_rgba(34,197,94,0.4)]">Sign In</button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
      <div v-if="checking" class="flex flex-col items-center justify-center py-20">
        <div class="w-12 h-12 border-4 border-[#22C55E]/10 border-t-[#22C55E] rounded-full animate-spin mb-4"></div>
        <p class="text-muted font-medium tracking-widest text-[10px] uppercase">Verifying Session...</p>
      </div>
      
      <div v-else class="animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 mb-8">
          <span class="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
          <span class="text-[10px] font-black uppercase tracking-widest text-[#22C55E]">Open Source Invite Tracking</span>
        </div>
        
        <h1 class="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-muted">
          Invite attribution<br /><span class="text-[#22C55E]">that just works.</span>
        </h1>
        
        <p class="text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
          The ultimate deferred deep linking platform. Match users from web invite to app installation with cross-platform SDKs and high-precision fingerprinting.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button @click="signInWithGitHub" class="w-full sm:w-auto bg-[#F8FAFC] text-[#020617] px-10 py-4 rounded-xl font-black text-lg hover:scale-105 transition-all flex items-center justify-center gap-3 shadow-xl dark:shadow-none">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z"/></svg>
            Get Started Free
          </button>
          <a href="https://github.com/ceeyang/share-installs" target="_blank" class="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-lg border border-border bg-surface hover:bg-surface-2 transition-all">Documentation</a>
        </div>

        <div v-if="alertMsg" class="mt-8 mx-auto max-w-lg bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center animate-in fade-in zoom-in-95 backdrop-blur-md">
          <p class="text-sm font-bold text-red-500 flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {{ alertMsg }}
          </p>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="max-w-7xl mx-auto px-6 py-24 border-t border-border">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        <div class="space-y-4">
          <div class="w-12 h-12 bg-white/10 dark:bg-white/5 rounded-xl flex items-center justify-center text-xl">🏠</div>
          <h3 class="text-xl font-bold text-brand-text">Self-Hosted Mastery</h3>
          <p class="text-muted">Your data, your rules. Deploy with Docker in seconds. No vendor lock-in, no hidden fees for self-hosters.</p>
        </div>
        <div class="space-y-4">
          <div class="w-12 h-12 bg-white/10 dark:bg-white/5 rounded-xl flex items-center justify-center text-xl">🔬</div>
          <h3 class="text-xl font-bold text-brand-text">Smart Fingerprinting</h3>
          <p class="text-muted">Multi-signal matching across IP, screen resolution, hardware concurrency, and behavior patterns for high accuracy.</p>
        </div>
        <div class="space-y-4">
          <div class="w-12 h-12 bg-white/10 dark:bg-white/5 rounded-xl flex items-center justify-center text-xl">📦</div>
          <h3 class="text-xl font-bold text-brand-text">Full-Stack SDKs</h3>
          <p class="text-muted">Native Swift (iOS) and Kotlin (Android) SDKs paired with a lightweight JS connector. Production-ready out of the box.</p>
        </div>
      </div>
    </section>

    <!-- Visual Proof Section -->
    <section class="max-w-7xl mx-auto px-6 py-24 bg-surface rounded-[3rem] border border-border mb-32 overflow-hidden relative transition-colors duration-300">
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#22C55E]/5 dark:bg-[#22C55E]/10 blur-[120px] pointer-events-none"></div>
      <div class="relative z-10 flex flex-col md:flex-row items-center gap-16">
        <div class="flex-1 text-left">
          <h2 class="text-4xl font-black mb-6 tracking-tight italic text-[#22C55E]">Deferred Deep Linking.</h2>
          <p class="text-lg text-muted mb-8 leading-relaxed">
            Standard deep links break after the App Store download. share-installs bridges that gap by "carrying" the attribution data across the installation process.
          </p>
          <ul class="space-y-4">
            <li v-for="benefit in ['No Clipboard Hacks Required', 'Privacy-Compliant Data Collection', 'Real-time Conversion Analytics']" :key="benefit" class="flex items-center gap-3 text-sm font-bold text-muted">
              <svg class="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              {{ benefit }}
            </li>
          </ul>
        </div>
        <div class="flex-1 w-full max-w-md aspect-square bg-[#020617] rounded-3xl border border-white/10 p-2 shadow-2xl relative">
          <div class="w-full h-full bg-slate-900/50 rounded-2xl border border-white/5 flex flex-col p-6 font-mono text-xs text-slate-500 overflow-hidden">
             <div class="flex items-center gap-4 mb-4">
               <div class="w-3 h-3 rounded-full bg-red-500/40"></div>
               <div class="w-3 h-3 rounded-full bg-yellow-500/40"></div>
               <div class="w-3 h-3 rounded-full bg-green-500/40"></div>
             </div>
             <p class="text-[#22C55E] mb-2 font-bold">// Incoming Attribution Event</p>
             <p class="text-slate-300 mb-1">{</p>
             <p class="ml-4 text-slate-300">"channel": <span class="text-purple-400">"FUZZY"</span>,</p>
             <p class="ml-4 text-slate-300">"confidence": <span class="text-[#22C55E]">0.982</span>,</p>
             <p class="ml-4 text-slate-300">"fingerprint": {</p>
             <p class="ml-8 text-slate-400">"os": "iOS", "ver": "17.4",</p>
             <p class="ml-8 text-slate-400">"ip": "1.2.3.4", "dpr": 3</p>
             <p class="ml-4 text-slate-300">},</p>
             <p class="ml-4 text-slate-300">"inviteCode": <span class="text-amber-400">"WELCOME2026"</span></p>
             <p class="text-slate-300">}</p>
             <div class="mt-8 p-4 bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/20 text-[#22C55E] font-bold text-center">
               MATCH FOUND (RELIABILITY: HIGH)
             </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="max-w-7xl mx-auto px-6 py-12 border-t border-border flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left transition-colors duration-300">
       <p class="text-sm text-muted">© 2026 share-installs. Engineered for scale. Open source under Apache 2.0.</p>
       <div class="flex items-center gap-6 text-sm font-semibold text-muted">
         <a href="#" class="hover:text-foreground transition-colors">Documentation</a>
         <a href="#" class="hover:text-foreground transition-colors">Privacy</a>
         <a href="https://github.com/ceeyang/share-installs" class="hover:text-foreground transition-colors">GitHub</a>
       </div>
    </footer>
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const alertMsg = ref('');
const checking = ref(true);

const checkAuth = async () => {
  try {
    await api.get('/me');
    router.push('/apps');
  } catch (err) {
    // Not logged in, stay on login page
    checking.value = false;
  }
};

onMounted(() => {
  if (route.query.error === 'github_not_configured') {
    alertMsg.value = 'Server Configuration Missing: Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your backend environment variables to enable OAuth features.';
    router.replace({ query: {} });
    checking.value = false;
  } else if (route.query.auth_error) {
    alertMsg.value = `Authentication failed: ${route.query.auth_error}`;
    router.replace({ query: {} });
    checking.value = false;
  } else {
    checkAuth();
  }
});

const signInWithGitHub = () => {
  // In development, use the Vite-proxied route (/auth/github → localhost:6066/auth/github).
  // In production, navigate to the deployed backend directly.
  if (import.meta.env.VITE_API_BASE_URL) {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/github`;
  } else {
    window.location.href = '/auth/github';
  }
};
</script>
