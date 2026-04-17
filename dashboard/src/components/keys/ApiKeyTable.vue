<!-- dashboard/src/components/keys/ApiKeyTable.vue -->
<template>
  <div class="bg-surface border border-border rounded-lg overflow-hidden">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-surface-2 border-b border-border">
          <th class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Name</th>
          <th class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Prefix</th>
          <th class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Created</th>
          <th class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr v-if="keys.length === 0">
          <td colspan="4" class="px-4 py-12 text-center text-sm text-muted">No API keys yet</td>
        </tr>
        <tr
          v-for="key in keys"
          :key="key.id"
          class="hover:bg-surface-2 transition-colors"
        >
          <td class="px-4 py-3 font-medium text-brand-text">{{ key.name }}</td>
          <td class="px-4 py-3 font-mono text-xs text-muted tracking-wider">{{ key.prefix }}••••••••</td>
          <td class="px-4 py-3 text-sm text-muted">{{ formatDate(key.createdAt) }}</td>
          <td class="px-4 py-3 text-right">
            <template v-if="!key.revokedAt">
              <button
                @click="$emit('reveal', key.id)"
                class="text-xs font-medium text-muted hover:text-brand-text px-2 py-1 rounded hover:bg-surface-2 transition-colors cursor-pointer mr-1"
              >
                View
              </button>
              <button
                @click="$emit('revoke', key.id)"
                class="text-xs font-medium text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                Revoke
              </button>
            </template>
            <span v-else class="text-[10px] font-semibold uppercase tracking-wider text-muted bg-surface-2 px-2 py-1 rounded">
              Revoked
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { ApiKey } from '@/api/types'

defineProps<{ keys: ApiKey[] }>()
defineEmits<{ reveal: [id: string]; revoke: [id: string] }>()

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>
