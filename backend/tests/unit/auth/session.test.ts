import {Request, Response, NextFunction} from 'express';
import {createRequireSession} from '../../../src/auth/session';
import {signJwt} from '../../../src/auth/jwt';

const secret = 'a'.repeat(32);
const requireSession = createRequireSession(secret);

function mockReq(cookie?: string): Partial<Request> {
  return {
    cookies: cookie ? {session: cookie} : {},
    headers: {},
  };
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('requireSession', () => {
  it('calls next() and sets req.userId for valid cookie', () => {
    const token = signJwt({sub: 'user_123', githubLogin: 'octocat'}, secret);
    const req = mockReq(token) as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & {userId?: string}).userId).toBe('user_123');
  });

  it('returns 401 when no cookie present', () => {
    const req = mockReq() as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for invalid token', () => {
    const req = mockReq('not.a.jwt') as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for expired token', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret, -1);
    const req = mockReq(token) as Request;
    const res = mockRes() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
