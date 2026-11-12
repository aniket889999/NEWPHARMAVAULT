'use strict';

const crypto = require('node:crypto');
const { ACADEMIC_MEDICINE_CATALOGUE } = require('../../data/academicMedicineCatalogue');
const {
  QUANTITY_STATUS,
  INVALID_RECONCILIATION_INPUT,
  getEffectiveFieldText,
  isFieldUncertain,
  classifyUnitToken,
  normalizeItemQuantity
} = require('./medicineQuantityService');

const RECONCILIATION_SCHEMA_VERSION = '2.0.0-session2';
const RECONCILIATION_RULESET_VERSION = 'academic-reconciliation/1.0.0';

const COMPARISON_STATUS = Object.freeze({
  CONSISTENT: 'CONSISTENT',
  MISMATCH: 'MISMATCH',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const CHECK_STATUS = Object.freeze({
  CONSISTENT: 'CONSISTENT',
  MISMATCH: 'MISMATCH',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

const COVERAGE_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  INCOMPLETE: 'INCOMPLETE',
  UNKNOWN: 'UNKNOWN',
  CONTRADICTORY: 'CONTRADICTORY',
  MISSING: 'MISSING'
});

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

const REASON_CODES = Object.freeze([
  'MISSING_DOCUMENT',
  'UNRESOLVED_GROUPING',
  'ITEM_LIMIT_EXCEEDED',
  'INCOMPLETE_PAGE_COVERAGE',
  'UNKNOWN_PAGE_COVERAGE',
  'CONTRADICTORY_PAGE_COVERAGE',
  'FIELD_NEEDS_CORRECTION',
  'UNKNOWN_MEDICINE',
  'AMBIGUOUS_MEDICINE',
  'IDENTITY_ATTRIBUTE_CONFLICT',
  'AMBIGUOUS_MATCH',
  'MISSING_INVOICE_ITEM',
  'EXTRA_INVOICE_ITEM',
  'STRENGTH_MISMATCH',
  'DOSAGE_FORM_MISMATCH',
  'RELEASE_TYPE_MISMATCH',
  'QUANTITY_MISMATCH',
  'MISSING_STRENGTH',
  'MISSING_DOSAGE_FORM',
  'MISSING_RELEASE_TYPE',
  'MISSING_QUANTITY',
  'UNKNOWN_QUANTITY_UNIT',
  'UNKNOWN_PACK_SIZE',
  'INCOMPATIBLE_QUANTITY_UNITS',
  'INVALID_QUANTITY',
  'UNSUPPORTED_STRENGTH_FORMAT',
  'UNSUPPORTED_PRODUCT_TYPE'
]);

const ALLOWED_REASON_SET = new Set(REASON_CODES);

const ENVELOPE_KEYS = Object.freeze([
  'schemaVersion',
  'caseId',
  'documentId',
  'documentType',
  'groupingStatus',
  'detectedGroupCount',
  'maxAllowedItems',
  'reviewRequired',
  'coverage',
  'medicineItems',
  'issues',
  'issueCodes'
]);

const COVERAGE_KEYS = Object.freeze([
  'status',
  'isComplete',
  'total',
  'processed',
  'omitted',
  'reportedStatus'
]);

const ITEM_KEYS = Object.freeze([
  'itemId',
  'caseId',
  'documentId',
  'documentType',
  'groupingMode',
  'anchorFieldId',
  'fieldIds',
  'pageNumbers',
  'needsCorrection',
  'fields'
]);

const LINKED_FIELD_KEYS = Object.freeze([
  'id',
  'caseId',
  'documentId',
  'fieldType',
  'rawValue',
  'normalizedValue',
  'pageNumber',
  'boundingBox',
  'extractionMethod',
  'extractionConfidence',
  'needsCorrection',
  'correctedBy',
  'correctedAt',
  'resolution'
]);

const ISSUE_KEYS = Object.freeze(['code', 'severity', 'message', 'fieldIds']);
const FORBIDDEN_STORAGE_KEYS = new Set(['objectStorageKey', 'localPath', 'storageRoot', 'storagePath']);

const SAFE_ID_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;
const ITEM_ID_PATTERN = /^mi_[a-f0-9]{24}$/;
const SCALAR_STRENGTH_PATTERN = /^(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|ml|iu)$/i;
const CONCENTRATION_STRENGTH_PATTERN = /^(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|iu)\s*\/\s*(\d+(?:\.\d+)?)?\s*(ml)$/i;

const DOSAGE_FORM_MAP = Object.freeze({
  tablet: 'tablet',
  tablets: 'tablet',
  tab: 'tablet',
  tabs: 'tablet',
  capsule: 'capsule',
  capsules: 'capsule',
  cap: 'capsule',
  caps: 'capsule',
  syrup: 'syrup',
  syrups: 'syrup',
  syp: 'syrup',
  suspension: 'suspension',
  suspensions: 'suspension',
  susp: 'suspension'
});

const RELEASE_TYPE_MAP = Object.freeze({
  ir: 'IR',
  'immediate release': 'IR',
  'immediate-release': 'IR',
  sr: 'SR',
  'sustained release': 'SR',
  'sustained-release': 'SR',
  er: 'ER',
  'extended release': 'ER',
  'extended-release': 'ER',
  xr: 'XR',
  xl: 'XL',
  cr: 'CR',
  'controlled release': 'CR',
  'controlled-release': 'CR',
  mr: 'MR',
  'modified release': 'MR',
  'modified-release': 'MR',
  dr: 'DR',
  'delayed release': 'DR',
  'delayed-release': 'DR',
  ec: 'EC',
  'enteric coated': 'EC',
  'enteric-coated': 'EC'
});

function createInvalidInputError() {
  const error = new Error('Invalid reconciliation input envelope or context.');
  error.code = INVALID_RECONCILIATION_INPUT;
  return error;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSafeId(value) {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value);
}

function hasExactKeys(obj, keys) {
  const objKeys = Object.keys(obj);
  return objKeys.length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(obj, k));
}

function containsForbiddenStorageKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(containsForbiddenStorageKey);
  }
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_STORAGE_KEYS.has(k)) return true;
    if (v && typeof v === 'object' && containsForbiddenStorageKey(v)) return true;
  }
  return false;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Deterministic row ID from caseId and scoped item identities.
 */
function deriveReconciliationRowId({ caseId, prescriptionItemId, invoiceItemId }) {
  const payload = `pharmavault:medicine-reconciliation-row:v1:${String(caseId)}:${prescriptionItemId || 'none'}:${invoiceItemId || 'none'}`;
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `mr_${digest}`;
}

function deriveExpectedMedicineItemId({ caseId, documentId, anchorFieldId }) {
  const payload = `pharmavault:medicine-item:v1:${String(caseId)}:${String(documentId)}:${String(anchorFieldId)}`;
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `mi_${digest}`;
}

/**
 * Validate a Session 1 DocumentMedicineItemsEnvelope for context, schema shape, and provenance integrity.
 * Throws INVALID_RECONCILIATION_INPUT with a generic message on any violation.
 */
