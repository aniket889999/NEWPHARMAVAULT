const express = require('express');
const router = express.Router();
const { 
  createBranch, 
  getBranches 
} = require('../controllers/branchController');
const { protect } = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

router.post('/', protect, permissionMiddleware('canManageBranch'), createBranch);
router.get('/', protect, getBranches);

module.exports = router;
