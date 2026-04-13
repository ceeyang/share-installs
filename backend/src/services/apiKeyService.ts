/**
 * @fileoverview Multi-tenant app and API key management service.
 *
 * API key format: sk_live_{32 random URL-safe chars}
 *   - First 12 chars used as an index prefix for fast DB lookup.
 *   - Full key is hashed with SHA-256 for auth; AES-256-GCM encrypted for display.
 */

import {PrismaClient, App, ApiKey} from '@prisma/client';
import crypto from 'crypto';
import {sha256} from '../utils/crypto';
import {logger} from '../utils/logger';

const KEY_PREFIX_LEN = 12; // chars kept in plaintext for display / DB index

export interface CreatedApiKey {
  id: string;
  appId: string;
  name: string;
  prefix: string;
  /** Plaintext key – shown at creation and via the reveal endpoint. */
  rawKey: string;
  createdAt: Date;
}

export class ApiKeyService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---- Apps ----

  async createApp(userId: string, name: string): Promise<App> {
    const app = await this.prisma.app.create({data: {userId, name}});
    logger.info({appId: app.id}, 'App created');
    return app;
  }

  async listApps(userId: string): Promise<App[]> {
    return this.prisma.app.findMany({
      where: {userId},
      orderBy: {createdAt: 'desc'},
    });
  }

  async getApp(id: string, userId: string): Promise<App | null> {
    return this.prisma.app.findFirst({where: {id, userId}});
  }

  /** Admin-only lookup — no userId filter. */
  async getAppById(id: string): Promise<App | null> {
    return this.prisma.app.findUnique({where: {id}});
  }

  /** Admin-only: list all apps across all users. */
  async listAllApps(): Promise<App[]> {
    return this.prisma.app.findMany({orderBy: {createdAt: 'desc'}});
  }

  // ---- API Keys ----

  async createApiKey(appId: string, name: string, encryptionKey?: string): Promise<CreatedApiKey> {
    const rawKey = `sk_live_${crypto.randomBytes(24).toString('base64url')}`;
    const prefix = rawKey.slice(0, KEY_PREFIX_LEN);
    const keyHash = sha256(rawKey);
    const keyEncrypted = encryptionKey ? encryptRaw(rawKey, encryptionKey) : rawKey;

    const apiKey = await this.prisma.apiKey.create({
      data: {appId, name, keyHash, keyEncrypted, prefix},
    });

    logger.info({keyId: apiKey.id, appId}, 'API key created');
    return {
      id: apiKey.id,
      appId,
      name,
      prefix,
      rawKey,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(appId: string): Promise<Omit<ApiKey, 'keyHash' | 'keyEncrypted'>[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {appId},
      orderBy: {createdAt: 'desc'},
    });
    return keys.map(({keyHash: _h, keyEncrypted: _e, ...rest}) => rest);
  }

  async revealApiKey(keyId: string, appId: string, encryptionKey?: string): Promise<string | null> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {id: keyId, appId, revokedAt: null},
      select: {keyEncrypted: true},
    });
    if (!apiKey) return null;
    return encryptionKey ? decryptRaw(apiKey.keyEncrypted, encryptionKey) : apiKey.keyEncrypted;
  }

  async revokeApiKey(keyId: string, appId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: {id: keyId, appId, revokedAt: null},
      data: {revokedAt: new Date()},
    });
    logger.info({keyId, appId}, 'API key revoked');
  }
}

// ---- AES-256-GCM helpers ----

function encryptRaw(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) + tag(16) + ciphertext — all base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptRaw(ciphertext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
