/**
 * @fileoverview Multi-tenant project and API key management service.
 *
 * API key format: sk_live_{32 random URL-safe chars}
 *   - First 12 chars used as an index prefix for fast DB lookup.
 *   - Full key is hashed with SHA-256; plaintext is returned only once at creation.
 */

import {PrismaClient, Project, ApiKey} from '@prisma/client';
import crypto from 'crypto';
import {sha256} from '../utils/crypto';
import {logger} from '../utils/logger';

const KEY_PREFIX_LEN = 12; // chars kept in plaintext for display / DB index

export interface CreatedApiKey {
  id: string;
  projectId: string;
  name: string;
  prefix: string;
  /** Plaintext key – shown only once at creation time. */
  rawKey: string;
  createdAt: Date;
}

export class ApiKeyService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---- Projects ----

  async createProject(name: string): Promise<Project> {
    const project = await this.prisma.project.create({data: {name}});
    logger.info({projectId: project.id}, 'Project created');
    return project;
  }

  async listProjects(): Promise<Project[]> {
    return this.prisma.project.findMany({orderBy: {createdAt: 'desc'}});
  }

  async getProject(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({where: {id}});
  }

  // ---- API Keys ----

  async createApiKey(projectId: string, name: string): Promise<CreatedApiKey> {
    const rawKey = `sk_live_${crypto.randomBytes(24).toString('base64url')}`;
    const prefix = rawKey.slice(0, KEY_PREFIX_LEN);
    const keyHash = sha256(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {projectId, name, keyHash, prefix},
    });

    logger.info({keyId: apiKey.id, projectId}, 'API key created');
    return {
      id: apiKey.id,
      projectId,
      name,
      prefix,
      rawKey,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(projectId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {projectId},
      orderBy: {createdAt: 'desc'},
    });
    // Strip the hash before returning; it must never leave the server.
    return keys.map(({keyHash: _hash, ...rest}) => rest);
  }

  async revokeApiKey(keyId: string, projectId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: {id: keyId, projectId, revokedAt: null},
      data: {revokedAt: new Date()},
    });
    logger.info({keyId, projectId}, 'API key revoked');
  }
}
