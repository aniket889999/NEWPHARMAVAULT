'use strict';

const QUANTITY_STATUS = Object.freeze({
  NORMALIZED: 'NORMALIZED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const SUPPORTED_BASE_UNITS = Object.freeze({
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  ML: 'mL'
});

const QUANTITY_SLOTS = Object.freeze([
  'quantity',
  'quantity_unit',
  'pack_size',
  'pack_unit'
]);

const MAX_BASE_QUANTITY = 1000000;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const POSITIVE_DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const INVALID_RECONCILIATION_INPUT = 'INVALID_RECONCILIATION_INPUT';

const DIRECT_UNIT_MAP = Object.freeze({
  tablet: SUPPORTED_BASE_UNITS.TABLET,
  tablets: SUPPORTED_BASE_UNITS.TABLET,
  tab: SUPPORTED_BASE_UNITS.TABLET,
  tabs: SUPPORTED_BASE_UNITS.TABLET,
  capsule: SUPPORTED_BASE_UNITS.CAPSULE,
  capsules: SUPPORTED_BASE_UNITS.CAPSULE,
  cap: SUPPORTED_BASE_UNITS.CAPSULE,
  caps: SUPPORTED_BASE_UNITS.CAPSULE,
  ml: SUPPORTED_BASE_UNITS.ML
});

const CONTAINER_UNITS = new Set(['strip', 'strips', 'pack', 'packs']);

function createInvalidInputError() {
  const error = new Error('Invalid reconciliation input envelope or medicine item context.');
  error.code = INVALID_RECONCILIATION_INPUT;
  return error;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSafeId(value) {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value);
}

/**
 * Return effective field string from normalizedValue when non-empty, else rawValue.
 */
function getEffectiveFieldText(field) {
  if (!isPlainObject(field)) return '';
  if (typeof field.normalizedValue === 'string' && field.normalizedValue.trim().length > 0) {
    return field.normalizedValue.trim();
  }
  if (typeof field.rawValue === 'string' && field.rawValue.trim().length > 0) {
    return field.rawValue.trim();
  }
  return '';
}

/**
 * Determine conservatively whether a linked field requires human correction/clarification.
 */
function isFieldUncertain(field) {
  if (!isPlainObject(field)) return false;
  const rawNeedsCorrection = field.needsCorrection === true;
  const hasCorrectedBy = typeof field.correctedBy === 'string' && field.correctedBy.trim().length > 0;
  const hasCorrectedAt = typeof field.correctedAt === 'string' && field.correctedAt.trim().length > 0;
  const hasCompleteCorrection = hasCorrectedBy && hasCorrectedAt && !rawNeedsCorrection;
  const hasPartialCorrection = hasCorrectedBy !== hasCorrectedAt;
  const isLowConfidence =
    typeof field.extractionConfidence === 'number' &&
    Number.isFinite(field.extractionConfidence) &&
    field.extractionConfidence < 0.75;

  return rawNeedsCorrection || hasPartialCorrection || (isLowConfidence && !hasCompleteCorrection);
}

/**
 * Classify a unit string as a direct base unit, a container unit (strip/pack), or unsupported.
 */
function classifyUnitToken(rawText) {
  if (typeof rawText !== 'string') {
    return { kind: 'MISSING', baseUnit: null };
  }
  const normalized = rawText.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    return { kind: 'MISSING', baseUnit: null };
  }
  if (Object.prototype.hasOwnProperty.call(DIRECT_UNIT_MAP, normalized)) {
    return { kind: 'DIRECT', baseUnit: DIRECT_UNIT_MAP[normalized] };
  }
  if (CONTAINER_UNITS.has(normalized)) {
    return { kind: 'CONTAINER', baseUnit: null, containerType: normalized };
  }
  return { kind: 'UNKNOWN', baseUnit: null };
}

/**
 * Parse a strict bounded positive whole number in [1, MAX_BASE_QUANTITY].
 * Rejects signs (+ / -), decimals, hex, exponents, ranges, zero, and overflow.
 */
function parsePositiveWholeNumber(text) {
  if (typeof text !== 'string') return { ok: false, value: null };
  const trimmed = text.trim();
  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return { ok: false, value: null };
  }
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num <= 0 || num > MAX_BASE_QUANTITY) {
    return { ok: false, value: null };
  }
  return { ok: true, value: num };
}

