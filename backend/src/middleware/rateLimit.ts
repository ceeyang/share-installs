/**
 * @fileoverview Rate limiting middleware.
 *
 * Uses a Redis-backed store so limits are shared across all worker processes/pods.
 * Call createRateLimiters(redis) in the router factory and pass the returned
 * limiters down; this avoids the need for a module-level singleton.
 */

import rateLimit from 'express-rate-limit';
import type {Redis} from 'ioredis';
import {config} from '../config/index';

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

  init(options: {windowMs: number}): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<{totalHits: number; resetTime: Date | undefined}> {
    const rKey = `${this.keyPrefix}:${key}`;
    const totalHits = await this.redis.incr(rKey);
    if (totalHits === 1) {
      await this.redis.pexpire(rKey, this.windowMs);
    }
    const pttl = await this.redis.pttl(rKey);
    const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
    return {totalHits, resetTime};
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(`${this.keyPrefix}:${key}`);
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(`${this.keyPrefix}:${key}`);
  }
}

export function createRateLimiters(redis: Redis) {
  /** General API rate limiter applied to all routes. */
  const apiRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(redis, config.RATE_LIMIT_WINDOW_MS, 'rl:api'),
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  });

  /** Stricter limiter for the resolve endpoint to prevent brute-force attacks. */
  const resolveRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(redis, 60 * 1000, 'rl:resolve'),
    validate: {singleCount: false},
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many resolve requests.',
    },
  });

  return {apiRateLimiter, resolveRateLimiter};
}
