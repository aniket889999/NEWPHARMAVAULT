const express = require('express');
const router = express.Router();
const { authUser, registerUser, provisionStaff, listStaff, getUserProfile, logoutUser, setupMfa, enableMfa, disableMfa, regenerateRecoveryCodes, deactivateStaff, reactivateStaff, changeStaffRole, forceSignOutStaff, unlockStaff, confirmStaffCredential, updateReviewPolicy, updateTextAlerts } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, authUser);
router.get('/profile', protect, getUserProfile);
router.post('/logout', protect, logoutUser);
router.post('/provision-staff', protect, provisionStaff);
router.get('/staff', protect, listStaff);
router.post('/mfa/setup', protect, authLimiter, setupMfa);
router.post('/mfa/enable', protect, authLimiter, enableMfa);
router.post('/mfa/disable', protect, authLimiter, disableMfa);
router.post('/mfa/recovery-codes', protect, authLimiter, regenerateRecoveryCodes);
router.post('/staff/:userId/deactivate', protect, deactivateStaff);
router.post('/staff/:userId/reactivate', protect, reactivateStaff);
router.post('/staff/:userId/role', protect, changeStaffRole);
router.post('/staff/:userId/sign-out', protect, forceSignOutStaff);
router.post('/staff/:userId/unlock', protect, unlockStaff);
router.post('/staff/:userId/credential', protect, confirmStaffCredential);
router.post('/organization/review-policy', protect, updateReviewPolicy);
router.post('/me/text-alerts', protect, updateTextAlerts);

module.exports = router;
