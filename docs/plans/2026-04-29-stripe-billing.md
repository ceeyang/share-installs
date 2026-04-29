# Stripe Billing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Stripe Billing so users can upgrade to PRO ($9/mo) or UNLIMITED ($29/mo) with monthly or annual billing, managed entirely via server-side webhooks.

**Architecture:** Frontend triggers a Stripe-hosted Checkout Session; plan state is updated exclusively via Stripe Webhooks (never from client-side callbacks). A Stripe Customer Portal lets paid users manage their subscription self-service.

**Tech Stack:** stripe npm package, Express raw body middleware for webhook verification, Prisma migration, Vue 3 ref/computed for toggle UI.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `backend/package.json` |
| Modify | `backend/src/config/index.ts` |
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/<timestamp>_add_stripe_customer_id/migration.sql` |
| Create | `backend/src/billing/planMap.ts` |
| Create | `backend/src/billing/stripeClient.ts` |
| Create | `backend/src/billing/webhookHandler.ts` |
| Create | `backend/src/billing/checkoutHandler.ts` |
| Create | `backend/src/billing/portalHandler.ts` |
| Create | `backend/src/billing/statusHandler.ts` |
| Modify | `backend/src/app.ts` |
| Modify | `backend/src/routes/index.ts` |
| Create | `backend/tests/unit/billing/planMap.test.ts` |
| Create | `backend/tests/unit/billing/webhookHandler.test.ts` |
| Create | `dashboard/src/api/billing.ts` |
| Modify | `dashboard/src/views/PricingView.vue` |
| Modify | `dashboard/src/views/ProfileView.vue` |
| Modify | `docker-compose.yml` |
| Modify | `docker-compose.dev.yml` |

---

## Task 1: Install Stripe SDK & extend config

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/config/index.ts`

- [ ] **Step 1: Install stripe npm package**

```bash
cd backend && npm install stripe
```

Expected: `stripe` appears in `package.json` dependencies, no errors.

- [ ] **Step 2: Add Stripe fields to config schema**

Open `backend/src/config/index.ts`. Add these 6 optional fields inside `configSchema` after the `ENCRYPTION_KEY` line:

```typescript
  // Stripe Billing (optional – omit to disable billing routes)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_UNLIMITED_MONTHLY: z.string().optional(),
  STRIPE_PRICE_UNLIMITED_YEARLY: z.string().optional(),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/config/index.ts
git commit -m "feat(billing): install stripe SDK and extend config schema"
```

---

## Task 2: Prisma migration — add stripeCustomerId

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: migration file (auto-generated)

- [ ] **Step 1: Add field to schema**

In `backend/prisma/schema.prisma`, add one line inside the `User` model after `passwordHash`:

```prisma
  stripeCustomerId  String?   @unique @map("stripe_customer_id")
```

- [ ] **Step 2: Generate migration**

```bash
cd backend && npx prisma migrate dev --name add_stripe_customer_id
```

Expected output includes: `✔ Generated Prisma Client` and a new file under `prisma/migrations/`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (Prisma client regenerated with new field).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(billing): add stripeCustomerId to User model"
```

---

## Task 3: planMap.ts + unit tests

**Files:**
- Create: `backend/src/billing/planMap.ts`
- Create: `backend/tests/unit/billing/planMap.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/unit/billing/planMap.test.ts`:

```typescript
import { Plan } from '@prisma/client';

// Override env before importing planMap (config reads env at module load time)
beforeAll(() => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
  process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_y';
  process.env.STRIPE_PRICE_UNLIMITED_MONTHLY = 'price_unl_m';
  process.env.STRIPE_PRICE_UNLIMITED_YEARLY = 'price_unl_y';
});

// Import after env is set
let planToPriceId: (plan: 'PRO' | 'UNLIMITED', interval: 'monthly' | 'yearly') => string;
let priceIdToPlan: (priceId: string) => Plan | null;

beforeAll(async () => {
  const mod = await import('../../src/billing/planMap');
  planToPriceId = mod.planToPriceId;
  priceIdToPlan = mod.priceIdToPlan;
});

