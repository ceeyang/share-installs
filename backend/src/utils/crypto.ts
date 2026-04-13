import crypto from 'crypto';
import { config } from '../config';

/**
 * Computes a SHA-256 hash of the given input.
 * Used for API key hashing and fingerprint computation.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Encrypts a string using AES-256-GCM.
 * The returned string contains iv:authTag:encryptedText
 */
export function encryptAES(text: string): string {
  if (!config.ENCRYPTION_KEY || config.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string (format iv:authTag:encryptedText).
 */
export function decryptAES(cipherText: string): string {
  if (!config.ENCRYPTION_KEY || config.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipherText format. Expected iv:authTag:encryptedText');
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}

/**
 * Generates a random Dashboard API key.
 * Formats: sk_live_{32-byte-hex}
 */
export function generateApiKey(): { key: string; prefix: string } {
  const randomHex = crypto.randomBytes(32).toString('hex');
  const key = `sk_live_${randomHex}`;
  return { key, prefix: key.substring(0, 12) };
}
