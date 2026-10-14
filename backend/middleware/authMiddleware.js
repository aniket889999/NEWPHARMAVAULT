const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      return next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
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
