/**
 * Unit tests for the fingerprint utility.
 */

import {computeFingerprint, computeSimilarityScore} from '../../src/utils/fingerprint';

describe('computeFingerprint', () => {
  it('returns a 64-char hex string', () => {
    const hash = computeFingerprint({ipAddress: '1.2.3.4', timezone: 'Asia/Shanghai'});
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for identical inputs', () => {
    const signals = {
      ipAddress: '1.2.3.4',
      languages: ['zh-CN', 'zh'],
      timezone: 'Asia/Shanghai',
      screenWidth: 390,
      screenHeight: 844,
    };
    expect(computeFingerprint(signals)).toBe(computeFingerprint(signals));
  });

  it('produces different hashes for different IPs', () => {
    const base = {timezone: 'Asia/Shanghai', screenWidth: 390};
    const h1 = computeFingerprint({...base, ipAddress: '1.2.3.4'});
    const h2 = computeFingerprint({...base, ipAddress: '5.6.7.8'});
    expect(h1).not.toBe(h2);
  });

  it('uses /24 subnet for IP normalisation', () => {
    // Two IPs in the same /24 should produce the same hash if other signals match
    const base = {timezone: 'UTC', screenWidth: 1080, screenHeight: 1920};
    const h1 = computeFingerprint({...base, ipAddress: '10.0.0.1'});
    const h2 = computeFingerprint({...base, ipAddress: '10.0.0.200'});
    expect(h1).toBe(h2);
  });
});

describe('computeSimilarityScore', () => {
  const webSignals = {
    ipAddress: '203.0.113.10',
    screenWidth: 390,
    screenHeight: 844,
    pixelRatio: 3,
    languages: ['zh-CN', 'zh'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 6,
    deviceMemory: 4,
    touchPoints: 5,
    osVersion: 'iOS 17.2',
  };

  it('returns 1.0 for identical signals', () => {
    const score = computeSimilarityScore(webSignals, webSignals);
    expect(score).toBe(1.0);
  });

  it('returns 0 when no signals are available on either side', () => {
    const score = computeSimilarityScore({}, {});
    expect(score).toBe(0);
  });

  it('returns a high score for same-device web→native match', () => {
    const nativeSignals = {
      ipAddress: '203.0.113.10',
      screenWidth: 390,
      screenHeight: 844,
      pixelRatio: 3,
      languages: ['zh-CN', 'zh'],
      timezone: 'Asia/Shanghai',
      osVersion: '17.2',
    };
    const score = computeSimilarityScore(webSignals, nativeSignals);
    expect(score).toBeGreaterThanOrEqual(0.75);
  });

  it('returns a low score for completely different devices', () => {
    const otherDevice = {
      ipAddress: '8.8.8.8',
      screenWidth: 1080,
      screenHeight: 2400,
      languages: ['en-US'],
      timezone: 'America/New_York',
      osVersion: 'Android 13',
    };
    const score = computeSimilarityScore(webSignals, otherDevice);
    expect(score).toBeLessThan(0.5);
  });

  it('excludes canvas/webgl/audio from cross-platform scoring', () => {
    // Web has canvas/webgl; native doesn't – they should not count against the score
    const withHashes = {
      ...webSignals,
      canvasHash: 'aaaa',
      webglHash: 'bbbb',
      audioHash: 'cccc',
    };
    const nativeOnly = {
      ipAddress: '203.0.113.10',
      screenWidth: 390,
      screenHeight: 844,
      languages: ['zh-CN'],
      timezone: 'Asia/Shanghai',
    };

    const scoreWithHashes = computeSimilarityScore(withHashes, nativeOnly);
    const scoreWithout = computeSimilarityScore(webSignals, nativeOnly);
    // Hashes must not lower the score when native side is absent
    expect(scoreWithHashes).toBeCloseTo(scoreWithout, 5);
  });

  it('awards full weight for matching canvas hashes (web-to-web)', () => {
    const a = {canvasHash: 'abc', webglHash: 'def', audioHash: 'ghi'};
    const b = {canvasHash: 'abc', webglHash: 'def', audioHash: 'ghi'};
    const score = computeSimilarityScore(a, b);
    expect(score).toBe(1.0);
  });

  it('uses subnet match for IP comparison', () => {
    const a = {ipAddress: '192.168.1.1'};
    const b = {ipAddress: '192.168.1.254'};
    const score = computeSimilarityScore(a, b);
    expect(score).toBe(1.0);
  });

  it('does not match different subnets', () => {
    const a = {ipAddress: '192.168.1.1'};
    const b = {ipAddress: '192.168.2.1'};
    const score = computeSimilarityScore(a, b);
    expect(score).toBe(0);
  });

  it('normalises OS version strings for comparison', () => {
    const a = {osVersion: 'iPhone OS 17_2_1'};
    const b = {osVersion: 'iOS 17.2'};
    const score = computeSimilarityScore(a, b);
    expect(score).toBe(1.0);
  });
});
