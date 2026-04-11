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
import {
  adminAuth,
  createRequireApiKey,
} from '../middleware/auth';
import {createRateLimiters} from '../middleware/rateLimit';
import {config} from '../config/index';

export function createRouter(prisma: PrismaClient, redis: Redis): Router {
  const router = Router();

  // ---- Services ----
  const fingerprintService = new FingerprintService(prisma, redis);
  const apiKeyService = new ApiKeyService(prisma);

  // ---- Controllers ----
  const resolveController = new ResolveController(fingerprintService);
  const projectController = new ProjectController(apiKeyService);

  // ---- Auth helpers ----
  const requireApiKey = createRequireApiKey(prisma);

  // ---- Rate limiters ----
  const {apiRateLimiter, resolveRateLimiter} = createRateLimiters(redis);

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

  if (config.MULTI_TENANT) {
    // SaaS mode: all core endpoints require a valid API key.
    // Project/key management requires super-admin secret.

    // --- Project management (super-admin only) ---
    v1.post('/projects', adminAuth, ...projectController.create);
    v1.get('/projects', adminAuth, ...projectController.list);
    v1.post('/projects/:projectId/api-keys', adminAuth, ...projectController.createKey);
    v1.get('/projects/:projectId/api-keys', adminAuth, ...projectController.listKeys);
    v1.delete('/projects/:projectId/api-keys/:keyId', adminAuth, ...projectController.revokeKey);

    // --- Core endpoints (require API key) ---
    v1.post('/clicks',      requireApiKey, ...resolveController.collect);
    v1.post('/resolutions', requireApiKey, resolveRateLimiter, ...resolveController.resolve);

    // --- Debug (non-production only, still requires API key) ---
    v1.get('/debug/clicks/:inviteCode', requireApiKey, ...resolveController.debugClicks);
  } else {
    // Self-hosted mode: no authentication required.
    v1.post('/clicks',      ...resolveController.collect);
    v1.post('/resolutions', resolveRateLimiter, ...resolveController.resolve);

    // --- Debug (non-production only) ---
    v1.get('/debug/clicks/:inviteCode', ...resolveController.debugClicks);
  }

  router.use('/v1', v1);

  return router;
}