function validateInputEnvelope(envelope, expectedCaseId, expectedDocumentType, usedItemIds, usedFieldIds) {
  if (!isPlainObject(envelope)) {
    throw createInvalidInputError();
  }
  if (!hasExactKeys(envelope, ENVELOPE_KEYS) || containsForbiddenStorageKey(envelope)) {
    throw createInvalidInputError();
  }
  if (
    envelope.schemaVersion !== '2.0.0-session1' ||
    envelope.caseId !== expectedCaseId ||
    !isSafeId(envelope.documentId) ||
    envelope.documentType !== expectedDocumentType ||
    envelope.maxAllowedItems !== 3 ||
    typeof envelope.reviewRequired !== 'boolean'
  ) {
    throw createInvalidInputError();
  }
  if (
    !['GROUPED', 'LEGACY_SINGLE_ITEM', 'UNRESOLVED'].includes(envelope.groupingStatus) ||
    !Number.isInteger(envelope.detectedGroupCount) ||
    envelope.detectedGroupCount < 0
  ) {
    throw createInvalidInputError();
  }
  if (
    !Array.isArray(envelope.medicineItems) ||
    envelope.medicineItems.length > 3 ||
    !Array.isArray(envelope.issues) ||
    !Array.isArray(envelope.issueCodes)
  ) {
    throw createInvalidInputError();
  }

  for (const issue of envelope.issues) {
    if (
      !isPlainObject(issue) ||
      !hasExactKeys(issue, ISSUE_KEYS) ||
      typeof issue.code !== 'string' ||
      !issue.code.trim() ||
      !['INFO', 'WARNING', 'ERROR'].includes(issue.severity) ||
      typeof issue.message !== 'string' ||
      !issue.message.trim() ||
      !Array.isArray(issue.fieldIds) ||
      !issue.fieldIds.every(isSafeId)
    ) {
      throw createInvalidInputError();
    }
  }
  if (
    !envelope.issueCodes.every(c => typeof c === 'string' && c.trim().length > 0) ||
    new Set(envelope.issueCodes).size !== envelope.issueCodes.length
  ) {
    throw createInvalidInputError();
  }
  if ((envelope.issues.length > 0 || envelope.issueCodes.length > 0) && !envelope.reviewRequired) {
    throw createInvalidInputError();
  }
  if (envelope.groupingStatus === 'UNRESOLVED' && (envelope.medicineItems.length !== 0 || !envelope.reviewRequired)) {
    throw createInvalidInputError();
  }
  if (envelope.groupingStatus === 'LEGACY_SINGLE_ITEM' && envelope.medicineItems.length !== 1) {
    throw createInvalidInputError();
  }
  if (envelope.groupingStatus === 'GROUPED' && envelope.medicineItems.length === 0) {
    throw createInvalidInputError();
  }
  if (envelope.groupingStatus !== 'UNRESOLVED' && envelope.detectedGroupCount !== envelope.medicineItems.length) {
    throw createInvalidInputError();
  }

  const cov = envelope.coverage;
  if (
    !isPlainObject(cov) ||
    !hasExactKeys(cov, COVERAGE_KEYS) ||
    !['COMPLETE', 'INCOMPLETE', 'UNKNOWN', 'CONTRADICTORY'].includes(cov.status) ||
    typeof cov.isComplete !== 'boolean'
  ) {
    throw createInvalidInputError();
  }
  if (
    ![cov.total, cov.processed, cov.omitted].every(n => n === null || (Number.isInteger(n) && n >= 0)) ||
    (cov.total !== null && cov.total < 1) ||
    ![null, 'COMPLETE', 'INCOMPLETE'].includes(cov.reportedStatus)
  ) {
    throw createInvalidInputError();
  }
  if (
    cov.status === 'COMPLETE' &&
    (!cov.isComplete ||
      cov.total === null ||
      cov.processed !== cov.total ||
      cov.omitted !== 0 ||
      cov.reportedStatus === 'INCOMPLETE')
  ) {
    throw createInvalidInputError();
  }
  if (cov.status !== 'COMPLETE' && (cov.isComplete || !envelope.reviewRequired)) {
    throw createInvalidInputError();
  }

  for (const item of envelope.medicineItems) {
    if (
      !isPlainObject(item) ||
      !hasExactKeys(item, ITEM_KEYS) ||
      typeof item.itemId !== 'string' ||
      !ITEM_ID_PATTERN.test(item.itemId) ||
      usedItemIds.has(item.itemId) ||
      item.caseId !== expectedCaseId ||
      item.documentId !== envelope.documentId ||
      item.documentType !== expectedDocumentType ||
      item.groupingMode !== envelope.groupingStatus ||
      !isSafeId(item.anchorFieldId) ||
      typeof item.needsCorrection !== 'boolean' ||
      !isPlainObject(item.fields) ||
      !hasExactKeys(item.fields, RECOGNIZED_MEDICINE_SLOTS)
    ) {
      throw createInvalidInputError();
    }
    const expectedItemId = deriveExpectedMedicineItemId({
      caseId: expectedCaseId,
      documentId: envelope.documentId,
      anchorFieldId: item.anchorFieldId
    });
    if (item.itemId !== expectedItemId) {
      throw createInvalidInputError();
    }
    usedItemIds.add(item.itemId);

    if (
      !Array.isArray(item.fieldIds) ||
      item.fieldIds.length === 0 ||
      item.fieldIds.length > 8 ||
      !item.fieldIds.every(isSafeId) ||
      new Set(item.fieldIds).size !== item.fieldIds.length
    ) {
      throw createInvalidInputError();
    }
    if (
      !Array.isArray(item.pageNumbers) ||
      item.pageNumbers.length === 0 ||
      !item.pageNumbers.every(p => Number.isInteger(p) && p >= 1) ||
      new Set(item.pageNumbers).size !== item.pageNumbers.length
    ) {
      throw createInvalidInputError();
    }

    const linkedIds = [];
    const linkedPages = new Set();

    for (const slot of RECOGNIZED_MEDICINE_SLOTS) {
      const f = item.fields[slot];
      if (f === null && slot !== 'medicine_name') continue;
      if (
        !isPlainObject(f) ||
        !hasExactKeys(f, LINKED_FIELD_KEYS) ||
        !isSafeId(f.id) ||
        usedFieldIds.has(f.id) ||
        f.caseId !== expectedCaseId ||
        f.documentId !== envelope.documentId ||
        f.fieldType !== slot
      ) {
        throw createInvalidInputError();
      }
      if (
        typeof f.rawValue !== 'string' ||
        !f.rawValue.trim() ||
        typeof f.normalizedValue !== 'string' ||
        !Number.isInteger(f.pageNumber) ||
        f.pageNumber < 1
      ) {
        throw createInvalidInputError();
      }
      if (cov.total !== null && f.pageNumber > cov.total) {
        throw createInvalidInputError();
      }
      if (f.extractionMethod !== null && (typeof f.extractionMethod !== 'string' || !f.extractionMethod.trim())) {
        throw createInvalidInputError();
      }
      if (
        typeof f.needsCorrection !== 'boolean' ||
        typeof f.extractionConfidence !== 'number' ||
        !Number.isFinite(f.extractionConfidence) ||
        f.extractionConfidence < 0 ||
        f.extractionConfidence > 1 ||
        (f.correctedBy !== null && !isSafeId(f.correctedBy))
      ) {
        throw createInvalidInputError();
      }
      if (f.correctedAt !== null && (typeof f.correctedAt !== 'string' || Number.isNaN(Date.parse(f.correctedAt)))) {
        throw createInvalidInputError();
      }
      if (!f.needsCorrection && (f.correctedBy !== null) !== (f.correctedAt !== null)) {
        throw createInvalidInputError();
      }
      if (!f.needsCorrection && f.extractionConfidence < 0.75 && (!f.correctedBy || !f.correctedAt)) {
        throw createInvalidInputError();
      }
      if (f.needsCorrection && (!item.needsCorrection || !envelope.reviewRequired)) {
        throw createInvalidInputError();
      }
      if (
        f.boundingBox !== null &&
        (!Array.isArray(f.boundingBox) ||
          f.boundingBox.length !== 4 ||
          !f.boundingBox.every(n => typeof n === 'number' && Number.isFinite(n)))
      ) {
        throw createInvalidInputError();
      }

      linkedIds.push(f.id);
      linkedPages.add(f.pageNumber);
      usedFieldIds.add(f.id);
    }

    const anchor = item.fields.medicine_name;
    if (
      !isPlainObject(anchor) ||
      anchor.id !== item.anchorFieldId ||
      linkedIds.length !== item.fieldIds.length ||
      !linkedIds.every(id => item.fieldIds.includes(id))
    ) {
      throw createInvalidInputError();
    }
    if (
      linkedPages.size !== item.pageNumbers.length ||
      !item.pageNumbers.every(p => linkedPages.has(p))
    ) {
      throw createInvalidInputError();
    }
    const missingEssential = ESSENTIAL_MEDICINE_SLOTS.some(s => item.fields[s] === null);
    if ((item.needsCorrection || missingEssential) && !envelope.reviewRequired) {
      throw createInvalidInputError();
    }
  }
}

