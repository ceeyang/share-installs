/**
 * @fileoverview Session middleware for dashboard routes.
 *
 * Reads the `session` cookie (HttpOnly JWT), verifies it, and injects
 * `req.userId` (User.id cuid) for downstream handlers.
 */

import {Request, Response, NextFunction} from 'express';
import {verifyJwt} from './jwt';

// Extend Express Request with dashboard user context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireSession for dashboard routes. */
      userId?: string;
    }
  }
}

/**
 * Factory: creates a requireSession middleware bound to a specific JWT secret.
 * Returns 401 when the session cookie is missing or the JWT is invalid/expired.
 */
export function createRequireSession(jwtSecret: string) {
  return function requireSession(req: Request, res: Response, next: NextFunction): void {
    const token: string | undefined = req.cookies?.session;

    if (!token) {
      res.status(401).json({
        error: {code: 401, status: 'UNAUTHENTICATED', message: 'Session required. Please log in.'},
      });
      return;
    }

    const payload = verifyJwt(token, jwtSecret);
    if (!payload) {
      res.status(401).json({
        error: {code: 401, status: 'UNAUTHENTICATED', message: 'Session expired or invalid.'},
      });
      return;
    }

    req.userId = payload.sub;
    next();
  };
}
