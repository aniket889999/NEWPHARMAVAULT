const asyncHandler = require('../middleware/asyncHandler');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const ConsistencyCheck = require('../models/consistencyCheckModel');
const RiskSignal = require('../models/riskSignalModel');
const ReviewDecision = require('../models/reviewDecisionModel');
const EvidenceItem = require('../models/evidenceItemModel');
const Organization = require('../models/organizationModel');
const AuditEvent = require('../models/auditEventModel');

const storageService = require('../services/trustRag/storageService');
const pdfRenderingService = require('../services/trustRag/pdfRenderingService');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const trustRagOrchestrator = require('../services/trustRag/trustRagOrchestrator');
const llmExplainabilityService = require('../services/trustRag/llmExplainabilityService');

/**
 * Human-in-the-Loop Review Action Mapping
 * Preserves backward compatibility while standardizing on public action labels:
 * VERIFY, RETURN_FOR_CORRECTION, ESCALATE.
 */
const REVIEW_ACTION_MAPPING = {
  // Public-facing labels
  VERIFY: {
    internalDecision: 'APPROVE',
    newStatus: 'VERIFIED',
    reviewRequired: false,
    label: 'VERIFY'
  },
  RETURN_FOR_CORRECTION: {
    internalDecision: 'REQUEST_CLARIFICATION',
    newStatus: 'NEEDS_CORRECTION',
    reviewRequired: true,
    label: 'RETURN_FOR_CORRECTION'
  },
  ESCALATE: {
    internalDecision: 'ESCALATE',
    newStatus: 'NEEDS_REVIEW',
    reviewRequired: true,
    label: 'ESCALATE'
  },
  // Backward compatibility legacy labels
  APPROVE: {
    internalDecision: 'APPROVE',
    newStatus: 'VERIFIED',
    reviewRequired: false,
    label: 'VERIFY'
  },
  REQUEST_CLARIFICATION: {
    internalDecision: 'REQUEST_CLARIFICATION',
    newStatus: 'NEEDS_CORRECTION',
    reviewRequired: true,
    label: 'RETURN_FOR_CORRECTION'
  },
  REJECT: {
    internalDecision: 'REJECT',
    newStatus: 'REJECTED',
    reviewRequired: false,
    label: 'REJECT'
  }
};

/**
 * Helper to enforce case access control
 * - Patient: can only access cases they created
 * - Staff: scoped by organizationId (returns 404 for other tenants to prevent enumeration)
 * - Super admin: unrestricted
 */
