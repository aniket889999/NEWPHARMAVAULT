const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { WEB_AUDIENCE, WEB_TTL_SECONDS, NATIVE_TTL_SECONDS } = require('../config/browserSession');

const generateToken = (id, sessionVersion = 0, { web = false } = {}) => {
  return jwt.sign({ id: String(id), ver: sessionVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: web ? WEB_TTL_SECONDS : NATIVE_TTL_SECONDS,
    audience: web ? WEB_AUDIENCE : 'pharmavault-api',
    jwtid: crypto.randomUUID(),
  });
};

module.exports = generateToken;
