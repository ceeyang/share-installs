// dashboard/src/api/stats.ts
import client from './client'
import type { AppStats } from './types'

export const getStats = (appId: string) =>
  client.get<AppStats>(`/apps/${appId}/stats`).then((r) => r.data)
