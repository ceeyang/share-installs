/**
 * @fileoverview App and API key management controller (admin/back-office).
 *
 * Only active when MULTI_TENANT=true. Endpoints:
 *   POST   /v1/projects                              Create app
 *   GET    /v1/projects                              List apps (all users)
 *   POST   /v1/projects/:projectId/api-keys          Create API key
 *   GET    /v1/projects/:projectId/api-keys          List API keys
 *   DELETE /v1/projects/:projectId/api-keys/:keyId   Revoke API key
 *
 * Note: User-facing app/key management is handled by dashboardController (Module 4).
 */

import {Request, Response, NextFunction} from 'express';
import {body, param, validationResult} from 'express-validator';
import {ApiKeyService} from '../services/apiKeyService';
import {AppError} from '../middleware/errorHandler';
import {config} from '../config/index';

export class ProjectController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /** POST /v1/projects — requires { name, userId } in body */
  create = [
    body('name').isString().trim().notEmpty(),
    body('userId').isString().trim().notEmpty(),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {code: 400, status: 'INVALID_ARGUMENT', message: 'Validation failed.'},
          details: errors.array(),
        });
        return;
      }
      try {
        const app = await this.apiKeyService.createApp(
          req.body.userId as string,
          req.body.name as string,
        );
        res.status(201).json({project: app});
      } catch (err) {
        next(err);
      }
    },
  ];

  /** GET /v1/projects — lists all apps (admin view) */
  list = [
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const apps = await this.apiKeyService.listAllApps();
        res.json({projects: apps});
      } catch (err) {
        next(err);
      }
    },
  ];

  /** POST /v1/projects/:projectId/api-keys */
  createKey = [
    param('projectId').isString().trim().notEmpty(),
    body('name').isString().trim().notEmpty(),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {code: 400, status: 'INVALID_ARGUMENT', message: 'Validation failed.'},
          details: errors.array(),
        });
        return;
      }
      try {
        const {projectId} = req.params;
        const app = await this.apiKeyService.getAppById(projectId);
        if (!app) throw new AppError(404, 'Project not found.');

        const created = await this.apiKeyService.createApiKey(
          projectId,
          req.body.name as string,
          config.ENCRYPTION_KEY,
        );
        res.status(201).json({
          id: created.id,
          appId: created.appId,
          name: created.name,
          prefix: created.prefix,
          key: created.rawKey,
          createdAt: created.createdAt,
        });
      } catch (err) {
        next(err);
      }
    },
  ];

  /** GET /v1/projects/:projectId/api-keys */
  listKeys = [
    param('projectId').isString().trim().notEmpty(),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {code: 400, status: 'INVALID_ARGUMENT', message: 'Validation failed.'},
          details: errors.array(),
        });
        return;
      }
      try {
        const keys = await this.apiKeyService.listApiKeys(req.params.projectId);
        res.json({apiKeys: keys});
      } catch (err) {
        next(err);
      }
    },
  ];

  /** DELETE /v1/projects/:projectId/api-keys/:keyId */
  revokeKey = [
    param('projectId').isString().trim().notEmpty(),
    param('keyId').isString().trim().notEmpty(),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {code: 400, status: 'INVALID_ARGUMENT', message: 'Validation failed.'},
          details: errors.array(),
        });
        return;
      }
      try {
        await this.apiKeyService.revokeApiKey(req.params.keyId, req.params.projectId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  ];
}
