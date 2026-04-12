/**
 * Shared utilities for integration tests.
 *
 * Creates the full Express app with mocked Prisma and Redis so tests exercise
 * the complete HTTP stack (routing, middleware, validation, controllers) without
 * requiring a live database or cache.
 */

import supertest from 'supertest';
import {createApp} from '../../src/app';

// ---- Mock factories ----

export function makeMockRedis() {
  const kv: Record<string, string> = {};
  const zsets: Record<string, Array<{score: number; member: string}>> = {};

  return {
    // Key-value ops (fingerprint cache)
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

export function makeClickData(overrides: any = {}) {
  return {
    inviteCode: 'TESTCODE',
    fingerprint: 'deadbeef01234567',
    platform: 'WEB',
    ...overrides,
  };
}

export function makeMockPrisma() {
  const baseClickEvent = {
    id: 'click_1',
    inviteCode: 'TESTCODE',
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
    customData: null,
    resolved: false,
    resolvedAt: null,
    createdAt: new Date(),
  };

  return {
    clickEvent: {
      create: jest.fn(async ({data}: {data: any}) => ({...baseClickEvent, ...data})),
      findMany: jest.fn(async () => [] as typeof baseClickEvent[]),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async ({where}: {where: {id: string}}) => {
        if (where.id === baseClickEvent.id) return baseClickEvent;
        return null;
      }),
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
      create: jest.fn().mockResolvedValue({id: 'proj_test1'}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({id: 'proj_test1'}),
      findFirst: jest.fn().mockResolvedValue({id: 'proj_test1'}),
      update: jest.fn().mockResolvedValue({id: 'proj_test1'}),
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
    prisma as unknown as any, // Cast to avoid complex Prisma generic mismatches in tests
    redis as unknown as import('ioredis').Redis,
  );
  return {app, prisma, redis, agent: supertest(app)};
}
