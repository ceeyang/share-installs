/**
 * @fileoverview Rate limiting middleware.
 *
 * Uses a Redis-backed store so limits are shared across all worker processes/pods.
 * Call createRateLimiters(redis) in the router factory and pass the returned
 * limiters down; this avoids the need for a module-level singleton.
 */

import rateLimit from 'express-rate-limit';
import type {Request, Response, NextFunction} from 'express';
import type {Redis} from 'ioredis';
import {config} from '../config/index';

/**
 * Per-plan resolve rate limits (requests per minute).
 * Applied in SaaS mode after requireApiKey sets req.userPlan.
 *
 * FREE: 10/min  PRO: 60/min  UNLIMITED: no practical limit
 */
const PLAN_RESOLVE_LIMITS: Record<string, number> = {
  FREE: 10,
  PRO: 60,
  UNLIMITED: 100_000,
};

/**
 * Redis-backed store for express-rate-limit.
 *
 * Uses INCR + PEXPIRE so the TTL is set only on the first request in each window,
 * ensuring the window resets correctly without a Lua script or MULTI/EXEC.
 */
class RedisStore {
  private windowMs: number;

  constructor(
    private readonly redis: Redis,
    windowMs: number,
    private readonly keyPrefix: string = 'rl',
  ) {
    this.windowMs = windowMs;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const rKey = `${this.keyPrefix}:${key}`;
    const totalHits = await this.redis.incr(rKey);
    if (totalHits === 1) {
      await this.redis.pexpire(rKey, this.windowMs);
    }
    const pttl = await this.redis.pttl(rKey);
    const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(`${this.keyPrefix}:${key}`);
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(`${this.keyPrefix}:${key}`);
  }
}

export function createRateLimiters(redis: Redis) {
  // Skip rate limiting in development only (not in test, so rate limit tests still pass).
  const isDev = config.NODE_ENV === 'development';

  /** General API rate limiter applied to all routes. */
  const apiRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(redis, config.RATE_LIMIT_WINDOW_MS, 'rl:api'),
    // Skip rate limiting entirely in development/test so manual testing isn't blocked.
    skip: isDev ? () => true : undefined,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  });

  /** Stricter limiter for the resolve endpoint to prevent brute-force attacks.
   *  Max per minute is configurable via RATE_LIMIT_RESOLVE_MAX (default 10).
   *  推荐值：FREE=10  PRO=60  UNLIMITED=600
   */
  const resolveRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.RATE_LIMIT_RESOLVE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(redis, 60 * 1000, 'rl:resolve'),
    validate: { singleCount: false },
    skip: isDev ? () => true : undefined,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many resolve requests.',
    },
  });

  return { apiRateLimiter, resolveRateLimiter };
}

/**
 * SaaS-mode per-plan rate limiter for the resolve endpoint.
 *
 * Must run AFTER requireApiKey (which sets req.projectId and req.userPlan).
 * Uses a Redis counter keyed by appId so limits are per-app, not per-IP.
 *
 * Limits (per minute):  FREE=10  PRO=60  UNLIMITED=100000
 */
export function createPlanRateLimiter(redis: Redis) {
  const isDev = config.NODE_ENV === 'development';

  return async function planRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (isDev) { next(); return; }

    const appId = req.projectId;
    if (!appId) { next(); return; }

    const plan = req.userPlan ?? 'FREE';
    const max = PLAN_RESOLVE_LIMITS[plan] ?? PLAN_RESOLVE_LIMITS.FREE;

    const key = `rl:resolve:app:${appId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    if (count > max) {
      const pttl = await redis.pttl(key);
      res.setHeader('Retry-After', Math.ceil((pttl > 0 ? pttl : 60000) / 1000));
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many resolve requests.',
        plan,
        limit: max,
        retryAfterSeconds: Math.ceil((pttl > 0 ? pttl : 60000) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Registration rate limiter: 5 attempts per 15 minutes per IP.
 * Prevents automated account creation without CAPTCHA overhead.
 */
export function createRegisterRateLimiter(redis: Redis) {
  const isDev = config.NODE_ENV === 'development';

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(redis, 15 * 60 * 1000, 'rl:register'),
    skip: isDev ? () => true : undefined,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again in 15 minutes.',
    },
  });
}
