'use strict';

/**
 * Envelope encryption for stored documents (AES-256-GCM).
 *
 * File layout: MAGIC(6) | VERSION(1) | IV(12) | TAG(16) | CIPHERTEXT
 * Enabled when DOCUMENT_ENCRYPTION_KEY (32+ characters) is set. Files written
 * before encryption was enabled stay readable (no magic header = plaintext).
 * The SHA-256 recorded in MongoDB is always of the original plaintext.
 */
const crypto = require('node:crypto');

const MAGIC = Buffer.from('PVENC1', 'ascii');
const VERSION = 1;
const HEADER_BYTES = MAGIC.length + 1 + 12 + 16;

function keyFrom(raw) {
  if (typeof raw !== 'string' || raw.length < 32) return null;
  // Domain-separated so the same secret is never reused verbatim across features.
  return crypto.createHash('sha256').update(`pharmavault-documents:${raw}`).digest();
}

function configuredKey(env = process.env) {
  return keyFrom(env.DOCUMENT_ENCRYPTION_KEY || '');
}

function isEncrypted(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= HEADER_BYTES && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

function encrypt(plain, key) {
  if (!key) throw new Error('Document encryption key is not configured.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

function decrypt(stored, key) {
  if (!isEncrypted(stored)) return stored;
  if (!key) {
    throw Object.assign(new Error('Encrypted document cannot be read: DOCUMENT_ENCRYPTION_KEY is not configured.'), { statusCode: 503 });
  }
  const version = stored[MAGIC.length];
  if (version !== VERSION) throw Object.assign(new Error('Unsupported document encryption version.'), { statusCode: 500 });
  const ivStart = MAGIC.length + 1;
  const iv = stored.subarray(ivStart, ivStart + 12);
  const tag = stored.subarray(ivStart + 12, ivStart + 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(stored.subarray(HEADER_BYTES)), decipher.final()]);
  } catch {
    throw Object.assign(new Error('Stored document failed its integrity check.'), { statusCode: 500, code: 'DOCUMENT_INTEGRITY_FAILED' });
  }
}

module.exports = { configuredKey, keyFrom, isEncrypted, encrypt, decrypt, MAGIC };
