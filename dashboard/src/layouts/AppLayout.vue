<!-- dashboard/src/layouts/AppLayout.vue -->
<template>
  <div class="flex h-screen bg-brand-bg overflow-hidden">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
</script>
