/**
 * @fileoverview Public type definitions for the share-installs Web SDK.
 *
 * This SDK is a pure client-side tracking library. It collects browser
 * fingerprint signals and reports them to the share-installs backend so that
 * the mobile SDK can later resolve the invite code via deferred deep linking.
 */

/** SDK initialization options. At least one of `apiBaseUrl` or `apiKey` must be provided. */
export interface ShareInstallsOptions {
  /**
   * Base URL of the share-installs backend.
   *
   * - **Omit** when using the hosted service (supply `apiKey` instead).
   *   Defaults to `"https://console.share-installs.com/api"`.
   * - **Set** when self-hosting. `apiKey` is not required in self-hosted mode.
   *
   * At least one of `apiBaseUrl` or `apiKey` must be provided.
   */
  apiBaseUrl?: string;
  /**
   * API key for the hosted service.
   * Required when `apiBaseUrl` is omitted (or set to the hosted service URL).
   * Leave `undefined` for self-hosted deployments.
   */
  apiKey?: string;
  /** Request timeout in milliseconds. Default: 5000. */
  timeoutMs?: number;
  /** Enable verbose console logging. Disable in production. */
  debug?: boolean;
}

/**
 * Rich browser fingerprint signals collected when the user visits the invite page.
 *
 * All signals are non-PII hardware/software characteristics.
 * No cookies or persistent identifiers are used.
 */
export interface BrowserFingerprint {
  /** SHA-256 hash of canvas rendering differences. */
  canvas: string | null;
  /** SHA-256 hash of WebGL rendering + vendor/renderer string. */
  webgl: string | null;
  /** SHA-256 hash of AudioContext processing differences. */
  audio: string | null;
  screen: {
    w: number;
    h: number;
    /** devicePixelRatio */
    dpr: number;
    depth: number;
  };
  hardware: {
    /** navigator.hardwareConcurrency */
    cores: number | null;
    /** navigator.deviceMemory (GB, rounded) */
    memory: number | null;
  };
  /** navigator.languages (full array). */
  languages: string[];
  timezone: string;
  /** navigator.maxTouchPoints */
  touchPoints: number;
  /** navigator.userAgent */
  ua: string;
  /**
   * Real OS version obtained via User-Agent Client Hints on Android Chrome.
   * Null when UA-CH is unavailable (non-Chrome browsers, iOS).
   * iOS devices don't need this — the UA string already reports the real version.
   */
  osVersion: string | null;
  connection: {
    type: string | null;
    effective: string | null;
  } | null;
}

/** Result returned by {@link ShareInstallsSDK.trackClick}. */
export interface TrackClickResult {
  /** Unique ID of the recorded click event. */
  eventId: string;
}

/** Error thrown when the backend request fails. */
export class ShareInstallsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ShareInstallsError';
  }
}
