const crypto = require('node:crypto');
const Document = require('../../models/documentModel');
const ExtractedField = require('../../models/extractedFieldModel');
const AuditEvent = require('../../models/auditEventModel');
const {
  RECOGNIZED_MEDICINE_SLOTS,
  MAX_MEDICINE_ITEMS,
  buildDocumentMedicineItems
} = require('./medicineItemContract');
const {
  reconcileMedicineDocuments,
  RULESET_VERSION,
  CATALOGUE_VERSION
} = require('./medicineReconciliationService');
const { buildProposedGroupsFromPersistedFields } = require('./localMedicineRowExtractor');
const {
  MUTABLE_EVIDENCE_STATUSES,
  REVIEWABLE_CASE_STATUSES,
  createControlledError,
  assertCaseMutableForEvidence,
  bumpCaseEvidenceRevision
} = require('./caseEvidenceMutationService');

const SESSION_3_SCHEMA_VERSION = '2.0.0-session3';
const SNAPSHOT_TOKEN_REGEX = /^rs_[a-f0-9]{64}$/;

const CORRECTION_ROLES = Object.freeze([
  'pharmacist',
  'pharmacy',
  'claims_reviewer',
  'org_admin'
]);

const REVIEW_ROLES = Object.freeze([
  'pharmacist',
  'pharmacy',
  'claims_reviewer',
  'org_admin',
  'super_admin'
]);

const ALLOWED_BLOCKER_CODES = Object.freeze([
  'DOCUMENTS_MISSING',
  'MULTIPLE_DOCUMENTS_UNSUPPORTED',
  'GROUPING_CONFIRMATION_REQUIRED',
  'GROUPING_STALE',
  'GROUPING_INVALID',
  'ITEM_LIMIT_EXCEEDED',
  'EXTRACTION_INCOMPLETE',
  'PAGE_COVERAGE_INCOMPLETE',
  'FIELD_CORRECTION_REQUIRED',
  'COMPARISON_MISMATCH',
  'COMPARISON_INSUFFICIENT',
  'CASE_NOT_REVIEWABLE',
  'LEGACY_FINDINGS_STALE',
  'UNSUPPORTED_LAYOUT'
]);

function isValidConfidence(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1;
}

function formatIsoOrNull(val) {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === 'string' && !Number.isNaN(Date.parse(val))) {
    return new Date(val).toISOString();
  }
  return null;
}

function deriveFieldNeedsCorrection(rawField) {
  const conf = isValidConfidence(rawField.extractionConfidence)
    ? rawField.extractionConfidence
    : null;
  const correctedBy = rawField.correctedBy ? String(rawField.correctedBy) : null;
  const correctedAt = formatIsoOrNull(rawField.correctedAt);
  const rawNeedsCorrection = rawField.needsCorrection === true;
  const hasCompleteCorrection = Boolean(correctedBy && correctedAt) && !rawNeedsCorrection;
  const hasPartialCorrection = Boolean(correctedBy) !== Boolean(correctedAt);
  const isLowConfidence = conf === null || conf < 0.75;

  return rawNeedsCorrection || hasPartialCorrection || (isLowConfidence && !hasCompleteCorrection);
}

function projectMedicineField(rawField, caseIdStr, docIdStr) {
  const conf = isValidConfidence(rawField.extractionConfidence)
    ? Number(rawField.extractionConfidence)
    : null;
  return {
    id: String(rawField._id || rawField.id),
    caseId: caseIdStr,
    documentId: docIdStr,
    fieldType: String(rawField.fieldType),
    rawValue: String(rawField.rawValue ?? ''),
    normalizedValue: String(rawField.normalizedValue ?? ''),
    pageNumber:
      Number.isInteger(rawField.pageNumber) && rawField.pageNumber >= 1
        ? rawField.pageNumber
        : 1,
    extractionConfidence: conf,
    needsCorrection: deriveFieldNeedsCorrection(rawField),
    correctedBy: rawField.correctedBy ? String(rawField.correctedBy) : null,
    correctedAt: formatIsoOrNull(rawField.correctedAt)
  };
}

