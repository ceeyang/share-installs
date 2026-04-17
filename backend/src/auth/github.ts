/**
 * @fileoverview GitHub OAuth 2.0 route handlers.
 *
 * Routes:
 *   GET /auth/github          → redirect to GitHub authorization page
 *   GET /auth/github/callback → exchange code for token, upsert User, set cookie
 *   GET /auth/logout          → clear session cookie
 *
 * After successful login:
 *   - Upserts the User row (githubId, githubLogin, email, avatarUrl)
 *   - Issues a 7-day JWT stored in an HttpOnly cookie named "session"
 *   - Redirects to FRONTEND_URL
 */

import {Router, Request, Response} from 'express';
import {PrismaClient} from '@prisma/client';
import {config} from '../config/index';
import {signJwt} from './jwt';
import {logger} from '../utils/logger';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`);

  const data = await res.json() as GitHubTokenResponse;
  if (!data.access_token) {
    throw new Error(`GitHub OAuth error: ${data.error ?? 'no access_token'}`);
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
  return res.json() as Promise<GitHubUser>;
}

/**
 * Creates the GitHub OAuth router.
 * @param prisma     Prisma client for upsert operations.
 * @param jwtSecret  Secret for signing session JWTs.
 */
export function createGitHubAuthRouter(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();

  // Step 1: Redirect user to GitHub
  router.get('/github', (_req: Request, res: Response) => {
    if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET || !jwtSecret) {
      res.redirect(`${config.FRONTEND_URL}?error=github_not_configured`);
      return;
    }
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      scope: 'read:user,user:email',
    });
    res.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
  });

  // Step 2: Handle callback from GitHub
  router.get('/github/callback', async (req: Request, res: Response) => {
    const {code, error} = req.query as {code?: string; error?: string};

    if (error || !code) {
      logger.warn({error}, 'GitHub OAuth denied or missing code');
      res.redirect(`${config.FRONTEND_URL}?auth_error=access_denied`);
      return;
    }

    try {
      const accessToken = await exchangeCodeForToken(code);
      const ghUser = await fetchGitHubUser(accessToken);

      const user = await prisma.user.upsert({
        where: {githubId: String(ghUser.id)},
        update: {
          githubLogin: ghUser.login,
          email: ghUser.email ?? undefined,
          avatarUrl: ghUser.avatar_url,
        },
        create: {
          githubId: String(ghUser.id),
          githubLogin: ghUser.login,
          email: ghUser.email ?? undefined,
          avatarUrl: ghUser.avatar_url,
        },
      });

      const token = signJwt({sub: user.id, githubLogin: user.githubLogin ?? ''}, jwtSecret);
      const isHttps = config.FRONTEND_URL.startsWith('https://');

      res.cookie('session', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      logger.info({userId: user.id, githubLogin: user.githubLogin}, 'User authenticated via GitHub');
      res.redirect(config.FRONTEND_URL);
    } catch (err) {
      logger.error({err}, 'GitHub OAuth callback error');
      res.redirect(`${config.FRONTEND_URL}?auth_error=server_error`);
    }
  });

  // Step 3: Logout
  router.get('/logout', (_req: Request, res: Response) => {
    res.clearCookie('session', {path: '/'});
    res.redirect(config.FRONTEND_URL);
  });

  return router;
}
