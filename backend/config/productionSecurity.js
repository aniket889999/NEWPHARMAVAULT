const path = require('path');

const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const isProduction = () => process.env.NODE_ENV === 'production';

function parseOrigins(value, { requireHTTPS = false } = {}) {
  return String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(origin => {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch (_) {
        throw new Error('[CRITICAL] Invalid CORS origin configuration.');
      }

      const isPlainOrigin = parsed.pathname === '/' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password;
      if (!isPlainOrigin || !['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.includes('*') || (requireHTTPS && parsed.protocol !== 'https:')) {
        throw new Error('[CRITICAL] Production CORS origins must be complete HTTPS origins without paths or credentials.');
      }
      return parsed.origin;
    });
}

function getAllowedOrigins() {
  const configured = parseOrigins(process.env.CORS_ALLOWED_ORIGINS, { requireHTTPS: isProduction() });
  const legacyFrontend = isProduction()
    ? []
    : parseOrigins(process.env.FRONTEND_URL);
  const origins = [...new Set([...configured, ...legacyFrontend])];

  if (isProduction() && origins.length === 0) {
    throw new Error('[CRITICAL] CORS_ALLOWED_ORIGINS must be configured in production.');
  }

  return origins.length > 0 ? origins : LOCAL_DEVELOPMENT_ORIGINS;
}

function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  return {
    origin(origin, callback) {
      // Native iOS clients and non-browser health checks do not send Origin.
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

      const error = new Error('Origin is not permitted.');
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  // Verification documents and responses may contain sensitive information.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function getTrustProxySetting() {
  const raw = String(process.env.TRUST_PROXY || '').trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'false') return false;
  if (raw === 'true') return 1;
  if (!/^\d+$/.test(raw)) throw new Error('[CRITICAL] Invalid TRUST_PROXY configuration.');
  const hops = Number(raw);
  if (!Number.isSafeInteger(hops) || hops <= 0) throw new Error('[CRITICAL] Invalid TRUST_PROXY configuration.');
  return hops;
}

const LEGACY_EXTERNAL_AI_PATHS = [
  '/api/chat', '/api/agents', '/api/graphrag', '/api/language',
  '/api/prescriptions/analyze', '/api/intelligence',
  '/api/explainability', '/api/workflows'
];

function blockLegacyExternalAI(req, res, next) {
  if (isProduction() && LEGACY_EXTERNAL_AI_PATHS.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return res.status(404).json({ message: 'Resource not found.' });
  }
  next();
}

function validateProductionSecurity() {
  if (!isProduction()) return;

  getAllowedOrigins();
  getTrustProxySetting();

  const jwtSecret = String(process.env.JWT_SECRET || '');
  if (jwtSecret.length < 32) {
    throw new Error('[CRITICAL] JWT_SECRET must contain at least 32 characters in production.');
  }

  const storageRoot = String(process.env.DOCUMENT_STORAGE_ROOT || '').trim();
  if (!storageRoot || !path.isAbsolute(storageRoot)) {
    throw new Error('[CRITICAL] DOCUMENT_STORAGE_ROOT must be an absolute, persistent volume path in production.');
  }
}

module.exports = {
  blockLegacyExternalAI,
  createCorsOptions,
  getAllowedOrigins,
  getTrustProxySetting,
  securityHeaders,
  validateProductionSecurity
};