function computeDocumentFieldSetFingerprint(doc, allDocFields, caseIdStr) {
  const docIdStr = String(doc._id || doc.id);
  const sortedFields = [...allDocFields]
    .map((f) => ({
      id: String(f._id || f.id),
      fieldType: String(f.fieldType),
      rawValue: String(f.rawValue ?? ''),
      normalizedValue: String(f.normalizedValue ?? ''),
      pageNumber: Number.isInteger(f.pageNumber) ? f.pageNumber : 1,
      extractionConfidence: isValidConfidence(f.extractionConfidence)
        ? Number(f.extractionConfidence)
        : null,
      needsCorrection: deriveFieldNeedsCorrection(f),
      correctedBy: f.correctedBy ? String(f.correctedBy) : null,
      correctedAt: formatIsoOrNull(f.correctedAt)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const payload = JSON.stringify({
    caseId: caseIdStr,
    documentId: docIdStr,
    documentType: doc.type,
    sha256: doc.sha256 || null,
    processingStatus: doc.processingStatus || 'PENDING',
    pageCount: doc.pageCount ?? null,
    processedPageCount: doc.processedPageCount ?? null,
    omittedPageCount: doc.omittedPageCount ?? null,
    fields: sortedFields
  });

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function sanitizeStoredGroups(rawGroups, projectedFields = null) {
  if (!Array.isArray(rawGroups)) return [];
  const rawOut = [];
  for (const g of rawGroups) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue;
    const anchorFieldId = typeof g.anchorFieldId === 'string' ? g.anchorFieldId.trim() : '';
    const fieldIds = Array.isArray(g.fieldIds)
      ? g.fieldIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())
      : [];
    if (anchorFieldId && fieldIds.length > 0) {
      rawOut.push({ anchorFieldId, fieldIds });
    }
  }

  if (!Array.isArray(projectedFields)) {
    return rawOut;
  }

  if (rawOut.length > MAX_MEDICINE_ITEMS) {
    return [];
  }

  const fieldMap = new Map(projectedFields.map((f) => [f.id, f]));
  const claimedFields = new Set();
  const anchors = new Set();
  const validOut = [];

  for (const group of rawOut) {
    if (
      !fieldMap.has(group.anchorFieldId) ||
      anchors.has(group.anchorFieldId) ||
      fieldMap.get(group.anchorFieldId).fieldType !== 'medicine_name' ||
      group.fieldIds.length === 0 ||
      group.fieldIds.length > 8 ||
      !group.fieldIds.includes(group.anchorFieldId)
    ) {
      return [];
    }
    anchors.add(group.anchorFieldId);
    const seenSlots = new Set();
    for (const fid of group.fieldIds) {
      if (!fieldMap.has(fid) || claimedFields.has(fid)) {
        return [];
      }
      const fieldObj = fieldMap.get(fid);
      if (seenSlots.has(fieldObj.fieldType)) {
        return [];
      }
      seenSlots.add(fieldObj.fieldType);
      claimedFields.add(fid);
    }
    validOut.push({
      anchorFieldId: group.anchorFieldId,
      fieldIds: [...group.fieldIds]
    });
  }

  return validOut;
}

function derivePermissions(user, caseStatus) {
  const role = user && typeof user.role === 'string' ? user.role : '';
  const canMutateEvidence =
    CORRECTION_ROLES.includes(role) && MUTABLE_EVIDENCE_STATUSES.includes(caseStatus);
  const canReview =
    REVIEW_ROLES.includes(role) && REVIEWABLE_CASE_STATUSES.includes(caseStatus);

  return {
    canCorrectFields: Boolean(canMutateEvidence),
    canConfirmGroups: Boolean(canMutateEvidence),
    canReview: Boolean(canReview)
  };
}

function computeSnapshotToken({
  caseId,
  caseStatus,
  evidenceRevision,
  documents,
  fields,
  groupingDocuments,
  prescription,
  invoice,
  comparison,
  canVerify,
  blockerCodes
}) {
  const canonicalDocs = [...documents]
    .map((d) => ({
      id: String(d._id || d.id),
      type: d.type,
      sha256: d.sha256 || null,
      processingStatus: d.processingStatus || 'PENDING',
      pageCount: d.pageCount ?? null,
      processedPageCount: d.processedPageCount ?? null,
      omittedPageCount: d.omittedPageCount ?? null,
      pageCoverage: d.pageCoverage || null,
      extractionBlockers: Array.isArray(d.metadata?.extractionBlockers)
        ? [...d.metadata.extractionBlockers].sort()
        : [],
      medicineGrouping: d.metadata?.medicineGrouping || null
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const canonicalFields = [...fields]
    .map((f) => ({
      id: String(f._id || f.id),
      documentId: String(f.documentId),
      fieldType: f.fieldType,
      rawValue: String(f.rawValue ?? ''),
      normalizedValue: String(f.normalizedValue ?? ''),
      pageNumber: f.pageNumber ?? 1,
      extractionConfidence: isValidConfidence(f.extractionConfidence)
        ? Number(f.extractionConfidence)
        : null,
      needsCorrection: deriveFieldNeedsCorrection(f),
      correctedBy: f.correctedBy ? String(f.correctedBy) : null,
      correctedAt: formatIsoOrNull(f.correctedAt),
      candidateRowKey: f.candidateRowKey || null
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const payload = JSON.stringify({
    schemaVersion: SESSION_3_SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    catalogueVersion: CATALOGUE_VERSION,
    caseId,
    caseStatus,
    evidenceRevision,
    documents: canonicalDocs,
    fields: canonicalFields,
    groupingDocuments: groupingDocuments.map((gd) => ({
      documentId: gd.documentId,
      documentType: gd.documentType,
      mode: gd.mode,
      observedItemCount: gd.observedItemCount,
      confirmedBy: gd.confirmedBy,
      confirmedAt: gd.confirmedAt,
      groups: gd.groups
    })),
    prescriptionItemIds: prescription ? prescription.medicineItems.map((i) => i.itemId) : null,
    prescriptionStatus: prescription ? prescription.groupingStatus : null,
    invoiceItemIds: invoice ? invoice.medicineItems.map((i) => i.itemId) : null,
    invoiceStatus: invoice ? invoice.groupingStatus : null,
    comparisonStatus: comparison ? comparison.status : null,
    comparisonSummary: comparison ? comparison.summary : null,
    canVerify,
    blockerCodes
  });

  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  return `rs_${digest}`;
}

/**
 * Evaluate a single PRESCRIPTION or PHARMACY_INVOICE document for grouping state,
 * Session 1 envelope, and document-specific blockers/notices.
 */
function evaluateMedicineDocument(doc, allDocFields, caseIdStr) {
  const docIdStr = String(doc._id || doc.id);
  const docType = doc.type;
  const processingStatus = doc.processingStatus || 'PENDING';

  const medicineFieldsRaw = allDocFields.filter((f) =>
    RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType)
  );
  const projectedMedicineFields = medicineFieldsRaw.map((f) =>
    projectMedicineField(f, caseIdStr, docIdStr)
  );

  const currentFingerprint = computeDocumentFieldSetFingerprint(doc, allDocFields, caseIdStr);
  const storedConfirmation =
    doc.metadata &&
    doc.metadata.medicineGrouping &&
    typeof doc.metadata.medicineGrouping === 'object'
      ? doc.metadata.medicineGrouping
      : null;

  const extractionBlockers = Array.isArray(doc.metadata?.extractionBlockers)
    ? doc.metadata.extractionBlockers
    : [];
  const detectedRowCount =
    typeof doc.metadata?.detectedRowCount === 'number'
      ? doc.metadata.detectedRowCount
      : medicineFieldsRaw.filter((f) => f.fieldType === 'medicine_name').length;

  const hasUnsupportedLayout =
    extractionBlockers.includes('UNSUPPORTED_LAYOUT') ||
    doc.metadata?.hasMultiPageConflict === true;
  const hasItemLimitExceeded =
    extractionBlockers.includes('ITEM_LIMIT_EXCEEDED') ||
    detectedRowCount > MAX_MEDICINE_ITEMS ||
    medicineFieldsRaw.filter((f) => f.fieldType === 'medicine_name').length > MAX_MEDICINE_ITEMS;
  const isUnprocessed = processingStatus !== 'PROCESSED';

  let mode = 'UNCONFIRMED';
  let observedItemCount = null;
  let confirmedBy = null;
  let confirmedAt = null;
  let groups = [];
  let envelope = null;
  let hasInvalidGrouping = false;

  if (storedConfirmation) {
    const storedGroups = sanitizeStoredGroups(storedConfirmation.groups, projectedMedicineFields);
    const storedObservedCount =
      Number.isInteger(storedConfirmation.observedItemCount) &&
      storedConfirmation.observedItemCount >= 1 &&
      storedConfirmation.observedItemCount <= MAX_MEDICINE_ITEMS
        ? storedConfirmation.observedItemCount
        : null;
    confirmedBy = storedConfirmation.confirmedBy ? String(storedConfirmation.confirmedBy) : null;
    confirmedAt = formatIsoOrNull(storedConfirmation.confirmedAt);
    observedItemCount = storedObservedCount;
    groups = storedGroups;

    const fingerprintMatches =
      typeof storedConfirmation.fieldSetFingerprint === 'string' &&
      storedConfirmation.fieldSetFingerprint === currentFingerprint;

    if (
      fingerprintMatches &&
      !isUnprocessed &&
      !hasUnsupportedLayout &&
      !hasItemLimitExceeded &&
      storedObservedCount !== null &&
      storedObservedCount >= 1 &&
      storedObservedCount <= MAX_MEDICINE_ITEMS &&
      storedGroups.length === storedObservedCount
    ) {
      const candidateEnvelope = buildDocumentMedicineItems({
        document: doc,
        extractedFields: allDocFields,
        groups: storedGroups
      });

      if (
        candidateEnvelope.groupingStatus === 'GROUPED' &&
        candidateEnvelope.medicineItems.length === storedObservedCount
      ) {
        mode = 'HUMAN_CONFIRMED';
        envelope = candidateEnvelope;
      } else {
        mode = 'STALE';
        hasInvalidGrouping = true;
        envelope = candidateEnvelope;
      }
    } else {
      mode = 'STALE';
      // Build envelope conservatively: if layout/limit/processing blocker or invalid groups, force unresolved
      if (isUnprocessed || hasUnsupportedLayout || hasItemLimitExceeded || storedGroups.length === 0) {
        envelope = buildDocumentMedicineItems({
          document: doc,
          extractedFields: allDocFields,
          groups: []
        });
      } else {
        const candidateEnvelope = buildDocumentMedicineItems({
          document: doc,
          extractedFields: allDocFields,
          groups: storedGroups
        });
        envelope = candidateEnvelope;
      }
    }
  } else {
    // No human confirmation yet; check for auto-proposed groups
    const rawProposedGroups =
      doc.metadata?.proposedMedicineGrouping?.groups ||
      buildProposedGroupsFromPersistedFields(allDocFields, {
        blockerCodes: extractionBlockers
      });
    const proposedGroups = sanitizeStoredGroups(rawProposedGroups, projectedMedicineFields);

    if (
      !isUnprocessed &&
      !hasUnsupportedLayout &&
      !hasItemLimitExceeded &&
      proposedGroups.length >= 1 &&
      proposedGroups.length <= MAX_MEDICINE_ITEMS
    ) {
      const candidateEnvelope = buildDocumentMedicineItems({
        document: doc,
        extractedFields: allDocFields,
        groups: proposedGroups
      });
      if (candidateEnvelope.groupingStatus === 'GROUPED') {
        mode = 'AUTO_PROPOSED';
        groups = proposedGroups;
        envelope = candidateEnvelope;
      } else {
        mode = 'UNCONFIRMED';
        groups = [];
        hasInvalidGrouping = true;
        envelope = candidateEnvelope;
      }
    } else if (isUnprocessed || hasUnsupportedLayout || hasItemLimitExceeded) {
      mode = 'UNCONFIRMED';
      groups = [];
      envelope = buildDocumentMedicineItems({
        document: doc,
        extractedFields: allDocFields,
        groups: []
      });
    } else {
      mode = 'UNCONFIRMED';
      groups = [];
      envelope = buildDocumentMedicineItems({
        document: doc,
        extractedFields: allDocFields
      });
    }
  }

  const groupingDocument = {
    documentId: docIdStr,
    documentType: docType,
    processingStatus,
    mode,
    observedItemCount,
    confirmedBy,
    confirmedAt,
    groups,
    fields: projectedMedicineFields
  };

  return {
    groupingDocument,
    envelope,
    hasUnsupportedLayout,
    hasItemLimitExceeded,
    isUnprocessed,
    hasInvalidGrouping
  };
}

/**
 * Build the current-case reconciliation snapshot without mutating the database.
 *
 * @param {Object} params
 * @param {Object} params.vCase - Loaded VerificationCase document
 * @param {Object} [params.user] - Request user for role-derived permissions
 * @returns {Promise<Object>} Session 3 Reconciliation Snapshot
 */
async function buildCaseReconciliationSnapshot({ vCase, user = null }) {
  const caseIdStr = String(vCase._id || vCase.id);
  const caseStatus = vCase.status;
  const evidenceRevision =
    typeof vCase.evidenceRevision === 'number' &&
    Number.isInteger(vCase.evidenceRevision) &&
    vCase.evidenceRevision >= 0
      ? vCase.evidenceRevision
      : 0;

  const [documents, fields] = await Promise.all([
    Document.find({ caseId: vCase._id }).sort({ createdAt: 1, _id: 1 }),
    ExtractedField.find({ caseId: vCase._id }).sort({ pageNumber: 1, _id: 1 })
  ]);

  const fieldsByDocId = new Map();
  for (const field of fields) {
    const dId = String(field.documentId);
    if (!fieldsByDocId.has(dId)) {
      fieldsByDocId.set(dId, []);
    }
    fieldsByDocId.get(dId).push(field);
  }

  const rxDocs = documents.filter((d) => d.type === 'PRESCRIPTION');
  const invDocs = documents.filter((d) => d.type === 'PHARMACY_INVOICE');
  const claimDocs = documents.filter((d) => d.type === 'CLAIM_FORM');

  const blockerSet = new Set();
  const notices = [];
  const seenNotices = new Set();

  function addNotice(code, documentId, message, isBlocker = true) {
    if (!ALLOWED_BLOCKER_CODES.includes(code)) return;
    if (isBlocker) {
      blockerSet.add(code);
    }
    const key = `${code}::${documentId || 'case'}`;
    if (!seenNotices.has(key)) {
      seenNotices.add(key);
      notices.push({
        code,
        documentId: documentId ? String(documentId) : null,
        message
      });
    }
  }

  // 1. Lifecycle reviewability check
  if (!REVIEWABLE_CASE_STATUSES.includes(caseStatus)) {
    addNotice(
      'CASE_NOT_REVIEWABLE',
      null,
      `Case is in "${caseStatus}" state; human verification decisions are only available in NEEDS_REVIEW or NEEDS_CORRECTION.`,
      true
    );
  }

  // 2. Document presence and multiplicity checks
  if (rxDocs.length === 0) {
    addNotice(
      'DOCUMENTS_MISSING',
      null,
      'A processed PRESCRIPTION document is required before verification.',
      true
    );
  }
  if (invDocs.length === 0) {
    addNotice(
      'DOCUMENTS_MISSING',
      null,
      'A processed PHARMACY_INVOICE document is required before verification.',
      true
    );
  }

  const hasMultipleDocs = rxDocs.length > 1 || invDocs.length > 1 || claimDocs.length > 1;
  if (hasMultipleDocs) {
    addNotice(
      'MULTIPLE_DOCUMENTS_UNSUPPORTED',
      null,
      'Multiple documents of the same type are uploaded on this case; single-prescription to single-invoice reconciliation cannot certify a subset.',
      true
    );
  }

  // 3. Evaluate all documents (including CLAIM_FORM) for processing status, coverage, and field corrections
  for (const doc of documents) {
    const docIdStr = String(doc._id);
    const docFields = fieldsByDocId.get(docIdStr) || [];

    if (doc.processingStatus !== 'PROCESSED') {
      addNotice(
        'EXTRACTION_INCOMPLETE',
        docIdStr,
        `${doc.type} document has processingStatus "${doc.processingStatus || 'PENDING'}" and has not completed OCR extraction.`,
        true
      );
    }

    const totalPages = doc.pageCount ?? doc.pageCoverage?.total ?? null;
    const processedPages = doc.processedPageCount ?? doc.pageCoverage?.processed ?? null;
    const omittedPages = doc.omittedPageCount ?? doc.pageCoverage?.omitted ?? 0;
    const covStatus = doc.pageCoverage?.status;

    if (
      omittedPages > 0 ||
      covStatus === 'INCOMPLETE' ||
      covStatus === 'UNKNOWN' ||
      (typeof totalPages === 'number' &&
        typeof processedPages === 'number' &&
        processedPages < totalPages)
    ) {
      addNotice(
        'PAGE_COVERAGE_INCOMPLETE',
        docIdStr,
        `${doc.type} document has incomplete or unknown page coverage (${processedPages ?? 0} of ${totalPages ?? '?'} page(s) processed).`,
        true
      );
    }

    if (docFields.some((f) => deriveFieldNeedsCorrection(f)) || doc.metadata?.needsHumanCorrection === true) {
      addNotice(
        'FIELD_CORRECTION_REQUIRED',
        docIdStr,
        `${doc.type} document has extracted field(s) with low confidence or pending human correction.`,
        true
      );
    }
  }

  // 4. Evaluate medicine documents (PRESCRIPTION & PHARMACY_INVOICE)
  const medicineDocs = [...rxDocs, ...invDocs];
  const groupingDocuments = [];
  let prescriptionEnvelope = null;
  let invoiceEnvelope = null;

  for (const doc of medicineDocs) {
    const docIdStr = String(doc._id);
    const docFields = fieldsByDocId.get(docIdStr) || [];
    const evalResult = evaluateMedicineDocument(doc, docFields, caseIdStr);
    const { groupingDocument, envelope } = evalResult;
    groupingDocuments.push(groupingDocument);

    if (doc.type === 'PRESCRIPTION' && rxDocs.length === 1) {
      prescriptionEnvelope = envelope;
    } else if (doc.type === 'PHARMACY_INVOICE' && invDocs.length === 1) {
      invoiceEnvelope = envelope;
    }

    if (
      evalResult.hasUnsupportedLayout ||
      envelope.issueCodes.includes('FLAT_MULTI_MEDICINE_VALUE') ||
      envelope.issueCodes.includes('MULTIPLE_FLAT_MEDICINE_NAMES')
    ) {
      addNotice(
        'UNSUPPORTED_LAYOUT',
        docIdStr,
        `${doc.type} document contains an unsupported or ambiguous medicine layout requiring manual correction.`,
        true
      );
    }

    if (
      evalResult.hasItemLimitExceeded ||
      envelope.issueCodes.includes('GROUP_LIMIT_EXCEEDED')
    ) {
      addNotice(
        'ITEM_LIMIT_EXCEEDED',
        docIdStr,
        `${doc.type} document exceeds the maximum supported limit of ${MAX_MEDICINE_ITEMS} medicine items.`,
        true
      );
    }

    if (
      ! envelope.coverage.isComplete ||
      envelope.issueCodes.includes('INCOMPLETE_PAGE_COVERAGE') ||
      envelope.issueCodes.includes('UNKNOWN_PAGE_COVERAGE') ||
      envelope.issueCodes.includes('CONTRADICTORY_PAGE_COVERAGE')
    ) {
      addNotice(
        'PAGE_COVERAGE_INCOMPLETE',
        docIdStr,
        `${doc.type} document page coverage is ${envelope.coverage.status}.`,
        true
      );
    }

    const medicineNameCount = groupingDocument.fields.filter(
      (f) => f.fieldType === 'medicine_name'
    ).length;
    if (
      evalResult.isUnprocessed ||
      groupingDocument.fields.length === 0 ||
      medicineNameCount === 0 ||
      envelope.issueCodes.includes('MISSING_MEDICINE_NAME') ||
      (doc.metadata?.extractionBlockers || []).includes('EXTRACTION_INCOMPLETE')
    ) {
      addNotice(
        'EXTRACTION_INCOMPLETE',
        docIdStr,
        `${doc.type} document does not have complete extracted medicine fields.`,
        true
      );
    }

    if (
      evalResult.hasInvalidGrouping ||
      envelope.issueCodes.some((c) =>
        [
          'INVALID_GROUP_STRUCTURE',
          'INVALID_GROUP_ANCHOR',
          'DUPLICATE_GROUP_ANCHOR',
          'DUPLICATE_FIELD_MEMBERSHIP',
          'INVALID_GROUP_MEMBERSHIP',
          'COMPETING_SLOT_VALUES',
          'UNGROUPED_MEDICINE_FIELD',
          'MISSING_REFERENCED_FIELD'
        ].includes(c)
      )
    ) {
      addNotice(
        'GROUPING_INVALID',
        docIdStr,
        `${doc.type} document has invalid or incomplete medicine item grouping.`,
        true
      );
    }

    if (groupingDocument.mode === 'STALE') {
      addNotice(
        'GROUPING_STALE',
        docIdStr,
        `${doc.type} medicine grouping is stale because document evidence or fields changed after confirmation.`,
        true
      );
    }

    if (groupingDocument.mode !== 'HUMAN_CONFIRMED') {
      addNotice(
        'GROUPING_CONFIRMATION_REQUIRED',
        docIdStr,
        `${doc.type} medicine item grouping and completeness must be confirmed by staff before verification.`,
        true
      );
    }

    if (envelope.medicineItems.some((item) => item.needsCorrection)) {
      addNotice(
        'FIELD_CORRECTION_REQUIRED',
        docIdStr,
        `${doc.type} has medicine item field(s) requiring human correction.`,
        true
      );
    }

    // Check if any grouped item is missing an essential slot (dosage_strength, dosage_form, quantity)
    if (
      envelope.medicineItems.some(
        (item) =>
          !item.fields.medicine_name ||
          !item.fields.dosage_strength ||
          !item.fields.dosage_form ||
          !item.fields.quantity
      )
    ) {
      addNotice(
        'EXTRACTION_INCOMPLETE',
        docIdStr,
        `${doc.type} medicine item is missing an essential field (medicine_name, dosage_strength, dosage_form, or quantity).`,
        true
      );
    }
  }

  // 5. Run Session 2 reconciliation when single prescription and/or single invoice envelopes exist
  let comparison = null;
  if (!hasMultipleDocs && (prescriptionEnvelope || invoiceEnvelope)) {
    comparison = reconcileMedicineDocuments({
      caseId: caseIdStr,
      prescription: prescriptionEnvelope,
      invoice: invoiceEnvelope
    });

    if (comparison.status === 'MISMATCH') {
      addNotice(
        'COMPARISON_MISMATCH',
        null,
        'Prescription and invoice medicine items have one or more clinical or quantity discrepancies.',
        true
      );
    } else if (
      comparison.hasInsufficientEvidence ||
      comparison.status === 'INSUFFICIENT_EVIDENCE' ||
      comparison.status === 'NEEDS_REVIEW' ||
      comparison.reviewRequired
    ) {
      addNotice(
        'COMPARISON_INSUFFICIENT',
        null,
        'Medicine reconciliation has insufficient or unconfirmed evidence and requires human review.',
        true
      );
    }
  } else {
    prescriptionEnvelope = null;
    invoiceEnvelope = null;
    addNotice(
      'COMPARISON_INSUFFICIENT',
      null,
      'Both a single processed prescription and a single processed invoice are required for reconciliation.',
      true
    );
  }

  // 6. Legacy findings currency check (always false in Session 3 contract)
  const bothHumanConfirmed =
    rxDocs.length === 1 &&
    invDocs.length === 1 &&
    groupingDocuments.length === 2 &&
    groupingDocuments.every((gd) => gd.mode === 'HUMAN_CONFIRMED');

  const legacyFindingsCurrent = false;
  addNotice(
    'LEGACY_FINDINGS_STALE',
    null,
    'Stored legacy case checks or explanations are provisional or stale relative to current grouping/evidence; rely on the live reconciliation snapshot.',
    false
  );

  // 7. Compute Verify eligibility & allowed actions
  const blockerCodes = Array.from(blockerSet);
  const canVerify = Boolean(
    REVIEWABLE_CASE_STATUSES.includes(caseStatus) &&
      !hasMultipleDocs &&
      rxDocs.length === 1 &&
      invDocs.length === 1 &&
      bothHumanConfirmed &&
      prescriptionEnvelope &&
      invoiceEnvelope &&
      prescriptionEnvelope.groupingStatus === 'GROUPED' &&
      invoiceEnvelope.groupingStatus === 'GROUPED' &&
      !prescriptionEnvelope.reviewRequired &&
      !invoiceEnvelope.reviewRequired &&
      comparison &&
      comparison.status === 'CONSISTENT' &&
      comparison.hasInsufficientEvidence === false &&
      comparison.reviewRequired === false &&
      blockerCodes.length === 0
  );

  const permissions = derivePermissions(user, caseStatus);
  let allowedActions = [];
  if (permissions.canReview) {
    allowedActions = canVerify
      ? ['VERIFY', 'RETURN_FOR_CORRECTION', 'ESCALATE']
      : ['RETURN_FOR_CORRECTION', 'ESCALATE'];
  }

  const snapshotToken = computeSnapshotToken({
    caseId: caseIdStr,
    caseStatus,
    evidenceRevision,
    documents,
    fields,
    groupingDocuments,
    prescription: prescriptionEnvelope,
    invoice: invoiceEnvelope,
    comparison,
    canVerify,
    blockerCodes
  });

  return {
    schemaVersion: SESSION_3_SCHEMA_VERSION,
    caseId: caseIdStr,
    caseStatus,
    snapshotToken,
    evidenceRevision,
    prescription: prescriptionEnvelope,
    invoice: invoiceEnvelope,
    comparison,
    groupingDocuments,
    permissions,
    reviewEligibility: {
      canVerify,
      blockerCodes,
      allowedActions
    },
    notices,
    legacyFindingsCurrent
  };
}

/**
 * Validate and persist staff-confirmed medicine groups for a specific case document,
 * bound to the current snapshotToken.
 */
async function confirmDocumentMedicineGroups({
  vCase,
  documentId,
  body,
  user
}) {
  const role = user && typeof user.role === 'string' ? user.role : '';
  if (!CORRECTION_ROLES.includes(role)) {
    throw createControlledError(
      403,
      'FORBIDDEN_ROLE',
      'Only authorized healthcare or review staff may confirm document medicine groups.'
    );
  }

  assertCaseMutableForEvidence(vCase, 'confirm medicine groups');

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createControlledError(
      400,
      'INVALID_GROUPING_PAYLOAD',
      'Request body must be a JSON object.'
    );
  }

  const allowedKeys = new Set([
    'snapshotToken',
    'observedItemCount',
    'completenessAttested',
    'groups'
  ]);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw createControlledError(
        400,
        'INVALID_GROUPING_PAYLOAD',
        `Unknown or prohibited property "${key}" in medicine-groups request.`
      );
    }
  }

  const { snapshotToken, observedItemCount, completenessAttested, groups } = body;

  if (typeof snapshotToken !== 'string' || !SNAPSHOT_TOKEN_REGEX.test(snapshotToken.trim())) {
    throw createControlledError(
      400,
      'INVALID_SNAPSHOT_TOKEN',
      'A valid snapshotToken (rs_<64 hex>) is required.'
    );
  }

  if (completenessAttested !== true) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      'completenessAttested must be true to confirm medicine groups.'
    );
  }

  if (typeof observedItemCount !== 'number' || !Number.isInteger(observedItemCount)) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      'observedItemCount must be an integer between 1 and 3.'
    );
  }

  if (observedItemCount > MAX_MEDICINE_ITEMS) {
    throw createControlledError(
      400,
      'ITEM_LIMIT_EXCEEDED',
      `observedItemCount (${observedItemCount}) exceeds the maximum supported limit of ${MAX_MEDICINE_ITEMS}.`
    );
  }

  if (observedItemCount < 1) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      'observedItemCount must be at least 1.'
    );
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      'groups must be a non-empty array of medicine item groups.'
    );
  }

  if (groups.length > MAX_MEDICINE_ITEMS) {
    throw createControlledError(
      400,
      'ITEM_LIMIT_EXCEEDED',
      `groups length (${groups.length}) exceeds the maximum supported limit of ${MAX_MEDICINE_ITEMS}.`
    );
  }

  if (groups.length !== observedItemCount) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      `groups length (${groups.length}) must match observedItemCount (${observedItemCount}).`
    );
  }

  const normalizedGroups = [];
  for (const rawGroup of groups) {
    if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
      throw createControlledError(
        400,
        'GROUPING_INVALID',
        'Each group must be a plain object with anchorFieldId and fieldIds.'
      );
    }
    const groupKeys = Object.keys(rawGroup);
    if (
      groupKeys.length !== 2 ||
      !groupKeys.includes('anchorFieldId') ||
      !groupKeys.includes('fieldIds')
    ) {
      throw createControlledError(
        400,
        'GROUPING_INVALID',
        'Each group object must contain only anchorFieldId and fieldIds.'
      );
    }
    if (typeof rawGroup.anchorFieldId !== 'string' || !rawGroup.anchorFieldId.trim()) {
      throw createControlledError(
        400,
        'GROUPING_INVALID',
        'Each group requires a non-empty string anchorFieldId.'
      );
    }
    if (
      !Array.isArray(rawGroup.fieldIds) ||
      rawGroup.fieldIds.length === 0 ||
      rawGroup.fieldIds.some((fid) => typeof fid !== 'string' || !fid.trim())
    ) {
      throw createControlledError(
        400,
        'GROUPING_INVALID',
        'Each group requires a non-empty array of string fieldIds.'
      );
    }
    normalizedGroups.push({
      anchorFieldId: rawGroup.anchorFieldId.trim(),
      fieldIds: rawGroup.fieldIds.map((fid) => fid.trim())
    });
  }

  const doc = await Document.findOne({ _id: documentId, caseId: vCase._id });
  if (!doc) {
    throw createControlledError(
      404,
      'DOCUMENT_NOT_FOUND',
      'Document not found for this verification case.'
    );
  }

  if (doc.type !== 'PRESCRIPTION' && doc.type !== 'PHARMACY_INVOICE') {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      `Medicine grouping is not supported for ${doc.type} documents.`
    );
  }

  // Verify snapshotToken matches current case state before applying changes
  const currentSnapshot = await buildCaseReconciliationSnapshot({ vCase, user });
  if (snapshotToken.trim() !== currentSnapshot.snapshotToken) {
    throw createControlledError(
      409,
      'STALE_REVIEW_SNAPSHOT',
      'Case evidence or grouping has changed since the provided snapshotToken was issued.'
    );
  }

  if (doc.processingStatus !== 'PROCESSED') {
    throw createControlledError(
      409,
      'EXTRACTION_INCOMPLETE',
      'Document must complete OCR extraction before confirming medicine groups.'
    );
  }

  const docBlockers = Array.isArray(doc.metadata?.extractionBlockers)
    ? doc.metadata.extractionBlockers
    : [];
  const detectedRows =
    typeof doc.metadata?.detectedRowCount === 'number' ? doc.metadata.detectedRowCount : 0;

  if (docBlockers.includes('ITEM_LIMIT_EXCEEDED') || detectedRows > MAX_MEDICINE_ITEMS) {
    throw createControlledError(
      400,
      'ITEM_LIMIT_EXCEEDED',
      `Document has ${detectedRows} detected medicine rows, exceeding the maximum supported limit of ${MAX_MEDICINE_ITEMS}.`
    );
  }

  if (docBlockers.includes('UNSUPPORTED_LAYOUT')) {
    throw createControlledError(
      400,
      'UNSUPPORTED_LAYOUT',
      'Document has an unsupported or ambiguous layout that cannot be confirmed without resolving field extraction.'
    );
  }

  if (detectedRows > observedItemCount) {
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      `observedItemCount (${observedItemCount}) cannot be smaller than detected medicine rows (${detectedRows}).`
    );
  }

  const docFields = await ExtractedField.find({
    caseId: vCase._id,
    documentId: doc._id
  }).sort({ pageNumber: 1, _id: 1 });

  const validationEnvelope = buildDocumentMedicineItems({
    document: doc,
    extractedFields: docFields,
    groups: normalizedGroups
  });

  if (validationEnvelope.issueCodes.includes('GROUP_LIMIT_EXCEEDED')) {
    throw createControlledError(
      400,
      'ITEM_LIMIT_EXCEEDED',
      'Document medicine groups exceed the maximum supported 3-item limit.'
    );
  }

  if (
    validationEnvelope.groupingStatus !== 'GROUPED' ||
    validationEnvelope.medicineItems.length !== observedItemCount
  ) {
    const primaryIssue = validationEnvelope.issues[0];
    throw createControlledError(
      400,
      'GROUPING_INVALID',
      primaryIssue
        ? primaryIssue.message
        : 'Provided medicine groups failed provenance or slot membership validation.',
      {
        issueCodes: validationEnvelope.issueCodes
      }
    );
  }

  const caseIdStr = String(vCase._id);
  const fieldSetFingerprint = computeDocumentFieldSetFingerprint(doc, docFields, caseIdStr);
  const confirmedAt = new Date().toISOString();

  doc.metadata = {
    ...(doc.metadata || {}),
    medicineGrouping: {
      mode: 'HUMAN_CONFIRMED',
      observedItemCount,
      completenessAttested: true,
      groups: normalizedGroups,
      confirmedBy: String(user._id),
      confirmedAt,
      fieldSetFingerprint
    }
  };
  if (typeof doc.markModified === 'function') {
    doc.markModified('metadata');
  }
  await doc.save();

  bumpCaseEvidenceRevision(vCase);
  await vCase.save();

  await AuditEvent.create({
    caseId: vCase._id,
    actorId: user._id,
    actorRole: user.role,
    action: 'GROUPING_CONFIRMED',
    targetType: 'Document',
    targetId: String(doc._id),
    metadata: {
      documentId: String(doc._id),
      documentType: doc.type,
      observedItemCount,
      groupCount: normalizedGroups.length,
      evidenceRevision: vCase.evidenceRevision,
      fieldSetFingerprint
    }
  });

  return buildCaseReconciliationSnapshot({ vCase, user });
}

module.exports = {
  SESSION_3_SCHEMA_VERSION,
  SNAPSHOT_TOKEN_REGEX,
  CORRECTION_ROLES,
  REVIEW_ROLES,
  ALLOWED_BLOCKER_CODES,
  deriveFieldNeedsCorrection,
  computeDocumentFieldSetFingerprint,
  buildCaseReconciliationSnapshot,
  confirmDocumentMedicineGroups
};
