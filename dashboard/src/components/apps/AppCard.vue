<!-- dashboard/src/components/apps/AppCard.vue -->
<template>
  <div class="relative bg-surface border border-border rounded-lg p-5 group hover:border-brand-cta/40 transition-colors">
    <!-- Full-card link -->
    <RouterLink :to="`/apps/${app.id}`" class="absolute inset-0 rounded-lg" aria-label="Open app" />

    <!-- Header row: avatar + delete -->
    <div class="flex items-start justify-between mb-5">
      <div class="w-10 h-10 bg-brand-cta/10 border border-brand-cta/20 rounded-lg flex items-center justify-center font-bold font-mono text-brand-cta text-sm">
        {{ app.name.charAt(0).toUpperCase() }}
      </div>
      <button
        @click.stop="$emit('delete', app.id)"
        class="relative z-10 p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
        title="Delete application"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <h3 class="font-semibold text-brand-text truncate mb-1">{{ app.name }}</h3>
    <p class="text-xs text-muted">Created {{ formatDate(app.createdAt) }}</p>
  </div>
</template>

<script setup lang="ts">
import type { App } from '@/api/types'

defineProps<{ app: App }>()
defineEmits<{ delete: [id: string] }>()

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>
