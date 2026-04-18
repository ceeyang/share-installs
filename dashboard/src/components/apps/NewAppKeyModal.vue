<!-- dashboard/src/components/apps/NewAppKeyModal.vue -->
<template>
  <BaseModal :open="open" title="Application Created" @close="$emit('close')">
    <p class="text-xs text-muted mb-3 leading-relaxed">
      Your app was created with a default API key. Copy it now — it will not be shown again.
    </p>
    <div class="flex gap-2">
      <input
        :value="apiKey"
        readonly
        class="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text focus:outline-none min-w-0"
      />
      <button
        @click="copy"
        class="flex-shrink-0 px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs font-medium text-brand-text hover:bg-border transition-colors cursor-pointer"
      >
        {{ copied ? '✓ Copied' : 'Copy' }}
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps<{ open: boolean; apiKey: string }>()
defineEmits<{ close: [] }>()

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.apiKey)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
