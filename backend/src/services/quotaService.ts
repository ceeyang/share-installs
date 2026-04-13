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
 * Only enforced in MULTI_TENANT mode. Self-hosted deployments bypass this.
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

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

function nextDayUtc(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

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
   * then checks if either limit is exceeded. Throws QuotaExceededError if so.
   *
   * Uses optimistic increment-then-check to avoid races. The overshoot is
   * bounded by the number of concurrent requests, acceptable for business quotas.
   *
   * @throws QuotaExceededError when daily or monthly limit is exceeded.
   * @throws Error when the app is not found.
   */
  async checkAndIncrement(appId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: {id: appId},
      select: {user: {select: {plan: true}}},
    });

    if (!app) throw new Error(`App not found: ${appId}`);

    const plan: Plan = app.user.plan;
    const limits = PLAN_LIMITS[plan];

    // UNLIMITED plan: skip Redis entirely
    if (limits.dailyInstalls === Infinity && limits.monthlyInstalls === Infinity) return;

    const today = todayUtc();
    const month = currentMonthUtc();
    const dKey = dailyKey(appId, today);
    const mKey = monthlyKey(appId, month);

    const [dailyCount, monthlyCount] = await Promise.all([
      this.redis.incr(dKey),
      this.redis.incr(mKey),
    ]);

    await Promise.all([
      this.redis.expire(dKey, 48 * 60 * 60),
      this.redis.expire(mKey, 35 * 24 * 60 * 60),
    ]);

    if (limits.dailyInstalls !== Infinity && dailyCount > limits.dailyInstalls) {
      throw new QuotaExceededError(plan, 'daily', limits.dailyInstalls, dailyCount, nextDayUtc());
    }

    if (limits.monthlyInstalls !== Infinity && monthlyCount > limits.monthlyInstalls) {
      throw new QuotaExceededError(plan, 'monthly', limits.monthlyInstalls, monthlyCount, nextMonthUtc());
    }
  }

  /**
   * Returns current daily and monthly usage counts without modifying them.
   * Used by the dashboard quota status endpoint (Module 4).
   */
  async getUsage(appId: string): Promise<{daily: number; monthly: number}> {
    const [dailyRaw, monthlyRaw] = await Promise.all([
      this.redis.get(dailyKey(appId, todayUtc())),
      this.redis.get(monthlyKey(appId, currentMonthUtc())),
    ]);
    return {
      daily: dailyRaw ? parseInt(dailyRaw, 10) : 0,
      monthly: monthlyRaw ? parseInt(monthlyRaw, 10) : 0,
    };
  }
}
