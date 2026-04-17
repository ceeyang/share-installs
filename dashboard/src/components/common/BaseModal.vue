<!-- dashboard/src/components/common/BaseModal.vue -->
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')" />
      <!-- Dialog -->
      <div class="relative z-10 w-full max-w-md bg-surface border border-border rounded-xl shadow-xl p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-brand-text">{{ title }}</h2>
          <button
            @click="$emit('close')"
            class="text-muted hover:text-brand-text transition-colors cursor-pointer"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title: string }>()
defineEmits<{ close: [] }>()
</script>
