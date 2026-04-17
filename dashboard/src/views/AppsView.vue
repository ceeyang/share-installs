<!-- dashboard/src/views/AppsView.vue -->
<template>
  <AppLayout>
    <div class="p-8 max-w-6xl">
      <!-- Page header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-brand-text">Applications</h1>
        <button
          @click="showCreate = true"
          class="flex items-center gap-2 bg-brand-cta text-[#020617] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Application
        </button>
      </div>

      <!-- Loading -->
      <LoadingSpinner v-if="appsStore.loading" />

      <!-- Empty -->
      <EmptyState
        v-else-if="!appsStore.loading && appsStore.apps.length === 0"
        title="No applications yet"
        description="Create your first application to start tracking deferred deep link conversions."
        action-label="Create Application"
        @action="showCreate = true"
      />

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AppCard
          v-for="app in appsStore.apps"
          :key="app.id"
          :app="app"
          @delete="confirmDelete"
        />
      </div>
    </div>

    <!-- Modals -->
    <CreateAppModal
      :open="showCreate"
      @close="showCreate = false"
      @created="handleCreate"
    />

    <ConfirmDialog
      :open="!!deleteTarget"
      title="Delete Application"
      description="This will permanently delete the application and all associated data. This action cannot be undone."
      confirm-label="Delete"
      :danger="true"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAppsStore } from '@/stores/apps'
import { useNotificationsStore } from '@/stores/notifications'
import AppCard from '@/components/apps/AppCard.vue'
import CreateAppModal from '@/components/apps/CreateAppModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const appsStore = useAppsStore()
const notifs = useNotificationsStore()

const showCreate = ref(false)
const deleteTarget = ref<string | null>(null)

onMounted(() => appsStore.fetchApps())

async function handleCreate(name: string) {
  try {
    await appsStore.createApp(name)
    showCreate.value = false
    notifs.notify('Application created', 'success')
  } catch {
    notifs.notify('Failed to create application', 'error')
  }
}

function confirmDelete(id: string) {
  deleteTarget.value = id
}

async function handleDelete() {
  const id = deleteTarget.value
  deleteTarget.value = null
  if (!id) return
  try {
    await appsStore.deleteApp(id)
    notifs.notify('Application deleted', 'success')
  } catch {
    notifs.notify('Failed to delete application', 'error')
  }
}
</script>
