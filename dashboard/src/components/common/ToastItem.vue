<!-- dashboard/src/components/common/ToastItem.vue -->
<template>
  <div class="flex items-start gap-3 px-4 py-3 bg-surface border border-border rounded-lg shadow-lg min-w-72 max-w-sm">
    <div class="flex-shrink-0 mt-0.5" :class="iconColor">
      <!-- success -->
      <svg v-if="type === 'success'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      <!-- error -->
      <svg v-else-if="type === 'error'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <!-- info -->
      <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p class="flex-1 text-sm text-brand-text leading-snug">{{ message }}</p>
    <button @click="$emit('dismiss')" class="text-muted hover:text-brand-text transition-colors flex-shrink-0 cursor-pointer">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToastType } from '@/stores/notifications'

const props = defineProps<{ id: string; message: string; type: ToastType }>()
defineEmits<{ dismiss: [] }>()

const iconColor = computed(() => ({
  'text-green-500': props.type === 'success',
  'text-red-500': props.type === 'error',
  'text-blue-400': props.type === 'info',
}))
</script>
