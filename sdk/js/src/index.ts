/**
 * @fileoverview Public exports for the share-installs Web SDK.
 *
 * This is a **client-side tracking SDK** for use in invite landing pages.
 * Embed it in your own page, call `trackClick(code)`, then redirect to the
 * App Store or Play Store. The mobile SDK handles the rest.
 *
 * @example
 * ```ts
 * import { ShareInstallsSDK } from '@share-installs/js-sdk';
 *
 * const sdk = new ShareInstallsSDK({ apiBaseUrl: 'https://api.yourdomain.com' });
 * const result = await sdk.trackClick('ABC12345');
 *
 * const url = sdk.isIOS() ? result.appStoreUrl : result.playStoreUrl;
 * if (url) location.href = url;
 * ```
 */

export {ShareInstallsSDK} from './InviteSDK.js';
export {FingerprintCollector} from './FingerprintCollector.js';
export {ShareInstallsError} from './types.js';
export type {
  ShareInstallsOptions,
  BrowserFingerprint,
  TrackClickResult,
} from './types.js';

import {ShareInstallsSDK} from './InviteSDK.js';
import type {ShareInstallsOptions, TrackClickResult} from './types.js';

/**
 * Convenient one-liner shorthand to initialize the SDK and track a click.
 * @example
 * ```ts
 * await ShareInstalls.trackClick({
 *   apiBaseUrl: 'https://api.domain.com',
 *   inviteCode: 'ABC12345',
 *   customData: { campaign: 'summer' }
 * });
 * ```
 */
export async function trackClick(
  options: ShareInstallsOptions & {
    inviteCode: string;
    customData?: Record<string, unknown>;
  }
): Promise<TrackClickResult> {
  const sdk = new ShareInstallsSDK({
    apiBaseUrl: options.apiBaseUrl,
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    debug: options.debug,
  });
  return sdk.trackClick(options.inviteCode, options.customData);
}
