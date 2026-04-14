# SaaS Auth, Quota Guard & Route Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Module 2 (GitHub OAuth + JWT session), Module 3 (quota guard), and Module 6 (route registration) for the share-installs SaaS platform.

**Architecture:** GitHub OAuth callback issues a 7-day JWT stored in an HttpOnly cookie. All `/dashboard/*` routes verify the cookie via `requireSession` middleware. A Redis-based `QuotaService` checks daily/monthly install limits per app before every successful conversion is recorded.

**Tech Stack:** Express, jsonwebtoken (already installed), cookie-parser (new), ioredis (existing), Prisma (existing), Jest + supertest

**Prerequisites:**
- Module 1 (DB migration) MUST be complete: `User`, `App`, `ApiKey` (with `keyEncrypted`) models in Prisma schema. The schema already reflects these changes (see `backend/prisma/schema.prisma`).
- Run `npm run db:generate` in `backend/` after schema migration before any TypeScript compilation.
- Module 4 (Dashboard API controller) is assigned to Gemini and is a separate concern — this plan wires the routes but the controller implementation is not here.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `backend/src/auth/jwt.ts` | Sign and verify JWTs |
| Create | `backend/src/auth/session.ts` | `requireSession` middleware + `req.userId` type |
| Create | `backend/src/auth/github.ts` | OAuth route handlers |
| Create | `backend/src/services/quotaService.ts` | `PLAN_LIMITS` + `checkAndIncrement` |
| Create | `backend/tests/unit/auth/jwt.test.ts` | Unit tests for JWT utils |
| Create | `backend/tests/unit/auth/session.test.ts` | Unit tests for session middleware |
| Create | `backend/tests/unit/services/quotaService.test.ts` | Unit tests for quota logic |
| Modify | `backend/src/config/index.ts` | Add JWT_SECRET, ENCRYPTION_KEY, GITHUB_*, FRONTEND_URL |
| Modify | `backend/src/services/fingerprintService.ts` | Inject QuotaService; fix `projectId` → `appId` Prisma field |
| Modify | `backend/src/routes/index.ts` | Register `/auth/*` and `/dashboard/*` routes |
| Modify | `backend/src/app.ts` | Add cookie-parser; update CORS for cross-origin credentials |

---

## Task 1: Add New Environment Variables to Config

**Files:**
- Modify: `backend/src/config/index.ts`

- [ ] **Step 1: Read the current config file**

Already read — it uses zod `configSchema`. Add 5 new fields after `CORS_ORIGINS`.

- [ ] **Step 2: Install cookie-parser**

```bash
cd backend
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

Expected: `package.json` updated with both packages.

- [ ] **Step 3: Edit `backend/src/config/index.ts`**

Add these fields inside `configSchema` (after `CORS_ORIGINS`):

```typescript
  // SaaS dashboard auth
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'Must be 64-char hex (32 bytes)').optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
```

After the closing `}` of the schema, update the `Config` type export (already inferred, no action needed).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors (new fields are optional so existing `.env` files without them still work).

- [ ] **Step 5: Commit**

```bash
cd backend
git add package.json package-lock.json src/config/index.ts
git commit -m "feat(saas): add auth/oauth env vars to config schema, install cookie-parser"
```

---

## Task 2: JWT Utilities

**Files:**
- Create: `backend/src/auth/jwt.ts`
- Create: `backend/tests/unit/auth/jwt.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/auth/jwt.test.ts`:

```typescript
import {signJwt, verifyJwt} from '../../../src/auth/jwt';

const secret = 'a'.repeat(32);

