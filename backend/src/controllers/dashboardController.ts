import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptAES, decryptAES, generateApiKey, sha256 } from '../utils/crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// In SaaS mode (Module 4), req.userId will be injected by the auth middleware (Module 2).
// We assume it's available via an extension of the Express Request.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function requireUserId(req: Request) {
  if (!req.userId) {
    throw new Error('Unauthorized');
  }
  return req.userId;
}

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      hasPassword: user.passwordHash !== null,
    });
  } catch (error) {
    logger.error('Failed to get user profile', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getQuota = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Dummy logic for now until Module 3 integrates limit bounds
    const limits: Record<string, { daily: number | null, monthly: number | null }> = {
      FREE: { daily: 20, monthly: 500 },
      PRO: { daily: null, monthly: 10000 },
      UNLIMITED: { daily: null, monthly: null }
    };
    
    const limitArgs = limits[user.plan] || limits.FREE;

    res.json({
      plan: user.plan.toLowerCase(),
      planExpiresAt: user.planExpiresAt,
      monthly: {
        limit: limitArgs.monthly,
        used: 0, // Placeholder
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      },
      daily: {
        limit: limitArgs.daily,
        used: 0, // Placeholder
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listApps = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const apps = await prisma.app.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createApp = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'App name is required' });
    }
    const app = await prisma.app.create({
      data: { name, userId }
    });
    res.status(201).json(app);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteApp = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId } = req.params;
    
    // Ownership check
    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    // Hard delete app (Prisma cascades are an option, but for now just delete ApiKeys)
    await prisma.apiKey.deleteMany({ where: { appId } });
    await prisma.app.delete({ where: { id: appId } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId } = req.params;
    
    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const keys = await prisma.apiKey.findMany({
      where: { appId },
      select: { id: true, name: true, prefix: true, createdAt: true, revokedAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createApiKey = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Key name is required' });

    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { key, prefix } = generateApiKey();
    const keyHash = sha256(key);
    const keyEncrypted = encryptAES(key);

    const apiKey = await prisma.apiKey.create({
      data: { appId, name, keyHash, keyEncrypted, prefix }
    });

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      key // Return plaintext ONLY ONCE!
    });
  } catch (error) {
    logger.error('Failed to create api key', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const revealApiKey = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId, keyId } = req.params;

    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const apiKey = await prisma.apiKey.findFirst({ where: { id: keyId, appId } });
    if (!apiKey) return res.status(404).json({ error: 'Key not found' });
    if (apiKey.revokedAt) return res.status(400).json({ error: 'Key is revoked' });

    const key = decryptAES(apiKey.keyEncrypted);
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId, keyId } = req.params;

    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    // Soft delete
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAppStats = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { appId } = req.params;

    const app = await prisma.app.findFirst({ where: { id: appId, userId } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const totalClicks = await prisma.clickEvent.count({ where: { appId } });
    const totalInstalls = await prisma.conversion.count({ where: { appId } });

    // Aggregate by match channel
    const channels = await prisma.conversion.groupBy({
      by: ['matchChannel'],
      where: { appId },
      _count: { matchChannel: true }
    });
    
    // Map aggregation
    const byChannel: Record<string, number> = { exact: 0, fuzzy: 0, clipboard: 0 };
    channels.forEach(ch => {
      if (ch.matchChannel) byChannel[ch.matchChannel] = ch._count.matchChannel;
    });
    
    // For iOS and Android platform split
    const platforms = await prisma.conversion.groupBy({
      by: ['platform'],
      where: { appId },
      _count: { platform: true }
    });
    
    const byPlatform: Record<string, number> = { ios: 0, android: 0 };
    platforms.forEach(pl => {
      if (pl.platform === 'IOS') byPlatform['ios'] = pl._count.platform;
      if (pl.platform === 'ANDROID') byPlatform['android'] = pl._count.platform;
    });

    res.json({
      totalClicks,
      totalInstalls,
      byChannel,
      byPlatform,
      dailySeries: [] // Subseries to be implemented later
    });
  } catch (error) {
    logger.error('Error fetching stats', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const {displayName, avatarUrl, currentPassword, newPassword} = req.body as {
      displayName?: string;
      avatarUrl?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const user = await prisma.user.findUnique({where: {id: userId}});
    if (!user) return res.status(404).json({error: 'User not found'});

    const updates: {
      displayName?: string | null;
      avatarUrl?: string | null;
      passwordHash?: string;
    } = {};

    if (displayName !== undefined) {
      updates.displayName = displayName.trim().slice(0, 50) || null;
    }
    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl.trim() || null;
    }
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({error: 'currentPassword is required'});
      }
      if (!user.passwordHash) {
        return res.status(400).json({error: 'Password change not available for OAuth accounts'});
      }
      if (newPassword.length < 8) {
        return res.status(400).json({error: 'New password must be at least 8 characters'});
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.status(400).json({error: 'Current password is incorrect'});
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const updated = await prisma.user.update({where: {id: userId}, data: updates});

    res.json({
      id: updated.id,
      githubLogin: updated.githubLogin,
      displayName: updated.displayName,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      createdAt: updated.createdAt,
      hasPassword: updated.passwordHash !== null,
    });
  } catch (error) {
    logger.error('Failed to update user profile', {error});
    res.status(500).json({error: 'Internal server error'});
  }
};
