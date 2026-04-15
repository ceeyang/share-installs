/**
 * @fileoverview Browser fingerprint signal collection.
 *
 * Collects non-PII device signals for deferred deep link matching.
 * Uses Canvas, WebGL, and AudioContext to generate high-entropy hashes
 * that are stable for the same browser/hardware combination.
 *
 * Audio collection is async (returns a Promise); all other signals are sync.
 */

import type {BrowserFingerprint} from './types.js';

export class FingerprintCollector {
  /**
   * Collects all available fingerprint signals.
   * Must be called in a browser environment with a valid DOM.
   */
  static async collect(): Promise<BrowserFingerprint> {
    const [canvas, webgl, audio] = await Promise.all([
      Promise.resolve(this.collectCanvas()),
      Promise.resolve(this.collectWebGL()),
      this.collectAudio(),
    ]);

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: {type?: string; effectiveType?: string};
    };

    const connection = nav.connection
      ? {
          type: nav.connection.type ?? null,
          effective: nav.connection.effectiveType ?? null,
        }
      : null;

    // UA-CH: get real Android OS version.
    // Chrome on Android freezes its UA string to "Android 10" for all devices
    // (Chrome 110+, Feb 2023, Privacy Sandbox policy). UA-CH returns the real
    // platform version (e.g. "16.0.0") and is available in Chrome 89+.
    // iOS is intentionally skipped — Safari UA already reports the real version
    // and iOS doesn't support navigator.userAgentData.
    const osVersion = await this.collectAndroidOsVersion();

    return {
      canvas,
      webgl,
      audio,
      screen: {
        w: window.screen.width,
        h: window.screen.height,
        dpr: window.devicePixelRatio ?? 1,
        depth: window.screen.colorDepth,
      },
      hardware: {
        cores: navigator.hardwareConcurrency ?? null,
        memory: nav.deviceMemory ?? null,
      },
      languages: Array.from(navigator.languages ?? [navigator.language ?? '']),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      touchPoints: navigator.maxTouchPoints ?? 0,
      ua: navigator.userAgent,
      osVersion,
      connection,
    };
  }

  // ---- Canvas fingerprint ----

  /**
   * Renders text and shapes to an off-screen canvas and hashes the pixel data.
   * Differences in font rendering, anti-aliasing, and GPU rasterisation produce
   * a unique-per-device hash.
   */
  private static collectCanvas(): string | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.textBaseline = 'top';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('share-installs 🔗', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('share-installs 🔗', 4, 17);

      // Add a curved path to capture path rendering differences
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(120, 30, 20, 0, Math.PI * 2);
      ctx.stroke();

      const dataUrl = canvas.toDataURL();
      return this.sha256Sync(dataUrl);
    } catch {
      return null;
    }
  }

  // ---- WebGL fingerprint ----

  /**
   * Collects WebGL renderer/vendor strings and renders a small scene.
   * Captures GPU-level rendering differences.
   */
  private static collectWebGL(): string | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;

      const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
      if (!(gl instanceof WebGLRenderingContext)) return null;

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR);
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);

      // Also render a triangle to capture shader compilation differences
      const vertShader = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(
        vertShader,
        'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }',
      );
      gl.compileShader(vertShader);

      const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(
        fragShader,
        'precision mediump float; void main() { gl_FragColor = vec4(0.2, 0.4, 0.6, 1.0); }',
      );
      gl.compileShader(fragShader);

      const program = gl.createProgram()!;
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.0, 0.5]),
        gl.STATIC_DRAW,
      );

      const loc = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const pixels = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      const payload = [
        String(vendor),
        String(renderer),
        Array.from(pixels).join(','),
      ].join('|');

      return this.sha256Sync(payload);
    } catch {
      return null;
    }
  }

  // ---- Audio fingerprint ----

  /**
   * Uses the Web Audio API to process a signal and hash the output.
   * Differences in audio processing hardware produce a unique fingerprint.
   * Returns null if AudioContext is unavailable or blocked.
   */
  private static async collectAudio(): Promise<string | null> {
    try {
      const AudioContext =
        window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof window.AudioContext}).webkitAudioContext;
      if (!AudioContext) return null;

      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const analyser = ctx.createAnalyser();
      const gain = ctx.createGain();
      const scriptNode = ctx.createScriptProcessor(4096, 1, 1);

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);

      oscillator.connect(analyser);
      analyser.connect(scriptNode);
      scriptNode.connect(gain);
      gain.connect(ctx.destination);

      return await new Promise<string | null>(resolve => {
        scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
          const data = Array.from(event.inputBuffer.getChannelData(0).slice(0, 50));
          oscillator.disconnect();
          analyser.disconnect();
          scriptNode.disconnect();
          ctx.close().catch(() => undefined);
          resolve(this.sha256Sync(data.join(',')));
        };

        oscillator.start(0);

        // Timeout guard: resolve null if audio doesn't process within 2s
        setTimeout(() => resolve(null), 2000);
      });
    } catch {
      return null;
    }
  }

  // ---- OS version via UA-CH ----

  /**
   * Returns the real Android OS version via User-Agent Client Hints.
   * Only runs on Android Chrome (89+); returns null on iOS and non-Chrome browsers.
   * iOS is intentionally excluded — Safari UA already reports the real iOS version,
   * and the backend extracts it directly from the UA string.
   */
  private static async collectAndroidOsVersion(): Promise<string | null> {
    try {
      const uaData = (navigator as Navigator & {
        userAgentData?: {
          platform?: string;
          getHighEntropyValues: (hints: string[]) => Promise<{platformVersion?: string}>;
        };
      }).userAgentData;

      if (!uaData || !this.isAndroid()) return null;

      const high = await uaData.getHighEntropyValues(['platformVersion']);
      const raw = high.platformVersion; // e.g. "16.0.0"
      if (!raw) return null;

      // Normalise to "major.minor" to match Build.VERSION.RELEASE on the Android SDK side.
      const parts = raw.split('.');
      return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] ?? null;
    } catch {
      return null;
    }
  }

  // ---- Platform helpers ----

  static isIOS(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  static isAndroid(): boolean {
    return /android/i.test(navigator.userAgent);
  }

  static isMobile(): boolean {
    return this.isIOS() || this.isAndroid();
  }

  // ---- Sync SHA-256 via SubtleCrypto polyfill ----
  // We use a synchronous FNV-1a hash for canvas/webgl to keep them off the
  // async path, falling back to SubtleCrypto only for audio.
  // FNV-1a is fast and has sufficient collision resistance for a fingerprint key.

  private static sha256Sync(input: string): string {
    // FNV-1a 64-bit (emulated as two 32-bit halves for JS)
    let h1 = 0x811c9dc5;
    let h2 = 0x84222325;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    }
    // Mix the two halves and encode as a fixed-length hex string
    const mix = Math.imul(h1 ^ (h2 >>> 16), 0x45d9f3b) >>> 0;
    return (h1 ^ h2 ^ mix).toString(16).padStart(8, '0') +
      (h1 * 0x1f + h2).toString(16).padStart(8, '0') +
      (h2 ^ mix).toString(16).padStart(8, '0') +
      ((h1 + h2 + mix) >>> 0).toString(16).padStart(8, '0');
  }
}
