const express = require('express');
const { authorize } = require('../middleware/authMiddleware');
const { documentContentLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/claimsController');

// Mounted at /api/v1 behind protect + tenantMiddleware (see app.js).
const router = express.Router();

// Claimant (patient)
router.get('/claims/payers', authorize('patient'), c.listPayers);
router.get('/claims/eligible-cases', authorize('patient'), c.listEligibleCases);
router.get('/claims', authorize('patient'), c.listMyClaims);
router.post('/claims', authorize('patient'), c.submitClaim);
router.get('/claims/:claimId', authorize('patient'), c.getMyClaim);
router.post('/claims/:claimId/queries/:queryId/answer', authorize('patient'), c.answerQuery);
router.post('/claims/:claimId/withdraw', authorize('patient'), c.withdrawClaim);
router.post('/claims/:claimId/appeal', authorize('patient'), c.appealClaim);
router.post('/claims/:claimId/accept-decision', authorize('patient'), c.acceptDecision);

// Insurer (payer tenant)
router.get('/payer/claims', authorize(...c.PAYER_ROLES), c.payerListClaims);
router.get('/payer/analytics', authorize(...c.PAYER_ROLES), c.payerAnalytics);
router.get('/payer/claims/:claimId', authorize(...c.PAYER_ROLES), c.payerGetClaim);
router.get('/payer/claims/:claimId/documents/:documentId/content', authorize(...c.PAYER_ROLES), documentContentLimiter, c.payerDocumentContent);
router.get('/payer/claims/:claimId/fhir-bundle', authorize(...c.PAYER_ROLES), c.payerFhirBundle);
router.post('/payer/claims/:claimId/start-review', authorize(...c.PAYER_ROLES), c.payerStartReview);
router.post('/payer/claims/:claimId/queries', authorize(...c.PAYER_ROLES), c.payerRaiseQuery);
router.post('/payer/claims/:claimId/decision', authorize(...c.PAYER_ROLES), c.payerDecide);
router.post('/payer/claims/:claimId/settle', authorize('payer_admin'), c.payerSettle);

// Pharmacy staff: read-only status of claims built on their cases
router.get('/pharmacy/claims', authorize(...c.PHARMACY_STAFF), c.pharmacyLinkedClaims);

// Notifications (every signed-in role)
router.get('/notifications', c.listNotifications);
router.post('/notifications/read-all', c.markAllNotificationsRead);
router.post('/notifications/:notificationId/read', c.markNotificationRead);

module.exports = router;
