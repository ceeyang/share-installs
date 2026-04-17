import axios from 'axios'
import client from './client'
import type { User, Quota } from './types'

// Separate client for /auth/* endpoints (not under /dashboard/ prefix)
const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  withCredentials: true,
})

export const getMe = () => client.get<User>('/me').then((r) => r.data)
export const getQuota = () => client.get<Quota>('/quota').then((r) => r.data)

export const login = (email: string, password: string) =>
  authClient.post<{ ok: boolean }>('/auth/login', { email, password })

export const register = (email: string, password: string, displayName?: string) =>
  authClient.post<{ ok: boolean }>('/auth/register', { email, password, displayName })

export interface UpdateMePayload {
  displayName?: string
  avatarUrl?: string
  currentPassword?: string
  newPassword?: string
}

export const updateMe = (data: UpdateMePayload) =>
  client.patch<User>('/me', data).then((r) => r.data)
