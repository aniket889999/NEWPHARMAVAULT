const crypto = require('node:crypto');

const SCHEMA_VERSION = '2.0.0-session1';
const MAX_MEDICINE_ITEMS = 3;

const RECOGNIZED_MEDICINE_SLOTS = Object.freeze([
  'medicine_name',
  'dosage_strength',
  'dosage_form',
  'release_type',
  'quantity',
  'quantity_unit',
  'pack_size',
  'pack_unit'
]);

const ESSENTIAL_MEDICINE_SLOTS = Object.freeze([
  'medicine_name',
  'dosage_strength',
  'dosage_form',
  'quantity'
]);

const DOCUMENT_LEVEL_FIELDS = Object.freeze([
  'prescription_date',
  'invoice_date',
  'claim_date',
  'total_amount',
  'claimed_amount',
  'prescriber_name',
  'pharmacy_name',
  'patient_name'
]);

const VALID_DOCUMENT_TYPES = Object.freeze([
  'PRESCRIPTION',
  'PHARMACY_INVOICE',
  'CLAIM_FORM'
]);

const GROUPING_STATUS = Object.freeze({
  GROUPED: 'GROUPED',
  LEGACY_SINGLE_ITEM: 'LEGACY_SINGLE_ITEM',
  UNRESOLVED: 'UNRESOLVED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

const COVERAGE_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  INCOMPLETE: 'INCOMPLETE',
  UNKNOWN: 'UNKNOWN',
  CONTRADICTORY: 'CONTRADICTORY'
});

const ISSUE_CODES = Object.freeze({
  INVALID_DOCUMENT_CONTEXT: 'INVALID_DOCUMENT_CONTEXT',
  UNSUPPORTED_DOCUMENT_TYPE: 'UNSUPPORTED_DOCUMENT_TYPE',
  CLAIM_FORM_GROUPING_NOT_APPLICABLE: 'CLAIM_FORM_GROUPING_NOT_APPLICABLE',
  INVALID_EXTRACTED_FIELDS: 'INVALID_EXTRACTED_FIELDS',
  CROSS_CASE_FIELD_REFERENCE: 'CROSS_CASE_FIELD_REFERENCE',
  CROSS_DOCUMENT_FIELD_REFERENCE: 'CROSS_DOCUMENT_FIELD_REFERENCE',
  INVALID_FIELD_PROVENANCE: 'INVALID_FIELD_PROVENANCE',
  MISSING_OR_INVALID_CONFIDENCE: 'MISSING_OR_INVALID_CONFIDENCE',
  INVALID_GROUP_STRUCTURE: 'INVALID_GROUP_STRUCTURE',
  EMPTY_GROUPS: 'EMPTY_GROUPS',
  GROUP_LIMIT_EXCEEDED: 'GROUP_LIMIT_EXCEEDED',
  MISSING_REFERENCED_FIELD: 'MISSING_REFERENCED_FIELD',
  INVALID_GROUP_ANCHOR: 'INVALID_GROUP_ANCHOR',
  DUPLICATE_GROUP_ANCHOR: 'DUPLICATE_GROUP_ANCHOR',
  DUPLICATE_FIELD_MEMBERSHIP: 'DUPLICATE_FIELD_MEMBERSHIP',
  INVALID_GROUP_MEMBERSHIP: 'INVALID_GROUP_MEMBERSHIP',
  COMPETING_SLOT_VALUES: 'COMPETING_SLOT_VALUES',
  UNGROUPED_MEDICINE_FIELD: 'UNGROUPED_MEDICINE_FIELD',
  MISSING_MEDICINE_NAME: 'MISSING_MEDICINE_NAME',
  MULTIPLE_FLAT_MEDICINE_NAMES: 'MULTIPLE_FLAT_MEDICINE_NAMES',
  FLAT_MULTI_MEDICINE_VALUE: 'FLAT_MULTI_MEDICINE_VALUE',
  INCOMPLETE_PAGE_COVERAGE: 'INCOMPLETE_PAGE_COVERAGE',
  UNKNOWN_PAGE_COVERAGE: 'UNKNOWN_PAGE_COVERAGE',
  CONTRADICTORY_PAGE_COVERAGE: 'CONTRADICTORY_PAGE_COVERAGE'
});

const SAFE_ID_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

const STANDALONE_MEDICINE_FAMILY_TERMS = [
  ['crocin', 'dolo', 'calpol', 'pacimol', 'paracetamol'],
  ['glycomet', 'obimet', 'glucophage', 'cetapin', 'metformin'],
  ['okacet', 'cetzine', 'alerid', 'zyrtec', 'cetirizine'],
  ['azee', 'azithral', 'zady', 'zithromax', 'azithromycin'],
  ['pan', 'pantocid', 'pantodac', 'protonix', 'pantoprazole'],
  ['augmentin', 'moxclav', 'clavam', 'amoxyclav', 'amoxicillin'],
  ['atorva', 'storvas', 'lipikind', 'lipitor', 'atorvastatin'],
  ['losar', 'repace', 'tozaar', 'cozaar', 'losartan'],
  ['omez', 'ocid', 'omecip', 'prilosec', 'omeprazole'],
  ['ibuprofen', 'brufen', 'diclofenac', 'voveran', 'aceclofenac', 'zerodol', 'naproxen', 'aspirin']
];

/**
 * Safely read raw property from a plain object or Mongoose document without calling .toObject()
 * (avoids triggering Mongoose schema transforms that synthesize default pageCoverage).
 */
function getRawProp(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (obj._doc && typeof obj._doc === 'object' && Object.prototype.hasOwnProperty.call(obj._doc, key)) {
    return obj._doc[key];
  }
  return obj[key];
}

/**
 * Convert an ID value (string or ObjectId-like) into a safe string ID.
 */
function normalizeId(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return SAFE_ID_PATTERN.test(trimmed) ? trimmed : null;
  }
  if (typeof val === 'object' && typeof val.toString === 'function') {
    const str = String(val.toString()).trim();
    return SAFE_ID_PATTERN.test(str) ? str : null;
  }
  return null;
}

/**
 * Generate an opaque, deterministic server-side medicine item ID from document identity
 * and stable anchor field identity. Never uses medicine text, group array index,
 * client-supplied itemId, or storage path.
 */