const getAccessibleCase = async (caseId, user, tenantContext, res) => {
  const vCase = await VerificationCase.findById(caseId);
  if (!vCase) {
    if (res) res.status(404);
    const err = new Error('Verification case not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.role === 'super_admin') {
    return vCase;
  }

  if (user.role === 'research_evaluator') {
    if (res) res.status(403);
    const err = new Error('Access denied: Research-evaluator access requires de-identification pipeline.');
    err.statusCode = 403;
    throw err;
  }

  if (user.role === 'patient') {
    if (vCase.createdBy.toString() !== user._id.toString()) {
      if (res) res.status(404);
      const err = new Error('Verification case not found');
      err.statusCode = 404;
      throw err;
    }
    return vCase;
  }

  // Staff users: pharmacist, claims_reviewer, org_admin, etc.
  const isStaff = ['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'admin', 'claims_reviewer'].includes(user.role);
  if (isStaff) {
    if (!tenantContext || !tenantContext.organizationId) {
      if (res) res.status(403);
      const err = new Error('Staff user has no organization tenant context.');
      err.statusCode = 403;
      throw err;
    }

    if (vCase.organizationId.toString() !== tenantContext.organizationId.toString()) {
      if (res) res.status(404);
      const err = new Error('Verification case not found');
      err.statusCode = 404;
      throw err;
    }
    return vCase;
  }

  if (res) res.status(403);
  const err = new Error('Not authorized to access verification cases');
  err.statusCode = 403;
  throw err;
};

// @desc    Create a new Verification Case
// @route   POST /api/v1/cases
// @access  Private (patient, pharmacist, claims_reviewer, org_admin)
const createCase = asyncHandler(async (req, res) => {
  const allowedRoles = ['patient', 'pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Not authorized to create verification cases');
  }

  let orgId = req.tenantContext?.organizationId;
  const isStaff = ['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'claims_reviewer', 'admin'].includes(req.user.role);

  if (isStaff) {
    if (!orgId) {
      res.status(403);
      throw new Error('Staff user has no organization tenant context. Access denied.');
    }
  } else {
    // Patients are tenant-neutral submitters
    if (req.body.organizationId) {
      const specifiedOrg = await Organization.findById(req.body.organizationId);
      if (specifiedOrg) {
        orgId = specifiedOrg._id;
      }
    }
    if (!orgId) {
      let activeOrg = await Organization.findOne({ status: 'active' });
      if (!activeOrg) {
        activeOrg = await Organization.findOne({});
      }
      if (activeOrg) {
        orgId = activeOrg._id;
      } else {
        activeOrg = await Organization.create({
          name: 'PharmaVault General Pharmacy',
          owner: req.user._id,
          plan: 'Enterprise',
          status: 'active'
        });
        orgId = activeOrg._id;
      }
    }
  }

  const { subjectReference, metadata } = req.body;

  // Sanitize client-provided metadata to prevent injection of internal explanation/resolution fields
  const safeMetadata = { ...(metadata || {}) };
  delete safeMetadata.explanation;
  delete safeMetadata.resolutions;
  delete safeMetadata.resolution;
  delete safeMetadata.canonicalMedicine;
  delete safeMetadata.canonicalResolution;

  const vCase = new VerificationCase({
    organizationId: orgId,
    branchId: req.tenantContext?.branchId || null,
    createdBy: req.user._id,
    subjectReference: subjectReference || `patient-${req.user._id.toString().slice(-6)}`,
    status: 'DRAFT',
    schemaVersion: '1.0',
    metadata: safeMetadata
  });

  const createdCase = await vCase.save();

  await auditLoggerService.logEvent({
    caseId: createdCase._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'CASE_CREATED',
    targetType: 'VerificationCase',
    targetId: createdCase._id,
    metadata: { caseReference: createdCase.caseReference }
  });

  res.status(201).json(createdCase);
});

// @desc    List Verification Cases
// @route   GET /api/v1/cases
// @access  Private
const listCases = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role === 'research_evaluator') {
    res.status(403);
    throw new Error('Access denied: Research-evaluator access requires de-identification pipeline.');
  }

  if (req.user.role === 'patient') {
    filter.createdBy = req.user._id;
  } else if (req.user.role === 'super_admin') {
    // unrestricted
  } else if (['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'claims_reviewer', 'admin'].includes(req.user.role)) {
    if (!req.tenantContext?.organizationId) {
      res.status(403);
      throw new Error('Staff user has no organization tenant context. Access denied.');
    }
    filter.organizationId = req.tenantContext.organizationId;
  } else {
    res.status(403);
    throw new Error('Not authorized to list cases');
  }

  const cases = await VerificationCase.find(filter).sort('-createdAt');
  res.status(200).json(cases);
});

// @desc    Get Case by ID
// @route   GET /api/v1/cases/:caseId
// @access  Private
const getCase = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  res.status(200).json(vCase);
});