/**
 * Parse a strict bounded positive decimal (or whole) number in (0, MAX_BASE_QUANTITY].
 * Rejects signs (+ / -), hex, exponents, ranges, zero, NaN, Infinity, and overflow.
 */
function parsePositiveDecimalNumber(text) {
  if (typeof text !== 'string') return { ok: false, value: null };
  const trimmed = text.trim();
  if (!POSITIVE_DECIMAL_PATTERN.test(trimmed)) {
    return { ok: false, value: null };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num > MAX_BASE_QUANTITY) {
    return { ok: false, value: null };
  }
  return { ok: true, value: num };
}

/**
 * Validate minimal item structure for quantity normalization without mutating the input.
 */
function validateQuantityItemInput(item) {
  if (!isPlainObject(item) || !isPlainObject(item.fields)) {
    throw createInvalidInputError();
  }
  const itemCaseId = item.caseId !== undefined ? item.caseId : null;
  const itemDocId = item.documentId !== undefined ? item.documentId : null;
  if (itemCaseId !== null && !isSafeId(itemCaseId)) {
    throw createInvalidInputError();
  }
  if (itemDocId !== null && !isSafeId(itemDocId)) {
    throw createInvalidInputError();
  }

  for (const slot of QUANTITY_SLOTS) {
    const field = item.fields[slot];
    if (field === null || field === undefined) continue;
    if (!isPlainObject(field) || !isSafeId(field.id)) {
      throw createInvalidInputError();
    }
    if (itemCaseId !== null && field.caseId !== undefined && field.caseId !== itemCaseId) {
      throw createInvalidInputError();
    }
    if (itemDocId !== null && field.documentId !== undefined && field.documentId !== itemDocId) {
      throw createInvalidInputError();
    }
    if (field.fieldType !== undefined && field.fieldType !== slot) {
      throw createInvalidInputError();
    }
  }
}

/**
 * Normalize an item's explicit administrative quantity fields into a supported base quantity and unit.
 * Never infers pack size (e.g. default 10) or calculates quantities from dosage instructions.
 *
 * @param {Object} item - Frozen Session 1 MedicineItem
 * @returns {{
 *   status: 'NORMALIZED' | 'INSUFFICIENT_EVIDENCE',
 *   baseQuantity: number | null,
 *   baseUnit: 'tablet' | 'capsule' | 'mL' | null,
 *   reasonCodes: Array<string>,
 *   fieldIds: Array<string>
 * }}
 */
