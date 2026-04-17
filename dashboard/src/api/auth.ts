// dashboard/src/api/auth.ts
import client from './client'
import type { User, Quota } from './types'

export const getMe = () => client.get<User>('/me').then((r) => r.data)
export const getQuota = () => client.get<Quota>('/quota').then((r) => r.data)
