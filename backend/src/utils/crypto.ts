import crypto from 'crypto';

/**
 * Computes a SHA-256 hash of the given input.
 * Used for API key hashing and fingerprint computation.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
