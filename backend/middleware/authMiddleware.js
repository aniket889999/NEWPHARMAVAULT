const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../models/userModel');
const { WEB_AUDIENCE, WEB_TTL_SECONDS, NATIVE_TTL_SECONDS, readBrowserCookie, verifyBrowserMutation, clearBrowserSession } = require('../config/browserSession');

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.get('Authorization');
  // A supplied but malformed bearer header must never fall back to a cookie.
  const cookie = authorization ? null : readBrowserCookie(req);
  const token = authorization ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization)?.[1] : cookie;
  if (token) {
    if (cookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) verifyBrowserMutation(req);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], maxAge: cookie ? WEB_TTL_SECONDS : NATIVE_TTL_SECONDS });
      if (typeof decoded !== 'object' || !/^[a-f0-9]{24}$/i.test(String(decoded.id)) ||
        (cookie && (decoded.aud !== WEB_AUDIENCE || !Number.isInteger(decoded.ver) || !decoded.jti)) ||
        (!cookie && decoded.aud !== undefined && decoded.aud !== 'pharmavault-api') || !Number.isFinite(decoded.exp)) throw new Error('Invalid session.');
    } catch (error) {
      if (cookie) clearBrowserSession(res);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
    try { req.user = await User.findById(decoded.id).select('-password +sessionVersion'); }
    catch { throw Object.assign(new Error('Authentication is temporarily unavailable.'), { statusCode: 503 }); }
    if (!req.user || (decoded.ver ?? 0) !== (req.user.sessionVersion || 0)) {
      if (cookie) clearBrowserSession(res);
      res.status(401);
      throw new Error('Not authorized, session revoked');
    }
    req.authTransport = cookie ? 'cookie' : 'bearer';
    // Do not catch and turn downstream database/controller errors into a 401.
    return next();
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const pharmacy = (req, res, next) => {
  const allowedRoles = ['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'admin', 'super_admin'];
  if (req.user && allowedRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as pharmacy staff');
  }
};

const patient = (req, res, next) => {
  if (req.user && req.user.role === 'patient') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as patient');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Not authorized to access this route"
      });
    }
    next();
  };
};

module.exports = { protect, pharmacy, patient, authorize };
