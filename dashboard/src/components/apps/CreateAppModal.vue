<!-- dashboard/src/components/apps/CreateAppModal.vue -->
<template>
  <BaseModal :open="open" title="New Application" @close="handleClose">
    <form @submit.prevent="submit">
      <div class="mb-5">
        <label class="block text-sm font-medium text-brand-text mb-1.5">Application Name</label>
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          required
          placeholder="e.g. My iOS App"
          class="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-cta"
        />
      </div>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          @click="handleClose"
          class="px-4 py-2 text-sm font-medium text-muted bg-surface-2 hover:bg-border rounded-lg transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="!name.trim()"
          class="px-4 py-2 text-sm font-semibold bg-brand-cta text-[#020617] rounded-lg hover:bg-green-600 disabled:opacity-40 transition-colors cursor-pointer"
        >
          Create
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [name: string] }>()

const name = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Auto-focus input when modal opens
watch(() => props.open, async (val) => {
  if (val) {
    await nextTick()
    inputRef.value?.focus()
  }
})

function handleClose() {
  name.value = ''
  emit('close')
}

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('created', trimmed)
  name.value = ''
}
</script>