describe('signJwt / verifyJwt', () => {
  it('round-trips a valid token', () => {
    const payload = {sub: 'user_abc', githubLogin: 'octocat'};
    const token = signJwt(payload, secret);
    expect(typeof token).toBe('string');
    const decoded = verifyJwt(token, secret);
    expect(decoded).toMatchObject(payload);
  });

  it('returns null for tampered token', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyJwt(tampered, secret)).toBeNull();
  });

  it('returns null for expired token', () => {
    // Sign with 0 seconds TTL
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret, 0);
    // Token is immediately expired — small race, but expiresIn:0 fires at sign time
    expect(verifyJwt(token, secret)).toBeNull();
  });

  it('returns null for wrong secret', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret);
    expect(verifyJwt(token, 'b'.repeat(32))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest tests/unit/auth/jwt.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../src/auth/jwt'`

- [ ] **Step 3: Create `backend/src/auth/jwt.ts`**

```typescript
/**
 * @fileoverview JWT sign and verify utilities for dashboard session tokens.
 *
 * Payload: { sub: string (User.id), githubLogin: string, iat: number, exp: number }
 * Default TTL: 7 days.
 */

import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  githubLogin: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Signs a JWT with the given secret.
 * @param payload - Must contain sub (User.id) and githubLogin.
 * @param secret  - Server secret (min 32 chars). Defaults to config.JWT_SECRET.
 * @param ttl     - Expiry in seconds. Default: 7 days.
 */
export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttl: number = DEFAULT_TTL_SECONDS,
): string {
  return jwt.sign(payload, secret, {expiresIn: ttl});
}

/**
 * Verifies a JWT and returns the decoded payload, or null on any error.
 * Never throws — all jwt errors are caught and converted to null.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
npx jest tests/unit/auth/jwt.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/auth/jwt.ts tests/unit/auth/jwt.test.ts
git commit -m "feat(saas): add JWT sign/verify utilities"
```

---

## Task 3: `requireSession` Middleware

**Files:**
- Create: `backend/src/auth/session.ts`
- Create: `backend/tests/unit/auth/session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/auth/session.test.ts`:

```typescript
import {Request, Response, NextFunction} from 'express';
import {createRequireSession} from '../../../src/auth/session';
import {signJwt} from '../../../src/auth/jwt';

const secret = 'a'.repeat(32);
const requireSession = createRequireSession(secret);

function mockReq(cookie?: string): Partial<Request> {
  return {
    cookies: cookie ? {session: cookie} : {},
    headers: {},
  };
}

function mockRes(): {status: jest.Mock; json: jest.Mock; statusCode: number} {
  const res = {
    statusCode: 200,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('requireSession', () => {
  it('calls next() and sets req.userId for valid cookie', () => {
    const token = signJwt({sub: 'user_123', githubLogin: 'octocat'}, secret);
    const req = mockReq(token) as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).userId).toBe('user_123');
  });

  it('returns 401 when no cookie present', () => {
    const req = mockReq() as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for invalid/expired token', () => {
    const req = mockReq('not.a.jwt') as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest tests/unit/auth/session.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../src/auth/session'`

- [ ] **Step 3: Create `backend/src/auth/session.ts`**

```typescript
/**
 * @fileoverview Session middleware for dashboard routes.
 *
 * Reads the `session` cookie (HttpOnly JWT), verifies it, and injects
 * `req.userId` (User.id cuid) for downstream handlers.
 */

import {Request, Response, NextFunction} from 'express';
import {verifyJwt} from './jwt';

// Extend Express Request with dashboard user context.
declare global {
  namespace Express {
    interface Request {
      /** Set by requireSession for dashboard routes. */
      userId?: string;
    }
  }
}

/**
 * Factory: creates a requireSession middleware bound to a specific JWT secret.
 * Returns 401 when the session cookie is missing or the JWT is invalid/expired.
 */
export function createRequireSession(jwtSecret: string) {
  return function requireSession(req: Request, res: Response, next: NextFunction): void {
    const token: string | undefined = req.cookies?.session;

    if (!token) {
      res.status(401).json({
        error: {code: 401, status: 'UNAUTHENTICATED', message: 'Session required. Please log in.'},
      });
      return;
    }

    const payload = verifyJwt(token, jwtSecret);
    if (!payload) {
      res.status(401).json({
        error: {code: 401, status: 'UNAUTHENTICATED', message: 'Session expired or invalid.'},
      });
      return;
    }

    req.userId = payload.sub;
    next();
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
npx jest tests/unit/auth/session.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/auth/session.ts tests/unit/auth/session.test.ts
git commit -m "feat(saas): add requireSession middleware"
```

---

## Task 4: GitHub OAuth Handlers

**Files:**
- Create: `backend/src/auth/github.ts`

No unit tests for this module — it talks to GitHub's OAuth servers and would require extensive mocking that provides little value. The integration is verified manually and via the route integration task.

- [ ] **Step 1: Create `backend/src/auth/github.ts`**

```typescript
/**
 * @fileoverview GitHub OAuth 2.0 route handlers.
 *
 * Routes:
 *   GET /auth/github          → redirect to GitHub authorization page
 *   GET /auth/github/callback → exchange code for token, upsert User, set cookie
 *   GET /auth/logout          → clear session cookie
 *
 * After successful login:
 *   - Upserts the User row (githubId, githubLogin, email, avatarUrl)
 *   - Issues a 7-day JWT stored in an HttpOnly cookie named "session"
 *   - Redirects to FRONTEND_URL
 */

import {Router, Request, Response} from 'express';
import {PrismaClient} from '@prisma/client';
import {config} from '../config/index';
import {signJwt} from './jwt';
import {logger} from '../utils/logger';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Exchanges a GitHub OAuth code for an access token.
 * Throws on network error or non-200 response.
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = await res.json() as GitHubTokenResponse;
  if (!data.access_token) {
    throw new Error('GitHub did not return an access_token');
  }
  return data.access_token;
}

/**
 * Fetches the authenticated user's profile from the GitHub API.
 */
async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub user fetch failed: ${res.status}`);
  }

  return res.json() as Promise<GitHubUser>;
}

