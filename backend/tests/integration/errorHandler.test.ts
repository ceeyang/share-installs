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
  it('returns 400 with details array for invalid invite creation', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/invites').send({code: 'X'});  // too short

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
  it('propagates 404 AppError from service (invite not found)', async () => {
    const prisma = makeMockPrisma();
    // No invite found → controller throws AppError(404)
    prisma.invite.findFirst.mockResolvedValue(null as never);
    const {agent} = buildApp(prisma);

    const res = await agent.post('/v1/clicks').send({
      inviteCode: 'NOEXIST',
      fingerprint: {timezone: 'UTC'},
    });

    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe('NOT_FOUND');
  });

  it('propagates 409 AppError from service (duplicate code)', async () => {
    const prisma = makeMockPrisma();
    // findFirst returns an existing invite → code collision → 409
    prisma.invite.findFirst.mockResolvedValueOnce({
      id: 'inv_existing',
      code: 'DUPCODE1',
    } as never);
    const {agent} = buildApp(prisma);

    const res = await agent.post('/v1/invites').send({code: 'DUPCODE1'});

    expect(res.status).toBe(409);
    expect(res.body.error.status).toBe('ALREADY_EXISTS');
  });
});

describe('Prisma error mapping', () => {
  it('maps Prisma P2002 (unique constraint) to 409', async () => {
    const prisma = makeMockPrisma();
    const prismaError = Object.assign(new Error('Unique constraint'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    prisma.invite.create.mockRejectedValueOnce(prismaError);

    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/invites').send({inviterId: 'user1'});

    expect(res.status).toBe(409);
    expect(res.body.error.status).toBe('ALREADY_EXISTS');
  });

  it('maps Prisma P2025 (record not found) to 404', async () => {
    // revokeInvite calls findFirst (returns invite) then invite.update.
    // Mock invite.update to throw P2025 to exercise the error-handler mapping.
    const prisma = makeMockPrisma();
    const prismaError = Object.assign(new Error('Record not found'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    });
    prisma.invite.update.mockRejectedValueOnce(prismaError);

    const {agent} = buildApp(prisma);
    const res = await agent.delete('/v1/invites/inv_test1');

    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe('NOT_FOUND');
  });
});

describe('Unhandled errors – 500', () => {
  it('returns 500 for unexpected errors from service layer', async () => {
    const prisma = makeMockPrisma();
    prisma.invite.findMany.mockRejectedValueOnce(new Error('DB connection lost'));
    const {agent} = buildApp(prisma);

    const res = await agent.get('/v1/invites');

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
      await agent.post('/v1/invites').send({code: 'X'}),                        // 400
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
