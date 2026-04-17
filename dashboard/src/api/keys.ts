// dashboard/src/api/keys.ts
import client from './client'
import type { ApiKey, CreatedApiKey } from './types'

export const listKeys = (appId: string) =>
  client.get<ApiKey[]>(`/apps/${appId}/keys`).then((r) => r.data)

export const createKey = (appId: string, name: string) =>
  client.post<CreatedApiKey>(`/apps/${appId}/keys`, { name }).then((r) => r.data)

export const revealKey = (appId: string, keyId: string) =>
  client.get<{ key: string }>(`/apps/${appId}/keys/${keyId}/reveal`).then((r) => r.data)

export const revokeKey = (appId: string, keyId: string) =>
  client.delete(`/apps/${appId}/keys/${keyId}`)
