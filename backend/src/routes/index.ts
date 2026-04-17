/**
 * @fileoverview Main API router.
 *
 * Access model:
 *
 *   自部署 (MULTI_TENANT=false):
 *     POST /v1/clicks      – 无需认证
 *     POST /v1/resolutions – 无需认证
 *
 *   SaaS (MULTI_TENANT=true):
 *     所有端点需要 Authorization: Bearer <api_key>
 *     项目/API key 管理需要 ADMIN_SECRET（超级管理员）
 */

import {Router} from 'express';
import {PrismaClient} from '@prisma/client';
import type {Redis} from 'ioredis';
import {ResolveController} from '../controllers/resolveController';
import {ProjectController} from '../controllers/projectController';
import {FingerprintService} from '../services/fingerprintService';
import {ApiKeyService} from '../services/apiKeyService';
import {QuotaService} from '../services/quotaService';
import {createGitHubAuthRouter} from '../auth/github';
import {createEmailAuthRouter} from '../auth/email';
import {createRequireSession} from '../auth/session';
import * as dashboardController from '../controllers/dashboardController';
import {
  adminAuth,
  createRequireApiKey,
} from '../middleware/auth';
import {createRateLimiters, createPlanRateLimiter} from '../middleware/rateLimit';
import {config} from '../config/index';

export function createRouter(prisma: PrismaClient, redis: Redis): Router {
  const router = Router();

  // ---- Services ----
  const quotaService = config.MULTI_TENANT ? new QuotaService(prisma, redis) : undefined;
  const fingerprintService = new FingerprintService(prisma, redis, quotaService);
  const apiKeyService = new ApiKeyService(prisma);

  // ---- Controllers ----
  const resolveController = new ResolveController(fingerprintService);
  const projectController = new ProjectController(apiKeyService);

  // ---- Auth helpers ----
  const requireApiKey = createRequireApiKey(prisma);
  const jwtSecret = config.JWT_SECRET ?? '';
  const requireSession = createRequireSession(jwtSecret);

  // ---- Rate limiters ----
  const {apiRateLimiter, resolveRateLimiter} = createRateLimiters(redis);
  // SaaS: per-plan limiter (keyed by appId, limit based on user's plan).
  // Self-hosted: falls back to static resolveRateLimiter.
  const planRateLimiter = createPlanRateLimiter(redis);

  // ---- Global rate limiter ----
  router.use(apiRateLimiter);

  // ---- Health ----
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      mode: config.MULTI_TENANT ? 'saas' : 'self-hosted',
    });
  });

  // ---- V1 API ----
  const v1 = Router();

  // --- Project management (super-admin only) ---
  v1.post('/projects', adminAuth, ...projectController.create);
  v1.get('/projects', adminAuth, ...projectController.list);
  v1.post('/projects/:projectId/api-keys', adminAuth, ...projectController.createKey);
  v1.get('/projects/:projectId/api-keys', adminAuth, ...projectController.listKeys);
  v1.delete('/projects/:projectId/api-keys/:keyId', adminAuth, ...projectController.revokeKey);

  if (config.MULTI_TENANT) {
    // SaaS mode: all core endpoints require a valid API key.
    v1.post('/clicks',      requireApiKey, ...resolveController.collect);
    v1.post('/resolutions', requireApiKey, planRateLimiter, ...resolveController.resolve);
  } else {
    // Self-hosted mode: no authentication required.
    v1.post('/clicks',      ...resolveController.collect);
    v1.post('/resolutions', resolveRateLimiter, ...resolveController.resolve);
  }

  // --- Debug (non-production only) ---
  if (config.NODE_ENV !== 'production') {
    if (config.MULTI_TENANT) {
      v1.get('/debug/clicks/:inviteCode', requireApiKey, ...resolveController.debugClicks);
    } else {
      v1.get('/debug/clicks/:inviteCode', ...resolveController.debugClicks);
    }
  }

  router.use('/v1', v1);

  // ---- Auth routes (/auth/*) ----
  router.use('/auth', createGitHubAuthRouter(prisma, config.JWT_SECRET || ''));
  router.use('/auth', createEmailAuthRouter(prisma, config.JWT_SECRET || '', redis));

  // ---- Dashboard routes (/dashboard/*) ----
  // All dashboard routes require a valid session cookie.
  // Route handlers are implemented by Module 4 (dashboardController).
  // Until then, returns 501 so the middleware chain is verified.
  const dashboard = Router();
  dashboard.use(requireSession);
  
  // User profile & Quota
  dashboard.get('/me', dashboardController.getMe);
  dashboard.patch('/me', dashboardController.updateMe);
  dashboard.get('/quota', dashboardController.getQuota);

  // App management
  dashboard.get('/apps', dashboardController.listApps);
  dashboard.post('/apps', dashboardController.createApp);
  dashboard.delete('/apps/:appId', dashboardController.deleteApp);

  // API Key management
  dashboard.get('/apps/:appId/keys', dashboardController.listApiKeys);
  dashboard.post('/apps/:appId/keys', dashboardController.createApiKey);
  dashboard.get('/apps/:appId/keys/:keyId/reveal', dashboardController.revealApiKey);
  dashboard.delete('/apps/:appId/keys/:keyId', dashboardController.deleteApiKey);

  // Stats
  dashboard.get('/apps/:appId/stats', dashboardController.getAppStats);

  router.use('/dashboard', dashboard);

  return router;
}