/**
 * Creates the GitHub OAuth router.
 * @param prisma - Prisma client for upsert operations.
 * @param jwtSecret - Secret for signing session JWTs.
 */
export function createGitHubAuthRouter(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();

  // ---- Step 1: Redirect user to GitHub ----
  router.get('/github', (_req: Request, res: Response) => {
    if (!config.GITHUB_CLIENT_ID) {
      res.status(503).json({error: {message: 'GitHub OAuth not configured.'}});
      return;
    }

    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      scope: 'read:user,user:email',
    });

    res.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
  });

  // ---- Step 2: Handle callback from GitHub ----
  router.get('/github/callback', async (req: Request, res: Response) => {
    const {code, error} = req.query as {code?: string; error?: string};

    if (error || !code) {
      logger.warn({error}, 'GitHub OAuth denied or missing code');
      res.redirect(`${config.FRONTEND_URL}?auth_error=access_denied`);
      return;
    }

    try {
      // Exchange code for access token
      const accessToken = await exchangeCodeForToken(code);

      // Fetch GitHub user profile
      const ghUser = await fetchGitHubUser(accessToken);

      // Upsert User record
      const user = await prisma.user.upsert({
        where: {githubId: String(ghUser.id)},
        update: {
          githubLogin: ghUser.login,
          email: ghUser.email ?? undefined,
          avatarUrl: ghUser.avatar_url,
        },
        create: {
          githubId: String(ghUser.id),
          githubLogin: ghUser.login,
          email: ghUser.email ?? undefined,
          avatarUrl: ghUser.avatar_url,
        },
      });

      // Issue JWT session cookie
      const token = signJwt({sub: user.id, githubLogin: user.githubLogin}, jwtSecret);

      const isProd = config.NODE_ENV === 'production';
      res.cookie('session', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        path: '/',
      });

      logger.info({userId: user.id, githubLogin: user.githubLogin}, 'User authenticated via GitHub');
      res.redirect(config.FRONTEND_URL);
    } catch (err) {
      logger.error({err}, 'GitHub OAuth callback error');
      res.redirect(`${config.FRONTEND_URL}?auth_error=server_error`);
    }
  });

  // ---- Step 3: Logout ----
  router.get('/logout', (_req: Request, res: Response) => {
    res.clearCookie('session', {path: '/'});
    res.redirect(config.FRONTEND_URL);
  });

  return router;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors. If you see "Property 'user' does not exist on type 'PrismaClient'", run `npm run db:generate` first (Module 1 migration must be applied).

- [ ] **Step 3: Commit**

```bash
cd backend
git add src/auth/github.ts
git commit -m "feat(saas): add GitHub OAuth handlers"
```

---

## Task 5: Quota Service

**Files:**
- Create: `backend/src/services/quotaService.ts`
- Create: `backend/tests/unit/services/quotaService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/services/quotaService.test.ts`:

