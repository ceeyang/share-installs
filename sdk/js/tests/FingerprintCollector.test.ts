/**
 * Unit tests for FingerprintCollector.
 *
 * Runs in jsdom (jest-environment-jsdom).
 */

import {FingerprintCollector} from '../src/FingerprintCollector';

describe('FingerprintCollector.collect', () => {
  it('returns all required fields with correct types', async () => {
    const fp = await FingerprintCollector.collect();
    
    // Screen
    expect(fp.screen).toMatchObject({
      w: expect.any(Number),
      h: expect.any(Number),
      dpr: expect.any(Number),
      depth: expect.any(Number),
    });

    // Hardware
    expect(fp.hardware.cores === null || typeof fp.hardware.cores === 'number').toBe(true);
    expect(fp.hardware.memory === null || typeof fp.hardware.memory === 'number').toBe(true);

    // Other fields
    expect(Array.isArray(fp.languages)).toBe(true);
    expect(typeof fp.timezone).toBe('string');
    expect(typeof fp.touchPoints).toBe('number');
    expect(typeof fp.ua).toBe('string');
    
    // Connection (can be null or object)
    if (fp.connection !== null) {
      expect(fp.connection.type === null || typeof fp.connection.type === 'string').toBe(true);
      expect(fp.connection.effective === null || typeof fp.connection.effective === 'string').toBe(true);
    }
  });

  it('collects hashes (can be null in jsdom)', async () => {
    const fp = await FingerprintCollector.collect();
    // In JSDOM, canvas/webgl/audio might be null, but the fields must exist
    expect(Object.keys(fp)).toContain('canvas');
    expect(Object.keys(fp)).toContain('webgl');
    expect(Object.keys(fp)).toContain('audio');
    
    if (fp.canvas !== null) expect(typeof fp.canvas).toBe('string');
    if (fp.webgl !== null) expect(typeof fp.webgl).toBe('string');
    if (fp.audio !== null) expect(typeof fp.audio).toBe('string');
  });
});

describe('FingerprintCollector platform detection', () => {
  const originalUA = navigator.userAgent;

  function setUA(ua: string) {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    setUA(originalUA);
  });

  it('detects iOS', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(FingerprintCollector.isIOS()).toBe(true);
    expect(FingerprintCollector.isAndroid()).toBe(false);
    expect(FingerprintCollector.isMobile()).toBe(true);
  });

  it('detects Android', () => {
    setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    expect(FingerprintCollector.isAndroid()).toBe(true);
    expect(FingerprintCollector.isIOS()).toBe(false);
    expect(FingerprintCollector.isMobile()).toBe(true);
  });

  it('detects desktop as not mobile', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    expect(FingerprintCollector.isMobile()).toBe(false);
  });
});
