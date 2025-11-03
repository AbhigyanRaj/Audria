import crypto from 'crypto';

/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from secret
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || 'default-secret-key';
  
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Combine salt + iv + tag + encrypted data
  return Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || 'default-secret-key';
  
  const buffer = Buffer.from(encryptedData, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = deriveKey(secret, salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