```typescript
import {QuotaService, PLAN_LIMITS, QuotaExceededError} from '../../../src/services/quotaService';
import {Plan} from '@prisma/client';

// ---- Mock Redis ----
function makeRedisMock(dailyCount: number, monthlyCount: number) {
  return {
    incr: jest.fn().mockResolvedValueOnce(dailyCount).mockResolvedValueOnce(monthlyCount),
    expire: jest.fn().mockResolvedValue(1),
  };
}

// ---- Mock Prisma ----
function makePrismaMock(plan: Plan) {
  return {
    app: {
      findUnique: jest.fn().mockResolvedValue({
        user: {plan, planExpiresAt: null},
      }),
    },
  };
}

describe('PLAN_LIMITS', () => {
  it('FREE has dailyInstalls: 20 and monthlyInstalls: 500', () => {
    expect(PLAN_LIMITS.FREE.dailyInstalls).toBe(20);
    expect(PLAN_LIMITS.FREE.monthlyInstalls).toBe(500);
  });

  it('PRO has no daily limit', () => {
    expect(PLAN_LIMITS.PRO.dailyInstalls).toBe(Infinity);
    expect(PLAN_LIMITS.PRO.monthlyInstalls).toBe(10_000);
  });

  it('UNLIMITED has no limits', () => {
    expect(PLAN_LIMITS.UNLIMITED.dailyInstalls).toBe(Infinity);
    expect(PLAN_LIMITS.UNLIMITED.monthlyInstalls).toBe(Infinity);
  });
});

describe('QuotaService.checkAndIncrement', () => {
  it('allows FREE plan under both limits', async () => {
    const prisma = makePrismaMock(Plan.FREE) as any;
    const redis = makeRedisMock(5, 100) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError when FREE daily limit hit', async () => {
    const prisma = makePrismaMock(Plan.FREE) as any;
    // daily count is now 21 (over the 20 limit)
    const redis = makeRedisMock(21, 100) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).rejects.toThrow(QuotaExceededError);
  });

  it('throws QuotaExceededError when FREE monthly limit hit', async () => {
    const prisma = makePrismaMock(Plan.FREE) as any;
    // daily ok, monthly is 501 (over 500)
    const redis = makeRedisMock(5, 501) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).rejects.toThrow(QuotaExceededError);
  });

  it('allows PRO plan over FREE daily limit', async () => {
    const prisma = makePrismaMock(Plan.PRO) as any;
    // daily 100 is fine for PRO (no daily cap)
    const redis = makeRedisMock(100, 500) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError when PRO monthly limit hit', async () => {
    const prisma = makePrismaMock(Plan.PRO) as any;
    // monthly 10001 over PRO 10000 limit
    const redis = makeRedisMock(100, 10_001) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).rejects.toThrow(QuotaExceededError);
  });

  it('allows UNLIMITED plan regardless of counts', async () => {
    const prisma = makePrismaMock(Plan.UNLIMITED) as any;
    const redis = makeRedisMock(999_999, 999_999) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
  });

  it('throws if app not found in DB', async () => {
    const prisma = {
      app: {findUnique: jest.fn().mockResolvedValue(null)},
    } as any;
    const redis = makeRedisMock(1, 1) as any;
    const svc = new QuotaService(prisma, redis);

    await expect(svc.checkAndIncrement('nonexistent')).rejects.toThrow('App not found');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest tests/unit/services/quotaService.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../src/services/quotaService'`

- [ ] **Step 3: Create `backend/src/services/quotaService.ts`**