function validateCatalogue(catalogue) {
  if (!Array.isArray(catalogue)) {
    throw createInvalidInputError();
  }
  for (const entry of catalogue) {
    if (!isPlainObject(entry) || typeof entry.genericName !== 'string' || !entry.genericName.trim()) {
      throw createInvalidInputError();
    }
  }
}

/**
 * Parse dosage_strength field conservatively without therapeutic equivalence or concentration conversion.
 */
function parseStrengthField(field) {
  if (!field) {
    return { status: 'MISSING', value: null, unitKey: null, canonical: null, needsCorrection: false };
  }
  const needsCorrection = isFieldUncertain(field);
  const raw = getEffectiveFieldText(field);
  if (!raw) {
    return { status: 'MISSING', value: null, unitKey: null, canonical: null, needsCorrection };
  }

  const scalarMatch = raw.match(SCALAR_STRENGTH_PATTERN);
  if (scalarMatch) {
    const val = Number(scalarMatch[1]);
    if (!Number.isFinite(val) || val <= 0 || val > 1000000) {
      return { status: 'UNSUPPORTED', value: null, unitKey: null, canonical: null, needsCorrection };
    }
    const rawUnit = scalarMatch[2].toLowerCase();
    const unitKey = rawUnit === 'gm' ? 'g' : rawUnit;
    return {
      status: 'VALID',
      kind: 'SCALAR',
      value: val,
      unitKey,
      canonical: `${val}${unitKey}`,
      needsCorrection
    };
  }

  const concMatch = raw.match(CONCENTRATION_STRENGTH_PATTERN);
  if (concMatch) {
    const num = Number(concMatch[1]);
    const den = concMatch[3] !== undefined ? Number(concMatch[3]) : 1;
    if (
      !Number.isFinite(num) ||
      num <= 0 ||
      num > 1000000 ||
      !Number.isFinite(den) ||
      den <= 0 ||
      den > 1000000
    ) {
      return { status: 'UNSUPPORTED', value: null, unitKey: null, canonical: null, needsCorrection };
    }
    const rawNumUnit = concMatch[2].toLowerCase();
    const numUnit = rawNumUnit === 'gm' ? 'g' : rawNumUnit;
    const denUnit = 'ml';
    const unitKey = `${numUnit}/${den}${denUnit}`;
    return {
      status: 'VALID',
      kind: 'CONCENTRATION',
      value: num,
      unitKey,
      canonical: `${num}${unitKey}`,
      needsCorrection
    };
  }

  return { status: 'UNSUPPORTED', value: null, unitKey: null, canonical: null, needsCorrection };
}

/**
 * Parse dosage_form field conservatively, keeping syrup and suspension distinct.
 */
function parseDosageFormField(field) {
  if (!field) {
    return { status: 'MISSING', canonical: null, needsCorrection: false };
  }
  const needsCorrection = isFieldUncertain(field);
  const raw = normalizeText(getEffectiveFieldText(field));
  if (!raw) {
    return { status: 'MISSING', canonical: null, needsCorrection };
  }
  if (Object.prototype.hasOwnProperty.call(DOSAGE_FORM_MAP, raw)) {
    return { status: 'VALID', canonical: DOSAGE_FORM_MAP[raw], needsCorrection };
  }
  return { status: 'UNSUPPORTED', canonical: null, needsCorrection };
}

/**
 * Parse release_type field conservatively, preserving distinctions (IR vs SR vs ER vs XR vs CR vs MR vs DR vs EC).
 */
function parseReleaseTypeField(field) {
  if (!field) {
    return { status: 'ABSENT', canonical: null, needsCorrection: false };
  }
  const needsCorrection = isFieldUncertain(field);
  const raw = normalizeText(getEffectiveFieldText(field));
  if (!raw) {
    return { status: 'ABSENT', canonical: null, needsCorrection };
  }
  const canonical = Object.prototype.hasOwnProperty.call(RELEASE_TYPE_MAP, raw)
    ? RELEASE_TYPE_MAP[raw]
    : raw.toUpperCase();
  return { status: 'VALID', canonical, needsCorrection };
}

/**
 * Freshly resolve an item's medicine_name against the supplied academic catalogue.
 * Never trusts cached field.resolution and never fills missing item attributes from the catalogue.
 */
