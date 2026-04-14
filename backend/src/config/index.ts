/**
 * @fileoverview Application configuration loader.
 *
 * 两种部署模式：
 *
 *   自部署 (MULTI_TENANT=false, 默认):
 *     用户自己部署，传入自有域名，无需 API key。
 *     管理端点可选 ADMIN_SECRET 保护。
 *
 *   SaaS (MULTI_TENANT=true):
 *     托管服务，所有请求需要 API key（Authorization: Bearer sk_live_xxx）。
 *     数据按项目隔离。
 */

import {z} from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('si:'),

  // Deployment mode
  // false (default): self-hosted, no API keys, caller manages invite codes.
  // true:            SaaS, API keys required, data isolated per project.
  MULTI_TENANT: z
    .string()
    .toLowerCase()
    .transform(v => v === 'true')
    .pipe(z.boolean())
    .default('false'),

  // Admin protection (used in both modes for project management endpoints).
  // When set, admin endpoints require: Authorization: Bearer <ADMIN_SECRET>
  // Leave empty for fully open access (suitable for private networks).
  ADMIN_SECRET: z.string().optional(),

  // SaaS Auth & Encryption
  JWT_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Fingerprint matching
  FINGERPRINT_MATCH_TTL_HOURS: z.coerce.number().default(72),
  FINGERPRINT_MATCH_THRESHOLD: z.coerce.number().default(0.75),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  // /v1/resolutions 专用限流（每分钟，按付费方案设置）
  // FREE: 10  PRO: 60  UNLIMITED: 600
  RATE_LIMIT_RESOLVE_MAX: z.coerce.number().default(10),

  // CORS (comma-separated origins, or * for all)
  CORS_ORIGINS: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid configuration:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}

export const config: Config = loadConfig();