function deriveMedicineItemId({ caseId, documentId, anchorFieldId }) {
  const payload = `pharmavault:medicine-item:v1:${String(caseId)}:${String(documentId)}:${String(anchorFieldId)}`;
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `mi_${digest}`;
}

/**
 * Conservatively detect whether a single medicine_name value actually encodes
 * multiple medicines (e.g., comma/semicolon/newline list, numbered items,
 * multiple dosage forms, dual strength clauses, or multiple drug families joined
 * in a single flat field). Does not use a partner-word allowlist to certify
 * unverified flat lists as one fixed-dose product.
 */
function isFlatMultiMedicineText(rawValue, normalizedValue) {
  const candidates = [rawValue, normalizedValue].filter(v => typeof v === 'string' && v.trim().length > 0);
  for (const text of candidates) {
    const trimmed = text.trim();

    // 1. Explicit list delimiters: comma, semicolon, newline, pipe
    if (/[,;\n\r|]/.test(trimmed)) {
      return true;
    }

    // 2. Numbered or bulleted inline list: "1. Dolo 650 2. Azee 500" or "1) ... 2) ..."
    if (/(?:^|\s)(?:1[.)]|\(1\)|\[1\])\s*\S+[\s\S]*?(?:2[.)]|\(2\)|\[2\])\s*\S+/i.test(trimmed)) {
      return true;
    }

    // 3. Multiple dosage form prefixes in a single line: e.g. "Tab Dolo 650 + Cap Omez 20"
    if (
      /\b(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrups?|inj(?:ection)?s?|susp(?:ension)?s?|drops?)\.?\s+[A-Za-z0-9][\w\s.-]*?(?:\+|&|\band\b|\/)\s*(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrups?|inj(?:ection)?s?|susp(?:ension)?s?|drops?)\.?\s+[A-Za-z0-9]/i.test(
        trimmed
      )
    ) {
      return true;
    }

    // 4. Two separate "<Name> <Strength>" clauses joined by +, &, "and", or /
    // Never exempt based on a partner-word heuristic.
    if (
      /\b([A-Za-z][A-Za-z0-9\s-]{2,25}?)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\s*(?:\+|&|\band\b|\/)\s*([A-Za-z][A-Za-z0-9\s-]{2,25}?)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\b/i.test(
        trimmed
      )
    ) {
      return true;
    }

    // 5. Multiple distinct standalone medicine families joined by "and", "&", "+", or "/"
    if (/(?:\+|&|\band\b|\/)/i.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      let matchedFamilies = 0;
      for (const family of STANDALONE_MEDICINE_FAMILY_TERMS) {
        if (family.some(term => new RegExp(`\\b${term}\\b`, 'i').test(lower))) {
          matchedFamilies += 1;
        }
      }
      if (matchedFamilies >= 2) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Sanitize optional resolution sub-object on a linked field without spreading arbitrary keys.
 */
function sanitizeResolution(resolution) {
  if (resolution === undefined || resolution === null) return null;
  if (typeof resolution !== 'object' || Array.isArray(resolution)) return null;

  const resolved = typeof resolution.resolved === 'boolean' ? resolution.resolved : false;
  const ambiguous = typeof resolution.ambiguous === 'boolean' ? resolution.ambiguous : false;
  const matchScore =
    typeof resolution.matchScore === 'number' &&
    Number.isFinite(resolution.matchScore) &&
    resolution.matchScore >= 0 &&
    resolution.matchScore <= 1
      ? resolution.matchScore
      : 0;
  const matchBasis = typeof resolution.matchBasis === 'string' ? resolution.matchBasis : 'None';
  const rawQuery = typeof resolution.rawQuery === 'string' ? resolution.rawQuery : '';

  let canonical = null;
  if (resolution.canonical && typeof resolution.canonical === 'object' && !Array.isArray(resolution.canonical)) {
    const rawCanon = resolution.canonical;
    if (typeof rawCanon.genericName === 'string' && rawCanon.genericName.trim().length > 0) {
      canonical = {
        genericName: rawCanon.genericName
      };
      if (typeof rawCanon.brandName === 'string') canonical.brandName = rawCanon.brandName;
      if (typeof rawCanon.strength === 'string') canonical.strength = rawCanon.strength;
      if (typeof rawCanon.strengthUnit === 'string') canonical.strengthUnit = rawCanon.strengthUnit;
      if (typeof rawCanon.dosageForm === 'string') canonical.dosageForm = rawCanon.dosageForm;
      if (typeof rawCanon.manufacturer === 'string') canonical.manufacturer = rawCanon.manufacturer;
      if (Array.isArray(rawCanon.regulatoryIdentifiers)) {
        canonical.regulatoryIdentifiers = rawCanon.regulatoryIdentifiers.filter(x => typeof x === 'string');
      }
      if (typeof rawCanon.sourceVersion === 'string') canonical.sourceVersion = rawCanon.sourceVersion;
      if (typeof rawCanon.catalogueVersion === 'string') canonical.catalogueVersion = rawCanon.catalogueVersion;
      if (typeof rawCanon.sourceNote === 'string') canonical.sourceNote = rawCanon.sourceNote;
      if (Array.isArray(rawCanon.aliases)) {
        canonical.aliases = rawCanon.aliases.filter(x => typeof x === 'string');
      }
    }
  }

  const out = {
    resolved,
    ambiguous,
    matchScore,
    matchBasis,
    canonical,
    rawQuery
  };
  if (typeof resolution.sourceNote === 'string') out.sourceNote = resolution.sourceNote;
  if (typeof resolution.catalogueVersion === 'string') out.catalogueVersion = resolution.catalogueVersion;
  return out;
}

/**
 * Evaluate document page coverage conservatively without inventing counts or trusting
 * a COMPLETE label when processed < total.
 */
function evaluateCoverage(document, validFieldsForDoc = []) {
  const issues = [];
  const rawPageCoverage = getRawProp(document, 'pageCoverage');
  const topTotal = getRawProp(document, 'pageCount');
  const topProcessed = getRawProp(document, 'processedPageCount');
  const topOmitted = getRawProp(document, 'omittedPageCount');

  const hasCovObj = Boolean(rawPageCoverage && typeof rawPageCoverage === 'object' && !Array.isArray(rawPageCoverage));
  const covTotal = hasCovObj ? getRawProp(rawPageCoverage, 'total') : undefined;
  const covProcessed = hasCovObj ? getRawProp(rawPageCoverage, 'processed') : undefined;
  const covOmitted = hasCovObj ? getRawProp(rawPageCoverage, 'omitted') : undefined;
  const rawStatus = hasCovObj ? getRawProp(rawPageCoverage, 'status') : undefined;

  const reportedStatus = rawStatus === 'COMPLETE' || rawStatus === 'INCOMPLETE' ? rawStatus : null;
  const hasInvalidStatusLabel =
    rawStatus !== undefined && rawStatus !== null && rawStatus !== 'COMPLETE' && rawStatus !== 'INCOMPLETE';

  let hasTopVsNestedMismatch = false;
  if (topTotal !== undefined && covTotal !== undefined && topTotal !== covTotal) {
    hasTopVsNestedMismatch = true;
  }
  if (topProcessed !== undefined && covProcessed !== undefined && topProcessed !== covProcessed) {
    hasTopVsNestedMismatch = true;
  }
  if (topOmitted !== undefined && covOmitted !== undefined && topOmitted !== covOmitted) {
    hasTopVsNestedMismatch = true;
  }

  const totalCandidate = covTotal !== undefined ? covTotal : topTotal;
  const processedCandidate = covProcessed !== undefined ? covProcessed : topProcessed;
  const omittedCandidate = covOmitted !== undefined ? covOmitted : topOmitted;

  const isValidTotal = typeof totalCandidate === 'number' && Number.isInteger(totalCandidate) && totalCandidate >= 1;
  const isValidProcessed =
    typeof processedCandidate === 'number' && Number.isInteger(processedCandidate) && processedCandidate >= 0;
  const isValidOmitted =
    omittedCandidate === undefined ||
    omittedCandidate === null ||
    (typeof omittedCandidate === 'number' && Number.isInteger(omittedCandidate) && omittedCandidate >= 0);

  const safeTotal = isValidTotal ? totalCandidate : null;
  const safeProcessed = isValidProcessed ? processedCandidate : null;
  let safeOmitted =
    typeof omittedCandidate === 'number' && Number.isInteger(omittedCandidate) && omittedCandidate >= 0
      ? omittedCandidate
      : null;

  const isMissingCoreCounts =
    (totalCandidate === undefined || totalCandidate === null) ||
    (processedCandidate === undefined || processedCandidate === null);

  if (isMissingCoreCounts && !hasTopVsNestedMismatch && !hasInvalidStatusLabel) {
    issues.push({
      code: ISSUE_CODES.UNKNOWN_PAGE_COVERAGE,
      severity: 'WARNING',
      message: 'Document page coverage is missing or incomplete; full page inspection cannot be verified.',
      fieldIds: []
    });
    return {
      coverage: {
        status: COVERAGE_STATUS.UNKNOWN,
        isComplete: false,
        total: safeTotal,
        processed: safeProcessed,
        omitted: safeOmitted,
        reportedStatus
      },
      issues
    };
  }

  const hasInvalidNumbers = !isValidTotal || !isValidProcessed || !isValidOmitted;
  const processedExceedsTotal = isValidTotal && isValidProcessed && safeProcessed > safeTotal;
  const omittedSumMismatch =
    isValidTotal &&
    isValidProcessed &&
    safeOmitted !== null &&
    safeProcessed + safeOmitted !== safeTotal;

  if (safeOmitted === null && isValidTotal && isValidProcessed && safeProcessed <= safeTotal) {
    safeOmitted = safeTotal - safeProcessed;
  }

  const completeLabelButIncompleteCounts =
    reportedStatus === 'COMPLETE' &&
    isValidTotal &&
    isValidProcessed &&
    (safeProcessed < safeTotal || (safeOmitted !== null && safeOmitted > 0));

  const incompleteLabelButCompleteCounts =
    reportedStatus === 'INCOMPLETE' &&
    isValidTotal &&
    isValidProcessed &&
    safeProcessed === safeTotal &&
    (safeOmitted === 0 || safeOmitted === null);

  const outOfBoundsFields = validFieldsForDoc.filter(
    f =>
      (isValidTotal && f.pageNumber > safeTotal) ||
      (isValidProcessed && f.pageNumber > safeProcessed)
  );

  if (
    hasTopVsNestedMismatch ||
    hasInvalidStatusLabel ||
    hasInvalidNumbers ||
    processedExceedsTotal ||
    omittedSumMismatch ||
    completeLabelButIncompleteCounts ||
    incompleteLabelButCompleteCounts ||
    outOfBoundsFields.length > 0
  ) {
    issues.push({
      code: ISSUE_CODES.CONTRADICTORY_PAGE_COVERAGE,
      severity: 'ERROR',
      message:
        'Document page coverage metadata is contradictory (e.g. COMPLETE status with processed < total, mismatched counts, or field page numbers exceeding processed pages).',
      fieldIds: outOfBoundsFields.map(f => f.id)
    });

    if (isValidTotal && isValidProcessed && (safeProcessed < safeTotal || (safeOmitted !== null && safeOmitted > 0))) {
      issues.push({
        code: ISSUE_CODES.INCOMPLETE_PAGE_COVERAGE,
        severity: 'WARNING',
        message: `Only ${safeProcessed} of ${safeTotal} document page(s) were processed.`,
        fieldIds: []
      });
    }

    return {
      coverage: {
        status: COVERAGE_STATUS.CONTRADICTORY,
        isComplete: false,
        total: safeTotal,
        processed: safeProcessed,
        omitted: safeOmitted,
        reportedStatus
      },
      issues
    };
  }

  if (safeProcessed < safeTotal || (safeOmitted !== null && safeOmitted > 0)) {
    issues.push({
      code: ISSUE_CODES.INCOMPLETE_PAGE_COVERAGE,
      severity: 'WARNING',
      message: `Document coverage is incomplete: ${safeProcessed} of ${safeTotal} page(s) processed (${safeOmitted} omitted).`,
      fieldIds: []
    });
    return {
      coverage: {
        status: COVERAGE_STATUS.INCOMPLETE,
        isComplete: false,
        total: safeTotal,
        processed: safeProcessed,
        omitted: safeOmitted,
        reportedStatus
      },
      issues
    };
  }

  return {
    coverage: {
      status: COVERAGE_STATUS.COMPLETE,
      isComplete: true,
      total: safeTotal,
      processed: safeProcessed,
      omitted: 0,
      reportedStatus
    },
    issues
  };
}

/**
 * Validate and sanitize a single ExtractedField record without mutating the input object.
 */
function validateAndLinkField(rawField, expectedCaseId, expectedDocumentId) {
  if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) {
    return {
      ok: false,
      issue: {
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: 'Extracted field entry must be a non-null object.',
        fieldIds: []
      }
    };
  }

  const id = normalizeId(getRawProp(rawField, 'id') ?? getRawProp(rawField, '_id'));
  const fieldIds = id ? [id] : [];

  if (!id) {
    return {
      ok: false,
      issue: {
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: 'Extracted field is missing a valid server identifier.',
        fieldIds: []
      }
    };
  }

  const fieldCaseId = normalizeId(getRawProp(rawField, 'caseId'));
  if (!fieldCaseId || fieldCaseId !== expectedCaseId) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.CROSS_CASE_FIELD_REFERENCE,
        severity: 'ERROR',
        message: `Field "${id}" belongs to case "${fieldCaseId || 'missing'}" instead of document case "${expectedCaseId}".`,
        fieldIds
      }
    };
  }

  const fieldDocId = normalizeId(getRawProp(rawField, 'documentId'));
  if (!fieldDocId || fieldDocId !== expectedDocumentId) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.CROSS_DOCUMENT_FIELD_REFERENCE,
        severity: 'ERROR',
        message: `Field "${id}" belongs to document "${fieldDocId || 'missing'}" instead of "${expectedDocumentId}".`,
        fieldIds
      }
    };
  }

  const rawFieldType = getRawProp(rawField, 'fieldType');
  const fieldType = typeof rawFieldType === 'string' ? rawFieldType.trim() : '';
  if (!fieldType) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: `Field "${id}" is missing a valid fieldType.`,
        fieldIds
      }
    };
  }

  const rawValue = getRawProp(rawField, 'rawValue');
  if (typeof rawValue !== 'string' || (RECOGNIZED_MEDICINE_SLOTS.includes(fieldType) && rawValue.trim().length === 0)) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: `Field "${id}" (${fieldType}) has a missing or empty rawValue.`,
        fieldIds
      }
    };
  }

  const rawNormValue = getRawProp(rawField, 'normalizedValue');
  const normalizedValue = typeof rawNormValue === 'string' ? rawNormValue : '';

  const pageNumber = getRawProp(rawField, 'pageNumber');
  if (typeof pageNumber !== 'number' || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: `Field "${id}" (${fieldType}) has an invalid or missing pageNumber.`,
        fieldIds
      }
    };
  }

  // Strictly require server model's extractionConfidence in [0, 1]; never fabricate from confidenceScore
  const extractionConfidence = getRawProp(rawField, 'extractionConfidence');
  if (
    typeof extractionConfidence !== 'number' ||
    !Number.isFinite(extractionConfidence) ||
    extractionConfidence < 0 ||
    extractionConfidence > 1
  ) {
    return {
      ok: false,
      id,
      issue: {
        code: ISSUE_CODES.MISSING_OR_INVALID_CONFIDENCE,
        severity: 'ERROR',
        message: `Field "${id}" (${fieldType}) is missing a valid server extractionConfidence in [0, 1].`,
        fieldIds
      }
    };
  }

  // Preserve boundingBox only when supplied as a valid 4-number array; never invent [0,0,0,0]
  const rawBbox = getRawProp(rawField, 'boundingBox');
  let boundingBox = null;
  if (rawBbox !== undefined && rawBbox !== null) {
    if (
      !Array.isArray(rawBbox) ||
      rawBbox.length !== 4 ||
      !rawBbox.every(n => typeof n === 'number' && Number.isFinite(n))
    ) {
      return {
        ok: false,
        id,
        issue: {
          code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
          severity: 'ERROR',
          message: `Field "${id}" (${fieldType}) has a malformed boundingBox.`,
          fieldIds
        }
      };
    }
    boundingBox = [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]];
  }

  const rawMethod = getRawProp(rawField, 'extractionMethod');
  const extractionMethod = typeof rawMethod === 'string' && rawMethod.trim().length > 0 ? rawMethod.trim() : null;

  const rawCorrectedBy = getRawProp(rawField, 'correctedBy');
  let correctedBy = null;
  if (rawCorrectedBy !== undefined && rawCorrectedBy !== null) {
    correctedBy = normalizeId(rawCorrectedBy);
    if (!correctedBy) {
      return {
        ok: false,
        id,
        issue: {
          code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
          severity: 'ERROR',
          message: `Field "${id}" (${fieldType}) has an invalid correctedBy identifier.`,
          fieldIds
        }
      };
    }
  }

  const rawCorrectedAt = getRawProp(rawField, 'correctedAt');
  let correctedAt = null;
  if (rawCorrectedAt !== undefined && rawCorrectedAt !== null) {
    if (rawCorrectedAt instanceof Date && !Number.isNaN(rawCorrectedAt.getTime())) {
      correctedAt = rawCorrectedAt.toISOString();
    } else if (typeof rawCorrectedAt === 'string' && !Number.isNaN(Date.parse(rawCorrectedAt))) {
      correctedAt = new Date(rawCorrectedAt).toISOString();
    } else {
      return {
        ok: false,
        id,
        issue: {
          code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
          severity: 'ERROR',
          message: `Field "${id}" (${fieldType}) has an invalid correctedAt timestamp.`,
          fieldIds
        }
      };
    }
  }

  // Conservative derived correction/review flag:
  // 1. An explicit needsCorrection=true is never cleared automatically.
  // 2. Partial correction metadata (correctedBy without correctedAt or vice versa) requires review.
  // 3. Low confidence (< 0.75) requires review even if stored needsCorrection defaults to false,
  //    unless cleared by a coherent human correction marker pair (correctedBy + correctedAt) with needsCorrection !== true.
  const rawNeedsCorrection = getRawProp(rawField, 'needsCorrection');
  const hasCompleteCorrection = Boolean(correctedBy && correctedAt) && rawNeedsCorrection !== true;
  const hasPartialCorrection = Boolean(correctedBy) !== Boolean(correctedAt);
  const isLowConfidence = extractionConfidence < 0.75;
  const needsCorrection =
    rawNeedsCorrection === true ||
    hasPartialCorrection ||
    (isLowConfidence && !hasCompleteCorrection);

  const resolution = sanitizeResolution(getRawProp(rawField, 'resolution'));

  return {
    ok: true,
    id,
    fieldType,
    linkedField: {
      id,
      caseId: expectedCaseId,
      documentId: expectedDocumentId,
      fieldType,
      rawValue,
      normalizedValue,
      pageNumber,
      boundingBox,
      extractionMethod,
      extractionConfidence,
      needsCorrection,
      correctedBy,
      correctedAt,
      resolution
    }
  };
}

