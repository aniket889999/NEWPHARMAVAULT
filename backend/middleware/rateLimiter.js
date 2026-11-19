const rateLimit = require('express-rate-limit');
const { MongoRateLimitStore } = require('../services/platform/mongoRateLimitStore');

// RATE_LIMIT_STORE=mongo shares counters across API instances; default stays in-memory.
const sharedStore = (prefix) => (process.env.RATE_LIMIT_STORE === 'mongo' ? { store: new MongoRateLimitStore({ prefix }) } : {});

const parseLimit = (val, defaultVal) => {
  const parsed = parseInt(val, 10);
  return (parsed && parsed > 0) ? parsed : defaultVal;
};

const windowMs = parseLimit(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
// A larger sign-in budget is for explicit local development only, not every
// non-production/unspecified deployment environment.
const defaultAuthMax = process.env.NODE_ENV === 'development' ? 200 : 10;
const authMax = parseLimit(process.env.RATE_LIMIT_AUTH_MAX, defaultAuthMax);
const aiMax = parseLimit(process.env.RATE_LIMIT_AI_MAX, 30);

// Stricter limiter for auth (login/register)
const authLimiter = rateLimit({
  ...sharedStore('auth'),
  windowMs,
  max: authMax,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for AI and computationally expensive routes
const aiLimiter = rateLimit({
  ...sharedStore('ai'),
  windowMs,
  max: aiMax,
  message: { message: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for document content streaming
const docMax = parseLimit(process.env.RATE_LIMIT_DOC_MAX, 120);
const documentContentLimiter = rateLimit({
  ...sharedStore('doc'),
  windowMs,
  max: docMax,
  message: { message: 'Too many document content requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Multi-instance deployments: set RATE_LIMIT_STORE=mongo (shared MongoDB counters).
module.exports = { authLimiter, aiLimiter, documentContentLimiter };
