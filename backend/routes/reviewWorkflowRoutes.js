const express = require('express');
const c = require('../controllers/reviewWorkflowController');

// Mounted at /api/v1 behind protect + tenantMiddleware (see app.js).
const router = express.Router();

router.get('/review/cases/:caseId/assignment', c.getAssignment);
router.post('/review/cases/:caseId/assignment', c.takeCase);
router.delete('/review/cases/:caseId/assignment', c.releaseCase);
router.post('/review/cases/:caseId/reopen', c.reopenCase);

module.exports = router;
