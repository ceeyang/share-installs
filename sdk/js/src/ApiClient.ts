/**
 * @fileoverview Fetch-based API client with timeout and optional API key support.
 */

import {ShareInstallsError} from './types.js';

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs: number;
}

/**
 * Lightweight API client using the native Fetch API.
 * Works in all modern browsers and Node.js 18+.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly debug: boolean;

  static readonly SDK_VERSION = '1.0.0';

  constructor(baseUrl: string, apiKey?: string, debug = false) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.debug = debug;
  }

  async request<T>(path: string, options: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ShareInstalls] ${options.method ?? 'GET'} ${url}`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-SDK-Platform': 'js',
      'X-SDK-Version': ApiClient.SDK_VERSION,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Promise.race for timeout: avoids AbortSignal structured-clone issues
    // in certain browser/WebView contexts.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ShareInstallsError('Request timed out', undefined, 'TIMEOUT')),
        options.timeoutMs,
      )
    );

    let response: Response;
    try {
      response = await Promise.race([
        fetch(url, {
          method: options.method ?? 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        }),
        timeoutPromise,
      ]);
    } catch (err) {
      if (err instanceof ShareInstallsError) throw err;
      throw new ShareInstallsError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'NETWORK_ERROR',
      );
    }

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ShareInstalls] Response ${response.status} from ${url}`);
    }

    if (!response.ok) {
      let errorBody: {error?: {message?: string; status?: string} | string; message?: string} = {};
      try {
        errorBody = await response.json();
      } catch {
        // ignore parse error
      }
      // Handle both Google-style {error:{code,status,message}} and legacy {error, message}
      const errObj = typeof errorBody.error === 'object' ? errorBody.error : null;
      const message = errObj?.message ?? errorBody.message ?? `HTTP ${response.status}`;
      const code = errObj?.status ?? (typeof errorBody.error === 'string' ? errorBody.error : undefined);
      throw new ShareInstallsError(message, response.status, code);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    return this.request<T>(path, {method: 'POST', body, timeoutMs});
  }

  async get<T>(path: string, timeoutMs: number): Promise<T> {
    return this.request<T>(path, {method: 'GET', timeoutMs});
  }

  async delete<T>(path: string, timeoutMs: number): Promise<T> {
    return this.request<T>(path, {method: 'DELETE', timeoutMs});
  }
}
