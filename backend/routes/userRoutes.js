const express = require('express');
const router = express.Router();
const { authUser, registerUser, provisionStaff, getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, authUser);
router.get('/profile', protect, getUserProfile);
router.post('/provision-staff', protect, provisionStaff);

module.exports = router;
