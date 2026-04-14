<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isDark = ref(false);

const updateTheme = (dark: boolean) => {
  isDark.value = dark;
  if (dark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

const toggleTheme = () => {
  updateTheme(!isDark.value);
};

onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    updateTheme(true);
  } else {
    updateTheme(false);
  }
});
</script>

<template>
  <button 
    @click="toggleTheme" 
    class="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:border-brand-cta group"
    aria-label="Toggle Theme"
  >
    <!-- Sun icon (shown when dark mode is active to switch to light) -->
    <svg 
      v-if="isDark" 
      class="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14.5 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
    
    <!-- Moon icon (shown when light mode is active to switch to dark) -->
    <svg 
      v-else 
      class="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  </button>
</template>