// @desc    Update Case metadata or close case
// @route   PATCH /api/v1/cases/:caseId
// @access  Private (pharmacist, pharmacy, claims_reviewer, org_admin)
const updateCase = asyncHandler(async (req, res) => {
  // Authorization matrix: patients cannot modify verification cases directly
  if (req.user.role === 'patient') {
    res.status(403);
    throw new Error('Patients cannot modify verification cases directly.');
  }

  if (req.user.role === 'research_evaluator' || req.user.role === 'super_admin') {
    res.status(403);
    throw new Error('Not authorized to patch verification cases.');
  }

  const allowedStaffRoles = ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin'];
  if (!allowedStaffRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Not authorized to patch verification cases.');
  }

  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const { status, metadata } = req.body;

  // Case PATCH cannot bypass a ReviewDecision to set final states
  if (status) {
    if (status === 'VERIFIED' || status === 'REJECTED') {
      res.status(400);
      throw new Error("Final verification states ('VERIFIED', 'REJECTED') cannot be set via case update. They require a formal ReviewDecision.");
    }

    if (status === 'CLOSED') {
      if (!['VERIFIED', 'REJECTED'].includes(vCase.status)) {
        res.status(400);
        throw new Error(`Cannot close case from state '${vCase.status}'. Case must be VERIFIED or REJECTED prior to closure.`);
      }
      vCase.status = 'CLOSED';
    } else {
      res.status(400);
      throw new Error(`Direct transition to status '${status}' via case update is prohibited.`);
    }
  }

  // Case PATCH cannot inject internal explanation/resolution metadata
  if (metadata) {
    const forbiddenKeys = ['explanation', 'resolutions', 'resolution', 'canonicalMedicine', 'canonicalResolution', 'internalDecision', 'reviewDecision'];
    for (const key of Object.keys(metadata)) {
      if (forbiddenKeys.includes(key)) {
        res.status(400);
        throw new Error(`Injecting internal explanation or resolution metadata '${key}' via case update is prohibited.`);
      }
    }
    vCase.metadata = { ...vCase.metadata, ...metadata };
  }

  const updatedCase = await vCase.save();

  await auditLoggerService.logEvent({
    caseId: updatedCase._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: status === 'CLOSED' ? 'CASE_CLOSED' : 'CASE_METADATA_UPDATED',
    targetType: 'VerificationCase',
    targetId: updatedCase._id,
    metadata: { newStatus: updatedCase.status }
  });

  res.status(200).json(updatedCase);
});

// @desc    Upload document to a case
// @route   POST /api/v1/cases/:caseId/documents
// @access  Private
const uploadDocument = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  if (['PROCESSING', 'CLOSED'].includes(vCase.status)) {
    res.status(400);
    throw new Error(`Cannot upload documents while case is in state '${vCase.status}'`);
  }

  // Reject upload requests containing sampleFields, lowConfidence, or unknown extraction-control properties with HTTP 400
  const allowedUploadKeys = new Set(['type', 'file', 'filename', 'mimeType']);
  for (const key of Object.keys(req.body || {})) {
    if (!allowedUploadKeys.has(key)) {
      res.status(400);
      throw new Error(`Client-controlled property or extraction override '${key}' is prohibited on document upload.`);
    }
  }

  const { type, file, filename, mimeType } = req.body;

  if (!type || !['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'].includes(type)) {
    res.status(400);
    throw new Error("Valid document type is required: 'PRESCRIPTION', 'PHARMACY_INVOICE', or 'CLAIM_FORM'");
  }

  if (file === undefined || file === null) {
    res.status(400);
    throw new Error('Document file payload is required and cannot be absent.');
  }

  if (typeof file === 'string' && file.trim() === '') {
    res.status(400);
    throw new Error('Document file payload cannot be empty.');
  }

  // Persist file via StorageService (stores to local sandbox/S3-style storage without putting raw content in MongoDB)
  const stored = await storageService.storeDocument({
    caseId: vCase._id,
    filename: filename || `${type.toLowerCase()}_document.pdf`,
    content: file,
    mimeType: mimeType || 'application/pdf'
  });

  const doc = new Document({
    caseId: vCase._id,
    type,
    objectStorageKey: stored.objectStorageKey,
    originalFilename: stored.sanitizedFilename,
    mimeType: stored.detectedMimeType,
    sizeBytes: stored.sizeBytes,
    sha256: stored.sha256,
    pageCount: 1,
    uploadStatus: 'COMPLETED',
    processingStatus: 'PENDING',
    uploadedBy: req.user._id,
    metadata: {}
  });

  const savedDoc = await doc.save();

  // Attach document ID to case
  if (!vCase.documentIds.map(id => id.toString()).includes(savedDoc._id.toString())) {
    vCase.documentIds.push(savedDoc._id);
  }

  // Update case status based on document availability
  const allDocs = await Document.find({ caseId: vCase._id });
  const uniqueTypes = new Set(allDocs.map(d => d.type));
  const hasTriangle = uniqueTypes.has('PRESCRIPTION') && uniqueTypes.has('PHARMACY_INVOICE') && uniqueTypes.has('CLAIM_FORM');

  if (hasTriangle) {
    vCase.status = 'READY_FOR_PROCESSING';
  } else if (vCase.status === 'DRAFT') {
    vCase.status = 'DOCUMENTS_PENDING';
  }

  await vCase.save();

  await auditLoggerService.logEvent({
    caseId: vCase._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'DOCUMENT_UPLOADED',
    targetType: 'Document',
    targetId: savedDoc._id,
    metadata: {
      type: savedDoc.type,
      sizeBytes: savedDoc.sizeBytes,
      sha256: savedDoc.sha256
    }
  });

  res.status(201).json(savedDoc);
});

