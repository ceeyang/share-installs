/**
 * Unit tests for InviteService.
 *
 * Uses a mocked PrismaClient and Redis so no DB connection is needed.
 */

import {InviteService} from '../../src/services/inviteService';
import {InviteStatus} from '@prisma/client';

// ---- Minimal mocks ----

function makeMockRedis() {
  const store: Record<string, string> = {};
  return {
    get: jest.fn(async (key: string) => store[key] ?? null),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => { store[key] = value; }),
    del: jest.fn(async (key: string) => { delete store[key]; }),
  };
}

function makeInvite(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    code: 'TESTCODE',
    projectId: null,
    inviterId: null,
    customData: null,
    maxUses: null,
    useCount: 0,
    expiresAt: null,
    status: InviteStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockPrisma(inviteData: ReturnType<typeof makeInvite> | null = makeInvite()) {
  return {
    invite: {
      findFirst: jest.fn(async () => inviteData),
      findMany: jest.fn(async () => (inviteData ? [inviteData] : [])),
      count: jest.fn(async () => (inviteData ? 1 : 0)),
      create: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({...makeInvite(), ...data})),
      update: jest.fn(async ({data}: {data: Record<string, unknown>}) => ({...inviteData, ...data})),
      updateMany: jest.fn(async () => ({count: 1})),
    },
    $transaction: jest.fn(async (fns: Array<Promise<unknown>>) => Promise.all(fns)),
  };
}

// ---- Tests ----

describe('InviteService.validateInvite', () => {
  const redis = makeMockRedis() as unknown as import('ioredis').Redis;
  const prisma = makeMockPrisma() as unknown as import('@prisma/client').PrismaClient;
  const service = new InviteService(prisma, redis);

  it('returns valid for an active, non-expired invite', () => {
    const result = service.validateInvite(makeInvite() as never);
    expect(result).toEqual({valid: true});
  });

  it('returns invalid for a REVOKED invite', () => {
    const result = service.validateInvite(makeInvite({status: InviteStatus.REVOKED}) as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/revoked/i);
  });

  it('returns invalid for an expired invite', () => {
    const past = new Date(Date.now() - 1000);
    const result = service.validateInvite(makeInvite({expiresAt: past}) as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('returns invalid when maxUses is reached', () => {
    const result = service.validateInvite(makeInvite({maxUses: 5, useCount: 5}) as never);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/maximum/i);
  });

  it('returns valid when useCount is below maxUses', () => {
    const result = service.validateInvite(makeInvite({maxUses: 10, useCount: 3}) as never);
    expect(result.valid).toBe(true);
  });
});

describe('InviteService.createInvite', () => {
  it('creates an invite with a generated code when none is supplied', async () => {
    const prisma = makeMockPrisma(null) as unknown as import('@prisma/client').PrismaClient;
    const redis = makeMockRedis() as unknown as import('ioredis').Redis;
    const service = new InviteService(prisma, redis);

    const invite = await service.createInvite({inviterId: 'user_1'});
    expect(invite.code).toBeTruthy();
    expect(invite.code.length).toBeGreaterThan(0);
  });

  it('uses the caller-supplied code when provided and available', async () => {
    const prisma = makeMockPrisma(null) as unknown as import('@prisma/client').PrismaClient;
    const redis = makeMockRedis() as unknown as import('ioredis').Redis;
    const service = new InviteService(prisma, redis);

    const invite = await service.createInvite({code: 'CUSTOM99'});
    // The create mock returns whatever data was passed
    expect((invite as {code: string}).code).toBe('CUSTOM99');
  });

  it('throws 409 when the requested code is already in use', async () => {
    // findFirst returns existing invite (code taken)
    const prisma = makeMockPrisma(makeInvite({code: 'TAKEN'})) as unknown as import('@prisma/client').PrismaClient;
    const redis = makeMockRedis() as unknown as import('ioredis').Redis;
    const service = new InviteService(prisma, redis);

    await expect(service.createInvite({code: 'TAKEN'})).rejects.toThrow('already in use');
  });
});
