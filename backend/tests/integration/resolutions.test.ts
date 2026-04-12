/**
 * Integration tests – POST /v1/resolutions
 *
 * Tests all three resolution channels:
 *   1. Clipboard (Android, confidence 1.0)
 *   2. Exact fingerprint match (Redis fast path)
 *   3. No match (returns matched: false)
 */

import {buildApp, makeMockPrisma, makeMockRedis} from './helpers';

const iosBody = {
  channel: 'ios',
  fingerprint: {
    osVersion: '17.2',
    languages: ['zh-CN', 'zh'],
    timezone: 'Asia/Shanghai',
    screen: {w: 390, h: 844, scale: 3},
    networkType: 'wifi',
  },
};

const androidBody = {
  channel: 'android',
  fingerprint: {
    androidId: 'abc123def456',
    apiLevel: 34,
    brand: 'Google',
    model: 'Pixel 8',
    timezone: 'Asia/Shanghai',
    languages: ['zh-CN'],
  },
};

describe('POST /v1/resolutions', () => {
  // ---- Input validation ----

  it('returns 400 for an invalid channel value', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({
      channel: 'web',
      fingerprint: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.error.status).toBe('INVALID_ARGUMENT');
  });

  it('returns 400 when fingerprint field is missing', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({channel: 'ios'});

    expect(res.status).toBe(400);
  });

  // ---- No match ----

  it('returns matched:false when no fingerprint match exists', async () => {
    // Default mock: redis.get returns null → no exact match
    // Fuzzy matching candidates also empty by default
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send(iosBody);

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
    expect(res.body.inviteCode).toBeUndefined();
  });

  // ---- Clipboard channel (Android) ----

  it('resolves via clipboard on Android (confidence 1.0)', async () => {
    const prisma = makeMockPrisma();
    const {agent} = buildApp(prisma);

    const res = await agent.post('/v1/resolutions').send({
      channel: 'android',
      clipboardCode: 'SHAREINSTALLS:TESTCODE',
      fingerprint: {},
    });

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.meta.channel).toBe('clipboard');
    expect(res.body.meta.confidence).toBe(1.0);
    expect(res.body.inviteCode).toBe('TESTCODE');
  });

  it('ignores clipboard on iOS (falls through to fingerprint matching)', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({
      channel: 'ios',
      clipboardCode: 'SHAREINSTALLS:TESTCODE', // must be ignored for iOS
      fingerprint: iosBody.fingerprint,
    });

    // Default mocks have no Redis hit → no match
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });

  it('ignores clipboard without the SHAREINSTALLS: prefix', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({
      channel: 'android',
      clipboardCode: 'RANDOMTEXT',
      fingerprint: {},
    });

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });

  // ---- Exact fingerprint match (Redis) ----

  it('resolves via exact match and returns matched:true', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();

    // Simulate a cached fingerprint entry in Redis
    const cached = JSON.stringify({
      clickEventId: 'click_1',
      inviteCode: 'TESTCODE',
    });
    redis.get.mockResolvedValueOnce(cached);

    // markClickResolved needs clickEvent.update + conversion.create
    prisma.clickEvent.update.mockResolvedValueOnce({
      id: 'click_1',
      inviteCode: 'TESTCODE',
      resolved: true,
      resolvedAt: new Date(),
    } as never);

    const {agent} = buildApp(prisma, redis);
    const res = await agent.post('/v1/resolutions').send(iosBody);

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.meta.channel).toBe('exact');
    expect(res.body.meta.confidence).toBe(1.0);
    expect(res.body.inviteCode).toBe('TESTCODE');
    expect(typeof res.body.customData).toBe('object'); // null is typeof 'object'
  });

  it('records a Conversion row on exact match', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();

    redis.get.mockResolvedValueOnce(
      JSON.stringify({clickEventId: 'click_1', inviteCode: 'TESTCODE'}),
    );
    prisma.clickEvent.update.mockResolvedValueOnce({
      id: 'click_1',
      inviteCode: 'TESTCODE',
      resolved: true,
      resolvedAt: new Date(),
    } as never);

    const {agent} = buildApp(prisma, redis);
    await agent.post('/v1/resolutions').send(iosBody);

    expect(prisma.conversion.create).toHaveBeenCalledTimes(1);
    expect((prisma.conversion.create.mock.calls as unknown[][])[0][0]).toMatchObject({
      data: expect.objectContaining({
        matchChannel: 'exact',
        confidence: 1.0,
      }),
    });
  });

  it('deletes the Redis cache entry after a successful match', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();

    redis.get.mockResolvedValueOnce(
      JSON.stringify({clickEventId: 'click_1', inviteCode: 'TESTCODE'}),
    );
    prisma.clickEvent.update.mockResolvedValueOnce({
      id: 'click_1',
      inviteCode: 'TESTCODE',
      resolved: true,
      resolvedAt: new Date(),
    } as never);

    const {agent} = buildApp(prisma, redis);
    await agent.post('/v1/resolutions').send(iosBody);

    // The fingerprint cache key must be removed to prevent duplicate matches
    expect(redis.del).toHaveBeenCalled();
  });

  // ---- Android-specific fields ----

  it('accepts Android fingerprint fields', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send(androidBody);

    expect(res.status).toBe(200);
    // No match expected with default mocks, but validation must pass
    expect(res.body.matched).toBe(false);
  });
});
