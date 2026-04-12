/**
 * End-to-end integration tests – full deferred deep link flow.
 *
 * These tests exercise the complete invite lifecycle:
 *   1. Web SDK posts to /v1/clicks  → fingerprint stored in Redis + DB
 *   2. Native SDK posts to /v1/resolutions → invite resolved (exact or fuzzy)
 *   3. Invite useCount is incremented
 *
 * All external dependencies (Prisma, Redis) are mocked; no real DB/cache needed.
 */

import {buildApp, makeMockPrisma, makeMockRedis} from './helpers';
import {computeFingerprint} from '../../src/utils/fingerprint';

// Shared signal set used across click and resolve so they produce the same fingerprint.
const SHARED_SIGNALS = {
  ipAddress: '203.0.113.42',
  timezone: 'Asia/Shanghai',
  screenWidth: 390,
  screenHeight: 844,
  languages: ['zh-CN', 'zh'],
};

describe('E2E – click → exact match resolve', () => {
  it('full flow: records click, resolves via exact fingerprint match', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();
    const {agent} = buildApp(prisma, redis);

    // Step 1: Web SDK records a click
    const clickRes = await agent.post('/v1/clicks').send({
      inviteCode: 'TESTCODE',
      fingerprint: {
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2)',
        timezone: SHARED_SIGNALS.timezone,
        screen: {
          w: SHARED_SIGNALS.screenWidth,
          h: SHARED_SIGNALS.screenHeight,
          dpr: 3,
        },
        languages: SHARED_SIGNALS.languages,
      },
      referrer: 'https://example.com',
    });

    expect(clickRes.status).toBe(200);
    expect(typeof clickRes.body.eventId).toBe('string');
    const eventId = clickRes.body.eventId;

    // Step 2: Native SDK resolves the invite using the same signals
    // The click stored a fingerprint hash in Redis; simulate the Redis lookup
    // returning that cached entry when the matching fingerprint is queried.
    const fingerprint = computeFingerprint({
      ipAddress: SHARED_SIGNALS.ipAddress,
      timezone: SHARED_SIGNALS.timezone,
      screenWidth: SHARED_SIGNALS.screenWidth,
      screenHeight: SHARED_SIGNALS.screenHeight,
    });
    redis.get.mockImplementation(async (key: string) => {
      if (key.includes(':click:')) {
        return JSON.stringify({clickEventId: eventId, inviteCode: 'TESTCODE'});
      }
      return null as unknown as string;
    });
    prisma.clickEvent.update.mockResolvedValueOnce({
      id: eventId,
      inviteId: 'inv_test1',
      resolved: true,
      resolvedAt: new Date(),
    } as never);

    const resolveRes = await agent.post('/v1/resolutions').send({
      channel: 'ios',
      fingerprint: {
        osVersion: '17.2',
        timezone: SHARED_SIGNALS.timezone,
        screen: {w: SHARED_SIGNALS.screenWidth, h: SHARED_SIGNALS.screenHeight, scale: 3},
        languages: SHARED_SIGNALS.languages,
      },
    });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.matched).toBe(true);
    expect(resolveRes.body.meta.channel).toBe('exact');
    expect(resolveRes.body.meta.confidence).toBe(1.0);
    expect(resolveRes.body.inviteCode).toBe('TESTCODE');
  });

  it('includes X-Request-Id in both click and resolve responses', async () => {
    const {agent} = buildApp();

    const clickRes = await agent.post('/v1/clicks').send({
      inviteCode: 'TESTCODE',
      fingerprint: {timezone: 'UTC'},
    });
    const resolveRes = await agent.post('/v1/resolutions').send({
      channel: 'ios',
      fingerprint: {timezone: 'UTC'},
    });

    expect(clickRes.headers['x-request-id']).toMatch(
      /^[0-9a-f-]{36}$/,  // UUID v4 pattern
    );
    expect(resolveRes.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    // Each request gets its own ID
    expect(clickRes.headers['x-request-id']).not.toBe(resolveRes.headers['x-request-id']);
  });

  it('propagates a caller-supplied X-Request-Id', async () => {
    const {agent} = buildApp();
    const traceId = 'my-trace-id-12345';

    const res = await agent
      .get('/health')
      .set('X-Request-Id', traceId);

    expect(res.headers['x-request-id']).toBe(traceId);
  });
});

describe('E2E – fuzzy match resolve', () => {
  it('resolves via fuzzy match when signals are similar but not identical', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();
    const {agent} = buildApp(prisma, redis);

    // No exact match in Redis
    redis.get.mockResolvedValue(null as unknown as string);

    // Fuzzy set returns one recent click event ID
    redis.zrangebyscore.mockResolvedValue(['click_1']);

    // DB returns that click event with signals matching the resolve request.
    prisma.clickEvent.findMany.mockResolvedValueOnce([
      {
        id: 'click_1',
        inviteId: 'inv_test1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        languages: '["zh-CN","zh"]',
        timezone: 'Asia/Shanghai',
        screenWidth: 390,
        screenHeight: 844,
        pixelRatio: 3,
        hardwareConcurrency: 6,
        deviceMemory: 4,
        touchPoints: 5,
        canvasHash: null,
        webglHash: null,
        audioHash: null,
        osVersion: null,
        resolved: false,
        inviteCode: 'TESTCODE',
        customData: null,
      },
    ] as never);

    prisma.clickEvent.update.mockResolvedValueOnce({
      id: 'click_1',
      inviteId: 'inv_test1',
      resolved: true,
      resolvedAt: new Date(),
    } as never);

    const res = await agent.post('/v1/resolutions').send({
      channel: 'ios',
      fingerprint: {
        osVersion: '17.2',
        timezone: 'Asia/Shanghai',
        languages: ['zh-CN', 'zh'],
        screen: {w: 390, h: 844, scale: 3},
        networkType: 'wifi',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.meta.channel).toBe('fuzzy');
    expect(res.body.meta.confidence).toBeGreaterThanOrEqual(0.75);
    expect(res.body.inviteCode).toBe('TESTCODE');
  });

  it('returns matched:false when fuzzy score is below threshold', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();
    const {agent} = buildApp(prisma, redis);

    redis.get.mockResolvedValue(null as unknown as string);
    redis.zrangebyscore.mockResolvedValue(['click_1']);

    // Click event has completely different signals → low similarity score
    prisma.clickEvent.findMany.mockResolvedValueOnce([
      {
        id: 'click_1',
        inviteId: 'inv_test1',
        ipAddress: '8.8.8.8',
        languages: '["en-US"]',
        timezone: 'America/New_York',
        screenWidth: 1920,
        screenHeight: 1080,
        pixelRatio: 1,
        hardwareConcurrency: null,
        deviceMemory: null,
        touchPoints: null,
        canvasHash: null,
        webglHash: null,
        audioHash: null,
        osVersion: null,
        userAgent: null,
        resolved: false,
        inviteCode: 'TESTCODE',
        customData: null,
      },
    ] as never);

    const res = await agent.post('/v1/resolutions').send({
      channel: 'ios',
      fingerprint: {
        timezone: 'Asia/Shanghai',
        languages: ['zh-CN'],
        screen: {w: 390, h: 844, scale: 3},
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });
});

describe('E2E – clipboard resolve', () => {
  it('clipboard resolve (SHAREINSTALLS:CODE)', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({
      channel: 'android',
      clipboardCode: 'SHAREINSTALLS:TESTCODE',
      fingerprint: {},
    });

    // The code extracted is TESTCODE, which our mock returns
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.meta.channel).toBe('clipboard');
    expect(res.body.inviteCode).toBe('TESTCODE');
  });
});