```typescript
/**
 * @fileoverview Quota enforcement service.
 *
 * Tracks daily and monthly install counts per App in Redis.
 * Called before every successful conversion is recorded to the DB.
 *
 * Redis key schema:
 *   si:quota:{appId}:daily:{YYYY-MM-DD}    TTL 48h
 *   si:quota:{appId}:monthly:{YYYY-MM}     TTL 35d
 *
 * Only applies in MULTI_TENANT mode. Self-hosted deployments bypass this.
 */

import {PrismaClient, Plan} from '@prisma/client';
import type {Redis} from 'ioredis';
import {config} from '../config/index';

// ---- Plan limits ----

export const PLAN_LIMITS = {
  FREE: {
    dailyInstalls: 20,
    monthlyInstalls: 500,
    maxApps: 1,
    maxKeysPerApp: 2,
    dataRetentionDays: 7,
  },
  PRO: {
    dailyInstalls: Infinity,
    monthlyInstalls: 10_000,
    maxApps: 5,
    maxKeysPerApp: 10,
    dataRetentionDays: 90,
  },
  UNLIMITED: {
    dailyInstalls: Infinity,
    monthlyInstalls: Infinity,
    maxApps: Infinity,
    maxKeysPerApp: Infinity,
    dataRetentionDays: 365,
  },
} as const;

// ---- Error class ----

export class QuotaExceededError extends Error {
  constructor(
    public readonly plan: Plan,
    public readonly period: 'daily' | 'monthly',
    public readonly limit: number,
    public readonly used: number,
    public readonly resetAt: Date,
  ) {
    super(`${period} install quota exceeded`);
    this.name = 'QuotaExceededError';
  }
}

// ---- Redis key helpers ----

function dailyKey(appId: string, date: string): string {
  return `${config.REDIS_KEY_PREFIX}quota:${appId}:daily:${date}`;
}

function monthlyKey(appId: string, month: string): string {
  return `${config.REDIS_KEY_PREFIX}quota:${appId}:monthly:${month}`;
}

/** Returns today's date as "YYYY-MM-DD" in UTC. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns current month as "YYYY-MM" in UTC. */
function currentMonthUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Returns the start of the next UTC day (tomorrow 00:00 UTC). */
function nextDayUtc(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

/** Returns the start of the next UTC month (1st of next month, 00:00 UTC). */
function nextMonthUtc(): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---- Service ----

export class QuotaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  /**
   * Atomically increments the daily and monthly install counters for an App,
   * then checks if either limit is exceeded. Throws `QuotaExceededError` if so.
   *
   * Counter-then-check (optimistic) approach: briefly allows the Nth install
   * to proceed before detecting overflow. This avoids a race window where two
   * concurrent requests both see count N-1 and both proceed. The overshoot is
   * at most equal to the number of concurrent requests, which is acceptable
   * for these business-level quotas.
   *
   * @param appId - The App.id to check quota for.
   * @throws QuotaExceededError when daily or monthly limit is exceeded.
   * @throws Error when the app is not found.
   */
  async checkAndIncrement(appId: string): Promise<void> {
    // Look up the plan for this app
    const app = await this.prisma.app.findUnique({
      where: {id: appId},
      select: {user: {select: {plan: true, planExpiresAt: true}}},
    });

    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    const plan: Plan = app.user.plan;
    const limits = PLAN_LIMITS[plan];

    // UNLIMITED plan: skip Redis entirely
    if (limits.dailyInstalls === Infinity && limits.monthlyInstalls === Infinity) {
      return;
    }

    const today = todayUtc();
    const month = currentMonthUtc();

    const dKey = dailyKey(appId, today);
    const mKey = monthlyKey(appId, month);

    // Increment both counters atomically
    const [dailyCount, monthlyCount] = await Promise.all([
      this.redis.incr(dKey),
      this.redis.incr(mKey),
    ]);

    // Set TTLs on first write (expire returns 0 if already set, harmless to call again)
    await Promise.all([
      this.redis.expire(dKey, 48 * 60 * 60),  // 48h
      this.redis.expire(mKey, 35 * 24 * 60 * 60), // 35 days
    ]);

    // Check daily limit (only applies to FREE)
    if (limits.dailyInstalls !== Infinity && dailyCount > limits.dailyInstalls) {
      throw new QuotaExceededError(plan, 'daily', limits.dailyInstalls, dailyCount, nextDayUtc());
    }

    // Check monthly limit
    if (limits.monthlyInstalls !== Infinity && monthlyCount > limits.monthlyInstalls) {
      throw new QuotaExceededError(plan, 'monthly', limits.monthlyInstalls, monthlyCount, nextMonthUtc());
    }
  }

  /**
   * Returns current daily and monthly usage counts for an app, without modifying them.
   * Used by the dashboard quota status endpoint.
   */
  async getUsage(appId: string): Promise<{daily: number; monthly: number}> {
    const today = todayUtc();
    const month = currentMonthUtc();

    const [dailyRaw, monthlyRaw] = await Promise.all([
      this.redis.get(dailyKey(appId, today)),
      this.redis.get(monthlyKey(appId, month)),
    ]);

    return {
      daily: dailyRaw ? parseInt(dailyRaw, 10) : 0,
      monthly: monthlyRaw ? parseInt(monthlyRaw, 10) : 0,
    };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
npx jest tests/unit/services/quotaService.test.ts --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/quotaService.ts tests/unit/services/quotaService.test.ts
git commit -m "feat(saas): add QuotaService with Redis-based daily/monthly counters"
```

---

## Task 6: Integrate Quota into FingerprintService

**Files:**
- Modify: `backend/src/services/fingerprintService.ts`

This task hooks the QuotaService into `resolveInvite()` so conversions are gated before being written to DB. It also updates Prisma field references from the old `projectId` to the new `appId` (schema Module 1 rename).

- [ ] **Step 1: Update the FingerprintService constructor to accept QuotaService**

In `backend/src/services/fingerprintService.ts`, update the class constructor and imports:

Find the existing constructor:
```typescript
export class FingerprintService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}
```

