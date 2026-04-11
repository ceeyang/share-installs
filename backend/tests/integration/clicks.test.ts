/**
 * Integration tests – POST /v1/clicks
 *
 * Tests the full click-collection flow: validation → invite lookup →
 * fingerprint storage → Redis cache.
 */

import {buildApp, makeMockPrisma, makeInviteData} from './helpers';

const validBody = {
  inviteCode: 'TESTCODE',
  fingerprint: {
    timezone: 'Asia/Shanghai',
    languages: ['zh-CN', 'zh'],
    screen: {w: 390, h: 844, dpr: 3, depth: 24},
    hardware: {cores: 6, memory: 4},
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)',
  },
};

describe('POST /v1/clicks', () => {
  it('records a click and returns 200 with eventId', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send(validBody);

    expect(res.status).toBe(200);
    expect(typeof res.body.eventId).toBe('string');
  });

  it('sets X-Request-Id on the response', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send(validBody);

    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('caches the fingerprint in Redis', async () => {
    const {agent, redis} = buildApp();
    await agent.post('/v1/clicks').send(validBody);

    // setex is called first for invite cache (si:invite:...) then for the
    // fingerprint cache (si:click:...). Find the fingerprint-specific call.
    const fingerprintCall = (redis.setex.mock.calls as [string, number, string][])
      .find(([key]) => key.includes(':click:'));
    expect(fingerprintCall).toBeDefined();
    const [key, , value] = fingerprintCall!;
    expect(key).toMatch(/^si:click:/);
    expect(JSON.parse(value)).toMatchObject({
      clickEventId: expect.any(String),
      inviteId: expect.any(String),
    });
  });

  it('returns 400 when inviteCode is missing', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send({fingerprint: {}});

    expect(res.status).toBe(400);
    expect(res.body.error.status).toBe('INVALID_ARGUMENT');
  });

  it('returns 400 when fingerprint field is missing', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send({inviteCode: 'TESTCODE'});

    expect(res.status).toBe(400);
  });

  it('returns 404 when the invite does not exist', async () => {
    const prisma = makeMockPrisma();
    prisma.invite.findFirst.mockResolvedValueOnce(null as never);
    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/clicks').send(validBody);

    expect(res.status).toBe(404);
  });

  it('returns 410 for an expired invite', async () => {
    const past = new Date(Date.now() - 1_000);
    const prisma = makeMockPrisma(makeInviteData({expiresAt: past}));
    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/clicks').send(validBody);

    expect(res.status).toBe(410);
  });

  it('accepts a webgl hash coerced from a number (legacy client)', async () => {
    // Some YAML/JSON parsers emit numeric values for hex-looking strings.
    // The backend must coerce them to strings rather than rejecting.
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send({
      ...validBody,
      fingerprint: {
        ...validBody.fingerprint,
        webgl: 11_223_344_556_677, // number, not string
      },
    });

    expect(res.status).toBe(200);
  });

  it('accepts an optional referrer field', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/clicks').send({
      ...validBody,
      referrer: 'https://example.com/feed',
    });

    expect(res.status).toBe(200);
  });
});
