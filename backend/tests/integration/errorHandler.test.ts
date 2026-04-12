/**
 * Integration tests – error handling middleware
 *
 * Verifies that the centralized error handler and notFoundHandler return
 * consistent, structured JSON error responses in all error scenarios.
 */

import {buildApp, makeMockPrisma} from './helpers';

describe('404 – unknown routes', () => {
  it('returns 404 for an unknown GET route', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 404,
      status: 'NOT_FOUND',
      message: expect.stringContaining('/v1/does-not-exist'),
    });
  });

  it('returns 404 for an unknown POST route', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/nonexistent').send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(404);
  });

  it('returns 404 for a completely unknown path', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/api/v99/anything');

    expect(res.status).toBe(404);
  });
});

describe('Validation errors – 400', () => {
  it('returns 400 with details array for invalid project creation', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/projects').send({name: ''});  // name required

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(400);
    expect(res.body.error.status).toBe('INVALID_ARGUMENT');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid channel in resolution request', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/resolutions').send({
      channel: 'unknown-platform',
      fingerprint: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.error.status).toBe('INVALID_ARGUMENT');
  });
});

describe('AppError propagation', () => {
  it('propagates 404 AppError from service (project not found)', async () => {
    const prisma = makeMockPrisma();
    prisma.project.findUnique.mockResolvedValueOnce(null);
    const {agent} = buildApp(prisma);

    // POST /v1/projects/:id/api-keys explicitly checks for project existence
    const res = await agent.post('/v1/projects/proj_nonexistent/api-keys').send({name: 'new-key'});

    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe('NOT_FOUND');
  });
});


describe('Prisma error mapping', () => {
  it('maps Prisma P2002 (unique constraint) to 409', async () => {
    const prisma = makeMockPrisma();
    const prismaError = Object.assign(new Error('Unique constraint'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    prisma.project.create.mockRejectedValueOnce(prismaError);

    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/projects').send({name: 'Broken Project'});

    expect(res.status).toBe(409);
    expect(res.body.error.status).toBe('ALREADY_EXISTS');
  });

  it('maps Prisma P2025 (record not found) to 404', async () => {
    const prisma = makeMockPrisma();
    const prismaError = Object.assign(new Error('Record not found'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    });
    // simulate error during project retrieval in createKey
    prisma.project.findUnique.mockRejectedValueOnce(prismaError);

    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/projects/proj_missing/api-keys').send({name: 'key'});

    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe('NOT_FOUND');
  });
});

describe('Unhandled errors – 500', () => {
  it('returns 500 for unexpected errors from service layer', async () => {
    const prisma = makeMockPrisma();
    prisma.project.findMany.mockRejectedValueOnce(new Error('DB connection lost'));
    const {agent} = buildApp(prisma);

    const res = await agent.get('/v1/projects');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: 500,
      status: 'INTERNAL',
      message: expect.any(String),
    });
  });
});

describe('Error response structure consistency', () => {
  it('all error responses have the same {error:{code,status,message}} shape', async () => {
    // Sequential requests to avoid ECONNRESET from concurrent keep-alive teardown
    const {agent} = buildApp();

    const results = [
      await agent.get('/v1/unknown'),                                            // 404
      await agent.post('/v1/projects').send({name: ''}),                        // 400
      await agent.post('/v1/clicks').send({fingerprint: {}}),                   // 400 (missing inviteCode)
      await agent.post('/v1/resolutions').send({channel: 'bad', fingerprint: {}}), // 400
    ];

    for (const res of results) {
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error.code).toBe('number');
      expect(typeof res.body.error.status).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
    }
  });
});
