const express = require('express');
const router = express.Router();
const { 
  createOrganization, 
  getMyOrganization, 
  getAllOrganizations 
} = require('../controllers/organizationController');
const { protect } = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.post('/', protect, createOrganization);
router.get('/me', protect, getMyOrganization);
router.get('/', protect, permissionMiddleware('super_admin'), getAllOrganizations);

module.exports = router;
