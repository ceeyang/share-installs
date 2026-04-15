/**
 * @fileoverview Fingerprint-based deferred deep link resolution service.
 *
 * Resolution strategy (in order):
 *
 *   1. Exact hash match (fast path, Redis):
 *      On web click, a SHA-256 hash of stable signals is stored in Redis keyed by
 *      that hash. If the native SDK produces the same hash, it's an instant match.
 *
 *   2. Fuzzy similarity match (fallback, DB scan):
 *      Recent unresolved ClickEvents are scored against the native signals using
 *      a weighted multi-signal algorithm. The best match above the threshold wins.
 *
 *   3. Clipboard channel (Android only, confidence = 1.0):
 *      The landing page writes "SHAREINSTALLS:{inviteCode}" to the clipboard.
 *      The Android SDK reads it on first launch and passes it here.
 */

import type {Redis} from 'ioredis';
import {PrismaClient, DevicePlatform, Prisma} from '@prisma/client';
import {QuotaService} from './quotaService';
import {
  computeFingerprint,
  computeSimilarityScore,
  type FingerprintSignals,
} from '../utils/fingerprint';
import {config} from '../config/index';
import {logger} from '../utils/logger';

const CLICK_TTL_SECONDS = config.FINGERPRINT_MATCH_TTL_HOURS * 3600;

/** Prefix written to the Android clipboard by the landing page. */
const CLIPBOARD_PREFIX = 'SHAREINSTALLS:';

export interface CollectClickParams extends FingerprintSignals {
  /** The caller's invite code — stored verbatim, never validated. */
  inviteCode: string;
  /** Arbitrary data to pass through to the mobile SDK on a successful match. */
  customData?: Record<string, unknown>;
  projectId?: string;
  referrer?: string;
}

export interface ResolveParams extends FingerprintSignals {
  platform: 'ios' | 'android';
  projectId?: string;
  /** Android clipboard content, e.g. "SHAREINSTALLS:INVITECODE". */
  clipboardCode?: string;
}

export interface ResolveResult {
  clickEventId: string | null;
  inviteCode: string;
  customData?: unknown;
  confidence: number;
  /** How the invite was resolved. */
  channel: 'clipboard' | 'exact' | 'fuzzy';
}

