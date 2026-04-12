/**
 * Unit tests – adminAuth middleware (timing-safe comparison)
 *
 * Tests the security-critical path: secret validation with
 * constant-time comparison to prevent timing attacks.
 *
 * Strategy: mutate the shared `config` object before each test.
 * adminAuth reads config.ADMIN_SECRET at call time, so mutations
 * are visible without module re-loading.
 */

import {Request, Response, NextFunction} from 'express';
import {config} from '../../src/config/index';
import {adminAuth} from '../../src/middleware/auth';

const originalEnvSecret = process.env.ADMIN_SECRET;

// ---- Helpers ----

function makeReq(authHeader?: string): Request {
  return {
    headers: {
      authorization: authHeader,
    },
  } as unknown as Request;
}

function makeRes(): {res: Response; status: jest.Mock; json: jest.Mock} {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const res = {status, json} as unknown as Response;
  return {res, status, json};
}

// ---- Tests ----

describe('adminAuth – ADMIN_SECRET not configured (open mode)', () => {
  beforeEach(() => {
    // Clear the secret so adminAuth passes through unconditionally
    (config as Record<string, unknown>).ADMIN_SECRET = undefined;
    delete process.env.ADMIN_SECRET;
  });

  afterAll(() => {
    process.env.ADMIN_SECRET = originalEnvSecret;
  });

  it('calls next() without checking the header', () => {
    const next = jest.fn() as NextFunction;
    const {res} = makeRes();
    adminAuth(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() even when no Authorization header is present', () => {
    const next = jest.fn() as NextFunction;
    const {res} = makeRes();
    adminAuth(makeReq(undefined), res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('adminAuth – ADMIN_SECRET configured', () => {
  beforeEach(() => {
    (config as Record<string, unknown>).ADMIN_SECRET = 'correct-secret';
    delete process.env.ADMIN_SECRET; // Ensure config is used, or simulate via process.env
  });

  afterEach(() => {
    (config as Record<string, unknown>).ADMIN_SECRET = undefined;
    delete process.env.ADMIN_SECRET;
  });

  it('calls next() when Bearer token matches the secret exactly', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer correct-secret'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq(undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when the token is wrong', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer wrong-secret'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an empty bearer token', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer '), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when header scheme is not Bearer', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Basic correct-secret'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('is case-sensitive for the token value', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer Correct-Secret'), res, next);  // wrong case
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a shorter token (timing-safe: different-length branch)', () => {
    // A token shorter than the secret exercises the dummy-comparison branch
    // of timingSafeCompare to prevent length-based timing leaks.
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer short'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a longer token (timing-safe: different-length branch)', () => {
    const next = jest.fn() as NextFunction;
    const {res, status} = makeRes();
    adminAuth(makeReq('Bearer correct-secret-but-much-longer-than-expected'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns a structured 401 error body', () => {
    const next = jest.fn() as NextFunction;
    const {res, json, status} = makeRes();
    adminAuth(makeReq(undefined), res, next);
    
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 401,
        status: 'UNAUTHENTICATED',
        message: 'Admin secret required',
      },
    });
  });
});