describe('planToPriceId', () => {
  it('returns PRO monthly price ID', () => {
    expect(planToPriceId('PRO', 'monthly')).toBe('price_pro_m');
  });

  it('returns PRO yearly price ID', () => {
    expect(planToPriceId('PRO', 'yearly')).toBe('price_pro_y');
  });

  it('returns UNLIMITED monthly price ID', () => {
    expect(planToPriceId('UNLIMITED', 'monthly')).toBe('price_unl_m');
  });

  it('returns UNLIMITED yearly price ID', () => {
    expect(planToPriceId('UNLIMITED', 'yearly')).toBe('price_unl_y');
  });
});

describe('priceIdToPlan', () => {
  it('maps PRO monthly price to PRO plan', () => {
    expect(priceIdToPlan('price_pro_m')).toBe('PRO');
  });

  it('maps PRO yearly price to PRO plan', () => {
    expect(priceIdToPlan('price_pro_y')).toBe('PRO');
  });

  it('maps UNLIMITED monthly price to UNLIMITED plan', () => {
    expect(priceIdToPlan('price_unl_m')).toBe('UNLIMITED');
  });

  it('returns null for unknown price ID', () => {
    expect(priceIdToPlan('price_unknown')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
cd backend && npx jest tests/unit/billing/planMap.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/billing/planMap'`

- [ ] **Step 3: Create planMap.ts**

Create `backend/src/billing/planMap.ts`:

```typescript
import { Plan } from '@prisma/client';
import { config } from '../config/index';

export function planToPriceId(
  plan: 'PRO' | 'UNLIMITED',
  interval: 'monthly' | 'yearly',
): string {
  const key = `${plan}:${interval}` as const;
  const map: Record<string, string | undefined> = {
    'PRO:monthly': config.STRIPE_PRICE_PRO_MONTHLY,
    'PRO:yearly': config.STRIPE_PRICE_PRO_YEARLY,
    'UNLIMITED:monthly': config.STRIPE_PRICE_UNLIMITED_MONTHLY,
    'UNLIMITED:yearly': config.STRIPE_PRICE_UNLIMITED_YEARLY,
  };
  const priceId = map[key];
  if (!priceId) throw new Error(`No Stripe price configured for ${key}`);
  return priceId;
}

export function priceIdToPlan(priceId: string): Plan | null {
  const map: Record<string, Plan> = {};
  if (config.STRIPE_PRICE_PRO_MONTHLY) map[config.STRIPE_PRICE_PRO_MONTHLY] = 'PRO';
  if (config.STRIPE_PRICE_PRO_YEARLY) map[config.STRIPE_PRICE_PRO_YEARLY] = 'PRO';
  if (config.STRIPE_PRICE_UNLIMITED_MONTHLY) map[config.STRIPE_PRICE_UNLIMITED_MONTHLY] = 'UNLIMITED';
  if (config.STRIPE_PRICE_UNLIMITED_YEARLY) map[config.STRIPE_PRICE_UNLIMITED_YEARLY] = 'UNLIMITED';
  return map[priceId] ?? null;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx jest tests/unit/billing/planMap.test.ts --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/planMap.ts backend/tests/unit/billing/planMap.test.ts
git commit -m "feat(billing): add planMap with Price ID ↔ Plan bidirectional mapping"
```

---

## Task 4: stripeClient.ts — Stripe singleton

**Files:**
- Create: `backend/src/billing/stripeClient.ts`

- [ ] **Step 1: Create the file**

Create `backend/src/billing/stripeClient.ts`:

```typescript
import Stripe from 'stripe';
import { config } from '../config/index';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2025-03-31.basil',
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!(config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/billing/stripeClient.ts
git commit -m "feat(billing): add Stripe singleton client"
```

---

## Task 5: webhookHandler.ts + tests

**Files:**
- Create: `backend/src/billing/webhookHandler.ts`
- Create: `backend/tests/unit/billing/webhookHandler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/billing/webhookHandler.test.ts`:

```typescript
import { Request, Response } from 'express';
import { Plan } from '@prisma/client';

// ---- Mocks ----
const mockConstructEvent = jest.fn();
const mockUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
const mockUserUpdate = jest.fn().mockResolvedValue({});
const mockUserFindUnique = jest.fn();
const mockPriceIdToPlan = jest.fn();

jest.mock('../../src/billing/stripeClient', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
  isStripeConfigured: () => true,
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
      updateMany: mockUserUpdateMany,
    },
  },
}));

jest.mock('../../src/billing/planMap', () => ({
  priceIdToPlan: mockPriceIdToPlan,
}));

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

import { handleStripeWebhook } from '../../src/billing/webhookHandler';

function makeReq(body: Buffer, sig: string): Request {
  return {
    body,
    headers: { 'stripe-signature': sig },
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnThis();
  return { res: { status, json } as unknown as Response, status, json };
}

describe('handleStripeWebhook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when signature is missing', async () => {
    const { res, status, json } = makeRes();
    const req = { body: Buffer.from('{}'), headers: {} } as unknown as Request;
    await handleStripeWebhook(req, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Missing signature' });
  });

  it('returns 400 when constructEvent throws', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('bad sig');
    });
    const { res, status } = makeRes();
    await handleStripeWebhook(makeReq(Buffer.from('{}'), 'sig'), res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('downgrades plan to FREE on subscription.deleted', async () => {
    const event = {
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_123' } },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    const { res, json } = makeRes();
    await handleStripeWebhook(makeReq(Buffer.from('{}'), 'sig'), res);
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
      data: { plan: 'FREE', planExpiresAt: null },
    });
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('updates plan on subscription.created', async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    const event = {
      type: 'customer.subscription.created',
      data: {
        object: {
          customer: 'cus_123',
          current_period_end: periodEnd,
          items: { data: [{ price: { id: 'price_pro_m' } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user_1' });
    mockPriceIdToPlan.mockReturnValueOnce('PRO' as Plan);
    const { res, json } = makeRes();
    await handleStripeWebhook(makeReq(Buffer.from('{}'), 'sig'), res);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { plan: 'PRO', planExpiresAt: new Date(periodEnd * 1000) },
    });
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('does not update DB when priceId is unknown', async () => {
    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          current_period_end: 9999999999,
          items: { data: [{ price: { id: 'price_unknown' } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user_1' });
    mockPriceIdToPlan.mockReturnValueOnce(null);
    const { res, json } = makeRes();
    await handleStripeWebhook(makeReq(Buffer.from('{}'), 'sig'), res);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ received: true });
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
cd backend && npx jest tests/unit/billing/webhookHandler.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/billing/webhookHandler'`

- [ ] **Step 3: Create webhookHandler.ts**

Create `backend/src/billing/webhookHandler.ts`:

```typescript
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { getStripe } from './stripeClient';
import { priceIdToPlan } from './planMap';
import { prisma } from '../lib/prisma';
import { config } from '../config/index';
import { logger } from '../utils/logger';

async function upsertSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) {
    logger.warn({ customerId }, 'Stripe webhook: no user found for customer');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;

  if (!plan) {
    logger.error({ priceId }, 'Stripe webhook: unknown priceId — skipping DB update');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      planExpiresAt: new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];

  if (!sig || !config.STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      sig,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // stripeCustomerId is already saved in checkoutHandler before redirecting.
        // This is a safety-net: if the DB write failed, recover here.
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.metadata?.userId) {
          await prisma.user.update({
            where: { id: session.metadata.userId },
            data: { stripeCustomerId: session.customer as string },
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: 'FREE', planExpiresAt: null },
        });
        break;
      }

      case 'invoice.payment_failed':
        logger.info({ eventId: event.id }, 'Invoice payment failed — awaiting Stripe retry cycle');
        break;

      default:
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Error processing Stripe webhook event');
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }

  res.json({ received: true });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx jest tests/unit/billing/webhookHandler.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/webhookHandler.ts backend/tests/unit/billing/webhookHandler.test.ts
git commit -m "feat(billing): add webhook handler with subscription event processing"
```

---

## Task 6: checkoutHandler.ts

**Files:**
- Create: `backend/src/billing/checkoutHandler.ts`

- [ ] **Step 1: Create the file**

Create `backend/src/billing/checkoutHandler.ts`:

```typescript
import { Request, Response } from 'express';
import { getStripe } from './stripeClient';
import { planToPriceId } from './planMap';
import { prisma } from '../lib/prisma';
import { config } from '../config/index';
import { logger } from '../utils/logger';

export async function handleCheckout(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { plan, interval } = req.body as { plan?: string; interval?: string };

  if (plan !== 'PRO' && plan !== 'UNLIMITED') {
    res.status(400).json({ error: 'plan must be PRO or UNLIMITED' });
    return;
  }
  if (interval !== 'monthly' && interval !== 'yearly') {
    res.status(400).json({ error: 'interval must be monthly or yearly' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const stripe = getStripe();
  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.displayName ?? user.githubLogin ?? undefined,
      metadata: { userId },
    });
    stripeCustomerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  }

  let priceId: string;
  try {
    priceId = planToPriceId(plan, interval);
  } catch {
    res.status(503).json({ error: 'Billing price not configured' });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { userId },
    success_url: `${config.FRONTEND_URL}/apps?upgraded=true`,
    cancel_url: `${config.FRONTEND_URL}/pricing`,
  });

  logger.info({ userId, plan, interval }, 'Checkout session created');
  res.json({ url: session.url });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/billing/checkoutHandler.ts
git commit -m "feat(billing): add checkout handler — creates Stripe Checkout Session"
```

---

## Task 7: portalHandler.ts + statusHandler.ts

**Files:**
- Create: `backend/src/billing/portalHandler.ts`
- Create: `backend/src/billing/statusHandler.ts`

- [ ] **Step 1: Create portalHandler.ts**

Create `backend/src/billing/portalHandler.ts`:

```typescript
import { Request, Response } from 'express';
import { getStripe } from './stripeClient';
import { prisma } from '../lib/prisma';
import { config } from '../config/index';

export async function handlePortal(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  if (!user.stripeCustomerId) {
    res.status(400).json({ error: 'No billing account found. Please upgrade first.' });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.FRONTEND_URL}/profile`,
  });

  res.json({ url: session.url });
}
```

- [ ] **Step 2: Create statusHandler.ts**

Create `backend/src/billing/statusHandler.ts`:

```typescript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function handleStatus(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  res.json({
    plan: user.plan,
    renewsAt: user.planExpiresAt?.toISOString() ?? null,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/billing/portalHandler.ts backend/src/billing/statusHandler.ts
git commit -m "feat(billing): add portal and status handlers"
```

---

## Task 8: Wire routes — app.ts webhook raw body + routes/index.ts

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/index.ts`

**Critical:** The Stripe webhook route must use `express.raw()` (not `express.json()`) to preserve the raw body for signature verification. Register it BEFORE the global `express.json()` middleware.

- [ ] **Step 1: Register raw-body middleware for webhook route in app.ts**

In `backend/src/app.ts`, add the following BEFORE the `app.use(express.json(...))` line. Current `express.json` is at line ~64. Add before it:

```typescript
  // Stripe webhook requires raw Buffer body for signature verification.
  // Must be registered before the global express.json() middleware.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
```

The block around it should look like:

```typescript
  // Stripe webhook requires raw Buffer body for signature verification.
  // Must be registered before the global express.json() middleware.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

  // Request body parsing
  app.use(express.json({limit: '1mb'}));
  app.use(express.urlencoded({extended: true}));
```

- [ ] **Step 2: Mount billing routes in routes/index.ts**

In `backend/src/routes/index.ts`, add the following imports near the top (after existing imports):

```typescript
import { handleCheckout } from '../billing/checkoutHandler';
import { handlePortal } from '../billing/portalHandler';
import { handleStatus } from '../billing/statusHandler';
import { handleStripeWebhook } from '../billing/webhookHandler';
import { isStripeConfigured } from '../billing/stripeClient';
```

Then add a helper middleware and two route blocks inside `createRouter`, AFTER the existing `router.use('/dashboard', dashboard)` line:

```typescript
  // ---- Stripe Billing (/dashboard/billing/*) ----
  // Reuses requireSession from above. Returns 503 if Stripe env vars are absent.
  const requireStripe = (_req: Request, res: Response, next: NextFunction) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Billing not configured' });
      return;
    }
    next();
  };

  const billing = Router();
  billing.use(requireSession);
  billing.use(requireStripe);
  billing.post('/checkout', handleCheckout);
  billing.post('/portal', handlePortal);
  billing.get('/status', handleStatus);
  router.use('/dashboard/billing', billing);

  // ---- Stripe Webhook (/webhooks/stripe) — public, verified by signature ----
  router.post('/webhooks/stripe', handleStripeWebhook);
```

Update the express import at the top of `routes/index.ts` to include `Request`, `Response`, and `NextFunction` (they're needed for the inline middleware):

```typescript
import {Router, Request, Response, NextFunction} from 'express';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
cd backend && npx jest tests/unit --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/routes/index.ts
git commit -m "feat(billing): wire billing routes and Stripe webhook endpoint"
```

---

## Task 9: Frontend billing.ts API

**Files:**
- Create: `dashboard/src/api/billing.ts`

- [ ] **Step 1: Create the file**

Create `dashboard/src/api/billing.ts`:

```typescript
import client from './client'

export const createCheckout = (
  plan: 'PRO' | 'UNLIMITED',
  interval: 'monthly' | 'yearly',
) => client.post<{ url: string }>('/billing/checkout', { plan, interval })

export const createPortal = () =>
  client.post<{ url: string }>('/billing/portal')

export const getBillingStatus = () =>
  client.get<{ plan: string; renewsAt: string | null }>('/billing/status')
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dashboard && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/api/billing.ts
git commit -m "feat(billing): add frontend billing API functions"
```

---

## Task 10: PricingView.vue — toggle + checkout buttons

**Files:**
- Modify: `dashboard/src/views/PricingView.vue`

The current view has a static `plans` array with hardcoded price strings and disabled buttons. We will:
1. Add a monthly/yearly ref toggle
2. Replace the static `price` string with computed display prices
3. Replace the no-op upgrade buttons with `upgrade()` function calls
4. Add loading state per plan button

- [ ] **Step 1: Replace the entire PricingView.vue**

Replace `dashboard/src/views/PricingView.vue` with:

```vue
<!-- dashboard/src/views/PricingView.vue -->
<template>
  <AppLayout>
    <div class="p-8">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-brand-text mb-1">Pricing</h1>
        <p class="text-sm text-muted">Choose the plan that fits your scale.</p>
      </div>

      <!-- Current usage bar -->
      <div v-if="auth.quota" class="mb-8 bg-surface border border-border rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-sm font-medium text-brand-text">Current Usage</p>
            <p class="text-xs text-muted mt-0.5">
              Plan: <span class="font-semibold" :class="planColor">{{ auth.planName }}</span>
            </p>
          </div>
          <p class="text-sm font-mono text-muted">
            {{ auth.quota.monthly.used.toLocaleString() }} /
            {{ auth.quota.monthly.limit === null ? '∞' : auth.quota.monthly.limit.toLocaleString() }}
            <span class="text-xs ml-1">resolutions</span>
          </p>
        </div>
        <div class="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="auth.usagePercent >= 80 ? 'bg-red-500' : 'bg-brand-cta'"
            :style="{ width: `${auth.usagePercent}%` }"
          />
        </div>
        <p class="text-xs text-muted mt-1.5">{{ auth.usagePercent }}% used this month</p>
      </div>

      <!-- Monthly / Yearly toggle -->
      <div class="flex items-center gap-3 mb-8">
        <span
          class="text-sm font-medium transition-colors"
          :class="interval === 'monthly' ? 'text-brand-text' : 'text-muted'"
        >Monthly</span>
        <button
          @click="interval = interval === 'monthly' ? 'yearly' : 'monthly'"
          class="relative w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none"
          :class="interval === 'yearly' ? 'bg-brand-cta' : 'bg-surface-2 border border-border'"
          aria-label="Toggle billing interval"
        >
          <span
            class="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
            :class="interval === 'yearly' ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
        <span
          class="text-sm font-medium transition-colors"
          :class="interval === 'yearly' ? 'text-brand-text' : 'text-muted'"
        >
          Yearly
          <span class="text-brand-cta text-xs font-bold ml-1">-20%</span>
        </span>
      </div>

      <!-- Plan cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="bg-surface border rounded-xl p-6 flex flex-col relative transition-colors"
          :class="[
            auth.planName === plan.id ? 'border-brand-cta' : plan.popular ? 'border-brand-cta/40' : 'border-border',
            plan.popular ? 'bg-gradient-to-b from-surface to-brand-cta/[0.03]' : ''
          ]"
        >
          <!-- Popular badge -->
          <div
            v-if="plan.popular"
            class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-cta text-[#020617] text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
          >
            Most Popular
          </div>

          <!-- Current badge -->
          <div class="flex items-center justify-between mb-1">
            <p class="text-xs font-bold uppercase tracking-wider" :class="plan.color">
              {{ plan.name }}
            </p>
            <span
              v-if="auth.planName === plan.id"
              class="text-[10px] font-bold bg-brand-cta/10 text-brand-cta px-2 py-0.5 rounded-full uppercase tracking-wider"
            >
              Current
            </span>
          </div>

          <!-- Price -->
          <div class="mb-0.5">
            <span class="text-3xl font-bold font-mono text-brand-text">{{ displayPrice(plan.id) }}</span>
            <span class="text-sm text-muted"> / mo</span>
          </div>
          <p v-if="billedAs(plan.id)" class="text-xs text-muted mb-4">{{ billedAs(plan.id) }}</p>
          <div v-else class="mb-4" />

          <!-- Description -->
          <p class="text-xs text-muted mb-5 leading-relaxed">{{ plan.description }}</p>

          <!-- Feature list -->
          <ul class="space-y-2 mb-6 flex-1">
            <li
              v-for="feat in plan.features"
              :key="feat.label"
              class="flex items-start gap-2 text-sm"
              :class="feat.dim ? 'text-muted/50' : 'text-muted'"
            >
              <svg v-if="!feat.dim" class="w-4 h-4 text-brand-cta flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-4 h-4 text-muted/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {{ feat.label }}
            </li>
          </ul>

          <!-- CTA -->
          <button
            :disabled="auth.planName === plan.id || plan.id === 'FREE' || loadingPlan === plan.id"
            @click="plan.id !== 'FREE' && auth.planName !== plan.id && upgrade(plan.id as 'PRO' | 'UNLIMITED')"
            class="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default"
            :class="auth.planName === plan.id || plan.id === 'FREE'
              ? 'bg-surface-2 text-muted'
              : plan.popular
                ? 'bg-brand-cta text-[#020617] hover:bg-green-600'
                : 'border border-border text-brand-text hover:border-brand-cta/50'"
          >
            <span v-if="loadingPlan === plan.id" class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Redirecting…
            </span>
            <span v-else>{{ auth.planName === plan.id ? 'Current Plan' : plan.cta }}</span>
          </button>
        </div>
      </div>

      <p v-if="checkoutError" class="mt-4 text-xs text-red-500 text-center">{{ checkoutError }}</p>

      <p class="mt-6 text-xs text-muted text-center">
        Need more than Unlimited?
        <a href="https://github.com/ceeyang/share-installs/issues" target="_blank" rel="noopener" class="text-brand-cta hover:underline">Contact us</a>
        for a custom plan. Or go
        <a href="https://github.com/ceeyang/share-installs" target="_blank" rel="noopener" class="text-brand-cta hover:underline">self-hosted</a>
        — unlimited usage, zero cost.
      </p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { createCheckout } from '@/api/billing'

const auth = useAuthStore()
const interval = ref<'monthly' | 'yearly'>('monthly')
const loadingPlan = ref<string | null>(null)
const checkoutError = ref('')

const planColor = computed(() => {
  if (auth.planName === 'PRO') return 'text-purple-500'
  if (auth.planName === 'UNLIMITED') return 'text-amber-500'
  return 'text-brand-cta'
})

function displayPrice(planId: string): string {
  if (planId === 'FREE') return '$0'
  if (planId === 'PRO') return interval.value === 'monthly' ? '$9' : '$7.20'
  if (planId === 'UNLIMITED') return interval.value === 'monthly' ? '$29' : '$23.20'
  return '$0'
}

function billedAs(planId: string): string | null {
  if (interval.value !== 'yearly' || planId === 'FREE') return null
  if (planId === 'PRO') return 'billed $86.40/year'
  if (planId === 'UNLIMITED') return 'billed $278.40/year'
  return null
}

async function upgrade(planId: 'PRO' | 'UNLIMITED') {
  checkoutError.value = ''
  loadingPlan.value = planId
  try {
    const { data } = await createCheckout(planId, interval.value)
    window.location.href = data.url
  } catch {
    checkoutError.value = 'Failed to start checkout. Please try again.'
    loadingPlan.value = null
  }
}

const plans = [
  {
    id: 'FREE' as const,
    name: 'Free',
    description: 'Perfect for indie developers and side projects. No credit card required.',
    color: 'text-brand-cta',
    popular: false,
    cta: 'Get Started',
    features: [
      { label: '500 monthly installs', dim: false },
      { label: '1 project', dim: false },
      { label: '2 API keys per project', dim: false },
      { label: '7-day data retention', dim: false },
      { label: 'Basic dashboard & stats', dim: false },
      { label: 'Priority support', dim: true },
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    description: 'For growing product teams that need higher throughput and longer data history.',
    color: 'text-purple-500',
    popular: true,
    cta: 'Upgrade to Pro',
    features: [
      { label: '10,000 monthly installs', dim: false },
      { label: 'Up to 5 projects', dim: false },
      { label: '10 API keys per project', dim: false },
      { label: '90-day data retention', dim: false },
      { label: 'Advanced analytics & Funnels', dim: false },
      { label: 'Priority email support', dim: false },
    ],
  },
  {
    id: 'UNLIMITED' as const,
    name: 'Unlimited',
    description: 'For high-traffic apps and enterprise teams that need unlimited scale.',
    color: 'text-amber-500',
    popular: false,
    cta: 'Upgrade Now',
    features: [
      { label: 'Unlimited monthly installs', dim: false },
      { label: 'Unlimited projects', dim: false },
      { label: 'Unlimited API keys', dim: false },
      { label: '365-day data retention', dim: false },
      { label: 'Dedicated support & SLA', dim: false },
      { label: 'Custom branding & Invoicing', dim: false },
    ],
  },
]
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dashboard && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/views/PricingView.vue
git commit -m "feat(billing): add monthly/yearly toggle and Stripe checkout to PricingView"
```

---

## Task 11: ProfileView.vue — Manage Subscription section

**Files:**
- Modify: `dashboard/src/views/ProfileView.vue`

Add a "Billing" card at the bottom of ProfileView, visible only when the user is on a paid plan.

- [ ] **Step 1: Add billing import and portal logic to the script section**

In `dashboard/src/views/ProfileView.vue`, add to the imports at the top of `<script setup>`:

```typescript
import { createPortal } from '@/api/billing'
```

And add these two refs + function after the existing `onMounted` block:

```typescript
const openingPortal = ref(false)
const portalError = ref('')

async function openBillingPortal() {
  openingPortal.value = true
  portalError.value = ''
  try {
    const { data } = await createPortal()
    window.location.href = data.url
  } catch {
    portalError.value = 'Failed to open billing portal. Please try again.'
    openingPortal.value = false
  }
}
```

- [ ] **Step 2: Add the Billing card to the template**

In the template, add this new card block AFTER the closing `</div>` of the "Change Password" section (before the outer `</div>`), still inside `<div class="max-w-lg mx-auto py-8 px-4 space-y-4">`:

```html
      <!-- Billing (paid plans only) -->
      <div v-if="auth.planName !== 'FREE'" class="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 class="text-sm font-semibold text-brand-text">Billing</h2>
        <p class="text-xs text-muted">
          Current plan: <span class="font-semibold text-brand-text">{{ auth.planName }}</span>
          <span v-if="auth.quota?.monthly.resetAt" class="ml-2 text-muted">
            · renews {{ new Date(auth.quota.monthly.resetAt).toLocaleDateString() }}
          </span>
        </p>
        <button
          @click="openBillingPortal"
          :disabled="openingPortal"
          class="px-4 py-2 rounded-lg border border-border text-brand-text text-sm font-semibold hover:border-brand-cta/50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {{ openingPortal ? 'Opening…' : 'Manage Subscription' }}
        </button>
        <p v-if="portalError" class="text-xs text-red-500">{{ portalError }}</p>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd dashboard && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/views/ProfileView.vue
git commit -m "feat(billing): add Manage Subscription section to ProfileView"
```

---

## Task 12: docker-compose env vars

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

- [ ] **Step 1: Add Stripe env vars to docker-compose.yml**

In `docker-compose.yml`, under `backend: environment:`, add after the `GITHUB_CLIENT_SECRET` line:

```yaml
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      STRIPE_PRICE_PRO_MONTHLY: ${STRIPE_PRICE_PRO_MONTHLY:-}
      STRIPE_PRICE_PRO_YEARLY: ${STRIPE_PRICE_PRO_YEARLY:-}
      STRIPE_PRICE_UNLIMITED_MONTHLY: ${STRIPE_PRICE_UNLIMITED_MONTHLY:-}
      STRIPE_PRICE_UNLIMITED_YEARLY: ${STRIPE_PRICE_UNLIMITED_YEARLY:-}
```

- [ ] **Step 2: Add same vars to docker-compose.dev.yml backend environment**

In `docker-compose.dev.yml`, under `backend: environment:`, add:

```yaml
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      STRIPE_PRICE_PRO_MONTHLY: ${STRIPE_PRICE_PRO_MONTHLY:-}
      STRIPE_PRICE_PRO_YEARLY: ${STRIPE_PRICE_PRO_YEARLY:-}
      STRIPE_PRICE_UNLIMITED_MONTHLY: ${STRIPE_PRICE_UNLIMITED_MONTHLY:-}
      STRIPE_PRICE_UNLIMITED_YEARLY: ${STRIPE_PRICE_UNLIMITED_YEARLY:-}
```

- [ ] **Step 3: Verify final TypeScript state**

```bash
cd backend && npx tsc --noEmit && cd ../dashboard && npx vue-tsc --noEmit
```

Expected: both pass with zero errors.

- [ ] **Step 4: Run all unit tests one final time**

```bash
cd backend && npx jest tests/unit --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "feat(billing): add Stripe env vars to docker-compose configs"
```

---

## Manual Stripe Setup Checklist (do before testing end-to-end)

These are one-time actions in the Stripe Dashboard (not code):

- [ ] Create Product **PRO** → add Price: $9.00/month, add Price: $86.40/year
- [ ] Create Product **UNLIMITED** → add Price: $29.00/month, add Price: $278.40/year
- [ ] Copy 4 Price IDs into `.env` as `STRIPE_PRICE_PRO_MONTHLY`, etc.
- [ ] Go to **Developers → Webhooks** → Add endpoint: `https://your-domain.com/api/webhooks/stripe`
  - For local testing: use `stripe listen --forward-to localhost:6066/api/webhooks/stripe` (Stripe CLI)
  - Events to subscribe: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy webhook signing secret → `.env` as `STRIPE_WEBHOOK_SECRET`
- [ ] Configure **Customer Portal** at `dashboard.stripe.com/test/settings/billing/portal` (enable cancellations, plan switching)
