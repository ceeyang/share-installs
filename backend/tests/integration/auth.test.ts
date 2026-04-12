/**
 * Integration tests – Admin authentication middleware
 *
 * Verifies that management endpoints (POST /v1/projects, GET /v1/projects)
 * enforce the ADMIN_SECRET when it is configured, and remain open when it is not set.
 */

describe('Admin auth', () => {
  beforeEach(() => {
    process.env.MULTI_TENANT = 'true';
  });

  describe('Admin auth – ADMIN_SECRET not configured (open mode)', () => {
    it('allows POST /v1/projects without a token', async () => {
      await jest.isolateModules(async () => {
        delete process.env.ADMIN_SECRET;
        const { buildApp } = require('./helpers');
        const { agent } = buildApp();
        const res = await agent.post('/v1/projects').send({ name: 'Test Project' });
        expect(res.status).not.toBe(401);
      });
    });

    it('allows GET /v1/projects without a token', async () => {
      await jest.isolateModules(async () => {
        delete process.env.ADMIN_SECRET;
        const { buildApp } = require('./helpers');
        const { agent } = buildApp();
        const res = await agent.get('/v1/projects');
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Admin auth – ADMIN_SECRET configured', () => {
    const SECRET = 'test-secret-xyz';

    it('returns 401 when Authorization header is missing', async () => {
      await jest.isolateModules(async () => {
        process.env.ADMIN_SECRET = SECRET;
        const { buildApp } = require('./helpers');
        const { agent } = buildApp();
        const res = await agent.get('/v1/projects');
        expect(res.status).toBe(401);
      });
    });

    it('returns 200 when correct Authorization header is provided', async () => {
      await jest.isolateModules(async () => {
        process.env.ADMIN_SECRET = SECRET;
        const { buildApp } = require('./helpers');
        const { agent } = buildApp();
        const res = await agent.get('/v1/projects').set('Authorization', `Bearer ${SECRET}`);
        expect(res.status).toBe(200);
      });
    });
  });

  afterAll(() => {
    delete process.env.ADMIN_SECRET;
    delete process.env.MULTI_TENANT;
  });
});