function normalizeItemQuantity(item) {
  validateQuantityItemInput(item);

  const fields = item.fields;
  const qtyField = fields.quantity || null;
  const unitField = fields.quantity_unit || null;
  const packSizeField = fields.pack_size || null;
  const packUnitField = fields.pack_unit || null;

  const fieldIds = [];
  for (const slot of QUANTITY_SLOTS) {
    const slotField = fields[slot];
    if (slotField && isSafeId(slotField.id) && !fieldIds.includes(slotField.id)) {
      fieldIds.push(slotField.id);
    }
  }

  const reasonSet = new Set();

  // Check if any present quantity-related field requires correction
  for (const slot of QUANTITY_SLOTS) {
    const slotField = fields[slot];
    if (slotField && isFieldUncertain(slotField)) {
      reasonSet.add('FIELD_NEEDS_CORRECTION');
    }
  }

  const qtyText = getEffectiveFieldText(qtyField);
  const unitText = getEffectiveFieldText(unitField);
  const packSizeText = getEffectiveFieldText(packSizeField);
  const packUnitText = getEffectiveFieldText(packUnitField);

  if (!qtyField || !qtyText) {
    reasonSet.add('MISSING_QUANTITY');
  }

  const unitClassification = classifyUnitToken(unitText);

  let resolvedBaseUnit = null;
  let computedBaseQuantity = null;

  if (unitClassification.kind === 'MISSING' || unitClassification.kind === 'UNKNOWN') {
    reasonSet.add('UNKNOWN_QUANTITY_UNIT');
    if (qtyField && qtyText) {
      const decCheck = parsePositiveDecimalNumber(qtyText);
      if (!decCheck.ok) {
        reasonSet.add('INVALID_QUANTITY');
      }
    }
  } else if (unitClassification.kind === 'DIRECT') {
    resolvedBaseUnit = unitClassification.baseUnit;

    if (qtyField && qtyText) {
      if (resolvedBaseUnit === SUPPORTED_BASE_UNITS.ML) {
        const parsed = parsePositiveDecimalNumber(qtyText);
        if (!parsed.ok) {
          reasonSet.add('INVALID_QUANTITY');
        } else {
          computedBaseQuantity = parsed.value;
        }
      } else {
        // Discrete tablet/capsule counts must be whole positive integers
        const parsed = parsePositiveWholeNumber(qtyText);
        if (!parsed.ok) {
          reasonSet.add('INVALID_QUANTITY');
        } else {
          computedBaseQuantity = parsed.value;
        }
      }
    }

    // If explicit pack_unit is also present on a direct-unit item and conflicts with the direct unit,
    // treat the unit relationship as needing clarification.
    if (packUnitField && packUnitText) {
      const packUnitClass = classifyUnitToken(packUnitText);
      if (packUnitClass.kind !== 'DIRECT' || packUnitClass.baseUnit !== resolvedBaseUnit) {
        reasonSet.add('UNKNOWN_QUANTITY_UNIT');
      }
    }
    if (packSizeField && packSizeText) {
      const parsedPack = parsePositiveWholeNumber(packSizeText);
      if (!parsedPack.ok) {
        reasonSet.add('INVALID_QUANTITY');
      }
    }
  } else if (unitClassification.kind === 'CONTAINER') {
    // Strip/pack quantities require a whole-number container count, an explicit positive integer
    // pack_size, and a supported contained base unit in pack_unit.
    let containerCount = null;
    if (qtyField && qtyText) {
      const parsedContainerCount = parsePositiveWholeNumber(qtyText);
      if (!parsedContainerCount.ok) {
        reasonSet.add('INVALID_QUANTITY');
      } else {
        containerCount = parsedContainerCount.value;
      }
    }

    let packSize = null;
    if (!packSizeField || !packSizeText) {
      reasonSet.add('UNKNOWN_PACK_SIZE');
    } else {
      const parsedPackSize = parsePositiveWholeNumber(packSizeText);
      if (!parsedPackSize.ok) {
        reasonSet.add('INVALID_QUANTITY');
      } else {
        packSize = parsedPackSize.value;
      }
    }

    if (!packUnitField || !packUnitText) {
      reasonSet.add('UNKNOWN_QUANTITY_UNIT');
    } else {
      const containedUnitClass = classifyUnitToken(packUnitText);
      // Contained unit inside a strip/pack must be a discrete or supported base unit
      if (containedUnitClass.kind !== 'DIRECT') {
        reasonSet.add('UNKNOWN_QUANTITY_UNIT');
      } else {
        resolvedBaseUnit = containedUnitClass.baseUnit;
      }
    }

    if (containerCount !== null && packSize !== null && resolvedBaseUnit !== null) {
      // If contained unit is mL vs discrete count, packSize and containerCount are whole integers;
      // product must not exceed MAX_BASE_QUANTITY.
      const product = containerCount * packSize;
      if (!Number.isSafeInteger(product) || product <= 0 || product > MAX_BASE_QUANTITY) {
        reasonSet.add('INVALID_QUANTITY');
      } else {
        computedBaseQuantity = product;
      }
    }
  }

  const reasonCodes = Array.from(reasonSet);

  if (reasonCodes.length > 0 || computedBaseQuantity === null || resolvedBaseUnit === null) {
    return {
      status: QUANTITY_STATUS.INSUFFICIENT_EVIDENCE,
      baseQuantity: null,
      baseUnit: null,
      reasonCodes,
      fieldIds
    };
  }

  return {
    status: QUANTITY_STATUS.NORMALIZED,
    baseQuantity: computedBaseQuantity,
    baseUnit: resolvedBaseUnit,
    reasonCodes: [],
    fieldIds
  };
}

module.exports = {
  QUANTITY_STATUS,
  SUPPORTED_BASE_UNITS,
  QUANTITY_SLOTS,
  MAX_BASE_QUANTITY,
  INVALID_RECONCILIATION_INPUT,
  getEffectiveFieldText,
  isFieldUncertain,
  classifyUnitToken,
  normalizeItemQuantity
};