Replace with:
```typescript
import {QuotaService, QuotaExceededError} from './quotaService';
import {config} from '../config/index';

export class FingerprintService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly quotaService?: QuotaService,
  ) {}
```

(The `QuotaExceededError` import is needed so it can be re-thrown properly; the import of `config` is already present.)

- [ ] **Step 2: Add quota check inside `resolveInvite` before `recordConversion`**

In `resolveInvite`, the exact match path currently is:
```typescript
    if (exactResult) {
      await this.recordConversion(exactResult.clickEventId, exactResult.inviteCode, platform, signals, 'exact', 1.0, projectId);
```

Replace with (add quota check before each `recordConversion` call):
```typescript
    if (exactResult) {
      await this.checkQuota(projectId);
      await this.recordConversion(exactResult.clickEventId, exactResult.inviteCode, platform, signals, 'exact', 1.0, projectId);
```

Do the same for the fuzzy match path:
```typescript
    if (fuzzyResult) {
      await this.checkQuota(projectId);
      await this.recordConversion(
```

And for the clipboard path (after resolving the clickEvent from DB):
```typescript
        await this.checkQuota(projectId);
        return {
          clickEventId: clickEvent?.id ?? null,
```

- [ ] **Step 3: Add the private `checkQuota` helper method**

Add this private method to the `FingerprintService` class (after the constructor):

```typescript
  /**
   * Enforces quota before recording a conversion.
   * Only runs in MULTI_TENANT mode when a QuotaService is injected.
   * Throws QuotaExceededError if the app is over its plan limit.
   */
  private async checkQuota(appId?: string): Promise<void> {
    if (!config.MULTI_TENANT || !this.quotaService || !appId) return;
    await this.quotaService.checkAndIncrement(appId);
  }
```

- [ ] **Step 4: Update Prisma field references from `projectId` to `appId`**

The schema renamed `Project.id` references from `projectId` to `appId` in `ClickEvent` and `Conversion`. Search and update all Prisma query references in `fingerprintService.ts`:

In `collectClick`:
- `projectId: projectId ?? null` → `appId: projectId ?? null`
- `where: {...(projectId ? {projectId} : {})}` → `where: {...(projectId ? {appId: projectId} : {})}`

In `tryExactMatch`:
- `where: {id: cached.clickEventId, projectId}` → `where: {id: cached.clickEventId, appId: projectId}`

In `tryFuzzyMatch`:
- `where: {id: {in: recentIds}, ...(projectId ? {projectId} : {})}` → `where: {id: {in: recentIds}, ...(projectId ? {appId: projectId} : {})}`

In the clipboard fallback:
- `where: {inviteCode: clipboardResult.inviteCode, ...(projectId ? {projectId} : {})}` → `where: {inviteCode: clipboardResult.inviteCode, ...(projectId ? {appId: projectId} : {})}`

In `recordConversion`:
- `projectId: projectId ?? null` → `appId: projectId ?? null`

In `debugClickEvents`:
- `where: {...(projectId ? {projectId} : {})}` → `where: {...(projectId ? {appId: projectId} : {})}`

- [ ] **Step 5: Verify TypeScript compiles with no errors**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors. If you see Prisma-related type errors, ensure `npm run db:generate` has been run after the schema migration.

- [ ] **Step 6: Update the route factory to pass QuotaService**

In `backend/src/routes/index.ts`, update the FingerprintService instantiation:

Find:
```typescript
  const fingerprintService = new FingerprintService(prisma, redis);
```

Replace with:
```typescript
  import {QuotaService} from '../services/quotaService';
  // ...
  const quotaService = config.MULTI_TENANT ? new QuotaService(prisma, redis) : undefined;
  const fingerprintService = new FingerprintService(prisma, redis, quotaService);
```

(Move the import to the top of the file with the other imports.)

- [ ] **Step 7: Add `QuotaExceededError` handler to error middleware**

In `backend/src/middleware/errorHandler.ts`, add handling for `QuotaExceededError` before the generic catch-all. Read the file first, then add:

```typescript
import {QuotaExceededError} from '../services/quotaService';

// In the errorHandler function, add before the generic 500 response:
if (err instanceof QuotaExceededError) {
  res.status(402).json({
    error: {
      code: 'QUOTA_EXCEEDED',
      message: `${err.period === 'daily' ? 'Daily' : 'Monthly'} install quota exceeded. Upgrade your plan.`,
      plan: err.plan.toLowerCase(),
      limit: err.limit,
      used: err.used,
      resetAt: err.resetAt.toISOString(),
    },
  });
  return;
}
```

