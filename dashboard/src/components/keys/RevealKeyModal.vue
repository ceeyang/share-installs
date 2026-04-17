<!-- dashboard/src/components/keys/RevealKeyModal.vue -->
<template>
  <BaseModal :open="open" title="View API Key" @close="$emit('close')">
    <LoadingSpinner v-if="loading" />

    <div v-else-if="fullKey">
      <p class="text-xs text-muted mb-3 leading-relaxed">
        This is the full decrypted key. Keep it secret — anyone with this key can record conversions to your app.
      </p>
      <div class="flex gap-2">
        <input
          :value="fullKey"
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
    </div>

    <div v-else class="text-sm text-red-500 py-4 text-center">
      Failed to load key. Please try again.
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { revealKey } from '@/api/keys'

const props = defineProps<{
  open: boolean
  appId: string
  keyId: string | null
}>()
defineEmits<{ close: [] }>()

const fullKey = ref<string | null>(null)
const loading = ref(false)
const copied = ref(false)

watch(
  () => props.keyId,
  async (id) => {
    if (!id) {
      // Modal is closing — clear sensitive data
      fullKey.value = null
      return
    }
    loading.value = true
    fullKey.value = null
    try {
      const data = await revealKey(props.appId, id)
      fullKey.value = data.key
    } catch {
      fullKey.value = null
    } finally {
      loading.value = false
    }
  },
)

async function copy() {
  if (!fullKey.value) return
  await navigator.clipboard.writeText(fullKey.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