// @desc    List documents for a case
// @route   GET /api/v1/cases/:caseId/documents
// @access  Private
const listDocuments = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const docs = await Document.find({ caseId: vCase._id }).sort('createdAt');
  res.status(200).json(docs);
});

// @desc    Get secure raw document content
// @route   GET /api/v1/cases/:caseId/documents/:documentId/content
// @access  Private
const getDocumentContent = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  const doc = await Document.findOne({
    _id: req.params.documentId,
    caseId: vCase._id
  });

  if (!doc) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Retrieve validated stored bytes from sandboxed storage
  const buffer = await storageService.getDocumentBuffer(vCase._id, doc.objectStorageKey);

  // Set required security and streaming headers (never leak localPath or storage key)
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  res.status(200).send(buffer);
});

// @desc    Get secure rendered page preview (PDF or image)
// @route   GET /api/v1/cases/:caseId/documents/:documentId/pages/:pageNumber/preview
// @access  Private
const getDocumentPagePreview = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  const doc = await Document.findOne({
    _id: req.params.documentId,
    caseId: vCase._id
  });

  if (!doc) {
    res.status(404);
    throw new Error('Document not found');
  }

  const pageNum = parseInt(req.params.pageNumber, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    res.status(404);
    throw new Error('Document page not found');
  }

  // Validate page number against document page count and MVP limit (3 pages)
  const actualPageCount = doc.pageCount || 1;
  if (pageNum > actualPageCount || pageNum > 3) {
    res.status(404);
    throw new Error('Document page not found');
  }

  const isPdf =
    doc.mimeType === 'application/pdf' ||
    (doc.originalFilename && doc.originalFilename.toLowerCase().endsWith('.pdf'));

  let previewBuffer;

  if (isPdf) {
    // Retrieve rendered page PNG preview (from cache or rendered on demand)
    previewBuffer = await pdfRenderingService.getPagePreview(
      vCase._id,
      doc._id,
      pageNum,
      async () => storageService.getDocumentBuffer(vCase._id, doc.objectStorageKey)
    );
  } else {
    // For single-page image documents, page 1 preview is the validated image buffer
    if (pageNum !== 1) {
      res.status(404);
      throw new Error('Document page not found');
    }
    previewBuffer = await storageService.getDocumentBuffer(vCase._id, doc.objectStorageKey);
  }

  if (!previewBuffer) {
    res.status(404);
    throw new Error('Document page not found');
  }

  // Set required security and streaming headers (never leak localPath or storage key)
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', previewBuffer.length);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  res.status(200).send(previewBuffer);
});

// @desc    Correct an extracted field (Human-in-the-Loop)
// @route   PATCH /api/v1/cases/:caseId/extracted-fields/:fieldId
// @access  Private (pharmacist, pharmacy, claims_reviewer, org_admin)
const correctExtractedField = asyncHandler(async (req, res) => {
  const allowedRoles = ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Access denied: Extracted field corrections are restricted to authorized healthcare staff.');
  }

  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const { normalizedValue } = req.body;

  if (typeof normalizedValue !== 'string' || normalizedValue.trim() === '') {
    res.status(400);
    throw new Error('A non-empty normalizedValue string is required for correction');
  }

  const field = await ExtractedField.findOne({ _id: req.params.fieldId, caseId: vCase._id });
  if (!field) {
    res.status(404);
    throw new Error('Extracted field not found');
  }

  const previousValue = field.normalizedValue;
  field.normalizedValue = normalizedValue.trim();
  field.needsCorrection = false;
  field.correctedBy = req.user._id;
  field.correctedAt = new Date();

  const savedField = await field.save();

  // Check if any other fields in this case still require correction
  const remainingNeedingCorrection = await ExtractedField.countDocuments({
    caseId: vCase._id,
    needsCorrection: true
  });

  if (remainingNeedingCorrection === 0 && vCase.status === 'NEEDS_CORRECTION') {
    vCase.status = 'READY_FOR_PROCESSING';
    await vCase.save();
  }

  await auditLoggerService.logEvent({
    caseId: vCase._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'EXTRACTED_FIELD_CORRECTED',
    targetType: 'ExtractedField',
    targetId: savedField._id,
    metadata: {
      fieldType: savedField.fieldType,
      previousValue,
      correctedValue: savedField.normalizedValue,
      remainingUncorrected: remainingNeedingCorrection
    }
  });

  res.status(200).json(savedField);
});

