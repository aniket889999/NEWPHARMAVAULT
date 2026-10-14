const test = require('node:test');
const assert = require('node:assert/strict');

const environmentKeys = [
  'NODE_ENV', 'CORS_ALLOWED_ORIGINS', 'FRONTEND_URL', 'JWT_SECRET', 'DOCUMENT_STORAGE_ROOT', 'TRUST_PROXY'
];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.after(restoreEnvironment);

test('production security rejects missing HTTPS CORS, long JWT secret, or absolute storage path', () => {
  const { validateProductionSecurity } = require('../config/productionSecurity');
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.CORS_ALLOWED_ORIGINS = '';
  process.env.DOCUMENT_STORAGE_ROOT = '/var/lib/pharmavault/documents';
  assert.throws(validateProductionSecurity, /CORS_ALLOWED_ORIGINS/);

  process.env.CORS_ALLOWED_ORIGINS = 'http://insecure.example';
  assert.throws(validateProductionSecurity, /HTTPS/);

  process.env.CORS_ALLOWED_ORIGINS = 'https://app.example';
  process.env.JWT_SECRET = 'short';
  assert.throws(validateProductionSecurity, /32 characters/);

  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.DOCUMENT_STORAGE_ROOT = 'relative/documents';
  assert.throws(validateProductionSecurity, /absolute/);
});

test('CORS allow-list accepts configured browser origin and native requests only', () => {
  const { createCorsOptions } = require('../config/productionSecurity');
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.CORS_ALLOWED_ORIGINS = 'https://app.example';
  process.env.DOCUMENT_STORAGE_ROOT = '/var/lib/pharmavault/documents';
  const options = createCorsOptions();

  let allowed;
  options.origin('https://app.example', (error, value) => { assert.equal(error, null); allowed = value; });
  assert.equal(allowed, true);

  options.origin(undefined, (error, value) => { assert.equal(error, null); allowed = value; });
  assert.equal(allowed, true);

  options.origin('https://untrusted.example', (error) => { assert.equal(error.statusCode, 403); });
});