export class FingerprintService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly quotaService?: QuotaService,
  ) {}

  /**
   * Enforces quota before recording a conversion.
   * Only runs in MULTI_TENANT mode when a QuotaService is injected.
   * Throws QuotaExceededError if the app is over its plan limit.
   */
  private async checkQuota(appId?: string): Promise<void> {
    if (!config.MULTI_TENANT || !this.quotaService || !appId) return;
    await this.quotaService.checkAndIncrement(appId);
  }

  /**
   * Records a web click event and caches signals in Redis for later resolution.
   * Called when the landing page Web SDK fires on invite link visit.
   *
   * @returns The created ClickEvent ID.
   */
  async collectClick(params: CollectClickParams): Promise<string> {
    const {inviteCode, customData, projectId, referrer, ...signals} = params;

    const platform = this.detectWebPlatform(signals.userAgent ?? '');
    const fingerprint = computeFingerprint(signals);

    const clickData: Prisma.ClickEventUncheckedCreateInput = {
      inviteCode,
      customData: customData ? (customData as Prisma.InputJsonValue) : Prisma.JsonNull,
      appId: projectId ?? null,
      fingerprint,
      ipAddress: signals.ipAddress,
      userAgent: signals.userAgent,
      languages: signals.languages ? JSON.stringify(signals.languages) : null,
      timezone: signals.timezone,
      referrer,
      screenWidth: signals.screenWidth,
      screenHeight: signals.screenHeight,
      pixelRatio: signals.pixelRatio,
      colorDepth: signals.colorDepth,
      touchPoints: signals.touchPoints,
      hardwareConcurrency: signals.hardwareConcurrency,
      deviceMemory: signals.deviceMemory,
      canvasHash: signals.canvasHash,
      webglHash: signals.webglHash,
      audioHash: signals.audioHash,
      connectionType: signals.connectionType,
      platform,
      osVersion: signals.osVersion,
    };
    const clickEvent = await this.prisma.clickEvent.create({data: clickData});

    // Cache for fast exact-match lookup
    const redisKey = `${config.REDIS_KEY_PREFIX}click:${fingerprint}`;
    await this.redis.setex(
      redisKey,
      CLICK_TTL_SECONDS,
      JSON.stringify({clickEventId: clickEvent.id, inviteCode, customData: customData ?? null}),
    );

    // Add to sorted set for fuzzy matching (score = timestamp)
    const fuzzyKey = this.fuzzySetKey(projectId);
    await this.redis.zadd(fuzzyKey, Date.now(), clickEvent.id);
    await this.redis.expire(fuzzyKey, CLICK_TTL_SECONDS);

    logger.info(
      {clickEventId: clickEvent.id, fingerprint, inviteCode},
      'Click event recorded',
    );
    return clickEvent.id;
  }

  /**
   * Resolves an invite for a device based on signals from the native SDK.
   * Called on first app launch.
   */
  async resolveInvite(params: ResolveParams): Promise<ResolveResult | null> {
    const {platform, projectId, clipboardCode, ...signals} = params;

    const fingerprint = computeFingerprint(signals);

    // ---- Channel 1: Exact hash match (Redis fast path) ----
    const exactResult = await this.tryExactMatch(fingerprint, projectId);
    if (exactResult) {
      await this.checkQuota(projectId);
      await this.recordConversion(exactResult.clickEventId, exactResult.inviteCode, platform, signals, 'exact', 1.0, projectId);
      
      // Delete the cache entry after match to prevent re-use
      const redisKey = `${config.REDIS_KEY_PREFIX}click:${fingerprint}`;
      await this.redis.del(redisKey);

      logger.info({fingerprint, inviteCode: exactResult.inviteCode}, 'Exact fingerprint match');
      return {...exactResult, confidence: 1.0, channel: 'exact'};
    }

    // ---- Channel 2: Fuzzy similarity match ----
    const fuzzyResult = await this.tryFuzzyMatch(signals, projectId);
    if (fuzzyResult) {
      await this.checkQuota(projectId);
      await this.recordConversion(
        fuzzyResult.clickEventId,
        fuzzyResult.inviteCode,
        platform,
        signals,
        'fuzzy',
        fuzzyResult.confidence,
        projectId,
      );
      logger.info(
        {fingerprint, inviteCode: fuzzyResult.inviteCode, confidence: fuzzyResult.confidence},
        'Fuzzy fingerprint match',
      );
      return fuzzyResult;
    }

    // ---- Channel 3: Clipboard fallback (Android only, no permission required) ----
    if (platform === 'android' && clipboardCode) {
      const clipboardResult = this.tryClipboardMatch(clipboardCode);
      if (clipboardResult) {
        const clickEvent = await this.prisma.clickEvent.findFirst({
          where: {
            inviteCode: clipboardResult.inviteCode,
            ...(projectId ? {appId: projectId} : {}),
          },
          orderBy: {createdAt: 'desc'},
          select: {id: true, customData: true},
        });
        await this.checkQuota(projectId);
        logger.info({inviteCode: clipboardResult.inviteCode}, 'Clipboard fallback match');
        return {
          clickEventId: clickEvent?.id ?? null,
          inviteCode: clipboardResult.inviteCode,
          customData: clickEvent?.customData ?? null,
          confidence: 1.0,
          channel: 'clipboard',
        };
      }
    }

    logger.info({fingerprint}, 'No match found (fingerprint + clipboard)');
    return null;
  }

  // ---- Private: match strategies ----

  /**
   * Clipboard channel: extract the invite code from the clipboard string.
   * Format written by landing page: "SHAREINSTALLS:{inviteCode}"
   * Returns a partial result; customData is fetched from DB by the caller.
   */
  private tryClipboardMatch(raw: string): {inviteCode: string} | null {
    if (!raw.startsWith(CLIPBOARD_PREFIX)) return null;
    const inviteCode = raw.slice(CLIPBOARD_PREFIX.length).trim();
    if (!inviteCode) return null;
    return {inviteCode};
  }

  private async tryExactMatch(
    fingerprint: string,
    projectId?: string,
  ): Promise<{clickEventId: string; inviteCode: string; customData?: unknown; channel: 'exact'; confidence: number} | null> {
    const redisKey = `${config.REDIS_KEY_PREFIX}click:${fingerprint}`;
    const raw = await this.redis.get(redisKey);
    if (!raw) return null;

    const cached = JSON.parse(raw) as {clickEventId: string; inviteCode: string; customData?: unknown};

    // In multi-tenant mode verify the click belongs to this project
    if (projectId) {
      const clickEvent = await this.prisma.clickEvent.findFirst({
        where: {id: cached.clickEventId, appId: projectId},
        select: {id: true},
      });
      if (!clickEvent) return null;
    }

    return {
      clickEventId: cached.clickEventId,
      inviteCode: cached.inviteCode,
      customData: cached.customData,
      channel: 'exact',
      confidence: 1.0,
    };
  }

  private async tryFuzzyMatch(
    sdkSignals: FingerprintSignals,
    projectId?: string,
  ): Promise<ResolveResult | null> {
    const cutoffMs = Date.now() - CLICK_TTL_SECONDS * 1000;
    const fuzzyKey = this.fuzzySetKey(projectId);

    const recentIds = await this.redis.zrangebyscore(fuzzyKey, cutoffMs, '+inf', 'LIMIT', 0, 200);
    if (recentIds.length === 0) return null;

    // Order newest-first so that when two events score equally the most recent wins.
    const clickEvents = await this.prisma.clickEvent.findMany({
      where: {
        id: {in: recentIds},
        ...(projectId ? {appId: projectId} : {}),
      },
      orderBy: {createdAt: 'desc'},
    });

    let bestScore = 0;
    let bestEvent: (typeof clickEvents)[0] | null = null;

    for (const event of clickEvents) {
      const webSignals: FingerprintSignals = {
        ipAddress: event.ipAddress ?? undefined,
        userAgent: event.userAgent ?? undefined,
        languages: event.languages ? (JSON.parse(event.languages) as string[]) : undefined,
        timezone: event.timezone ?? undefined,
        screenWidth: event.screenWidth ?? undefined,
        screenHeight: event.screenHeight ?? undefined,
        pixelRatio: event.pixelRatio ?? undefined,
        hardwareConcurrency: event.hardwareConcurrency ?? undefined,
        deviceMemory: event.deviceMemory ?? undefined,
        touchPoints: event.touchPoints ?? undefined,
        canvasHash: event.canvasHash ?? undefined,
        webglHash: event.webglHash ?? undefined,
        audioHash: event.audioHash ?? undefined,
        osVersion: event.osVersion ?? undefined,
      };

      const score = computeSimilarityScore(webSignals, sdkSignals);
      // Strict > keeps the first (newest) event when scores tie.
      if (score >= config.FINGERPRINT_MATCH_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    if (!bestEvent) return null;

    return {
      clickEventId: bestEvent.id,
      inviteCode: bestEvent.inviteCode,
      customData: bestEvent.customData ?? undefined,
      confidence: bestScore,
      channel: 'fuzzy',
    };
  }

  // ---- Private: helpers ----

  private async recordConversion(
    clickEventId: string | null,
    inviteCode: string,
    platform: string,
    sdkSignals: FingerprintSignals,
    channel: string,
    confidence: number,
    projectId?: string,
  ): Promise<void> {
    if (!clickEventId) return;

    const convData: Prisma.ConversionUncheckedCreateInput = {
      inviteCode,
      clickEventId,
      appId: projectId ?? null,
      platform: this.toDevicePlatform(platform),
      matchChannel: channel,
      confidence,
      nativeSignals: sdkSignals as object,
      installedAt: new Date(),
    };
    await this.prisma.conversion.create({data: convData});
  }

  /**
   * Returns stored click signals for a given inviteCode.
   * Only enabled when NODE_ENV !== 'production'.
   * Useful for diagnosing "same device, no match" complaints.
   */
  async debugClickEvents(inviteCode: string, projectId?: string) {
    const events = await this.prisma.clickEvent.findMany({
      where: {
        inviteCode,
        ...(projectId ? {projectId} : {}),
      },
      orderBy: {createdAt: 'desc'},
      take: 10,
      select: {
        id: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
        languages: true,
        timezone: true,
        screenWidth: true,
        screenHeight: true,
        pixelRatio: true,
        osVersion: true,
        hardwareConcurrency: true,
        deviceMemory: true,
        touchPoints: true,
        canvasHash: true,
        webglHash: true,
        audioHash: true,
        fingerprint: true,
      },
    });

    return events.map(e => ({
      ...e,
      languages: e.languages ? JSON.parse(e.languages) : null,
    }));
  }

  private fuzzySetKey(projectId?: string): string {
    const scope = projectId ?? 'global';
    return `${config.REDIS_KEY_PREFIX}clicks:recent:${scope}`;
  }

  private detectWebPlatform(userAgent: string): DevicePlatform {
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad')) return DevicePlatform.IOS;
    if (ua.includes('android')) return DevicePlatform.ANDROID;
    return DevicePlatform.WEB;
  }

  private toDevicePlatform(platform: string): DevicePlatform {
    switch (platform.toLowerCase()) {
      case 'ios': return DevicePlatform.IOS;
      case 'android': return DevicePlatform.ANDROID;
      default: return DevicePlatform.UNKNOWN;
    }
  }
}
