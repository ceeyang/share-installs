<!-- dashboard/src/components/common/ConfirmDialog.vue -->
<template>
  <BaseModal :open="open" :title="title" @close="$emit('cancel')">
    <p class="text-sm text-muted mb-6">{{ description }}</p>
    <div class="flex justify-end gap-3">
      <button
        @click="$emit('cancel')"
        class="px-4 py-2 text-sm font-medium text-brand-text bg-surface-2 hover:bg-border rounded-lg transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        @click="$emit('confirm')"
        class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        :class="danger
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-brand-cta hover:bg-green-600 text-[#020617]'"
      >
        {{ confirmLabel ?? 'Confirm' }}
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'

defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
}>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>
