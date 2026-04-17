// dashboard/src/api/types.ts

export interface User {
  id: string
  githubLogin: string
  email: string | null
  avatarUrl: string
}

export interface Quota {
  plan: 'FREE' | 'PRO' | 'UNLIMITED'
  used: number
  limit: number
}

export interface App {
  id: string
  name: string
  createdAt: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  revokedAt: string | null
}

/** Returned only on key creation — contains the full plaintext key. */
export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface AppStats {
  totalClicks: number
  totalInstalls: number
  byChannel: Record<string, number>
  byPlatform: {
    ios: number
    android: number
  }
}
