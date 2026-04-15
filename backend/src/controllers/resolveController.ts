/**
 * @fileoverview Fingerprint collect and resolve controller.
 *
 * Endpoints:
 *   POST /v1/clicks       – Web SDK: record a click event with browser fingerprint
 *   POST /v1/resolutions  – Mobile SDK: resolve invite code on first app launch
 *
 * Invite codes are managed entirely by the caller's system.
 * We store them verbatim and return them on a successful fingerprint match.
 */

import {Request, Response, NextFunction} from 'express';
import {body, param, validationResult} from 'express-validator';
import {FingerprintService} from '../services/fingerprintService';
import {logger} from '../utils/logger';
import {config} from '../config/index';

export class ResolveController {
  constructor(private readonly fingerprintService: FingerprintService) {}

  /**
   * POST /v1/clicks
   *
   * Called by the Web SDK when a user visits an invite landing page.
   * Stores the browser fingerprint so the native SDK can match against it later.
   *
   * Request body:
   *   inviteCode        string   (required) – the caller's invite code
   *   customData        object?             – arbitrary data returned to mobile SDK on match
   *   fingerprint       object   (required)
   *     canvas          string?  SHA-256 hash of canvas rendering
   *     webgl           string?  SHA-256 hash of WebGL rendering
   *     audio           string?  SHA-256 hash of audio processing
   *     screen          object?  { w, h, dpr, depth }
   *     hardware        object?  { cores, memory }
   *     languages       string[] navigator.languages
   *     timezone        string
   *     touchPoints     number?
   *     ua              string?  navigator.userAgent
   *     connection      object?  { type, effective }
   *   referrer          string?
   */
  collect = [
    body('inviteCode').isString().trim().notEmpty(),
    body('customData').optional({nullable: true}).isObject().custom(v => {
      if (JSON.stringify(v).length > 10_240) {
        throw new Error('customData must not exceed 10 KB when serialized.');
      }
      return true;
    }),
    body('fingerprint').isObject(),
    body('fingerprint.languages').optional({nullable: true}).isArray(),
    body('fingerprint.timezone').optional({nullable: true}).isString(),
    body('fingerprint.screen').optional({nullable: true}).isObject(),
    body('fingerprint.screen.w').optional({nullable: true}).isInt({min: 0}),
    body('fingerprint.screen.h').optional({nullable: true}).isInt({min: 0}),
    body('fingerprint.screen.dpr').optional({nullable: true}).isFloat({min: 0}),
    body('fingerprint.screen.depth').optional({nullable: true}).isInt({min: 0}),
    body('fingerprint.hardware').optional({nullable: true}).isObject(),
    body('fingerprint.hardware.cores').optional({nullable: true}).isInt({min: 1}),
    body('fingerprint.hardware.memory').optional({nullable: true}).isFloat({min: 0}),
    body('fingerprint.canvas').optional({nullable: true}).customSanitizer(v => v != null ? String(v) : v),
    body('fingerprint.webgl').optional({nullable: true}).customSanitizer(v => v != null ? String(v) : v),
    body('fingerprint.audio').optional({nullable: true}).customSanitizer(v => v != null ? String(v) : v),
    body('fingerprint.touchPoints').optional({nullable: true}).isInt({min: 0}),
    body('fingerprint.ua').optional({nullable: true}).isString(),
    body('fingerprint.osVersion').optional({nullable: true}).isString(),
    body('referrer').optional({nullable: true}).isString(),

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
        const {inviteCode, customData, fingerprint = {}, referrer} = req.body as {
          inviteCode: string;
          customData?: Record<string, unknown>;
          fingerprint: {
            canvas?: string;
            webgl?: string;
            audio?: string;
            screen?: {w?: number; h?: number; dpr?: number; depth?: number};
            hardware?: {cores?: number; memory?: number};
            languages?: string[];
            timezone?: string;
            touchPoints?: number;
            ua?: string;
            osVersion?: string | null;
            connection?: {type?: string; effective?: string};
          };
          referrer?: string;
        };

        const ua = typeof fingerprint.ua === 'string' ? fingerprint.ua : (req.headers['user-agent'] ?? '');
        let osVersion: string | undefined;

        if (ua.includes('iPhone OS') || ua.includes('iPad OS')) {
            // iOS: extract real version from Safari UA string (reliable).
            // Safari reports the actual iOS version; no UA-CH needed.
            const iphoneOsMatch = ua.match(/iPhone OS (\d+)[_.](\d+)/);
            const safariVersionMatch = ua.match(/Version\/(\d+)\.(\d+)/);
            if (iphoneOsMatch && safariVersionMatch) {
                // On real devices iPhone OS major == Safari Version major (both report public iOS version).
                // On simulators iPhone OS reports the internal kernel version (e.g. 18.7) while
                // Safari Version reports the public iOS version (e.g. 26.3). Use the larger one.
                const iphoneMajor = parseInt(iphoneOsMatch[1], 10);
                const safariMajor = parseInt(safariVersionMatch[1], 10);
                osVersion = safariMajor > iphoneMajor
                    ? `${safariVersionMatch[1]}.${safariVersionMatch[2]}`
                    : `${iphoneOsMatch[1]}.${iphoneOsMatch[2]}`;
            } else if (iphoneOsMatch) {
                osVersion = `${iphoneOsMatch[1]}.${iphoneOsMatch[2]}`;
            } else if (safariVersionMatch) {
                osVersion = `${safariVersionMatch[1]}.${safariVersionMatch[2]}`;
            }
        } else if (ua.includes('Android') && typeof fingerprint.osVersion === 'string') {
            // Android: UA string is frozen to "Android 10" by Chrome (Privacy Sandbox,
            // Chrome 110+). Use the real version from UA-CH sent by the JS SDK instead.
            osVersion = fingerprint.osVersion;
        }
        // Other platforms: leave osVersion undefined.

        const eventId = await this.fingerprintService.collectClick({
          inviteCode,
          customData,
          projectId: req.projectId,
          referrer,
          ipAddress: extractClientIp(req),
          userAgent: ua,
          osVersion,
          languages: fingerprint.languages,
          timezone: fingerprint.timezone,
          screenWidth: fingerprint.screen?.w,
          screenHeight: fingerprint.screen?.h,
          pixelRatio: fingerprint.screen?.dpr,
          colorDepth: fingerprint.screen?.depth,
          hardwareConcurrency: fingerprint.hardware?.cores,
          deviceMemory: fingerprint.hardware?.memory,
          touchPoints: fingerprint.touchPoints,
          canvasHash: fingerprint.canvas,
          webglHash: fingerprint.webgl,
          audioHash: fingerprint.audio,
          connectionType: fingerprint.connection?.effective ?? fingerprint.connection?.type,
        });

        res.status(200).json({eventId});
      } catch (error) {
        next(error);
      }
    },
  ];

  /**
   * POST /v1/resolutions
   *
   * Called by the native SDK on first app launch to resolve the invite code.
   *
   * Request body:
   *   channel           "ios" | "android"     (required)
   *   clipboardCode     string?               (Android only)
   *   fingerprint       object                (required)
   *     -- iOS fields --
   *     osVersion       string?
   *     screen          object?  { w, h, scale }
   *     languages       string[]
   *     timezone        string
   *     networkType     string?  "wifi" | "cellular" | "none"
   *     diskBucket      string?  "64GB" | "128GB" etc.
   *     keychainUuid    string?
   *     -- Android fields --
   *     androidId       string?
   *     apiLevel        number?
   *     brand           string?
   *     model           string?
   *     buildFingerprint string?
   *
   * Response (matched):
   *   { matched: true, inviteCode: string, customData: object|null,
   *     meta: { confidence: number, channel: string } }
   *
   * Response (no match):
   *   { matched: false }
   */
  resolve = [
    body('channel').isIn(['ios', 'android']),
    body('clipboardCode').optional({nullable: true}).isString(),
    body('fingerprint').isObject(),
    body('fingerprint.osVersion').optional({nullable: true}).isString(),
    body('fingerprint.languages').optional({nullable: true}).isArray(),
    body('fingerprint.timezone').optional({nullable: true}).isString(),
    body('fingerprint.screen').optional({nullable: true}).isObject(),
    body('fingerprint.keychainUuid').optional({nullable: true}).isString(),
    body('fingerprint.androidId').optional({nullable: true}).isString(),
    body('fingerprint.networkType').optional({nullable: true}).isString(),
    body('fingerprint.diskBucket').optional({nullable: true}).isString(),
    body('fingerprint.buildFingerprint').optional({nullable: true}).isString(),
    body('fingerprint.hardwareConcurrency').optional({nullable: true}).isInt({min: 1}),
    body('fingerprint.touchPoints').optional({nullable: true}).isInt({min: 0}),

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
        const {channel, clipboardCode, fingerprint = {}} = req.body as {
          channel: 'ios' | 'android';
          clipboardCode?: string;
          fingerprint: {
            osVersion?: string;
            screen?: {w?: number; h?: number; scale?: number; density?: number};
            languages?: string[];
            timezone?: string;
            networkType?: string;
            diskBucket?: string;
            keychainUuid?: string;
            androidId?: string;
            apiLevel?: number;
            brand?: string;
            model?: string;
            buildFingerprint?: string;
            hardwareConcurrency?: number;
            touchPoints?: number;
          };
        };

        const result = await this.fingerprintService.resolveInvite({
          platform: channel,
          projectId: req.projectId,
          clipboardCode,
          ipAddress: extractClientIp(req),
          languages: fingerprint.languages,
          timezone: fingerprint.timezone,
          screenWidth: fingerprint.screen?.w,
          screenHeight: fingerprint.screen?.h,
          pixelRatio: fingerprint.screen?.scale ?? fingerprint.screen?.density,
          osVersion: fingerprint.osVersion,
          networkType: fingerprint.networkType,
          diskBucket: fingerprint.diskBucket,
          keychainUuid: fingerprint.keychainUuid,
          androidId: fingerprint.androidId,
          buildFingerprint: fingerprint.buildFingerprint,
          hardwareConcurrency: fingerprint.hardwareConcurrency,
          touchPoints: fingerprint.touchPoints,
          deviceModel: fingerprint.brand && fingerprint.model
            ? `${fingerprint.brand} ${fingerprint.model}`
            : undefined,
        });

        if (!result) {
          res.json({matched: false});
          return;
        }

        logger.info(
          {inviteCode: result.inviteCode, confidence: result.confidence, channel: result.channel},
          'Invite resolved',
        );

        res.json({
          matched: true,
          inviteCode: result.inviteCode,
          customData: result.customData ?? null,
          meta: {
            confidence: result.confidence,
            channel: result.channel,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  /**
   * GET /v1/debug/clicks/:inviteCode
   *
   * Returns all stored ClickEvent signals for the given invite code.
   * Only available when NODE_ENV !== 'production'.
   * Use this to diagnose "same device, no match" complaints.
   */
  debugClicks = [
    param('inviteCode').isString().trim().notEmpty(),

    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (config.NODE_ENV === 'production') {
        res.status(404).json({error: {code: 404, status: 'NOT_FOUND', message: 'Not found.'}});
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({error: {code: 400, status: 'INVALID_ARGUMENT', message: 'Validation failed.'}, details: errors.array()});
        return;
      }

      try {
        const {inviteCode} = req.params;
        const events = await this.fingerprintService.debugClickEvents(inviteCode, req.projectId);
        res.json({
          inviteCode,
          count: events.length,
          tip: 'Compare stored signals against what your mobile SDK sends to /v1/resolutions.',
          events,
        });
      } catch (error) {
        next(error);
      }
    },
  ];
}

function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : (req.socket.remoteAddress ?? '0.0.0.0');
  // Normalize IPv6-mapped IPv4 addresses (e.g. "::ffff:1.2.3.4" → "1.2.3.4")
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}
