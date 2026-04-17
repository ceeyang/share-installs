<!-- dashboard/src/components/common/EmptyState.vue -->
<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <slot name="icon">
      <div class="w-12 h-12 bg-surface-2 border border-border rounded-xl flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
    </slot>
    <h3 class="text-sm font-semibold text-brand-text mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted mb-4 max-w-xs">{{ description }}</p>
    <button
      v-if="actionLabel"
      @click="$emit('action')"
      class="text-sm font-medium text-brand-cta hover:underline cursor-pointer"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  actionLabel?: string
}>()
defineEmits<{ action: [] }>()
</script>
