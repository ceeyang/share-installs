/**
 * @fileoverview Device fingerprint computation and similarity scoring.
 *
 * Implements a multi-signal probabilistic matching algorithm for deferred
 * deep linking: web click fingerprints are matched against native SDK signals
 * collected on first app launch.
 *
 * Signal availability per environment:
 *
 *   Signal             Web   iOS   Android
 *   -----------------  ----  ----  -------
 *   ipAddress          ✓     ✓     ✓
 *   screenWidth/Height ✓     ✓     ✓
 *   pixelRatio         ✓     ✓     ✓
 *   languages          ✓     ✓     ✓
 *   timezone           ✓     ✓     ✓
 *   hardwareConcurrency✓     –     –
 *   deviceMemory       ✓     –     –
 *   touchPoints        ✓     –     –
 *   osVersion          ✓(UA) ✓     ✓
 *   canvasHash         ✓     –     –
 *   webglHash          ✓     –     –
 *   audioHash          ✓     –     –
 *   keychainUuid       –     ✓     –
 *   androidId          –     –     ✓
 *
 * Cross-platform signals (web→native matching) are: IP, screen, pixelRatio,
 * languages, timezone, osVersion.
 *
 * Browser-only hashes (canvasHash, webglHash, audioHash) never match native
 * but are stored for potential future web-to-web use cases.
 */

import crypto from 'crypto';

export interface FingerprintSignals {
  // ---- Cross-platform ----
  ipAddress?: string;
  userAgent?: string;

  /** Preferred languages, e.g. ["zh-CN", "zh", "en"]. */
  languages?: string[];
  timezone?: string;

  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;

  // ---- Web / hardware hints ----
  hardwareConcurrency?: number;
  deviceMemory?: number;
  touchPoints?: number;
  colorDepth?: number;
  connectionType?: string;
  referrer?: string;

  // ---- Browser fingerprint hashes (web-only, not sent by native SDK) ----
  canvasHash?: string;
  webglHash?: string;
  audioHash?: string;

  // ---- Native-only ----
  platform?: string;
  osVersion?: string;
  deviceModel?: string;
  networkType?: string;
  diskBucket?: string;

  /** iOS Keychain UUID – persists across reinstalls. */
  keychainUuid?: string;

  /** Android Settings.Secure.ANDROID_ID. */
  androidId?: string;

  /** Android Build.FINGERPRINT. */
  buildFingerprint?: string;
}

/**
 * Computes a deterministic fingerprint hash from the most stable web signals.
 * Used as a Redis cache key for fast exact-match lookup.
 */
/**
 * Only cross-platform signals are included so that the hash computed by
 * the web SDK matches the hash computed by the native SDK on the same device.
 *
 * Web-only signals (userAgent, canvasHash, webglHash, audioHash) are
 * intentionally excluded — native SDKs do not have them and would produce
 * a different hash, making the exact-match Redis lookup always miss.
 */
