'use strict';

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s) using only node:crypto.
 * Secrets are stored encrypted at rest with AES-256-GCM (see encryptSecret).
 */
const crypto = require('node:crypto');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secretBuffer, counter, digits = DIGITS, algorithm = 'sha1') {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac(algorithm, secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

function totp(base32Secret, { time = Date.now(), digits = DIGITS, algorithm = 'sha1' } = {}) {
  const counter = Math.floor(time / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter, digits, algorithm);
}

/**
 * Constant-time verification with a ±window step tolerance for clock drift.
 * Returns the matched counter (to block replay) or null.
 */
function verifyTotp(base32Secret, code, { time = Date.now(), window = 1, lastUsedCounter = -1 } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(base32Secret);
  const current = Math.floor(time / 1000 / STEP_SECONDS);
  for (let delta = -window; delta <= window; delta += 1) {
    const counter = current + delta;
    if (counter <= lastUsedCounter) continue;
    const expected = Buffer.from(hotp(secret, counter));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) return counter;
  }
  return null;
}

function otpauthUri({ secret, accountName, issuer = 'PharmaVault' }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

function encryptionKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY || '';
  if (raw.length < 32) {
    throw Object.assign(new Error('MFA is not configured on this server (MFA_ENCRYPTION_KEY missing or shorter than 32 characters).'), { statusCode: 503 });
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptSecret(payload) {
  const [version, iv, tag, data] = String(payload).split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported MFA secret format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  hotp,
  totp,
  verifyTotp,
  otpauthUri,
  encryptSecret,
  decryptSecret,
  STEP_SECONDS
};
