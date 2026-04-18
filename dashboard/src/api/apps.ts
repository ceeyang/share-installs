// dashboard/src/api/apps.ts
import client from './client'
import type { App, CreatedApp } from './types'

export const listApps = () => client.get<App[]>('/apps').then((r) => r.data)

export const createApp = (name: string) =>
  client.post<CreatedApp>('/apps', { name }).then((r) => r.data)

export const deleteApp = (id: string) => client.delete(`/apps/${id}`)