function resolveItemIdentity(item, strengthProfile, formProfile, releaseProfile, catalogue) {
  const nameField = item.fields.medicine_name;
  const nameNeedsCorrection = isFieldUncertain(nameField);
  const queryText = getEffectiveFieldText(nameField);
  const normQuery = normalizeText(queryText);

  const identityReasonCodes = [];
  if (nameNeedsCorrection) {
    identityReasonCodes.push('FIELD_NEEDS_CORRECTION');
  }

  if (!normQuery) {
    identityReasonCodes.push('UNKNOWN_MEDICINE');
    return {
      resolved: false,
      genericName: null,
      genericKey: null,
      hasAttributeConflict: false,
      hasStrengthConflict: false,
      hasFormConflict: false,
      hasReleaseConflict: false,
      nameNeedsCorrection,
      identityReasonCodes
    };
  }

  const matchingRecords = catalogue.filter(rec => {
    if (normalizeText(rec.genericName) === normQuery) return true;
    if (typeof rec.brandName === 'string' && normalizeText(rec.brandName) === normQuery) return true;
    if (Array.isArray(rec.aliases) && rec.aliases.some(alias => normalizeText(alias) === normQuery)) return true;
    return false;
  });

  if (matchingRecords.length === 0) {
    identityReasonCodes.push('UNKNOWN_MEDICINE');
    return {
      resolved: false,
      genericName: null,
      genericKey: null,
      hasAttributeConflict: false,
      hasStrengthConflict: false,
      hasFormConflict: false,
      hasReleaseConflict: false,
      nameNeedsCorrection,
      identityReasonCodes
    };
  }

  const distinctGenerics = new Map();
  for (const rec of matchingRecords) {
    const gKey = normalizeText(rec.genericName);
    if (!distinctGenerics.has(gKey)) {
      distinctGenerics.set(gKey, rec.genericName.trim());
    }
  }

  if (distinctGenerics.size > 1) {
    identityReasonCodes.push('AMBIGUOUS_MEDICINE');
    return {
      resolved: false,
      genericName: null,
      genericKey: null,
      hasAttributeConflict: false,
      hasStrengthConflict: false,
      hasFormConflict: false,
      hasReleaseConflict: false,
      nameNeedsCorrection,
      identityReasonCodes
    };
  }

  const [genericKey, canonicalGenericName] = distinctGenerics.entries().next().value;

  // Check if matched product is an unsupported combination / product type outside single-ingredient scope
  const isUnsupportedProduct = matchingRecords.some(
    rec =>
      rec.supported === false ||
      rec.unsupportedProductType === true ||
      /[+/]/.test(String(rec.genericName || ''))
  );

  if (isUnsupportedProduct) {
    identityReasonCodes.push('UNSUPPORTED_PRODUCT_TYPE');
    return {
      resolved: false,
      genericName: canonicalGenericName,
      genericKey: null,
      hasAttributeConflict: false,
      hasStrengthConflict: false,
      hasFormConflict: false,
      hasReleaseConflict: false,
      nameNeedsCorrection,
      identityReasonCodes
    };
  }

  // Check brand/alias attribute conflict against extracted strength, form, and release
  let hasStrengthConflict = false;
  let hasFormConflict = false;
  let hasReleaseConflict = false;

  if (normQuery !== genericKey) {
    const recordsWithStrength = matchingRecords.filter(
      rec => typeof rec.strength === 'string' && rec.strength.trim().length > 0
    );
    if (strengthProfile.status === 'VALID' && recordsWithStrength.length > 0) {
      const anyStrengthMatches = recordsWithStrength.some(rec => {
        const parsedRecStrength = parseStrengthField({
          rawValue: rec.strength,
          normalizedValue: rec.strength
        });
        return parsedRecStrength.status === 'VALID' && parsedRecStrength.canonical === strengthProfile.canonical;
      });
      if (!anyStrengthMatches) {
        hasStrengthConflict = true;
      }
    }

    const recordsWithForm = matchingRecords.filter(
      rec => typeof rec.dosageForm === 'string' && rec.dosageForm.trim().length > 0
    );
    if (formProfile.status === 'VALID' && recordsWithForm.length > 0) {
      const anyFormMatches = recordsWithForm.some(rec => {
        const parsedRecForm = parseDosageFormField({
          rawValue: rec.dosageForm,
          normalizedValue: rec.dosageForm
        });
        return parsedRecForm.status === 'VALID' && parsedRecForm.canonical === formProfile.canonical;
      });
      if (!anyFormMatches) {
        hasFormConflict = true;
      }
    }

    const recordsWithRelease = matchingRecords.filter(
      rec => typeof rec.releaseType === 'string' && rec.releaseType.trim().length > 0
    );
    if (releaseProfile.status === 'VALID' && recordsWithRelease.length > 0) {
      const anyReleaseMatches = recordsWithRelease.some(rec => {
        const parsedRecRelease = parseReleaseTypeField({
          rawValue: rec.releaseType,
          normalizedValue: rec.releaseType
        });
        return parsedRecRelease.status === 'VALID' && parsedRecRelease.canonical === releaseProfile.canonical;
      });
      if (!anyReleaseMatches) {
        hasReleaseConflict = true;
      }
    }
  }

  const hasAttributeConflict = hasStrengthConflict || hasFormConflict || hasReleaseConflict;
  if (hasAttributeConflict) {
    identityReasonCodes.push('IDENTITY_ATTRIBUTE_CONFLICT');
  }

  // A medicine_name that still requires human correction or conflicts with its own extracted
  // attributes is not a confirmed identity and must not be used to prove another item missing/extra.
  const resolved = !nameNeedsCorrection && !hasAttributeConflict;

  return {
    resolved,
    genericName: canonicalGenericName,
    genericKey,
    hasAttributeConflict,
    hasStrengthConflict,
    hasFormConflict,
    hasReleaseConflict,
    nameNeedsCorrection,
    identityReasonCodes
  };
}

function buildItemProfile(item, catalogue) {
  const strength = parseStrengthField(item.fields.dosage_strength);
  const form = parseDosageFormField(item.fields.dosage_form);
  const release = parseReleaseTypeField(item.fields.release_type);
  const quantity = normalizeItemQuantity(item);
  const identity = resolveItemIdentity(item, strength, form, release, catalogue);

  const hasCleanFullAttributes =
    identity.resolved &&
    !identity.hasAttributeConflict &&
    strength.status === 'VALID' &&
    form.status === 'VALID';

  const fullSignature = hasCleanFullAttributes
    ? `${strength.canonical}|${form.canonical}|${release.status === 'VALID' ? release.canonical : 'ABSENT'}`
    : null;

  const strengthSignature =
    identity.resolved && !identity.hasAttributeConflict && strength.status === 'VALID'
      ? strength.canonical
      : null;

  return {
    item,
    identity,
    strength,
    form,
    release,
    quantity,
    fullSignature,
    strengthSignature,
    ambiguousMatch: false,
    paired: false
  };
}

/**
 * Perform conservative, order-independent 1-to-1 matching between prescription and invoice item profiles.
 */
