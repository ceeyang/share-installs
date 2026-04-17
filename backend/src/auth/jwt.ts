/**
 * @fileoverview JWT sign and verify utilities for dashboard session tokens.
 *
 * Payload: { sub: string (User.id), githubLogin: string, iat: number, exp: number }
 * Default TTL: 7 days.
 */

import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  githubLogin?: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Signs a JWT with the given secret.
 * @param payload   Must contain sub (User.id) and githubLogin.
 * @param secret    Server secret (min 32 chars).
 * @param ttl       Expiry in seconds. Default: 7 days.
 */
export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttl: number = DEFAULT_TTL_SECONDS,
): string {
  return jwt.sign(payload, secret, {expiresIn: ttl});
}

/**
 * Verifies a JWT and returns the decoded payload, or null on any error.
 * Never throws — all jwt errors are caught and returned as null.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}
