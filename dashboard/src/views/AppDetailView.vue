<!-- dashboard/src/views/AppDetailView.vue -->
<template>
  <AppLayout>
    <div class="p-8">

      <!-- Back + App name header -->
      <div class="flex items-center gap-3 mb-6">
        <RouterLink to="/apps" class="text-muted hover:text-brand-text transition-colors cursor-pointer">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </RouterLink>
        <h1 class="text-xl font-bold text-brand-text truncate">{{ appName }}</h1>
      </div>

      <!-- Tab bar -->
      <div class="flex gap-0 border-b border-border mb-6">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors cursor-pointer"
          :class="activeTab === tab
            ? 'text-brand-text border-brand-cta'
            : 'text-muted border-transparent hover:text-brand-text hover:border-border'"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Overview tab -->
      <div v-if="activeTab === 'Overview'">
        <StatsGrid :stats="stats" :loading="statsLoading" @retry="loadStats" />
      </div>

      <!-- API Keys tab -->
      <div v-else-if="activeTab === 'API Keys'">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-brand-text">API Keys</h2>
          <button
            @click="showCreateKey = true"
            class="flex items-center gap-2 bg-brand-cta text-[#020617] px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Generate Key
          </button>
        </div>

        <!-- One-time banner for newly created key -->
        <div v-if="newKey" class="mb-4 p-4 bg-brand-cta/10 border border-brand-cta/20 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-brand-cta">Key generated — copy it now, it won't appear again</p>
            <button @click="newKey = null" class="text-muted hover:text-brand-text cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex gap-2">
            <input
              :value="newKey"
              readonly
              class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text focus:outline-none min-w-0"
            />
            <button
              @click="copyNewKey"
              class="flex-shrink-0 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-brand-text hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {{ newKeyCopied ? '✓' : 'Copy' }}
            </button>
          </div>
        </div>

        <LoadingSpinner v-if="keysLoading" />
        <ApiKeyTable
          v-else
          :keys="keys"
          @reveal="openReveal"
          @revoke="confirmRevoke"
        />
      </div>
    </div>

    <!-- Modals -->
    <CreateKeyModal
      :open="showCreateKey"
      @close="showCreateKey = false"
      @created="handleCreateKey"
    />

    <RevealKeyModal
      :open="!!revealKeyId"
      :app-id="appId"
      :key-id="revealKeyId"
      @close="revealKeyId = null"
    />

    <ConfirmDialog
      :open="!!revokeTarget"
      title="Revoke API Key"
      description="This will immediately disable the key. Any SDK using it will stop attributing installs. This cannot be undone."
      confirm-label="Revoke"
      :danger="true"
      @confirm="handleRevoke"
      @cancel="revokeTarget = null"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { createKey, listKeys, revokeKey } from '@/api/keys'
import { getStats } from '@/api/stats'
import type { ApiKey, AppStats } from '@/api/types'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ApiKeyTable from '@/components/keys/ApiKeyTable.vue'
import CreateKeyModal from '@/components/keys/CreateKeyModal.vue'
import RevealKeyModal from '@/components/keys/RevealKeyModal.vue'
import StatsGrid from '@/components/stats/StatsGrid.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAppsStore } from '@/stores/apps'
import { useNotificationsStore } from '@/stores/notifications'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const appsStore = useAppsStore()
const notifs = useNotificationsStore()

const appId = route.params.id as string
const tabs = ['Overview', 'API Keys'] as const
const activeTab = ref<(typeof tabs)[number]>('Overview')

const appName = computed(
  () => appsStore.apps.find((a) => a.id === appId)?.name ?? appId,
)

// ── Stats ──────────────────────────────────────────────────
const stats = ref<AppStats | null>(null)
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = await getStats(appId)
  } catch {
    stats.value = null
    notifs.notify('Failed to load stats', 'error')
  } finally {
    statsLoading.value = false
  }
}

// ── API Keys ───────────────────────────────────────────────
const keys = ref<ApiKey[]>([])
const keysLoading = ref(false)
const showCreateKey = ref(false)
const newKey = ref<string | null>(null)
const newKeyCopied = ref(false)
const revealKeyId = ref<string | null>(null)
const revokeTarget = ref<string | null>(null)

async function loadKeys() {
  keysLoading.value = true
  try {
    keys.value = await listKeys(appId)
  } catch {
    notifs.notify('Failed to load API keys', 'error')
  } finally {
    keysLoading.value = false
  }
}

async function handleCreateKey(name: string) {
  try {
    const created = await createKey(appId, name)
    newKey.value = created.key
    showCreateKey.value = false
    await loadKeys()
    notifs.notify('API key generated', 'success')
  } catch {
    notifs.notify('Failed to generate API key', 'error')
  }
}

function openReveal(id: string) {
  revealKeyId.value = id
}

function confirmRevoke(id: string) {
  revokeTarget.value = id
}

async function handleRevoke() {
  const id = revokeTarget.value
  revokeTarget.value = null
  if (!id) return
  try {
    await revokeKey(appId, id)
    await loadKeys()
    notifs.notify('API key revoked', 'success')
  } catch {
    notifs.notify('Failed to revoke API key', 'error')
  }
}

async function copyNewKey() {
  if (!newKey.value) return
  await navigator.clipboard.writeText(newKey.value)
  newKeyCopied.value = true
  setTimeout(() => (newKeyCopied.value = false), 1500)
}

// ── Init ───────────────────────────────────────────────────
onMounted(async () => {
  // Ensure app name is available in sidebar breadcrumb
  if (appsStore.apps.length === 0) await appsStore.fetchApps()
  // Load both tabs eagerly so switching is instant
  loadStats()
  loadKeys()
})
</script>
