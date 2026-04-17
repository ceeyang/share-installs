import {Router, Request, Response} from 'express';
import {PrismaClient} from '@prisma/client';
import type {Redis} from 'ioredis';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {config} from '../config/index';
import {signJwt} from './jwt';
import {logger} from '../utils/logger';
import {createRegisterRateLimiter} from '../middleware/rateLimit';

function randomHex(bytes = 4): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function setSessionCookie(res: Response, token: string): void {
  const isHttps = config.FRONTEND_URL.startsWith('https://');
  res.cookie('session', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function createEmailAuthRouter(
  prisma: PrismaClient,
  jwtSecret: string,
  redis: Redis,
): Router {
  const router = Router();
  const registerLimiter = createRegisterRateLimiter(redis);

  // POST /auth/register
  router.post('/register', registerLimiter, async (req: Request, res: Response) => {
    const {email, password, displayName} = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password) {
      res.status(400).json({error: 'email and password are required'});
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({error: 'Invalid email format'});
      return;
    }
    if (password.length < 8) {
      res.status(400).json({error: 'Password must be at least 8 characters'});
      return;
    }

    try {
      const existing = await prisma.user.findUnique({where: {email}});
      if (existing) {
        res.status(409).json({error: 'Email already registered'});
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const resolvedName = displayName?.trim() || `user_${randomHex(4)}`;
      const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${randomHex(8)}`;

      const user = await prisma.user.create({
        data: {email, passwordHash, displayName: resolvedName, avatarUrl},
      });

      const token = signJwt({sub: user.id}, jwtSecret);
      setSessionCookie(res, token);
      logger.info({userId: user.id}, 'User registered via email');
      res.json({ok: true});
    } catch (err) {
      logger.error({err}, 'Email register error');
      res.status(500).json({error: 'Internal server error'});
    }
  });

  // POST /auth/login
  router.post('/login', async (req: Request, res: Response) => {
    const {email, password} = req.body as {email?: string; password?: string};

    if (!email || !password) {
      res.status(400).json({error: 'email and password are required'});
      return;
    }

    try {
      const user = await prisma.user.findUnique({where: {email}});
      // Use a constant-time dummy hash when user not found to prevent timing attacks
      const hash =
        user?.passwordHash ??
        '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const match = await bcrypt.compare(password, hash);

      if (!user || !user.passwordHash || !match) {
        res.status(401).json({error: 'Invalid email or password'});
        return;
      }

      const token = signJwt({sub: user.id}, jwtSecret);
      setSessionCookie(res, token);
      logger.info({userId: user.id}, 'User authenticated via email');
      res.json({ok: true});
    } catch (err) {
      logger.error({err}, 'Email login error');
      res.status(500).json({error: 'Internal server error'});
    }
  });

  return router;
}
