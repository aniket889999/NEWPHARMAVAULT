const express = require('express');
const router = express.Router();
const { authUser, registerUser, provisionStaff, getUserProfile, logoutUser, setupMfa, enableMfa, disableMfa } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, authUser);
router.get('/profile', protect, getUserProfile);
router.post('/logout', protect, logoutUser);
router.post('/provision-staff', protect, provisionStaff);
router.post('/mfa/setup', protect, authLimiter, setupMfa);
router.post('/mfa/enable', protect, authLimiter, enableMfa);
router.post('/mfa/disable', protect, authLimiter, disableMfa);

module.exports = router;