export function computeFingerprint(signals: FingerprintSignals): string {
  // Languages are intentionally excluded: iOS returns BCP 47 full tags
  // ("zh-Hans-CN") while web returns short tags ("zh-CN"), producing different
  // strings for the same device and breaking the hash match.
  // Timezone + screen + pixelRatio are stable and consistent across platforms.
  const parts = [
    signals.ipAddress?.split('.').slice(0, 3).join('.') ?? '',
    signals.timezone ?? '',
    Math.min(signals.screenWidth ?? 0, signals.screenHeight ?? 0).toString(),
    Math.max(signals.screenWidth ?? 0, signals.screenHeight ?? 0).toString(),
    signals.pixelRatio?.toFixed(2) ?? '',
    normalizeOsVersion(signals.osVersion),
  ];

  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Each check: a weight (raw points), whether both sides have the signal,
 * and whether they match.
 *
 * Only signals available on BOTH sides contribute to the score.
 * This prevents inflating totalWeight with signals only one side provides.
 */
interface ScoringCheck {
  weight: number;
  available: boolean;
  match: boolean;
}

/**
 * Computes a similarity score (0.0–1.0) between two sets of fingerprint signals.
 *
 * Uses weighted scoring; only signals present on both sides are considered.
 * Caller should compare the result against FINGERPRINT_MATCH_THRESHOLD (default 0.75).
 */
export function computeSimilarityScore(
  a: FingerprintSignals,
  b: FingerprintSignals,
): number {
  // Hard veto: OS version mismatch means different devices.
  // Within the attribution window (hours) no real user updates their OS.
  const osA = normalizeOsVersion(a.osVersion);
  const osB = normalizeOsVersion(b.osVersion);
  if (osA && osB && osA !== osB) return 0;

  const checks: ScoringCheck[] = [
    // ---- IP address (/24 subnet) — auxiliary signal; users switch WiFi↔cellular ----
    {
      weight: 20,
      available: !!(a.ipAddress && b.ipAddress),
      match: isSameSubnet(a.ipAddress, b.ipAddress),
    },
    // ---- Screen resolution — most stable device-specific signal ----
    // Android SDK uses integer division which can differ by 1px from browser's
    // window.screen.width rounding. Allow ±2px on each dimension.
    {
      weight: 25,
      available: !!(a.screenWidth && b.screenWidth && a.screenHeight && b.screenHeight),
      match: (
        Math.abs(Math.min(a.screenWidth!, a.screenHeight!) - Math.min(b.screenWidth!, b.screenHeight!)) <= 2 &&
        Math.abs(Math.max(a.screenWidth!, a.screenHeight!) - Math.max(b.screenWidth!, b.screenHeight!)) <= 2
      ),
    },
    // ---- Timezone ----
    {
      weight: 15,
      available: !!(a.timezone && b.timezone),
      match: a.timezone === b.timezone,
    },
    // ---- Languages (first preferred language) ----
    {
      weight: 10,
      available: !!(a.languages?.length && b.languages?.length),
      match: firstLanguage(a.languages) === firstLanguage(b.languages),
    },
    // ---- OS version ----
    {
      weight: 20,
      available: !!(a.osVersion && b.osVersion),
      match: normalizeOsVersion(a.osVersion) === normalizeOsVersion(b.osVersion),
    },
    // ---- Pixel ratio (round to 2dp to absorb float32→float64 precision loss) ----
    {
      weight: 5,
      available: !!(a.pixelRatio && b.pixelRatio),
      match: Math.round((a.pixelRatio ?? 0) * 100) === Math.round((b.pixelRatio ?? 0) * 100),
    },
    // ---- Hardware concurrency ----
    {
      weight: 5,
      available: !!(a.hardwareConcurrency && b.hardwareConcurrency),
      match: a.hardwareConcurrency === b.hardwareConcurrency,
    },
    // ---- Device memory bucket ----
    {
      weight: 5,
      available: !!(a.deviceMemory && b.deviceMemory),
      match: a.deviceMemory === b.deviceMemory,
    },
    // ---- Touch points ----
    {
      weight: 4,
      available: a.touchPoints !== undefined && b.touchPoints !== undefined,
      match: a.touchPoints === b.touchPoints,
    },
    // ---- Canvas fingerprint (web-to-web only) ----
    {
      weight: 20,
      available: !!(a.canvasHash && b.canvasHash),
      match: a.canvasHash === b.canvasHash,
    },
    // ---- WebGL fingerprint (web-to-web only) ----
    {
      weight: 15,
      available: !!(a.webglHash && b.webglHash),
      match: a.webglHash === b.webglHash,
    },
    // ---- Audio fingerprint (web-to-web only) ----
    {
      weight: 10,
      available: !!(a.audioHash && b.audioHash),
      match: a.audioHash === b.audioHash,
    },
  ];

  let score = 0;
  let totalWeight = 0;

  for (const check of checks) {
    if (check.available) {
      totalWeight += check.weight;
      if (check.match) {
        score += check.weight;
      }
    }
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

// ---- Private helpers ----

function isSameSubnet(ip1?: string, ip2?: string): boolean {
  if (!ip1 || !ip2) return false;
  // IPv4: compare /24 prefix (first 3 octets)
  if (ip1.includes('.') && ip2.includes('.')) {
    return ip1.split('.').slice(0, 3).join('.') === ip2.split('.').slice(0, 3).join('.');
  }
  // IPv6: compare /48 prefix (first 3 groups)
  if (ip1.includes(':') && ip2.includes(':')) {
    const normalize = (ip: string) => ip.toLowerCase().split(':').slice(0, 3).join(':');
    return normalize(ip1) === normalize(ip2);
  }
  return false;
}

function firstLanguage(langs?: string[]): string {
  // Extract only the primary language subtag (BCP 47) so that
  // iOS "zh-Hans-CN" and web "zh-CN" both normalize to "zh".
  return (langs?.[0] ?? '').toLowerCase().split('-')[0];
}

function normalizeOsVersion(version?: string): string {
  if (!version) return '';
  // Extract a simple numeric version suffix for cross-UA comparison.
  // e.g. "iPhone OS 17_2_1" → "17.2", "Android 14" → "14", "iOS 18.2" → "18.2"
  const match = version.match(/(\d+)[._](\d+)/);
  if (match) return `${match[1]}.${match[2]}`;
  const major = version.match(/(\d+)/);
  return major ? major[1] : version.toLowerCase().trim();
}