// @desc    Trigger TrustRAG processing pipeline
// @route   POST /api/v1/cases/:caseId/process
// @access  Private
const processCase = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  // The public POST /cases/:caseId/process endpoint must accept no processing options for this MVP.
  // Reject unexpected request-body fields with HTTP 400.
  if (req.body && Object.keys(req.body).length > 0) {
    res.status(400);
    throw new Error('Processing options in request body are prohibited for this MVP.');
  }

  try {
    const result = await trustRagOrchestrator.processCase(vCase._id, req.user);
    res.status(202).json(result);
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    throw err;
  }
});

// @desc    Get structured explainable results for a case
// @route   GET /api/v1/cases/:caseId/results
// @access  Private
const getResults = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  const [docs, fields, checks, signals, reviews, evidence, auditEvents] = await Promise.all([
    Document.find({ caseId: vCase._id }),
    ExtractedField.find({ caseId: vCase._id }),
    ConsistencyCheck.find({ caseId: vCase._id }),
    RiskSignal.find({ caseId: vCase._id }),
    ReviewDecision.find({ caseId: vCase._id }),
    EvidenceItem.find({ caseId: vCase._id }),
    AuditEvent.find({ caseId: vCase._id }).populate('actorId', 'name email role').sort('createdAt')
  ]);

  // Retrieve cached explanation or generate on demand
  const explanation = vCase.metadata?.explanation || await llmExplainabilityService.generateExplanation({
    vCase,
    documents: docs,
    fields,
    checks,
    signals,
    evidenceItems: evidence
  });

  const summary = {
    caseId: vCase._id,
    caseReference: vCase.caseReference,
    status: vCase.status,
    reviewRequired: vCase.reviewRequired,
    totalDocuments: docs.length,
    explanation,
    consistencyChecksSummary: {
      total: checks.length,
      passed: checks.filter(c => c.status === 'PASS').length,
      failed: checks.filter(c => c.status === 'FAIL').length,
      inconclusive: checks.filter(c => c.status === 'INCONCLUSIVE').length
    },
    riskSignalsCount: signals.length,
    activeSignals: signals.map(s => ({ signalType: s.signalType, severity: s.severity, description: s.description })),
    consistencyChecks: checks,
    extractedFields: fields,
    evidenceItems: evidence,
    reviewDecisions: reviews,
    auditTrail: auditEvents
  };

  res.status(200).json(summary);
});

// @desc    Get review queue (cases awaiting human review)
// @route   GET /api/v1/review-queue
// @access  Private (pharmacist, pharmacy, claims_reviewer, org_admin)
const getReviewQueue = asyncHandler(async (req, res) => {
  const allowedRoles = ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Access denied: Review queue is restricted to authorized healthcare staff and claims reviewers.');
  }

  if (req.user.role !== 'super_admin') {
    if (!req.tenantContext?.organizationId) {
      res.status(403);
      throw new Error('Staff user has no organization tenant context. Access denied.');
    }
  }

  const filter = {
    status: { $in: ['NEEDS_REVIEW', 'NEEDS_CORRECTION'] }
  };

  if (req.user.role !== 'super_admin' && req.tenantContext?.organizationId) {
    filter.organizationId = req.tenantContext.organizationId;
  }

  const queue = await VerificationCase.find(filter)
    .populate('createdBy', 'name email role')
    .sort('-updatedAt');

  res.status(200).json(queue);
});

