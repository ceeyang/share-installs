/**
 * Shared utilities for integration tests.
 *
 * Creates the full Express app with mocked Prisma and Redis so tests exercise
 * the complete HTTP stack (routing, middleware, validation, controllers) without
 * requiring a live database or cache.
 */

import supertest from 'supertest';
import type {InviteStatus} from '@prisma/client';
import {createApp} from '../../src/app';

// ---- Mock factories ----

export function makeMockRedis() {
  const kv: Record<string, string> = {};
  const zsets: Record<string, Array<{score: number; member: string}>> = {};

  return {
    // Key-value ops (invite cache, fingerprint cache)
    get: jest.fn(async (key: string) => kv[key] ?? null),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => {
      kv[key] = value;
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      const existed = key in kv;
      delete kv[key];
      return existed ? 1 : 0;
    }),

    // Sorted-set ops (fuzzy-match recent-clicks set)
    zadd: jest.fn(async (key: string, score: number, member: string) => {
      if (!zsets[key]) zsets[key] = [];
      zsets[key].push({score, member});
      return 1;
    }),
    expire: jest.fn(async () => 1),
    zrangebyscore: jest.fn(async (key: string, min: number, _max: string) => {
      const set = zsets[key];
      if (!set) return [];
      return set.filter(e => e.score >= min).map(e => e.member);
    }),

    // Rate-limiting ops (RedisStore)
    incr: jest.fn(async (key: string) => {
      const v = parseInt(kv[key] ?? '0', 10) + 1;
      kv[key] = String(v);
      return v;
    }),
    pexpire: jest.fn(async () => 1),
    pttl: jest.fn(async () => 60_000),
    decr: jest.fn(async (key: string) => {
      const v = parseInt(kv[key] ?? '1', 10) - 1;
      kv[key] = String(v);
      return v;
    }),
  };
}

export function makeInviteData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_test1',
    code: 'TESTCODE',
    projectId: null,
    inviterId: null,
    customData: null,
    maxUses: null,
    useCount: 0,
    expiresAt: null,
    status: 'ACTIVE' as InviteStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeMockPrisma(inviteData = makeInviteData()) {
  const baseClickEvent = {
    id: 'click_1',
    inviteId: inviteData.id,
    projectId: null,
    fingerprint: 'deadbeef01234567',
    ipAddress: '127.0.0.1',
    userAgent: null,
    languages: null,
    timezone: null,
    referrer: null,
    screenWidth: null,
    screenHeight: null,
    pixelRatio: null,
    colorDepth: null,
    touchPoints: null,
    hardwareConcurrency: null,
    deviceMemory: null,
    canvasHash: null,
    webglHash: null,
    audioHash: null,
    connectionType: null,
    platform: 'WEB',
    osVersion: null,
    resolved: false,
    resolvedAt: null,
    createdAt: new Date(),
    invite: inviteData,
  };

  return {
    invite: {
      // Return the test invite when queried by its own code or by non-code criteria
      // (e.g. by ID). Return null for any other code so that generateUniqueCode()
      // can find an available slot without exhausting retries.
      findFirst: jest.fn(async (args?: {where?: {code?: string}}) => {
        const code = args?.where?.code;
        if (code === undefined || code === inviteData.code) return inviteData;
        return null;
      }),
      findMany: jest.fn(async () => [inviteData]),
      count: jest.fn(async () => 1),
      create: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({
        ...makeInviteData(),
        ...data,
      })),
      update: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({
        ...inviteData,
        ...data,
      })),
      updateMany: jest.fn(async () => ({count: 1})),
    },
    clickEvent: {
      create: jest.fn(async () => ({...baseClickEvent})),
      findMany: jest.fn(async () => [] as typeof baseClickEvent[]),
      update: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({
        ...baseClickEvent,
        ...data,
      })),
    },
    conversion: {
      create: jest.fn(async () => ({id: 'conv_1'})),
    },
    apiKey: {
      findFirst: jest.fn(async () => null),
    },
    project: {
      create: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({
        id: 'proj_1',
        ...data,
      })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    $transaction: jest.fn(async (fns: Array<Promise<unknown>>) => Promise.all(fns)),
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
  };
}

export type MockPrisma = ReturnType<typeof makeMockPrisma>;
export type MockRedis = ReturnType<typeof makeMockRedis>;

/**
 * Builds the Express app with injected mocks and returns a supertest agent.
 */
export function buildApp(
  prisma: MockPrisma = makeMockPrisma(),
  redis: MockRedis = makeMockRedis(),
) {
  const app = createApp(
    prisma as unknown as import('@prisma/client').PrismaClient,
    redis as unknown as import('ioredis').Redis,
  );
  return {app, prisma, redis, agent: supertest(app)};
}