function createEmptySlotMap() {
  return {
    medicine_name: null,
    dosage_strength: null,
    dosage_form: null,
    release_type: null,
    quantity: null,
    quantity_unit: null,
    pack_size: null,
    pack_unit: null
  };
}

/**
 * Construct a single MedicineItem DTO from validated slot fields.
 */
function buildMedicineItemDto({ caseId, documentId, documentType, groupingMode, slotMap }) {
  const anchorField = slotMap.medicine_name;
  const anchorFieldId = anchorField.id;
  const itemId = deriveMedicineItemId({ caseId, documentId, anchorFieldId });

  const fieldIds = [];
  const pageSet = new Set();
  let needsCorrection = false;

  for (const slot of RECOGNIZED_MEDICINE_SLOTS) {
    const field = slotMap[slot];
    if (field) {
      fieldIds.push(field.id);
      pageSet.add(field.pageNumber);
      if (field.needsCorrection) {
        needsCorrection = true;
      }
    }
  }

  const pageNumbers = Array.from(pageSet).sort((a, b) => a - b);

  return {
    itemId,
    caseId,
    documentId,
    documentType,
    groupingMode,
    anchorFieldId,
    fieldIds,
    pageNumbers,
    needsCorrection,
    fields: {
      medicine_name: slotMap.medicine_name,
      dosage_strength: slotMap.dosage_strength || null,
      dosage_form: slotMap.dosage_form || null,
      release_type: slotMap.release_type || null,
      quantity: slotMap.quantity || null,
      quantity_unit: slotMap.quantity_unit || null,
      pack_size: slotMap.pack_size || null,
      pack_unit: slotMap.pack_unit || null
    }
  };
}