- [ ] **Step 8: Run all unit tests to confirm no regressions**

```bash
cd backend
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd backend
git add src/services/fingerprintService.ts src/middleware/errorHandler.ts src/routes/index.ts
git commit -m "feat(saas): integrate QuotaService into FingerprintService; fix appId Prisma field rename"
```

---

## Task 7: Route Registration + CORS + Cookie-Parser

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Add cookie-parser to `backend/src/app.ts`**

In `backend/src/app.ts`, add the import and middleware:

After the existing imports, add:
```typescript
import cookieParser from 'cookie-parser';
```

After `app.use(express.urlencoded({extended: true}));`, add:
```typescript
  // Parse cookies (used for dashboard session JWT)
  app.use(cookieParser());
```

- [ ] **Step 2: Update CORS config in `backend/src/app.ts` to support credentials**

The current CORS setup sends all origins in dev and restricted in prod but doesn't send `credentials: true`. Update the `corsOptions` to add credentials support:

Find the `corsOptions` declaration:
```typescript
  const corsOptions: cors.CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-SDK-Platform', 'X-SDK-Version', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  };
```

Replace with:
```typescript
  const corsOptions: cors.CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-SDK-Platform', 'X-SDK-Version', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true, // Required for cross-origin cookie sessions (dashboard → api)
  };
```

Also ensure the FRONTEND_URL is included in allowed origins in production. Find the production origins check and update it:

```typescript
  if (allowedOrigins.includes('*') || config.NODE_ENV !== 'production') {
    corsOptions.origin = true;
  } else {
    // Add FRONTEND_URL to allowed origins in production
    const productionOrigins = [...allowedOrigins];
    if (config.FRONTEND_URL && !productionOrigins.includes(config.FRONTEND_URL)) {
      productionOrigins.push(config.FRONTEND_URL);
    }
    corsOptions.origin = (origin, callback) => {
      if (!origin || productionOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    };
  }
```

- [ ] **Step 3: Register auth and dashboard routes in `backend/src/routes/index.ts`**

