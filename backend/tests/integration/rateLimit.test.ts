/**
 * Integration tests – rate limiting
 *
 * Verifies that endpoints enforce request limits via the Redis-backed store.
 * Uses the mock Redis from helpers.ts which maintains counters per key in
 * memory so the limiter can count up and trigger a 429.
 */

import {buildApp, makeMockPrisma, makeMockRedis} from './helpers';

const validResolveBody = {
  channel: 'ios',
  fingerprint: {
    timezone: 'Asia/Shanghai',
    languages: ['zh-CN'],
    screen: {w: 390, h: 844, scale: 3},
  },
};

describe('Rate limit headers', () => {
  it('includes standard RateLimit headers on every response', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/health').set('X-Forwarded-For', '192.168.50.1');

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it('decrements remaining count on successive requests', async () => {
    const {agent} = buildApp();
    const testIp = '192.168.50.2';
    const first = await agent.get('/health').set('X-Forwarded-For', testIp);
    const second = await agent.get('/health').set('X-Forwarded-For', testIp);

    const remaining1 = parseInt(first.headers['ratelimit-remaining'] as string, 10);
    const remaining2 = parseInt(second.headers['ratelimit-remaining'] as string, 10);

    expect(remaining2).toBeLessThan(remaining1);
  });
});

describe('Resolve endpoint rate limit (max 10 per minute)', () => {
  it('returns 429 after exceeding the per-endpoint limit', async () => {
    const prisma = makeMockPrisma();
    const redis = makeMockRedis();
    const {agent} = buildApp(prisma, redis);

    const testIp = '192.168.50.3';
    // Make 10 requests (all within limit)
    const responses: number[] = [];
    for (let i = 0; i < 10; i++) {
       const res = await agent.post('/v1/resolutions')
         .set('X-Forwarded-For', testIp)
         .send(validResolveBody);
      responses.push(res.status);
    }
    // All 10 should succeed (200)
    expect(responses.every(s => s === 200)).toBe(true);

    // 11th request should be rate-limited
    const limitedRes = await agent.post('/v1/resolutions')
      .set('X-Forwarded-For', testIp)
      .send(validResolveBody);
    expect(limitedRes.status).toBe(429);
  });

  it('rate limit response has the correct error structure', async () => {
    const redis = makeMockRedis();
    const {agent} = buildApp(makeMockPrisma(), redis);

    const testIp = '192.168.50.4';
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      await agent.post('/v1/resolutions')
        .set('X-Forwarded-For', testIp)
        .send(validResolveBody);
    }

    const res = await agent.post('/v1/resolutions')
      .set('X-Forwarded-For', testIp)
      .send(validResolveBody);
    expect(res.status).toBe(429);
    // express-rate-limit emits its message body directly
    expect(res.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});