function matchItemProfiles(rxProfiles, invProfiles) {
  const pairs = [];

  // Group resolved items by canonical genericKey
  const genericKeys = new Set();
  for (const p of rxProfiles) {
    if (p.identity.genericKey) genericKeys.add(p.identity.genericKey);
  }
  for (const p of invProfiles) {
    if (p.identity.genericKey) genericKeys.add(p.identity.genericKey);
  }

  const sortedGenericKeys = Array.from(genericKeys).sort();

  for (const genericKey of sortedGenericKeys) {
    const rxGroup = rxProfiles.filter(p => p.identity.genericKey === genericKey);
    const invGroup = invProfiles.filter(p => p.identity.genericKey === genericKey);

    if (rxGroup.length === 0 || invGroup.length === 0) {
      continue;
    }

    // Pass 1: Mutually unique full-attribute candidates (strength + form + release)
    const fullSignatures = new Set();
    for (const p of rxGroup) {
      if (p.fullSignature) fullSignatures.add(p.fullSignature);
    }
    for (const p of invGroup) {
      if (p.fullSignature) fullSignatures.add(p.fullSignature);
    }

    for (const sig of Array.from(fullSignatures).sort()) {
      const rxMatches = rxGroup.filter(p => !p.paired && !p.ambiguousMatch && p.fullSignature === sig);
      const invMatches = invGroup.filter(p => !p.paired && !p.ambiguousMatch && p.fullSignature === sig);

      if (rxMatches.length === 1 && invMatches.length === 1) {
        rxMatches[0].paired = true;
        invMatches[0].paired = true;
        pairs.push({ rx: rxMatches[0], inv: invMatches[0] });
      } else if (rxMatches.length >= 1 && invMatches.length >= 1) {
        // Duplicate/competing full-attribute candidates: do not break ties by order or quantity
        for (const p of rxMatches) p.ambiguousMatch = true;
        for (const p of invMatches) p.ambiguousMatch = true;
      }
    }

    // Pass 2: Mutually unique same-strength candidates among remaining non-competing items
    const strengthSignatures = new Set();
    for (const p of rxGroup) {
      if (!p.paired && !p.ambiguousMatch && p.strengthSignature) {
        strengthSignatures.add(p.strengthSignature);
      }
    }
    for (const p of invGroup) {
      if (!p.paired && !p.ambiguousMatch && p.strengthSignature) {
        strengthSignatures.add(p.strengthSignature);
      }
    }

    for (const sSig of Array.from(strengthSignatures).sort()) {
      const rxMatches = rxGroup.filter(p => !p.paired && !p.ambiguousMatch && p.strengthSignature === sSig);
      const invMatches = invGroup.filter(p => !p.paired && !p.ambiguousMatch && p.strengthSignature === sSig);

      if (rxMatches.length === 1 && invMatches.length === 1) {
        rxMatches[0].paired = true;
        invMatches[0].paired = true;
        pairs.push({ rx: rxMatches[0], inv: invMatches[0] });
      } else if (rxMatches.length >= 1 && invMatches.length >= 1) {
        for (const p of rxMatches) p.ambiguousMatch = true;
        for (const p of invMatches) p.ambiguousMatch = true;
      }
    }

    // Pass 3: Mutually unique same-generic candidate for explicit difference checks
    const remainingRx = rxGroup.filter(p => !p.paired && !p.ambiguousMatch);
    const remainingInv = invGroup.filter(p => !p.paired && !p.ambiguousMatch);

    if (remainingRx.length === 1 && remainingInv.length === 1) {
      // Only pair when neither side had an unresolved multi-candidate ambiguity in this generic family
      if (
        (remainingRx[0].identity.resolved && remainingInv[0].identity.resolved) ||
        (rxGroup.length === 1 && invGroup.length === 1)
      ) {
        remainingRx[0].paired = true;
        remainingInv[0].paired = true;
        pairs.push({ rx: remainingRx[0], inv: remainingInv[0] });
      } else {
        remainingRx[0].ambiguousMatch = true;
        remainingInv[0].ambiguousMatch = true;
      }
    } else if (remainingRx.length >= 1 && remainingInv.length >= 1) {
      for (const p of remainingRx) p.ambiguousMatch = true;
      for (const p of remainingInv) p.ambiguousMatch = true;
    }
  }

  const unmatchedRx = rxProfiles.filter(p => !p.paired);
  const unmatchedInv = invProfiles.filter(p => !p.paired);

  return { pairs, unmatchedRx, unmatchedInv };
}

/**
 * Collect canonical, deduplicated evidence references strictly belonging to the row's item(s).
 */
