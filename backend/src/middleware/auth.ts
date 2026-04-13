/**
 * @fileoverview Authentication middleware.
 *
 * 自部署 (MULTI_TENANT=false):
 *   - Core endpoints (clicks, resolutions): no auth required.
 *   - Admin endpoints (project management): optional ADMIN_SECRET bearer token.
 *
 * SaaS (MULTI_TENANT=true):
 *   - Core endpoints: API key required (Authorization: Bearer sk_live_xxx).
 *   - Admin endpoints: ADMIN_SECRET required.
 */

import crypto from 'crypto';
import {Request, Response, NextFunction} from 'express';
import {PrismaClient} from '@prisma/client';
import {config} from '../config/index';
import {sha256} from '../utils/crypto';

// Augment Express Request to carry resolved project context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireApiKey in multi-tenant mode. */
      projectId?: string;
    }
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always runs the full comparison even when lengths differ.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Run a dummy comparison to consume the same amount of time,
    // then return false so the length difference isn't leaked via early exit.
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Extracts the raw bearer token from the Authorization header. */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Single-tenant admin auth.
 *
 * Passes through if ADMIN_SECRET is not configured (open mode).
 * Returns 401 if the secret is configured but the header doesn't match.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = config.ADMIN_SECRET;
  
  if (!adminSecret) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('Admin auth attempt failed: missing or malformed header');
    res.status(401).json({
      error: {
        code: 401,
        status: 'UNAUTHENTICATED',
        message: 'Admin secret required',
      },
    });
    return;
  }

  const token = extractBearerToken(req);
  if (!token || !timingSafeCompare(token, adminSecret)) {
    console.warn('Admin auth attempt failed: invalid secret');
    res.status(401).json({
      error: {
        code: 401,
        status: 'UNAUTHENTICATED',
        message: 'Missing or invalid Authorization header.',
      },
    });
    return;
  }

  next();
}

/**
 * Factory: creates a multi-tenant API key middleware that resolves the project.
 *
 * On success: sets req.projectId and calls next().
 * On failure: returns 401.
 */
export function createRequireApiKey(prisma: PrismaClient) {
  return async function requireApiKey(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const raw = extractBearerToken(req);
    if (!raw) {
      res.status(401).json({
        error: {
          code: 401,
          status: 'UNAUTHENTICATED',
          message: 'Missing Authorization header. Expected: Bearer <api_key>',
        },
      });
      return;
    }

    // Keys are prefixed (e.g. "sk_live_abcd1234..."). Use prefix for index lookup.
    const prefix = raw.slice(0, 12);
    const hash = sha256(raw);

    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {prefix, keyHash: hash, revokedAt: null},
        select: {appId: true},
      });

      if (!apiKey) {
        res.status(401).json({
          error: {
            code: 401,
            status: 'UNAUTHENTICATED',
            message: 'API key is invalid or has been revoked.',
          },
        });
        return;
      }

      req.projectId = apiKey.appId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

