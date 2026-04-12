/**
 * Integration tests – Admin authentication middleware
 *
 * Verifies that management endpoints (POST /v1/projects, GET /v1/projects)
 * enforce the ADMIN_SECRET when it is configured, and remain open when it is not set.
 */

import { buildApp } from './helpers';

describe('Admin auth', () => {
  beforeAll(() => {
    process.env.MULTI_TENANT = 'true';
  });

  describe('Admin auth – ADMIN_SECRET not configured (open mode)', () => {
    beforeAll(() => {
      delete process.env.ADMIN_SECRET;
    });

    it('allows POST /v1/projects without a token', async () => {
      const { agent } = buildApp();
      const res = await agent.post('/v1/projects').send({ name: 'Test Project' });
      // The endpoint should pass auth and hit the controller (which might fail validation but not 401)
      expect(res.status).not.toBe(401);
    });

    it('allows GET /v1/projects without a token', async () => {
      const { agent } = buildApp();
      const res = await agent.get('/v1/projects');
      expect(res.status).toBe(200);
    });
  });

  describe('Admin auth – ADMIN_SECRET configured', () => {
    const SECRET = 'test-secret-xyz';

    beforeAll(() => {
      process.env.ADMIN_SECRET = SECRET;
    });

    afterAll(() => {
      delete process.env.ADMIN_SECRET;
    });

    it('returns 401 when Authorization header is missing', async () => {
      const { agent } = buildApp();
      const res = await agent.get('/v1/projects');
      // In our test env the secret is set at runtime.
      expect(res.status).toBe(401);
    });

    it('returns 200 when correct Authorization header is provided', async () => {
      const { agent } = buildApp();
      const res = await agent.get('/v1/projects').set('Authorization', `Bearer ${SECRET}`);
      expect(res.status).toBe(200);
    });
  });
});
