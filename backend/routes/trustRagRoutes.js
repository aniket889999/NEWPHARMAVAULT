const express = require('express');
const router = express.Router();
const { documentContentLimiter } = require('../middleware/rateLimiter');
const {
  createCase,
  listCases,
  getCase,
  updateCase,
  uploadDocument,
  listDocuments,
  getDocumentContent,
  getDocumentPagePreview,
  correctExtractedField,
  processCase,
  getResults,
  getReviewQueue,
  submitReview,
  listReviews,
  getEvidence,
  getFhirBundle,
  getAuditTrail
} = require('../controllers/trustRagController');

// Cases CRUD & Lifecycle
router.route('/cases')
  .post(createCase)
  .get(listCases);

router.route('/cases/:caseId')
  .get(getCase)
  .patch(updateCase);

// Documents
router.route('/cases/:caseId/documents')
  .post(uploadDocument)
  .get(listDocuments);

router.get('/cases/:caseId/documents/:documentId/content', documentContentLimiter, getDocumentContent);
router.get('/cases/:caseId/documents/:documentId/pages/:pageNumber/preview', documentContentLimiter, getDocumentPagePreview);

// Extracted Fields (Human in the loop corrections)
router.patch('/cases/:caseId/extracted-fields/:fieldId', correctExtractedField);

// TrustRAG Processing Engine
router.post('/cases/:caseId/process', processCase);

// Structured Explainable Results, Lineage & Audit Trail
router.get('/cases/:caseId/results', getResults);
router.get('/cases/:caseId/evidence', getEvidence);
router.get('/cases/:caseId/audit-trail', getAuditTrail);

// Review Queue & Human Adjudication
router.get('/review-queue', getReviewQueue);

router.route('/cases/:caseId/reviews')
  .get(listReviews)
  .post(submitReview);

// Standards Export
router.get('/cases/:caseId/fhir-bundle', getFhirBundle);

module.exports = router;