function buildRowEvidenceReferences(rxItem, invItem) {
  const refs = [];
  const seen = new Set();

  for (const item of [rxItem, invItem]) {
    if (!item) continue;
    for (const slot of RECOGNIZED_MEDICINE_SLOTS) {
      const field = item.fields[slot];
      if (!field) continue;
      const key = `${field.documentId}|${field.id}|${field.pageNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({
          documentId: field.documentId,
          fieldId: field.id,
          pageNumber: field.pageNumber
        });
      }
    }
  }

  return refs;
}

function sortReasonsCanonically(reasonSet) {
  return REASON_CODES.filter(code => reasonSet.has(code));
}

/**
 * Determine whether an unmatched item with a failing quantity normalization has an explicit unit
 * that is incompatible with the counterpart's normalized base unit.
 */
function hasIncompatibleRawUnit(failingItem, knownBaseUnit) {
  if (!failingItem || !knownBaseUnit) return false;
  const unitField = failingItem.fields.quantity_unit;
  const packUnitField = failingItem.fields.pack_unit;

  const unitClass = classifyUnitToken(getEffectiveFieldText(unitField));
  if (unitClass.kind === 'DIRECT' && unitClass.baseUnit !== knownBaseUnit) {
    return true;
  }
  if (unitClass.kind === 'CONTAINER' && packUnitField) {
    const packUnitClass = classifyUnitToken(getEffectiveFieldText(packUnitField));
    if (packUnitClass.kind === 'DIRECT' && packUnitClass.baseUnit !== knownBaseUnit) {
      return true;
    }
  }
  return false;
}

/**
 * Build a paired comparison row from matched prescription and invoice item profiles.
 */
function buildPairedRow(caseId, rxProfile, invProfile) {
  const rxItem = rxProfile.item;
  const invItem = invProfile.item;
  const reasonSet = new Set();

  for (const code of rxProfile.identity.identityReasonCodes) reasonSet.add(code);
  for (const code of invProfile.identity.identityReasonCodes) reasonSet.add(code);

  // 1. Identity check
  const identityHasIssue =
    rxProfile.identity.hasAttributeConflict ||
    invProfile.identity.hasAttributeConflict ||
    rxProfile.identity.nameNeedsCorrection ||
    invProfile.identity.nameNeedsCorrection ||
    !rxProfile.identity.resolved ||
    !invProfile.identity.resolved;

  const identityCheck = identityHasIssue ? CHECK_STATUS.INSUFFICIENT_EVIDENCE : CHECK_STATUS.CONSISTENT;

  // 2. Strength check
  if (rxProfile.strength.needsCorrection || invProfile.strength.needsCorrection) {
    reasonSet.add('FIELD_NEEDS_CORRECTION');
  }
  let strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  if (rxProfile.strength.status === 'MISSING' || invProfile.strength.status === 'MISSING') {
    reasonSet.add('MISSING_STRENGTH');
    strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.strength.status === 'UNSUPPORTED' || invProfile.strength.status === 'UNSUPPORTED') {
    reasonSet.add('UNSUPPORTED_STRENGTH_FORMAT');
    strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.strength.unitKey !== invProfile.strength.unitKey) {
    reasonSet.add('UNSUPPORTED_STRENGTH_FORMAT');
    strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.identity.hasStrengthConflict || invProfile.identity.hasStrengthConflict) {
    strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.strength.value !== invProfile.strength.value) {
    if (rxProfile.strength.needsCorrection || invProfile.strength.needsCorrection) {
      strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
    } else {
      reasonSet.add('STRENGTH_MISMATCH');
      strengthCheck = CHECK_STATUS.MISMATCH;
    }
  } else if (rxProfile.strength.needsCorrection || invProfile.strength.needsCorrection) {
    strengthCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else {
    strengthCheck = CHECK_STATUS.CONSISTENT;
  }

  // 3. Dosage form check
  if (rxProfile.form.needsCorrection || invProfile.form.needsCorrection) {
    reasonSet.add('FIELD_NEEDS_CORRECTION');
  }
  let formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  if (rxProfile.form.status === 'MISSING' || invProfile.form.status === 'MISSING') {
    reasonSet.add('MISSING_DOSAGE_FORM');
    formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.form.status === 'UNSUPPORTED' || invProfile.form.status === 'UNSUPPORTED') {
    reasonSet.add('UNSUPPORTED_PRODUCT_TYPE');
    formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.identity.hasFormConflict || invProfile.identity.hasFormConflict) {
    formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (rxProfile.form.canonical !== invProfile.form.canonical) {
    if (rxProfile.form.needsCorrection || invProfile.form.needsCorrection) {
      formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
    } else {
      reasonSet.add('DOSAGE_FORM_MISMATCH');
      formCheck = CHECK_STATUS.MISMATCH;
    }
  } else if (rxProfile.form.needsCorrection || invProfile.form.needsCorrection) {
    formCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else {
    formCheck = CHECK_STATUS.CONSISTENT;
  }

  // 4. Release type check
  let releaseCheck = CHECK_STATUS.NOT_APPLICABLE;
  if (rxProfile.release.status === 'ABSENT' && invProfile.release.status === 'ABSENT') {
    releaseCheck = CHECK_STATUS.NOT_APPLICABLE;
  } else if (rxProfile.release.status === 'ABSENT' || invProfile.release.status === 'ABSENT') {
    if (rxProfile.release.needsCorrection || invProfile.release.needsCorrection) {
      reasonSet.add('FIELD_NEEDS_CORRECTION');
    }
    reasonSet.add('MISSING_RELEASE_TYPE');
    releaseCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else {
    if (rxProfile.release.needsCorrection || invProfile.release.needsCorrection) {
      reasonSet.add('FIELD_NEEDS_CORRECTION');
    }
    if (rxProfile.identity.hasReleaseConflict || invProfile.identity.hasReleaseConflict) {
      releaseCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
    } else if (rxProfile.release.canonical !== invProfile.release.canonical) {
      if (rxProfile.release.needsCorrection || invProfile.release.needsCorrection) {
        releaseCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
      } else {
        reasonSet.add('RELEASE_TYPE_MISMATCH');
        releaseCheck = CHECK_STATUS.MISMATCH;
      }
    } else if (rxProfile.release.needsCorrection || invProfile.release.needsCorrection) {
      releaseCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
    } else {
      releaseCheck = CHECK_STATUS.CONSISTENT;
    }
  }

  // 5. Quantity check
  const rxQty = rxProfile.quantity;
  const invQty = invProfile.quantity;
  for (const code of rxQty.reasonCodes) reasonSet.add(code);
  for (const code of invQty.reasonCodes) reasonSet.add(code);

  let quantityCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  let quantityDto = {
    prescriptionBaseQuantity: null,
    invoiceBaseQuantity: null,
    baseUnit: null
  };

  if (rxQty.status === QUANTITY_STATUS.NORMALIZED && invQty.status === QUANTITY_STATUS.NORMALIZED) {
    if (rxQty.baseUnit !== invQty.baseUnit) {
      reasonSet.add('INCOMPATIBLE_QUANTITY_UNITS');
      quantityCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
      quantityDto = {
        prescriptionBaseQuantity: null,
        invoiceBaseQuantity: null,
        baseUnit: null
      };
    } else {
      quantityDto = {
        prescriptionBaseQuantity: rxQty.baseQuantity,
        invoiceBaseQuantity: invQty.baseQuantity,
        baseUnit: rxQty.baseUnit
      };
      if (rxQty.baseQuantity === invQty.baseQuantity) {
        quantityCheck = CHECK_STATUS.CONSISTENT;
      } else {
        reasonSet.add('QUANTITY_MISMATCH');
        quantityCheck = CHECK_STATUS.MISMATCH;
      }
    }
  } else if (rxQty.status === QUANTITY_STATUS.NORMALIZED) {
    if (hasIncompatibleRawUnit(invItem, rxQty.baseUnit)) {
      reasonSet.add('INCOMPATIBLE_QUANTITY_UNITS');
      quantityDto = {
        prescriptionBaseQuantity: null,
        invoiceBaseQuantity: null,
        baseUnit: null
      };
    } else {
      quantityDto = {
        prescriptionBaseQuantity: rxQty.baseQuantity,
        invoiceBaseQuantity: null,
        baseUnit: rxQty.baseUnit
      };
    }
    quantityCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  } else if (invQty.status === QUANTITY_STATUS.NORMALIZED) {
    if (hasIncompatibleRawUnit(rxItem, invQty.baseUnit)) {
      reasonSet.add('INCOMPATIBLE_QUANTITY_UNITS');
      quantityDto = {
        prescriptionBaseQuantity: null,
        invoiceBaseQuantity: null,
        baseUnit: null
      };
    } else {
      quantityDto = {
        prescriptionBaseQuantity: null,
        invoiceBaseQuantity: invQty.baseQuantity,
        baseUnit: invQty.baseUnit
      };
    }
    quantityCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  }

  const checks = {
    identity: identityCheck,
    strength: strengthCheck,
    form: formCheck,
    release: releaseCheck,
    quantity: quantityCheck
  };

  const checkValues = Object.values(checks);
  let rowStatus = COMPARISON_STATUS.CONSISTENT;
  if (checkValues.includes(CHECK_STATUS.MISMATCH)) {
    rowStatus = COMPARISON_STATUS.MISMATCH;
  } else if (checkValues.includes(CHECK_STATUS.INSUFFICIENT_EVIDENCE) || reasonSet.size > 0) {
    rowStatus = COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;
  }

  return {
    rowId: deriveReconciliationRowId({
      caseId,
      prescriptionItemId: rxItem.itemId,
      invoiceItemId: invItem.itemId
    }),
    prescriptionItemId: rxItem.itemId,
    invoiceItemId: invItem.itemId,
    genericName: rxProfile.identity.genericName || invProfile.identity.genericName || null,
    status: rowStatus,
    checks,
    quantity: quantityDto,
    reasonCodes: sortReasonsCanonically(reasonSet),
    evidenceReferences: buildRowEvidenceReferences(rxItem, invItem),
    _sortKey: `0:${rxItem.anchorFieldId}|0:${invItem.anchorFieldId}`
  };
}

/**
 * Build a single-sided row for an unmatched prescription or invoice item.
 */
function buildSingleSidedRow({
  caseId,
  profile,
  side,
  bothDocsCompletelyInspectedAndGrouped,
  counterpartHasUnresolvedIdentity,
  counterpartDocReasons
}) {
  const isRx = side === 'PRESCRIPTION';
  const item = profile.item;
  const reasonSet = new Set();

  for (const code of profile.identity.identityReasonCodes) {
    reasonSet.add(code);
  }
  if (profile.ambiguousMatch) {
    reasonSet.add('AMBIGUOUS_MATCH');
  }

  if (profile.strength.needsCorrection) reasonSet.add('FIELD_NEEDS_CORRECTION');
  if (profile.strength.status === 'MISSING') reasonSet.add('MISSING_STRENGTH');
  else if (profile.strength.status === 'UNSUPPORTED') reasonSet.add('UNSUPPORTED_STRENGTH_FORMAT');

  if (profile.form.needsCorrection) reasonSet.add('FIELD_NEEDS_CORRECTION');
  if (profile.form.status === 'MISSING') reasonSet.add('MISSING_DOSAGE_FORM');
  else if (profile.form.status === 'UNSUPPORTED') reasonSet.add('UNSUPPORTED_PRODUCT_TYPE');

  if (profile.release.needsCorrection) reasonSet.add('FIELD_NEEDS_CORRECTION');

  for (const code of profile.quantity.reasonCodes) {
    reasonSet.add(code);
  }

  const canConfirmDocumentOmissionOrExtra =
    bothDocsCompletelyInspectedAndGrouped &&
    !counterpartHasUnresolvedIdentity &&
    profile.identity.resolved &&
    !profile.identity.hasAttributeConflict &&
    !profile.identity.nameNeedsCorrection &&
    !profile.ambiguousMatch;

  let identityCheck = CHECK_STATUS.INSUFFICIENT_EVIDENCE;
  let rowStatus = COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;

  if (canConfirmDocumentOmissionOrExtra) {
    reasonSet.add(isRx ? 'MISSING_INVOICE_ITEM' : 'EXTRA_INVOICE_ITEM');
    identityCheck = CHECK_STATUS.MISMATCH;
    rowStatus = COMPARISON_STATUS.MISMATCH;
  } else {
    for (const docReason of counterpartDocReasons) {
      reasonSet.add(docReason);
    }
  }

  const checks = {
    identity: identityCheck,
    strength: CHECK_STATUS.INSUFFICIENT_EVIDENCE,
    form: CHECK_STATUS.INSUFFICIENT_EVIDENCE,
    release:
      profile.release.status === 'ABSENT'
        ? CHECK_STATUS.NOT_APPLICABLE
        : CHECK_STATUS.INSUFFICIENT_EVIDENCE,
    quantity: CHECK_STATUS.INSUFFICIENT_EVIDENCE
  };

  let quantityDto = {
    prescriptionBaseQuantity: null,
    invoiceBaseQuantity: null,
    baseUnit: null
  };

  if (profile.quantity.status === QUANTITY_STATUS.NORMALIZED) {
    quantityDto = {
      prescriptionBaseQuantity: isRx ? profile.quantity.baseQuantity : null,
      invoiceBaseQuantity: isRx ? null : profile.quantity.baseQuantity,
      baseUnit: profile.quantity.baseUnit
    };
  }

  return {
    rowId: deriveReconciliationRowId({
      caseId,
      prescriptionItemId: isRx ? item.itemId : null,
      invoiceItemId: isRx ? null : item.itemId
    }),
    prescriptionItemId: isRx ? item.itemId : null,
    invoiceItemId: isRx ? null : item.itemId,
    genericName: profile.identity.genericName || null,
    status: rowStatus,
    checks,
    quantity: quantityDto,
    reasonCodes: sortReasonsCanonically(reasonSet),
    evidenceReferences: buildRowEvidenceReferences(isRx ? item : null, isRx ? null : item),
    _sortKey: isRx ? `0:${item.anchorFieldId}|1:` : `1:|0:${item.anchorFieldId}`
  };
}

function collectEnvelopeGlobalReasons(envelope) {
  const reasons = [];
  if (!envelope) {
    reasons.push('MISSING_DOCUMENT');
    return reasons;
  }

  if (envelope.coverage.status === COVERAGE_STATUS.INCOMPLETE || envelope.issueCodes.includes('INCOMPLETE_PAGE_COVERAGE')) {
    reasons.push('INCOMPLETE_PAGE_COVERAGE');
  }
  if (envelope.coverage.status === COVERAGE_STATUS.UNKNOWN || envelope.issueCodes.includes('UNKNOWN_PAGE_COVERAGE')) {
    reasons.push('UNKNOWN_PAGE_COVERAGE');
  }
  if (envelope.coverage.status === COVERAGE_STATUS.CONTRADICTORY || envelope.issueCodes.includes('CONTRADICTORY_PAGE_COVERAGE')) {
    reasons.push('CONTRADICTORY_PAGE_COVERAGE');
  }

  const hasLimitExceeded =
    envelope.issueCodes.includes('GROUP_LIMIT_EXCEEDED') || envelope.detectedGroupCount > 3;
  if (hasLimitExceeded) {
    reasons.push('ITEM_LIMIT_EXCEEDED');
  }

  if (envelope.groupingStatus === 'UNRESOLVED') {
    const nonLimitGroupingIssues = envelope.issueCodes.filter(
      code =>
        code !== 'GROUP_LIMIT_EXCEEDED' &&
        code !== 'INCOMPLETE_PAGE_COVERAGE' &&
        code !== 'UNKNOWN_PAGE_COVERAGE' &&
        code !== 'CONTRADICTORY_PAGE_COVERAGE'
    );
    if (!hasLimitExceeded || nonLimitGroupingIssues.length > 0) {
      reasons.push('UNRESOLVED_GROUPING');
    }
  }

  if (envelope.medicineItems.some(item => item.needsCorrection)) {
    reasons.push('FIELD_NEEDS_CORRECTION');
  }

  return reasons;
}

/**
 * Pure, deterministic, offline reconciliation of prescription and pharmacy invoice medicine items.
 *
 * @param {Object} params
 * @param {string} params.caseId
 * @param {Object|null} params.prescription
 * @param {Object|null} params.invoice
 * @param {Array<Object>} [params.catalogue]
 * @returns {Object} MedicineReconciliationResult conforming to contracts/schemas/medicine-reconciliation.schema.json
 */
function reconcileMedicineDocuments(params) {
  if (!isPlainObject(params)) {
    throw createInvalidInputError();
  }

  const allowedParamKeys = ['caseId', 'prescription', 'invoice', 'catalogue'];
  if (!Object.keys(params).every(k => allowedParamKeys.includes(k))) {
    throw createInvalidInputError();
  }

  const { caseId, catalogue = ACADEMIC_MEDICINE_CATALOGUE } = params;
  const prescription = params.prescription === undefined ? null : params.prescription;
  const invoice = params.invoice === undefined ? null : params.invoice;

  if (!isSafeId(caseId)) {
    throw createInvalidInputError();
  }
  if (!('prescription' in params) && !('invoice' in params)) {
    throw createInvalidInputError();
  }

  validateCatalogue(catalogue);

  const usedItemIds = new Set();
  const usedFieldIds = new Set();

  if (prescription !== null) {
    validateInputEnvelope(prescription, caseId, 'PRESCRIPTION', usedItemIds, usedFieldIds);
  }
  if (invoice !== null) {
    validateInputEnvelope(invoice, caseId, 'PHARMACY_INVOICE', usedItemIds, usedFieldIds);
  }
  if (prescription !== null && invoice !== null && prescription.documentId === invoice.documentId) {
    throw createInvalidInputError();
  }

  const rxProfiles = (prescription ? prescription.medicineItems : []).map(item =>
    buildItemProfile(item, catalogue)
  );
  const invProfiles = (invoice ? invoice.medicineItems : []).map(item =>
    buildItemProfile(item, catalogue)
  );

  const { pairs, unmatchedRx, unmatchedInv } = matchItemProfiles(rxProfiles, invProfiles);

  const bothDocsCompletelyInspectedAndGrouped = Boolean(
    prescription &&
      invoice &&
      prescription.coverage.status === COVERAGE_STATUS.COMPLETE &&
      invoice.coverage.status === COVERAGE_STATUS.COMPLETE &&
      prescription.groupingStatus !== 'UNRESOLVED' &&
      invoice.groupingStatus !== 'UNRESOLVED'
  );

  const hasUnconfirmedOrAmbiguousIdentity = p =>
    Boolean(
      !p.identity.resolved ||
        p.identity.nameNeedsCorrection ||
        p.identity.hasAttributeConflict ||
        p.ambiguousMatch
    );

  const rxHasUnresolvedIdentity = rxProfiles.some(hasUnconfirmedOrAmbiguousIdentity);
  const invHasUnresolvedIdentity = invProfiles.some(hasUnconfirmedOrAmbiguousIdentity);

  const rxGlobalReasons = collectEnvelopeGlobalReasons(prescription);
  const invGlobalReasons = collectEnvelopeGlobalReasons(invoice);

  const rawRows = [];

  for (const pair of pairs) {
    rawRows.push(buildPairedRow(caseId, pair.rx, pair.inv));
  }

  for (const rxProfile of unmatchedRx) {
    rawRows.push(
      buildSingleSidedRow({
        caseId,
        profile: rxProfile,
        side: 'PRESCRIPTION',
        bothDocsCompletelyInspectedAndGrouped,
        counterpartHasUnresolvedIdentity: invHasUnresolvedIdentity,
        counterpartDocReasons: invGlobalReasons
      })
    );
  }

  for (const invProfile of unmatchedInv) {
    rawRows.push(
      buildSingleSidedRow({
        caseId,
        profile: invProfile,
        side: 'PHARMACY_INVOICE',
        bothDocsCompletelyInspectedAndGrouped,
        counterpartHasUnresolvedIdentity: rxHasUnresolvedIdentity,
        counterpartDocReasons: rxGlobalReasons
      })
    );
  }

  rawRows.sort((a, b) => {
    if (a._sortKey < b._sortKey) return -1;
    if (a._sortKey > b._sortKey) return 1;
    return a.rowId.localeCompare(b.rowId);
  });

  const rows = rawRows.map(({ _sortKey, ...row }) => row);

  const aggregateReasonSet = new Set();
  for (const code of rxGlobalReasons) {
    if (ALLOWED_REASON_SET.has(code)) aggregateReasonSet.add(code);
  }
  for (const code of invGlobalReasons) {
    if (ALLOWED_REASON_SET.has(code)) aggregateReasonSet.add(code);
  }
  for (const row of rows) {
    for (const code of row.reasonCodes) {
      if (ALLOWED_REASON_SET.has(code)) aggregateReasonSet.add(code);
    }
  }

  const summary = {
    consistent: rows.filter(r => r.status === COMPARISON_STATUS.CONSISTENT).length,
    mismatch: rows.filter(r => r.status === COMPARISON_STATUS.MISMATCH).length,
    insufficientEvidence: rows.filter(r => r.status === COMPARISON_STATUS.INSUFFICIENT_EVIDENCE).length
  };

  const sourceUncertainty = Boolean(
    !prescription ||
      !invoice ||
      prescription.reviewRequired ||
      invoice.reviewRequired ||
      prescription.coverage.status !== COVERAGE_STATUS.COMPLETE ||
      invoice.coverage.status !== COVERAGE_STATUS.COMPLETE ||
      prescription.groupingStatus === 'UNRESOLVED' ||
      invoice.groupingStatus === 'UNRESOLVED'
  );

  const rowHasInsufficient = rows.some(
    r =>
      r.status === COMPARISON_STATUS.INSUFFICIENT_EVIDENCE ||
      Object.values(r.checks).includes(CHECK_STATUS.INSUFFICIENT_EVIDENCE)
  );

  const hasInsufficientEvidence = Boolean(
    sourceUncertainty || rows.length === 0 || summary.insufficientEvidence > 0 || rowHasInsufficient
  );

  let status = COMPARISON_STATUS.CONSISTENT;
  if (summary.mismatch > 0) {
    status = COMPARISON_STATUS.MISMATCH;
  } else if (hasInsufficientEvidence) {
    status = COMPARISON_STATUS.INSUFFICIENT_EVIDENCE;
  }

  const reviewRequired = Boolean(status !== COMPARISON_STATUS.CONSISTENT || hasInsufficientEvidence);

  return {
    schemaVersion: RECONCILIATION_SCHEMA_VERSION,
    rulesetVersion: RECONCILIATION_RULESET_VERSION,
    caseId,
    documentIds: {
      prescription: prescription ? prescription.documentId : null,
      invoice: invoice ? invoice.documentId : null
    },
    status,
    reviewRequired,
    humanDecisionRequired: true,
    coverage: {
      prescription: prescription ? prescription.coverage.status : COVERAGE_STATUS.MISSING,
      invoice: invoice ? invoice.coverage.status : COVERAGE_STATUS.MISSING
    },
    hasInsufficientEvidence,
    reasonCodes: sortReasonsCanonically(aggregateReasonSet),
    rows,
    summary
  };
}

module.exports = {
  RECONCILIATION_SCHEMA_VERSION,
  RECONCILIATION_RULESET_VERSION,
  COMPARISON_STATUS,
  CHECK_STATUS,
  COVERAGE_STATUS,
  REASON_CODES,
  INVALID_RECONCILIATION_INPUT,
  deriveReconciliationRowId,
  reconcileMedicineDocuments
};