function itemHasMissingEssentialSlot(item) {
  return ESSENTIAL_MEDICINE_SLOTS.some(slot => item.fields[slot] === null);
}

/**
 * Deduplicate issues while preserving emission order.
 */
function finalizeIssues(issues) {
  const deduped = [];
  const seenKeys = new Set();
  const codeSet = new Set();

  for (const issue of issues) {
    const sortedFieldIds = Array.from(new Set(issue.fieldIds || []));
    const key = `${issue.code}::${sortedFieldIds.join(',')}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        fieldIds: sortedFieldIds
      });
    }
    codeSet.add(issue.code);
  }

  return {
    issues: deduped,
    issueCodes: Array.from(codeSet)
  };
}

/**
 * Build a pure, database/network-free document medicine-item contract envelope
 * over server-loaded extracted fields and optional trusted server grouping.
 *
 * @param {Object} params
 * @param {Object} params.document - Server-loaded Document record or plain object
 * @param {Array<Object>} params.extractedFields - Server-loaded ExtractedField records
 * @param {Array<Object>|null|undefined} [params.groups] - Optional server-derived medicine groups
 * @returns {Object} DocumentMedicineItemsEnvelope
 */
function buildDocumentMedicineItems({ document, extractedFields, groups } = {}) {
  const rawIssues = [];

  const docId = normalizeId(getRawProp(document, 'id') ?? getRawProp(document, '_id'));
  const caseId = normalizeId(getRawProp(document, 'caseId'));
  const rawDocType = getRawProp(document, 'type');
  const isValidDocType = typeof rawDocType === 'string' && VALID_DOCUMENT_TYPES.includes(rawDocType);
  const documentType = isValidDocType ? rawDocType : 'UNKNOWN';

  if (!document || typeof document !== 'object' || Array.isArray(document) || !docId || !caseId) {
    rawIssues.push({
      code: ISSUE_CODES.INVALID_DOCUMENT_CONTEXT,
      severity: 'ERROR',
      message: 'Document context is missing required server identity (id, caseId).',
      fieldIds: []
    });
  }

  if (!isValidDocType) {
    rawIssues.push({
      code: ISSUE_CODES.UNSUPPORTED_DOCUMENT_TYPE,
      severity: 'ERROR',
      message: `Unsupported or missing document type "${String(rawDocType ?? '')}".`,
      fieldIds: []
    });
  }

  const safeCaseId = caseId || 'unknown_case';
  const safeDocId = docId || 'unknown_document';

  if (!Array.isArray(extractedFields)) {
    rawIssues.push({
      code: ISSUE_CODES.INVALID_EXTRACTED_FIELDS,
      severity: 'ERROR',
      message: 'extractedFields must be an array of server-loaded field records.',
      fieldIds: []
    });

    const { coverage, issues: covIssues } = evaluateCoverage(document, []);
    const { issues, issueCodes } = finalizeIssues([...rawIssues, ...covIssues]);

    return {
      schemaVersion: SCHEMA_VERSION,
      caseId: safeCaseId,
      documentId: safeDocId,
      documentType,
      groupingStatus: documentType === 'CLAIM_FORM' ? GROUPING_STATUS.NOT_APPLICABLE : GROUPING_STATUS.UNRESOLVED,
      detectedGroupCount: 0,
      maxAllowedItems: MAX_MEDICINE_ITEMS,
      reviewRequired: true,
      coverage,
      medicineItems: [],
      issues,
      issueCodes
    };
  }

  // Validate all supplied extracted fields without mutating any input object
  const fieldById = new Map();
  const validFieldsForDoc = [];
  const invalidFieldIds = new Set();

  for (const rawField of extractedFields) {
    const validation = validateAndLinkField(rawField, safeCaseId, safeDocId);
    if (!validation.ok) {
      rawIssues.push(validation.issue);
      if (validation.id) {
        invalidFieldIds.add(validation.id);
      }
      continue;
    }

    if (fieldById.has(validation.id)) {
      rawIssues.push({
        code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
        severity: 'ERROR',
        message: `Duplicate extractedField ID "${validation.id}" encountered in input array.`,
        fieldIds: [validation.id]
      });
      invalidFieldIds.add(validation.id);
      continue;
    }

    fieldById.set(validation.id, validation);
    validFieldsForDoc.push(validation.linkedField);
  }

  // Evaluate document coverage
  const { coverage, issues: coverageIssues } = evaluateCoverage(document, validFieldsForDoc);

  // Requirement 5: Claim form returns no invented medicine items and NOT_APPLICABLE status
  if (documentType === 'CLAIM_FORM') {
    if (groups !== undefined && groups !== null) {
      if (!Array.isArray(groups) || groups.length > 0) {
        rawIssues.push({
          code: ISSUE_CODES.CLAIM_FORM_GROUPING_NOT_APPLICABLE,
          severity: 'WARNING',
          message: 'Medicine item grouping is not applicable to CLAIM_FORM documents; no medicine lines were created.',
          fieldIds: []
        });
      }
    }

    const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
    return {
      schemaVersion: SCHEMA_VERSION,
      caseId: safeCaseId,
      documentId: safeDocId,
      documentType: 'CLAIM_FORM',
      groupingStatus: GROUPING_STATUS.NOT_APPLICABLE,
      detectedGroupCount: 0,
      maxAllowedItems: MAX_MEDICINE_ITEMS,
      reviewRequired: issues.length > 0 || !coverage.isComplete,
      coverage,
      medicineItems: [],
      issues,
      issueCodes
    };
  }

  const hasFatalContextError = rawIssues.length > 0;

  // Branch A: Explicit server-supplied groups mode
  if (groups !== undefined && groups !== null) {
    if (!Array.isArray(groups)) {
      rawIssues.push({
        code: ISSUE_CODES.INVALID_GROUP_STRUCTURE,
        severity: 'ERROR',
        message: 'Supplied groups parameter must be an array of server-produced group descriptors.',
        fieldIds: []
      });
      const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
      return {
        schemaVersion: SCHEMA_VERSION,
        caseId: safeCaseId,
        documentId: safeDocId,
        documentType,
        groupingStatus: GROUPING_STATUS.UNRESOLVED,
        detectedGroupCount: 0,
        maxAllowedItems: MAX_MEDICINE_ITEMS,
        reviewRequired: true,
        coverage,
        medicineItems: [],
        issues,
        issueCodes
      };
    }

    if (groups.length === 0) {
      rawIssues.push({
        code: ISSUE_CODES.EMPTY_GROUPS,
        severity: 'ERROR',
        message: 'Explicit groups array is empty; cannot resolve document medicine items.',
        fieldIds: []
      });
      const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
      return {
        schemaVersion: SCHEMA_VERSION,
        caseId: safeCaseId,
        documentId: safeDocId,
        documentType,
        groupingStatus: GROUPING_STATUS.UNRESOLVED,
        detectedGroupCount: 0,
        maxAllowedItems: MAX_MEDICINE_ITEMS,
        reviewRequired: true,
        coverage,
        medicineItems: [],
        issues,
        issueCodes
      };
    }

    const totalMedicineNameFields = validFieldsForDoc.filter(f => f.fieldType === 'medicine_name').length;
    const detectedGroupCount = Math.max(groups.length, totalMedicineNameFields);

    if (groups.length > MAX_MEDICINE_ITEMS) {
      rawIssues.push({
        code: ISSUE_CODES.GROUP_LIMIT_EXCEEDED,
        severity: 'ERROR',
        message: `Document contains ${groups.length} medicine groups, exceeding the maximum supported limit of ${MAX_MEDICINE_ITEMS}.`,
        fieldIds: []
      });
    }

    const seenAnchors = new Set();
    const claimedFieldIds = new Set();
    const resolvedGroupSlotMaps = [];

    for (const rawGroup of groups) {
      if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
        rawIssues.push({
          code: ISSUE_CODES.INVALID_GROUP_STRUCTURE,
          severity: 'ERROR',
          message: 'Each group descriptor must be a non-null object.',
          fieldIds: []
        });
        continue;
      }

      const rawAnchorId =
        getRawProp(rawGroup, 'anchorFieldId') ??
        getRawProp(rawGroup, 'anchorId') ??
        getRawProp(rawGroup, 'medicineNameFieldId');
      const anchorFieldId = normalizeId(rawAnchorId);

      if (!anchorFieldId) {
        rawIssues.push({
          code: ISSUE_CODES.INVALID_GROUP_ANCHOR,
          severity: 'ERROR',
          message: 'Group is missing a valid anchorFieldId.',
          fieldIds: []
        });
        continue;
      }

      if (seenAnchors.has(anchorFieldId)) {
        rawIssues.push({
          code: ISSUE_CODES.DUPLICATE_GROUP_ANCHOR,
          severity: 'ERROR',
          message: `Anchor field "${anchorFieldId}" is referenced by multiple medicine groups.`,
          fieldIds: [anchorFieldId]
        });
      }
      seenAnchors.add(anchorFieldId);

      const rawMembersProp =
        getRawProp(rawGroup, 'fieldIds') !== undefined
          ? getRawProp(rawGroup, 'fieldIds')
          : getRawProp(rawGroup, 'memberFieldIds') !== undefined
          ? getRawProp(rawGroup, 'memberFieldIds')
          : getRawProp(rawGroup, 'memberIds');

      let memberIds = [];
      if (rawMembersProp === undefined) {
        memberIds = [anchorFieldId];
      } else if (!Array.isArray(rawMembersProp)) {
        rawIssues.push({
          code: ISSUE_CODES.INVALID_GROUP_STRUCTURE,
          severity: 'ERROR',
          message: `Group anchored by "${anchorFieldId}" has a non-array fieldIds property.`,
          fieldIds: [anchorFieldId]
        });
        continue;
      } else {
        const normalizedMembers = [];
        let hasInvalidMemberId = false;
        for (const m of rawMembersProp) {
          const normM = normalizeId(m);
          if (!normM) {
            hasInvalidMemberId = true;
          } else {
            normalizedMembers.push(normM);
          }
        }
        if (hasInvalidMemberId) {
          rawIssues.push({
            code: ISSUE_CODES.INVALID_GROUP_MEMBERSHIP,
            severity: 'ERROR',
            message: `Group anchored by "${anchorFieldId}" contains a malformed field ID.`,
            fieldIds: [anchorFieldId]
          });
        }

        const seenInRawMembers = new Set();
        for (const mId of normalizedMembers) {
          if (seenInRawMembers.has(mId)) {
            rawIssues.push({
              code: ISSUE_CODES.DUPLICATE_FIELD_MEMBERSHIP,
              severity: 'ERROR',
              message: `Field "${mId}" is listed multiple times within the same group.`,
              fieldIds: [mId]
            });
          }
          seenInRawMembers.add(mId);
        }

        memberIds = normalizedMembers.includes(anchorFieldId)
          ? normalizedMembers
          : [anchorFieldId, ...normalizedMembers];
      }

      const anchorEntry = fieldById.get(anchorFieldId);
      if (!anchorEntry) {
        if (!invalidFieldIds.has(anchorFieldId)) {
          rawIssues.push({
            code: ISSUE_CODES.MISSING_REFERENCED_FIELD,
            severity: 'ERROR',
            message: `Group anchor field "${anchorFieldId}" does not exist in extractedFields for this document.`,
            fieldIds: [anchorFieldId]
          });
        }
      } else if (anchorEntry.fieldType !== 'medicine_name') {
        rawIssues.push({
          code: ISSUE_CODES.INVALID_GROUP_ANCHOR,
          severity: 'ERROR',
          message: `Group anchor field "${anchorFieldId}" has fieldType "${anchorEntry.fieldType}" instead of "medicine_name".`,
          fieldIds: [anchorFieldId]
        });
      } else if (
        isFlatMultiMedicineText(anchorEntry.linkedField.rawValue, anchorEntry.linkedField.normalizedValue)
      ) {
        rawIssues.push({
          code: ISSUE_CODES.FLAT_MULTI_MEDICINE_VALUE,
          severity: 'ERROR',
          message: `Medicine name field "${anchorFieldId}" contains a flat multi-medicine string that cannot be safely trusted as a single medicine item.`,
          fieldIds: [anchorFieldId]
        });
      }

      const slotMap = createEmptySlotMap();

      for (const memberId of memberIds) {
        if (claimedFieldIds.has(memberId)) {
          rawIssues.push({
            code: ISSUE_CODES.DUPLICATE_FIELD_MEMBERSHIP,
            severity: 'ERROR',
            message: `Field "${memberId}" is claimed by multiple medicine groups.`,
            fieldIds: [memberId]
          });
        }
        claimedFieldIds.add(memberId);

        const memberEntry = fieldById.get(memberId);
        if (!memberEntry) {
          if (memberId !== anchorFieldId && !invalidFieldIds.has(memberId)) {
            rawIssues.push({
              code: ISSUE_CODES.MISSING_REFERENCED_FIELD,
              severity: 'ERROR',
              message: `Referenced member field "${memberId}" does not exist in extractedFields for this document.`,
              fieldIds: [memberId]
            });
          }
          continue;
        }

        const slot = memberEntry.fieldType;
        if (!RECOGNIZED_MEDICINE_SLOTS.includes(slot)) {
          rawIssues.push({
            code: ISSUE_CODES.INVALID_GROUP_MEMBERSHIP,
            severity: 'ERROR',
            message: `Field "${memberId}" has fieldType "${slot}", which is not a valid medicine item slot.`,
            fieldIds: [memberId]
          });
          continue;
        }

        if (slot === 'medicine_name' && memberId !== anchorFieldId) {
          rawIssues.push({
            code: ISSUE_CODES.COMPETING_SLOT_VALUES,
            severity: 'ERROR',
            message: `Group anchored by "${anchorFieldId}" includes a competing medicine_name field "${memberId}".`,
            fieldIds: [anchorFieldId, memberId]
          });
          continue;
        }

        if (slotMap[slot] !== null && slotMap[slot].id !== memberId) {
          rawIssues.push({
            code: ISSUE_CODES.COMPETING_SLOT_VALUES,
            severity: 'ERROR',
            message: `Group anchored by "${anchorFieldId}" has multiple competing fields for slot "${slot}" ("${slotMap[slot].id}", "${memberId}").`,
            fieldIds: [slotMap[slot].id, memberId]
          });
          continue;
        }

        slotMap[slot] = memberEntry.linkedField;
      }

      if (slotMap.medicine_name) {
        resolvedGroupSlotMaps.push(slotMap);
      }
    }

    // Check if any medicine-slot fields in extractedFields were left ungrouped
    const ungroupedMedicineFields = validFieldsForDoc.filter(
      f => RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType) && !claimedFieldIds.has(f.id)
    );
    if (ungroupedMedicineFields.length > 0) {
      rawIssues.push({
        code: ISSUE_CODES.UNGROUPED_MEDICINE_FIELD,
        severity: 'ERROR',
        message: `Document has ${ungroupedMedicineFields.length} medicine slot field(s) not assigned to any group.`,
        fieldIds: ungroupedMedicineFields.map(f => f.id)
      });
      if (totalMedicineNameFields > MAX_MEDICINE_ITEMS && groups.length <= MAX_MEDICINE_ITEMS) {
        rawIssues.push({
          code: ISSUE_CODES.GROUP_LIMIT_EXCEEDED,
          severity: 'ERROR',
          message: `Document contains ${totalMedicineNameFields} medicine_name fields, exceeding the maximum limit of ${MAX_MEDICINE_ITEMS}.`,
          fieldIds: validFieldsForDoc.filter(f => f.fieldType === 'medicine_name').map(f => f.id)
        });
      }
    }

    if (hasFatalContextError || rawIssues.length > 0) {
      const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
      return {
        schemaVersion: SCHEMA_VERSION,
        caseId: safeCaseId,
        documentId: safeDocId,
        documentType,
        groupingStatus: GROUPING_STATUS.UNRESOLVED,
        detectedGroupCount,
        maxAllowedItems: MAX_MEDICINE_ITEMS,
        reviewRequired: true,
        coverage,
        medicineItems: [],
        issues,
        issueCodes
      };
    }

    const medicineItems = resolvedGroupSlotMaps.map(slotMap =>
      buildMedicineItemDto({
        caseId: safeCaseId,
        documentId: safeDocId,
        documentType,
        groupingMode: GROUPING_STATUS.GROUPED,
        slotMap
      })
    );

    const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
    const anyItemNeedsCorrection = medicineItems.some(item => item.needsCorrection);
    const anyItemMissingEssentialSlot = medicineItems.some(item => itemHasMissingEssentialSlot(item));

    return {
      schemaVersion: SCHEMA_VERSION,
      caseId: safeCaseId,
      documentId: safeDocId,
      documentType,
      groupingStatus: GROUPING_STATUS.GROUPED,
      detectedGroupCount: medicineItems.length,
      maxAllowedItems: MAX_MEDICINE_ITEMS,
      reviewRequired:
        anyItemNeedsCorrection || anyItemMissingEssentialSlot || issues.length > 0 || !coverage.isComplete,
      coverage,
      medicineItems,
      issues,
      issueCodes
    };
  }

  // Branch B: Conservative Legacy Single-Item Adapter (groups omitted / null)
  const medicineNameFields = validFieldsForDoc.filter(f => f.fieldType === 'medicine_name');
  const detectedLegacyCount = medicineNameFields.length;

  const unrecognizedFields = validFieldsForDoc.filter(
    f => !RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType) && !DOCUMENT_LEVEL_FIELDS.includes(f.fieldType)
  );
  if (unrecognizedFields.length > 0) {
    rawIssues.push({
      code: ISSUE_CODES.INVALID_FIELD_PROVENANCE,
      severity: 'ERROR',
      message: `Unrecognized fieldType(s) encountered: ${unrecognizedFields.map(f => f.fieldType).join(', ')}.`,
      fieldIds: unrecognizedFields.map(f => f.id)
    });
  }

  if (medicineNameFields.length === 0) {
    rawIssues.push({
      code: ISSUE_CODES.MISSING_MEDICINE_NAME,
      severity: 'ERROR',
      message: 'No medicine_name field found in extractedFields.',
      fieldIds: []
    });
  } else if (medicineNameFields.length > 1) {
    rawIssues.push({
      code: ISSUE_CODES.MULTIPLE_FLAT_MEDICINE_NAMES,
      severity: 'ERROR',
      message: `Found ${medicineNameFields.length} flat medicine_name fields without explicit server grouping; refusing to guess item boundaries.`,
      fieldIds: medicineNameFields.map(f => f.id)
    });
    if (medicineNameFields.length > MAX_MEDICINE_ITEMS) {
      rawIssues.push({
        code: ISSUE_CODES.GROUP_LIMIT_EXCEEDED,
        severity: 'ERROR',
        message: `Found ${medicineNameFields.length} medicine_name fields, exceeding the ${MAX_MEDICINE_ITEMS}-item limit.`,
        fieldIds: medicineNameFields.map(f => f.id)
      });
    }
  } else {
    const singleMedField = medicineNameFields[0];
    if (isFlatMultiMedicineText(singleMedField.rawValue, singleMedField.normalizedValue)) {
      rawIssues.push({
        code: ISSUE_CODES.FLAT_MULTI_MEDICINE_VALUE,
        severity: 'ERROR',
        message: `Single medicine_name field "${singleMedField.id}" contains multi-medicine text ("${singleMedField.rawValue}"); refusing to split or fabricate items.`,
        fieldIds: [singleMedField.id]
      });
    }
  }

  const slotMap = createEmptySlotMap();
  slotMap.medicine_name = medicineNameFields.length === 1 ? medicineNameFields[0] : null;

  for (const slot of RECOGNIZED_MEDICINE_SLOTS) {
    if (slot === 'medicine_name') continue;
    const slotCandidates = validFieldsForDoc.filter(f => f.fieldType === slot);
    if (slotCandidates.length > 1) {
      rawIssues.push({
        code: ISSUE_CODES.COMPETING_SLOT_VALUES,
        severity: 'ERROR',
        message: `Found ${slotCandidates.length} competing "${slot}" fields in ungrouped document; refusing to select the first value silently.`,
        fieldIds: slotCandidates.map(f => f.id)
      });
    } else if (slotCandidates.length === 1) {
      slotMap[slot] = slotCandidates[0];
    }
  }

  if (hasFatalContextError || rawIssues.length > 0 || !slotMap.medicine_name) {
    const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
    return {
      schemaVersion: SCHEMA_VERSION,
      caseId: safeCaseId,
      documentId: safeDocId,
      documentType,
      groupingStatus: GROUPING_STATUS.UNRESOLVED,
      detectedGroupCount: detectedLegacyCount,
      maxAllowedItems: MAX_MEDICINE_ITEMS,
      reviewRequired: true,
      coverage,
      medicineItems: [],
      issues,
      issueCodes
    };
  }

  const singleItem = buildMedicineItemDto({
    caseId: safeCaseId,
    documentId: safeDocId,
    documentType,
    groupingMode: GROUPING_STATUS.LEGACY_SINGLE_ITEM,
    slotMap
  });

  const { issues, issueCodes } = finalizeIssues([...rawIssues, ...coverageIssues]);
  const missingEssentialSlot = itemHasMissingEssentialSlot(singleItem);

  return {
    schemaVersion: SCHEMA_VERSION,
    caseId: safeCaseId,
    documentId: safeDocId,
    documentType,
    groupingStatus: GROUPING_STATUS.LEGACY_SINGLE_ITEM,
    detectedGroupCount: 1,
    maxAllowedItems: MAX_MEDICINE_ITEMS,
    reviewRequired:
      singleItem.needsCorrection || missingEssentialSlot || issues.length > 0 || !coverage.isComplete,
    coverage,
    medicineItems: [singleItem],
    issues,
    issueCodes
  };
}

module.exports = {
  SCHEMA_VERSION,
  MAX_MEDICINE_ITEMS,
  RECOGNIZED_MEDICINE_SLOTS,
  ESSENTIAL_MEDICINE_SLOTS,
  DOCUMENT_LEVEL_FIELDS,
  GROUPING_STATUS,
  COVERAGE_STATUS,
  ISSUE_CODES,
  deriveMedicineItemId,
  isFlatMultiMedicineText,
  buildDocumentMedicineItems
};
