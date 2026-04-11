/**
 * Integration tests – /v1/invites CRUD
 */

import {buildApp, makeMockPrisma, makeInviteData} from './helpers';
import {InviteStatus} from '@prisma/client';

// ---- POST /v1/invites ----

describe('POST /v1/invites', () => {
  it('creates an invite and returns 201', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/invites').send({inviterId: 'user_1'});

    expect(res.status).toBe(201);
    expect(res.body.invite).toBeDefined();
    expect(res.body.invite.id).toBeDefined();
  });

  it('accepts an optional caller-supplied code', async () => {
    const prisma = makeMockPrisma();
    // findFirst returns null → code not taken
    prisma.invite.findFirst.mockResolvedValueOnce(null as never);
    prisma.invite.create.mockResolvedValueOnce(
      makeInviteData({code: 'MYCODE01'}) as never,
    );
    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/invites').send({code: 'MYCODE01'});

    expect(res.status).toBe(201);
  });

  it('returns 400 when code is too short', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/invites').send({code: 'AB'}); // min 4

    expect(res.status).toBe(400);
    expect(res.body.error.status).toBe('INVALID_ARGUMENT');
  });

  it('returns 400 when ttlDays is out of range', async () => {
    const {agent} = buildApp();
    const res = await agent.post('/v1/invites').send({ttlDays: 400}); // max 365

    expect(res.status).toBe(400);
  });

  it('returns 400 when customData exceeds 10 KB', async () => {
    const {agent} = buildApp();
    const bigData = {payload: 'x'.repeat(11_000)};
    const res = await agent.post('/v1/invites').send({customData: bigData});

    expect(res.status).toBe(400);
    expect(res.body.details[0].msg).toMatch(/10 KB/i);
  });

  it('returns 409 when the requested code is already taken', async () => {
    const prisma = makeMockPrisma();
    // findFirst returns an existing invite → code collision
    prisma.invite.findFirst.mockResolvedValueOnce(makeInviteData({code: 'TAKEN123'}) as never);
    const {agent} = buildApp(prisma);
    const res = await agent.post('/v1/invites').send({code: 'TAKEN123'});

    expect(res.status).toBe(409);
  });
});

// ---- GET /v1/invites ----

describe('GET /v1/invites', () => {
  it('returns a paginated list', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/v1/invites');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invites)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: expect.any(Number),
      pageSize: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it('accepts page and pageSize query params', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/v1/invites?page=2&pageSize=5');

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.pageSize).toBe(5);
  });
});

// ---- GET /v1/invites/:code ----

describe('GET /v1/invites/:code', () => {
  it('returns the invite when found', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/v1/invites/TESTCODE');

    expect(res.status).toBe(200);
    expect(res.body.invite.code).toBe('TESTCODE');
    expect(typeof res.body.valid).toBe('boolean');
  });

  it('returns 404 for an unknown code', async () => {
    const prisma = makeMockPrisma();
    prisma.invite.findFirst.mockResolvedValueOnce(null as never);
    const {agent} = buildApp(prisma);
    const res = await agent.get('/v1/invites/NOTFOUND');

    expect(res.status).toBe(404);
  });

  it('returns valid:false for a revoked invite', async () => {
    const revoked = makeInviteData({status: InviteStatus.REVOKED});
    const {agent} = buildApp(makeMockPrisma(revoked));
    const res = await agent.get('/v1/invites/TESTCODE');

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/revoked/i);
  });

  it('returns valid:false for an expired invite', async () => {
    const past = new Date(Date.now() - 1_000);
    const expired = makeInviteData({expiresAt: past});
    const {agent} = buildApp(makeMockPrisma(expired));
    const res = await agent.get('/v1/invites/TESTCODE');

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/expired/i);
  });
});

// ---- DELETE /v1/invites/:id ----

describe('DELETE /v1/invites/:id', () => {
  it('revokes the invite and returns 200', async () => {
    const {agent} = buildApp();
    const res = await agent.delete('/v1/invites/inv_test1');

    expect(res.status).toBe(200);
  });
});
