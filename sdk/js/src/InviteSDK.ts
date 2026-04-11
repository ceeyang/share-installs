/**
 * @fileoverview share-installs Web SDK – client-side invite tracking.
 *
 * ## Purpose
 * Embed this SDK in your invite landing page. When a user arrives via an invite
 * link, the SDK collects rich browser fingerprint signals (Canvas, WebGL, Audio,
 * hardware, screen, etc.) and reports them to the share-installs backend.
 *
 * When the user installs the app and opens it for the first time, the mobile SDK
 * sends matching signals to the backend, which attributes the install to the
 * original click and resolves the invite code automatically.
 *
 * ## Quick Start – CDN
 * ```html
 * <script src="https://cdn.yourdomain.com/share-installs-sdk.min.js"></script>
 * <script>
 *   const sdk = new ShareInstallsSDK({ apiBaseUrl: 'https://api.yourdomain.com' });
 *   const code = location.pathname.split('/').pop();
 *   await sdk.trackClick(code);
 * </script>
 * ```
 *
 * ## Quick Start – npm / bundler
 * ```ts
 * import { ShareInstallsSDK } from '@share-installs/js-sdk';
 *
 * // Single-tenant (self-hosted, no key needed)
 * const sdk = new ShareInstallsSDK({ apiBaseUrl: 'https://api.yourdomain.com' });
 *
 * // Multi-tenant (SaaS, API key required)
 * const sdk = new ShareInstallsSDK({
 *   apiBaseUrl: 'https://api.shareinstalls.com',
 *   apiKey: 'sk_live_xxxxxxxx',
 * });
 *
 * const code = new URL(location.href).searchParams.get('code')!;
 * await sdk.trackClick(code);
 * ```
 */

import {ApiClient} from './ApiClient.js';
import {FingerprintCollector} from './FingerprintCollector.js';
import type {ShareInstallsOptions, TrackClickResult} from './types.js';

export class ShareInstallsSDK {
  private readonly client: ApiClient;
  private readonly options: Required<Omit<ShareInstallsOptions, 'apiKey'>> & {apiKey?: string};

  static readonly VERSION = '1.0.0';

  /**
   * @param options.apiBaseUrl - Base URL of the share-installs backend.
   * @param options.apiKey     - API key for multi-tenant deployments (optional).
   * @param options.timeoutMs  - Request timeout in ms. Default: 5000.
   * @param options.debug      - Verbose logging. Default: false.
   */
  constructor(options: ShareInstallsOptions) {
    this.options = {
      apiBaseUrl: options.apiBaseUrl,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs ?? 5000,
      debug: options.debug ?? false,
    };
    this.client = new ApiClient(
      this.options.apiBaseUrl,
      this.options.apiKey,
      this.options.debug,
    );
  }

  /**
   * Records a click event on the invite landing page.
   *
   * Collects browser fingerprint signals and sends them to the backend together
   * with the invite code. The referrer is included automatically.
   *
   * Call this once when the landing page loads.
   *
   * @param inviteCode - The invite code from the URL (e.g. `"ABC12345"`).
   */
  async trackClick(inviteCode: string, customData?: Record<string, unknown>): Promise<TrackClickResult> {
    if (!inviteCode?.trim()) {
      throw new Error('trackClick: inviteCode must not be empty.');
    }

    const isBrowser =
      typeof window !== 'undefined' && typeof navigator !== 'undefined';

    const fingerprint = isBrowser
      ? await FingerprintCollector.collect()
      : {
          canvas: null,
          webgl: null,
          audio: null,
          screen: {w: 0, h: 0, dpr: 1, depth: 0},
          hardware: {cores: null, memory: null},
          languages: [],
          timezone: '',
          touchPoints: 0,
          ua: '',
          connection: null,
        };

    const result = await this.client.post<TrackClickResult>(
      '/v1/clicks',
      {
        inviteCode,
        customData,
        fingerprint,
        referrer: isBrowser ? document.referrer : undefined,
      },
      this.options.timeoutMs,
    );

    // Write invite code to clipboard for Android fallback resolution.
    // navigator.clipboard is available without user permission on Android Chrome
    // when the page is in focus (no prompt shown to user).
    // Silently ignored if unavailable (iOS, non-secure context, etc.).
    if (isBrowser && FingerprintCollector.isAndroid()) {
      try {
        await navigator.clipboard.writeText(`SHAREINSTALLS:${inviteCode}`);
        if (this.options.debug) {
          console.log('[ShareInstalls] Clipboard written for Android fallback');
        }
      } catch {
        // Non-fatal: fingerprint match is the primary channel
      }
    }

    return result;
  }

  // ---- Platform detection helpers ----

  /** `true` when running in an iOS browser. */
  isIOS(): boolean {
    return typeof navigator !== 'undefined' && FingerprintCollector.isIOS();
  }

  /** `true` when running in an Android browser. */
  isAndroid(): boolean {
    return typeof navigator !== 'undefined' && FingerprintCollector.isAndroid();
  }

  /** `true` when running in a mobile browser (iOS or Android). */
  isMobile(): boolean {
    return this.isIOS() || this.isAndroid();
  }
}
