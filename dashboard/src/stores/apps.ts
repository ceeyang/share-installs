// dashboard/src/stores/apps.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listApps, createApp as apiCreate, deleteApp as apiDelete } from '@/api/apps'
import type { App, CreatedApp } from '@/api/types'

export const useAppsStore = defineStore('apps', () => {
  const apps = ref<App[]>([])
  const loading = ref(false)

  async function fetchApps() {
    loading.value = true
    try {
      apps.value = await listApps()
    } finally {
      loading.value = false
    }
  }

  async function createApp(name: string): Promise<CreatedApp> {
    const app = await apiCreate(name)
    apps.value.unshift(app)
    return app
  }

  async function deleteApp(id: string) {
    await apiDelete(id)
    apps.value = apps.value.filter((a) => a.id !== id)
  }

  return { apps, loading, fetchApps, createApp, deleteApp }
})
