/**
 * @fileoverview Project and API key management controller.
 *
 * Only active when MULTI_TENANT=true. Endpoints:
 *   POST   /v1/projects                              Create project
 *   GET    /v1/projects                              List projects
 *   POST   /v1/projects/:projectId/api-keys          Create API key
 *   GET    /v1/projects/:projectId/api-keys          List API keys
 *   DELETE /v1/projects/:projectId/api-keys/:keyId   Revoke API key
 */

import {Request, Response, NextFunction} from 'express';
import {body, param, validationResult} from 'express-validator';
import {ApiKeyService} from '../services/apiKeyService';
import {AppError} from '../middleware/errorHandler';

export class ProjectController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /** POST /v1/projects */
  create = [
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
        const project = await this.apiKeyService.createProject(req.body.name as string);
        res.status(201).json({project});
      } catch (err) {
        next(err);
      }
    },
  ];

  /** GET /v1/projects */
  list = [
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const projects = await this.apiKeyService.listProjects();
        res.json({projects});
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
        const project = await this.apiKeyService.getProject(projectId);
        if (!project) throw new AppError(404, 'Project not found.');

        const created = await this.apiKeyService.createApiKey(projectId, req.body.name as string);
        res.status(201).json({
          id: created.id,
          projectId: created.projectId,
          name: created.name,
          prefix: created.prefix,
          // rawKey is returned once; client must store it securely.
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
        res.json({});
      } catch (err) {
        next(err);
      }
    },
  ];
}