Update `backend/src/routes/index.ts` to:
1. Import auth modules
2. Register `/auth/*` routes
3. Register placeholder `/dashboard/*` routes (real handlers from Gemini's Module 4)

Find the imports block and add:
```typescript
import {createGitHubAuthRouter} from '../auth/github';
import {createRequireSession} from '../auth/session';
import {QuotaService} from '../services/quotaService';
```

Find the `createRouter` function signature and update it (the signature stays the same — `prisma` and `redis` are already passed).

Inside `createRouter`, after `const requireApiKey = createRequireApiKey(prisma);`, add:

```typescript
  // ---- SaaS: Auth + Session ----
  const jwtSecret = config.JWT_SECRET ?? '';
  const requireSession = createRequireSession(jwtSecret);

  // ---- SaaS: Quota ----
  const quotaService = config.MULTI_TENANT ? new QuotaService(prisma, redis) : undefined;
```

Then update the FingerprintService instantiation:
```typescript
  const fingerprintService = new FingerprintService(prisma, redis, quotaService);
```

After `router.use('/v1', v1);`, add the new route groups:

```typescript
  // ---- Auth routes (/auth/*) ----
  // Only mount when GitHub OAuth is configured
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET && config.JWT_SECRET) {
    const authRouter = createGitHubAuthRouter(prisma, jwtSecret);
    router.use('/auth', authRouter);
  }

  // ---- Dashboard routes (/dashboard/*) ----
  // All dashboard routes require a valid session cookie.
  // Actual route handlers are implemented in Module 4 (dashboardController).
  // Mount a placeholder router that returns 501 until Module 4 is complete.
  const dashboard = Router();
  dashboard.use(requireSession);
  dashboard.all('*', (_req, res) => {
    res.status(501).json({error: {message: 'Dashboard API not yet implemented.'}});
  });
  router.use('/dashboard', dashboard);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start dev server and manually test auth redirect**

```bash
cd backend
npm run dev
```

In a separate terminal:
```bash
curl -v http://localhost:3000/auth/github 2>&1 | grep -E 'Location|HTTP'
```

Expected (when GITHUB_CLIENT_ID is set): `HTTP/1.1 302` with `Location: https://github.com/login/oauth/authorize?...`

Expected (when GITHUB_CLIENT_ID not set): `HTTP/1.1 503`

```bash
curl -v http://localhost:3000/dashboard/me 2>&1 | grep -E 'HTTP|session'
```

Expected: `HTTP/1.1 401` with `{"error":{"code":401,"status":"UNAUTHENTICATED",...}}`

- [ ] **Step 6: Run full test suite**

```bash
cd backend
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/app.ts src/routes/index.ts
git commit -m "feat(saas): register auth/dashboard routes, add cookie-parser, update CORS for credentials"
```

---

## Task 8: Wire Up `.env` and End-to-End Smoke Test

**Files:**
- No code changes — environment configuration and manual verification.

- [ ] **Step 1: Add new env vars to `.env`**

In `backend/.env` (or `.env.local`), add:

```bash
# GitHub OAuth (create at github.com/settings/developers)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here

# Dashboard session (generate: openssl rand -base64 32)
JWT_SECRET=your_32_char_minimum_secret_here

# API key encryption (generate: openssl rand -hex 32)
ENCRYPTION_KEY=your_64_char_hex_here

# Frontend URL (where the dashboard is hosted)
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 2: Set GitHub OAuth callback URL in GitHub App settings**

In GitHub → Settings → Developer Settings → OAuth Apps → your app:
- Authorization callback URL: `http://localhost:3000/auth/github/callback` (development)

- [ ] **Step 3: Smoke test the full auth flow**

```bash
# Open in browser (or curl -L to follow redirects):
open http://localhost:3000/auth/github
```

Expected flow:
1. Browser redirects to `github.com/login/oauth/authorize`
2. After GitHub approval: redirects to `http://localhost:3000/auth/github/callback?code=xxx`
3. Backend exchanges code, upserts User in DB, sets `session` cookie
4. Browser redirects to `FRONTEND_URL`

Verify the `session` cookie is set:
```bash
curl -v http://localhost:3000/auth/github/callback?code=test 2>&1 | grep -i 'set-cookie'
```

(Will show an error for invalid code, but the cookie header format is visible)

- [ ] **Step 4: Verify dashboard route with valid cookie**

```bash
# Use the cookie from a real login, or manually sign a JWT for testing:
cd backend
node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({sub:'test123',githubLogin:'test'}, process.env.JWT_SECRET, {expiresIn:'7d'});
  console.log(token);
"
```

```bash
TOKEN="<token from above>"
curl -H "Cookie: session=$TOKEN" http://localhost:3000/dashboard/me
```

Expected: `HTTP 501` (not yet implemented — Module 4) instead of `HTTP 401`. This confirms `requireSession` passed.

- [ ] **Step 5: Final commit if any last fixes**

```bash
cd backend
git add -p  # only stage intentional changes
git commit -m "fix(saas): post-smoke-test adjustments"
```

---

## Self-Review Checklist

**Spec Coverage:**
- [x] `GET /auth/github` — redirect → Task 4
- [x] `GET /auth/github/callback` — code exchange + JWT cookie → Task 4
- [x] `GET /auth/logout` — clear cookie → Task 4
- [x] `requireSession` middleware — verifies JWT cookie, injects `req.userId` → Task 3
- [x] JWT sign/verify utilities — Task 2
- [x] `PLAN_LIMITS` constant — Task 5
- [x] Redis quota counters (`si:quota:{appId}:daily/monthly:*`) — Task 5
- [x] `checkAndIncrement` before `recordConversion` — Task 6
- [x] `QuotaExceededError` → 402 response — Task 6 (errorHandler)
- [x] CORS credentials for cross-origin cookie — Task 7
- [x] `/dashboard/*` routes registered with `requireSession` — Task 7
- [x] `/auth/*` routes registered — Task 7
- [x] New env vars: JWT_SECRET, ENCRYPTION_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, FRONTEND_URL — Task 1

**Note:** `ENCRYPTION_KEY` (for API key reveal endpoint) is added to config in Task 1 but the encryption/decryption utilities are used by Module 4's `dashboardController`. QuotaService's `getUsage()` method is implemented for Module 4's quota status endpoint.

**Module 4 (Gemini) handoff:**
- `requireSession` is importable from `backend/src/auth/session.ts`
- `QuotaService` is injectable from `backend/src/services/quotaService.ts`
- `PLAN_LIMITS` is exported from `quotaService.ts`
- `config.ENCRYPTION_KEY` is available for AES-GCM key decryption
- Dashboard routes are pre-wired at `/dashboard/*` with session middleware — Module 4 just needs to replace the 501 placeholder router