// @desc    Submit a human review decision
// @route   POST /api/v1/cases/:caseId/reviews
// @access  Private (pharmacist, pharmacy, claims_reviewer, org_admin)
const submitReview = asyncHandler(async (req, res) => {
  const allowedRoles = ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Access denied: Only authorized pharmacists and claims reviewers can adjudicate cases.');
  }

  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);

  // Validate case is ready for human review
  if (!['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(vCase.status)) {
    res.status(400);
    throw new Error(`Cannot submit review for case in '${vCase.status}' status. Case must be in NEEDS_REVIEW or NEEDS_CORRECTION.`);
  }

  const { action, decision, reasonCode, notes, evidenceItemIds } = req.body;
  const rawAction = (action || decision || '').toUpperCase().trim();
  const mapping = REVIEW_ACTION_MAPPING[rawAction];

  if (!mapping) {
    res.status(400);
    throw new Error("Valid review action is required: 'VERIFY', 'RETURN_FOR_CORRECTION', or 'ESCALATE' (legacy 'APPROVE', 'REJECT', 'REQUEST_CLARIFICATION' supported)");
  }

  if (!reasonCode || typeof reasonCode !== 'string' || reasonCode.trim() === '') {
    res.status(400);
    throw new Error('A valid reasonCode is required to record a review decision');
  }

  // Create immutable ReviewDecision
  const reviewDecision = new ReviewDecision({
    caseId: vCase._id,
    reviewerId: req.user._id,
    decision: mapping.internalDecision,
    reasonCode: reasonCode.trim(),
    notes: notes || '',
    evidenceItemIds: evidenceItemIds || [],
    createdAt: new Date()
  });

  const savedDecision = await reviewDecision.save();

  // Update Case lifecycle based on decision
  vCase.status = mapping.newStatus;
  vCase.reviewRequired = mapping.reviewRequired;
  await vCase.save();

  // Record immutable Audit Event
  await auditLoggerService.logEvent({
    caseId: vCase._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'REVIEW_DECISION_RECORDED',
    targetType: 'ReviewDecision',
    targetId: savedDecision._id,
    metadata: {
      publicAction: mapping.label,
      decision: savedDecision.decision,
      reasonCode: savedDecision.reasonCode,
      newCaseStatus: vCase.status
    }
  });

  res.status(201).json({
    ...savedDecision.toJSON(),
    publicAction: mapping.label,
    newCaseStatus: vCase.status
  });
});

// @desc    List reviews for a case
// @route   GET /api/v1/cases/:caseId/reviews
// @access  Private
const listReviews = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const reviews = await ReviewDecision.find({ caseId: vCase._id }).sort('createdAt');
  res.status(200).json(reviews);
});

// @desc    Get evidence items for a case
// @route   GET /api/v1/cases/:caseId/evidence
// @access  Private
const getEvidence = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const evidence = await EvidenceItem.find({ caseId: vCase._id }).sort('retrievedAt');
  res.status(200).json(evidence);
});

// @desc    Export case as synthetic FHIR R4 Bundle
// @route   GET /api/v1/cases/:caseId/fhir-bundle
// @access  Private
const getFhirBundle = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const [docs, reviews, checks] = await Promise.all([
    Document.find({ caseId: vCase._id }),
    ReviewDecision.find({ caseId: vCase._id }),
    ConsistencyCheck.find({ caseId: vCase._id })
  ]);

  const fhirBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    id: `bundle-${vCase._id}`,
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${vCase._id}`,
        resource: {
          resourceType: 'Task',
          id: String(vCase._id),
          identifier: [{ system: 'https://pharmavault.example/cases', value: vCase.caseReference }],
          status: vCase.status.toLowerCase(),
          intent: 'order',
          description: 'TrustRAG Multi-Document Verification Case'
        }
      },
      ...docs.map(d => ({
        fullUrl: `urn:uuid:${d._id}`,
        resource: {
          resourceType: 'DocumentReference',
          id: String(d._id),
          status: 'current',
          description: `${d.type} upload`
        }
      }))
    ]
  };

  res.status(200).json(fhirBundle);
});

// @desc    Get readable audit trail for a case
// @route   GET /api/v1/cases/:caseId/audit-trail
// @access  Private
const getAuditTrail = asyncHandler(async (req, res) => {
  const vCase = await getAccessibleCase(req.params.caseId, req.user, req.tenantContext, res);
  const events = await AuditEvent.find({ caseId: vCase._id })
    .populate('actorId', 'name email role')
    .sort('createdAt');
  res.status(200).json(events);
});

module.exports = {
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
};
