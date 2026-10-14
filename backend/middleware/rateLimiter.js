const rateLimit = require('express-rate-limit');

const parseLimit = (val, defaultVal) => {
  const parsed = parseInt(val, 10);
  return (parsed && parsed > 0) ? parsed : defaultVal;
};

const windowMs = parseLimit(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const authMax = parseLimit(process.env.RATE_LIMIT_AUTH_MAX, 10);
const aiMax = parseLimit(process.env.RATE_LIMIT_AI_MAX, 30);

// Stricter limiter for auth (login/register)
const authLimiter = rateLimit({
  windowMs,
  max: authMax,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for AI and computationally expensive routes
const aiLimiter = rateLimit({
  windowMs,
  max: aiMax,
  message: { message: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for document content streaming
const docMax = parseLimit(process.env.RATE_LIMIT_DOC_MAX, 120);
const documentContentLimiter = rateLimit({
  windowMs,
  max: docMax,
  message: { message: 'Too many document content requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// NOTE: For multi-instance deployments (e.g. cluster, PM2, Kubernetes), 
// this in-memory limiter MUST be replaced by a shared store like Redis.
module.exports = { authLimiter, aiLimiter, documentContentLimiter };
