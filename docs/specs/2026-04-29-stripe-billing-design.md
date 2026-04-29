# Stripe Billing Integration — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  
**Author:** Claude

---

## 1. Overview

Integrate Stripe Billing into share-installs SaaS platform to handle paid plan upgrades (PRO $9/mo, UNLIMITED $29/mo) with monthly and annual billing intervals.

**Key constraint:** `User.plan` is the single source of truth and is updated **only** via Stripe Webhooks — never via client-side callbacks.

---

## 2. Architecture

```
User clicks "Upgrade"
    │
    ▼
POST /api/dashboard/billing/checkout
    │  Backend creates Stripe Checkout Session
    ▼
Browser redirects to Stripe-hosted Checkout page
    │  User pays with card / Alipay
    ▼
Stripe sends Webhook → POST /api/webhooks/stripe
    │  Backend verifies signature, updates User.plan + planExpiresAt
    ▼
success_url → /apps?upgraded=true
```

### Stripe objects

| Object | Purpose |
|--------|---------|
| `Customer` | One per user; `stripeCustomerId` stored on `User` |
| `Product` × 2 | PRO, UNLIMITED |
| `Price` × 4 | Each product: monthly + annual |
| `Checkout Session` | Created per upgrade click |
| `Customer Portal` | Self-service subscription management |

---

## 3. Database Changes

Single field added to `User`:

```prisma
model User {
  // existing fields unchanged
  stripeCustomerId  String?   @unique @map("stripe_customer_id")
}
```

Subscription details (subscription ID, invoice history) are **not** stored locally — fetched from Stripe API on demand to avoid dual-write inconsistency.

### Webhook → DB mapping

| Stripe Event | DB Update |
|---|---|
| `checkout.session.completed` | Write `stripeCustomerId` (first time only) |
| `customer.subscription.created` | `plan` + `planExpiresAt` (initial subscription) |
| `customer.subscription.updated` | `plan` + `planExpiresAt` (renewal / plan change) |
| `customer.subscription.deleted` | `plan = FREE`, `planExpiresAt = null` |
| `invoice.payment_failed` | No immediate action; wait for Stripe retry cycle |

---

## 4. Backend

### New routes

All billing routes require `requireSession` middleware (existing).

```
POST /api/dashboard/billing/checkout    Create Checkout Session → { url }
POST /api/dashboard/billing/portal      Create Customer Portal Session → { url }
GET  /api/dashboard/billing/status      Current plan + next renewal date
```

Webhook endpoint is **public** (no session), verified by Stripe signature:

```
POST /api/webhooks/stripe               Raw body + signature verification
```

### File structure

```
backend/src/billing/
  stripeClient.ts       Stripe singleton (lazy-init, throws if STRIPE_SECRET_KEY missing)
  checkoutHandler.ts    POST /billing/checkout
  portalHandler.ts      POST /billing/portal
  statusHandler.ts      GET  /billing/status
  webhookHandler.ts     POST /webhooks/stripe + event dispatch
  planMap.ts            Price ID ↔ Plan enum bidirectional mapping
```

### Checkout Session creation

1. If `user.stripeCustomerId` is null → `stripe.customers.create({ email, name })` → persist to DB
2. Resolve Price ID from `planMap` using `{ plan, interval }`
3. Create session:
   - `mode: 'subscription'`
   - `allow_promotion_codes: true`
   - `success_url: FRONTEND_URL/apps?upgraded=true`
   - `cancel_url: FRONTEND_URL/pricing`
   - `customer: stripeCustomerId`

### Webhook verification

```typescript
// This route must use express.raw() — NOT express.json()
stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
```

The `/api/webhooks/stripe` route is registered **before** `express.json()` middleware in `app.ts`, with its own `express.raw({ type: 'application/json' })` middleware scoped to that path only.

### Plan mapping (`planMap.ts`)

```typescript
// Price ID → Plan (used in webhook handler)
export function priceIdToPlan(priceId: string): Plan | null

// Plan + interval → Price ID (used in checkout handler)
export function planToPriceId(plan: 'PRO' | 'UNLIMITED', interval: 'monthly' | 'yearly'): string
```

---

## 5. Frontend

### PricingView.vue changes

- Add monthly/yearly toggle (state: `interval: 'monthly' | 'yearly'`)
- Show discounted annual price when yearly selected (e.g. "$7.2/mo, billed $86.4/year")
- Upgrade buttons call `createCheckout(plan, interval)` → redirect to `url`
- Button loading state prevents double-click

### ProfileView.vue changes

- Add "Manage Subscription" section at bottom
- Visible only when `auth.planName !== 'FREE'`
- Calls `createPortal()` → redirect to Stripe Customer Portal

### New API file: `dashboard/src/api/billing.ts`

```typescript
export const createCheckout = (plan: 'PRO' | 'UNLIMITED', interval: 'monthly' | 'yearly') =>
  client.post<{ url: string }>('/billing/checkout', { plan, interval })

export const createPortal = () =>
  client.post<{ url: string }>('/billing/portal')

export const getBillingStatus = () =>
  client.get<{ plan: string; renewsAt: string | null }>('/billing/status')
```

---

## 6. Configuration

### Environment variables (new)

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_UNLIMITED_MONTHLY=price_xxx
STRIPE_PRICE_UNLIMITED_YEARLY=price_xxx
```

All Stripe vars are **optional** in `config/index.ts` — omitting them disables billing routes gracefully (self-hosted mode is unaffected).

### Stripe Dashboard setup (one-time manual)

| Product | Interval | Price | Annual discount |
|---------|----------|-------|----------------|
| PRO | Monthly | $9.00 | — |
| PRO | Yearly | $86.40 | 20% ($7.20/mo) |
| UNLIMITED | Monthly | $29.00 | — |
| UNLIMITED | Yearly | $278.40 | 20% ($23.20/mo) |

### docker-compose.yml additions

```yaml
backend:
  environment:
    STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
    STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
    STRIPE_PRICE_PRO_MONTHLY: ${STRIPE_PRICE_PRO_MONTHLY:-}
    STRIPE_PRICE_PRO_YEARLY: ${STRIPE_PRICE_PRO_YEARLY:-}
    STRIPE_PRICE_UNLIMITED_MONTHLY: ${STRIPE_PRICE_UNLIMITED_MONTHLY:-}
    STRIPE_PRICE_UNLIMITED_YEARLY: ${STRIPE_PRICE_UNLIMITED_YEARLY:-}
```

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Stripe not configured (missing env vars) | `/billing/*` routes return `503 Service Unavailable` |
| Webhook signature invalid | Return `400`, log warning |
| Unknown Price ID in webhook | Log error, no DB update (prevents accidental downgrade) |
| Customer Portal: user has no subscription | Stripe handles gracefully (shows "no active subscription") |
| Payment failed | No immediate plan downgrade; Stripe retries for ~3 weeks, then fires `subscription.deleted` |

---

## 8. Out of Scope

- Proration on mid-cycle plan upgrades (Stripe handles automatically)
- Invoice PDF download (available via Stripe Customer Portal)
- Coupon/discount code creation (managed in Stripe Dashboard)
- Lifetime deal / one-time payment
- Multi-seat / per-seat pricing
