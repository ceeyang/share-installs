// dashboard/src/api/billing.ts
import client from './client'

export interface PriceInfo {
  priceId: string
  amount: number
}

export interface PricesResponse {
  PRO: { monthly: PriceInfo; yearly: PriceInfo }
  UNLIMITED: { monthly: PriceInfo; yearly: PriceInfo }
}

export interface SubscriptionDetails {
  id: string
  status: string
  nextBilledAt: string | null
  scheduledChange: { action: string; effectiveAt: string } | null
}

/**
 * Fetches configured Paddle price IDs and amounts.
 */
export async function getPrices(): Promise<PricesResponse> {
  const { data } = await client.get<PricesResponse>('/billing/prices')
  return data
}

/**
 * Creates a Paddle checkout transaction for Overlay mode.
 * Returns a transactionId to pass to Paddle.js open().
 */
export async function createCheckout(priceId: string): Promise<{ transactionId: string }> {
  const { data } = await client.post<{ transactionId: string }>('/billing/checkout', { priceId })
  return data
}

/**
 * Cancels the user's active subscription (effective at end of billing period).
 */
export async function cancelSubscription(): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>('/billing/cancel')
  return data
}

/**
 * Fetches the user's current Paddle subscription details.
 */
export async function getSubscription(): Promise<{ subscription: SubscriptionDetails | null }> {
  const { data } = await client.get<{ subscription: SubscriptionDetails | null }>(
    '/billing/subscription',
  )
  return data
}
