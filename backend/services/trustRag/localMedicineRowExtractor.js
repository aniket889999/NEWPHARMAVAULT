const { ACADEMIC_MEDICINE_CATALOGUE } = require('../../data/academicMedicineCatalogue');
const {
  RECOGNIZED_MEDICINE_SLOTS,
  MAX_MEDICINE_ITEMS,
  isFlatMultiMedicineText
} = require('./medicineItemContract');

const CONFIDENCE_REVIEW_THRESHOLD = 0.75;

const BOILERPLATE_LINE_PATTERNS = [
  /^synthetic\s+demo\b/i,
  /^not\s+for\s+clinical\s+use$/i,
  /^fictional\s+family\b/i,
  /^(?:medical\s+)?prescription$/i,
  /^(?:pharmacy\s+|tax\s+)?invoice$/i,
  /^claim\s+form$/i,
  /^(?:s\.?\s*no\.?|sl\.?\s*no\.?|item|medicine\s+name|description|qty|quantity|amount|price|rate|total)\s*$/i
];

const DOSAGE_FORM_MAP = Object.freeze({
  tablet: 'Tablet',
  tablets: 'Tablet',
  tab: 'Tablet',
  tabs: 'Tablet',
  capsule: 'Capsule',
  capsules: 'Capsule',
  cap: 'Capsule',
  caps: 'Capsule',
  syrup: 'Syrup',
  syrups: 'Syrup',
  syr: 'Syrup',
  syp: 'Syrup',
  suspension: 'Suspension',
  suspensions: 'Suspension',
  susp: 'Suspension',
  injection: 'Injection',
  injections: 'Injection',
  inj: 'Injection',
  cream: 'Cream',
  creams: 'Cream',
  ointment: 'Ointment',
  ointments: 'Ointment',
  oint: 'Ointment',
  gel: 'Gel',
  gels: 'Gel',
  drop: 'Drops',
  drops: 'Drops',
  inhaler: 'Inhaler',
  inhalers: 'Inhaler',
  sachet: 'Sachet',
  sachets: 'Sachet',
  solution: 'Solution',
  solutions: 'Solution',
  lotion: 'Lotion',
  lotions: 'Lotion'
});

const UNIT_TOKEN_MAP = Object.freeze({
  tablet: 'tablet',
  tablets: 'tablet',
  tab: 'tablet',
  tabs: 'tablet',
  capsule: 'capsule',
  capsules: 'capsule',
  cap: 'capsule',
  caps: 'capsule',
  strip: 'strip',
  strips: 'strip',
  pack: 'pack',
  packs: 'pack',
  box: 'box',
  boxes: 'box',
  bottle: 'bottle',
  bottles: 'bottle',
  vial: 'vial',
  vials: 'vial',
  tube: 'tube',
  tubes: 'tube',
  sachet: 'sachet',
  sachets: 'sachet',
  ml: 'ml',
  unit: 'unit',
  units: 'unit'
});

const RELEASE_TOKEN_MAP = Object.freeze({
  sr: 'SR',
  'sustained release': 'SR',
  er: 'ER',
  'extended release': 'ER',
  xl: 'XL',
  xr: 'XR',
  dr: 'DR',
  'delayed release': 'DR',
  ec: 'DR',
  'enteric coated': 'DR',
  cr: 'CR',
  'controlled release': 'CR',
  ir: 'IR',
  'immediate release': 'IR',
  mr: 'MR',
  'modified release': 'MR'
});

function buildKnownMedicineTokenSet() {
  const tokens = new Set();
  for (const entry of ACADEMIC_MEDICINE_CATALOGUE || []) {
    for (const raw of [entry.brandName, entry.genericName, ...(entry.aliases || [])]) {
      if (typeof raw !== 'string') continue;
      const firstWord = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        tokens.add(firstWord);
      }
    }
  }
  // Common academic medicine stems
  for (const stem of [
    'paracetamol',
    'acetaminophen',
    'crocin',
    'dolo',
    'calpol',
    'pacimol',
    'amoxicillin',
    'amoxyclav',
    'augmentin',
    'moxclav',
    'clavam',
    'azithromycin',
    'azithral',
    'azee',
    'zady',
    'metformin',
    'glycomet',
    'glucophage',
    'cetirizine',
    'levocetirizine',
    'cetzine',
    'okacet',
    'alerid',
    'pantoprazole',
    'pan',
    'pantocid',
    'pantodac',
    'omeprazole',
    'omez',
    'ocid',
    'atorvastatin',
    'atorva',
    'storvas',
    'lipitor',
    'losartan',
    'losar',
    'repace',
    'amlodipine',
    'amlong',
    'stamlo',
    'ibuprofen',
    'brufen',
    'diclofenac',
    'voveran',
    'aspirin',
    'ecosprin',
    'shelcal',
    'limcee',
    'montelukast',
    'montair',
    'ranitidine',
    'ciprofloxacin',
    'ciplox',
    'doxycycline',
    'cefuroxime',
    'cefixime',
    'taxim',
    'insulin',
    'glimepiride',
    'amaryl',
    'telmisartan',
    'telma',
    'metoprolol',
    'betaloc',
    'levothyroxine',
    'thyronorm',
    'eltroxin',
    'salbutamol',
    'astHalIn'.toLowerCase()
  ]) {
    tokens.add(stem);
  }
  return tokens;
}

const KNOWN_MEDICINE_TOKENS = buildKnownMedicineTokenSet();

/**
 * Validate and normalize an OCR bounding box without inventing coordinates.
 */
function normalizeBoundingBox(rawBbox) {
  let coords = null;
  if (Array.isArray(rawBbox) && rawBbox.length === 4) {
    coords = rawBbox;
  } else if (rawBbox && typeof rawBbox === 'object' && !Array.isArray(rawBbox)) {
    const x0 = rawBbox.x0 ?? rawBbox.x_min ?? rawBbox.left;
    const y0 = rawBbox.y0 ?? rawBbox.y_min ?? rawBbox.top;
    const x1 = rawBbox.x1 ?? rawBbox.x_max ?? rawBbox.right;
    const y1 = rawBbox.y1 ?? rawBbox.y_max ?? rawBbox.bottom;
    if (x0 !== undefined && y0 !== undefined && x1 !== undefined && y1 !== undefined) {
      coords = [x0, y0, x1, y1];
    }
  }
  if (!coords) {
    return null;
  }
  const nums = coords.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(4)) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 1)) {
    return null;
  }
  const [x0, y0, x1, y1] = nums;
  if (x1 <= x0 || y1 <= y0) {
    return null;
  }
  if (x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) {
    return null;
  }
  return [x0, y0, x1, y1];
}

/**
 * Validate and normalize OCR extraction confidence without inventing defaults.
 */
function normalizeConfidence(rawConfidence) {
  if (rawConfidence === undefined || rawConfidence === null || typeof rawConfidence !== 'number' || !Number.isFinite(rawConfidence)) {
    return null;
  }
  if (rawConfidence < 0 || rawConfidence > 1) {
    return null;
  }
  return Number(rawConfidence.toFixed(4));
}

function normalizeDosageFormToken(token) {
  if (!token || typeof token !== 'string') return null;
  const key = token.trim().toLowerCase().replace(/\.$/, '');
  return DOSAGE_FORM_MAP[key] || null;
}

function normalizeUnitToken(token) {
  if (!token || typeof token !== 'string') return null;
  const key = token.trim().toLowerCase().replace(/\.$/, '');
  return UNIT_TOKEN_MAP[key] || null;
}

function normalizeReleaseToken(token) {
  if (!token || typeof token !== 'string') return null;
  const key = token.trim().toLowerCase().replace(/\s+/g, ' ');
  return RELEASE_TOKEN_MAP[key] || token.trim().toUpperCase();
}

function isBoilerplateLine(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^\[fixture\s+oracle\s+note:/i.test(trimmed)) return true;
  return BOILERPLATE_LINE_PATTERNS.some((rx) => rx.test(trimmed));
}

/**
 * Extract document-level (non-medicine) fields from a single line.
 */
function extractDocumentLevelFieldsFromLine(lineText, documentType, meta) {
  const fields = [];
  const trimmed = lineText.trim();

  // 1. Date
  const dateMatch = trimmed.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]20\d{2})\b/);
  if (dateMatch) {
    const dateFieldType =
      documentType === 'PRESCRIPTION'
        ? 'prescription_date'
        : documentType === 'PHARMACY_INVOICE'
        ? 'invoice_date'
        : 'claim_date';
    fields.push({
      fieldType: dateFieldType,
      rawValue: trimmed,
      normalizedValue: dateMatch[1].replace(/\//g, '-'),
      pageNumber: meta.pageNumber,
      boundingBox: meta.boundingBox,
      extractionConfidence: meta.extractionConfidence,
      needsCorrection: meta.needsCorrection,
      candidateRowKey: null
    });
  }

  // 2. Total / Claimed Amount
  if (documentType === 'PHARMACY_INVOICE') {
    const totalMatch = trimmed.match(
      /\b(?:total(?:\s*amount)?|net(?:\s*amount)?|grand\s*total|bill\s*amount|amount\s*payable)\s*[:=-]?\s*(?:rs\.?|inr|\$)?\s*(\d+(?:\.\d{1,2})?)\b/i
    );
    if (totalMatch) {
      fields.push({
        fieldType: 'total_amount',
        rawValue: trimmed,
        normalizedValue: parseFloat(totalMatch[1]).toFixed(2),
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        extractionConfidence: meta.extractionConfidence,
        needsCorrection: meta.needsCorrection,
        candidateRowKey: null
      });
    }
  } else if (documentType === 'CLAIM_FORM') {
    const claimedMatch = trimmed.match(
      /\b(?:claimed(?:\s*amount)?|claim\s*amount|total\s*claimed|reimbursement(?:\s*amount)?|amount)\s*[:=-]?\s*(?:rs\.?|inr|\$)?\s*(\d+(?:\.\d{1,2})?)\b/i
    );
    if (claimedMatch) {
      fields.push({
        fieldType: 'claimed_amount',
        rawValue: trimmed,
        normalizedValue: parseFloat(claimedMatch[1]).toFixed(2),
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        extractionConfidence: meta.extractionConfidence,
        needsCorrection: meta.needsCorrection,
        candidateRowKey: null
      });
    }
  }

  // 3. Prescriber Name (PRESCRIPTION)
  if (documentType === 'PRESCRIPTION') {
    const drMatch = trimmed.match(/\b(dr\.?\s+[a-z][a-z\s.]{2,40})\b/i);
    if (drMatch) {
      fields.push({
        fieldType: 'prescriber_name',
        rawValue: trimmed,
        normalizedValue: drMatch[1].trim(),
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        extractionConfidence: meta.extractionConfidence,
        needsCorrection: meta.needsCorrection,
        candidateRowKey: null
      });
    }
  }

  // 4. Pharmacy Name (PHARMACY_INVOICE)
  if (documentType === 'PHARMACY_INVOICE') {
    const pharmMatch = trimmed.match(
      /\b([a-z0-9][a-z0-9\s&.'-]{1,40}\s+(?:pharmacy|medicals|chemist|druggist|pharma|dispensary))\b/i
    );
    if (pharmMatch && !/\b(?:invoice|prescription|claim)\b/i.test(pharmMatch[1])) {
      fields.push({
        fieldType: 'pharmacy_name',
        rawValue: trimmed,
        normalizedValue: pharmMatch[1].trim(),
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        extractionConfidence: meta.extractionConfidence,
        needsCorrection: meta.needsCorrection,
        candidateRowKey: null
      });
    }
  }

  return fields;
}

/**
 * Determine whether a line is a flat multi-medicine line or has competing strengths on one line.
 */
function detectFlatMultiMedicineOrCompetingLine(lineText) {
  const trimmed = lineText.trim();
  if (!trimmed) return null;

  // If pipe-delimited single item template: e.g. "Paracetamol | 500 mg | tablet | 10 tablet"
  // check the first segment and check if multiple segments contain distinct medicine names
  if (trimmed.includes('|')) {
    const segments = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      // Check if first segment itself is flat multi-medicine
      if (isFlatMultiMedicineText(segments[0], segments[0])) {
        return 'FLAT_MULTI_MEDICINE_LINE';
      }
      return null;
    }
  }

  // Strip trailing ", Qty: ..." or "; Qty: ..." before checking comma/semicolon multi-medicine
  const withoutTrailingQtyOrPack = trimmed.replace(
    /[,;]\s*(?:qty|quantity|dispensed|pack(?:\s*size)?|strip\s+of|price|total|amount|mrp)\b[\s\S]*$/i,
    ''
  );

  if (isFlatMultiMedicineText(withoutTrailingQtyOrPack, withoutTrailingQtyOrPack)) {
    return 'FLAT_MULTI_MEDICINE_LINE';
  }

  // Check for competing distinct dosage strengths on the same single line (excluding combination a/b mg)
  const maskedForStrength = withoutTrailingQtyOrPack
    .replace(/\b(?:pack(?:\s*size)?|strip|box|bottle)\s*(?:of|:|=|-)?\s*\d+\s*(?:tablets?|tabs?|capsules?|caps?|ml)\b/gi, ' ')
    .replace(/\b(?:qty|quantity|dispensed|supply)\s*[:=-]?\s*\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|ml)?\b/gi, ' ');

  const strengthMatches = Array.from(
    maskedForStrength.matchAll(/\b(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mg(?:\s*\/\s*\d*\s*ml)?|mcg|g|iu|%))\b/gi)
  ).map((m) => m[1].replace(/\s+/g, '').toLowerCase());

  const uniqueStrengths = Array.from(new Set(strengthMatches));
  if (uniqueStrengths.length > 1) {
    return 'COMPETING_STRENGTHS_ON_LINE';
  }

  return null;
}

/**
 * Parse medicine slots from a single line (either a pipe-delimited row, a full medicine line,
 * or a standalone continuation attribute line).
 */
function parseLineMedicineSlots(lineText) {
  const trimmed = lineText.trim();
  const slots = {
    medicine_name: null,
    dosage_strength: null,
    dosage_form: null,
    release_type: null,
    quantity: null,
    quantity_unit: null,
    pack_size: null,
    pack_unit: null
  };

  // Case 1: Pipe-delimited structured line (e.g. "Paracetamol | 500 mg | tablet | IR | 10 tablet | Pack size: 10 tablet")
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const packMatch =
          part.match(/\b(?:pack(?:\s*size)?\s*[:=-]?\s*)(\d+)(?:\s*([a-z]+)(?:\s*(?:per|\/)\s*([a-z]+))?)?\b/i) ||
          part.match(/\b(\d+)\s*(tablets?|tabs?|capsules?|caps?|ml|sachets?|units?)\s*(?:per|\/)\s*(?:strip|pack|box|bottle)s?\b/i);
        if (packMatch) {
          slots.pack_size = { rawValue: part, normalizedValue: String(Number(packMatch[1])) };
          const unitCandidate = packMatch[2];
          const normPackUnit = normalizeUnitToken(unitCandidate);
          if (normPackUnit) {
            slots.pack_unit = { rawValue: unitCandidate, normalizedValue: normPackUnit };
          }
          continue;
        }

        const qtyMatch =
          part.match(/^(?:qty|quantity|dispensed)?\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(tablets?|tabs?|capsules?|caps?|strips?|packs?|bottles?|vials?|tubes?|sachets?|ml|units?)?$/i);
        if (qtyMatch && (i > 0 || /^(?:qty|quantity)/i.test(part))) {
          slots.quantity = { rawValue: part, normalizedValue: String(Number(qtyMatch[1])) };
          if (qtyMatch[2]) {
            const normUnit = normalizeUnitToken(qtyMatch[2]);
            if (normUnit) {
              slots.quantity_unit = { rawValue: qtyMatch[2], normalizedValue: normUnit };
            }
          }
          continue;
        }

        const strengthOnly = part.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mg(?:\s*\/\s*\d*\s*ml)?|mcg|g|ml|iu|%))$/i);
        if (strengthOnly) {
          slots.dosage_strength = {
            rawValue: part,
            normalizedValue: strengthOnly[1].replace(/\s+/g, '').toLowerCase()
          };
          continue;
        }

        const formOnly = normalizeDosageFormToken(part);
        if (formOnly) {
          slots.dosage_form = { rawValue: part, normalizedValue: formOnly };
          continue;
        }

        const releaseOnly = part.match(/^(Sustained\s+Release|Extended\s+Release|Delayed\s+Release|Controlled\s+Release|Immediate\s+Release|Modified\s+Release|SR|ER|XL|XR|DR|CR|IR|MR|EC)$/i);
        if (releaseOnly) {
          slots.release_type = { rawValue: part, normalizedValue: normalizeReleaseToken(releaseOnly[1]) };
          continue;
        }

        if (i === 0) {
          // First segment may be pure medicine name or medicine + strength/form/release
          const subSlots = parseNaturalMedicineLine(part);
          for (const key of RECOGNIZED_MEDICINE_SLOTS) {
            if (subSlots[key] && !slots[key]) {
              slots[key] = subSlots[key];
            }
          }
          if (!slots.medicine_name && /^[A-Za-z]/.test(part)) {
            const cleanName = cleanMedicineNameText(part);
            if (cleanName) {
              slots.medicine_name = { rawValue: part, normalizedValue: cleanName };
            }
          }
        }
      }
      return slots;
    }
  }

  return parseNaturalMedicineLine(trimmed);
}

function cleanMedicineNameText(rawSegment) {
  let s = rawSegment.trim();
  // Remove leading numbering / bullet / Rx / Item / Row prefix
  s = s.replace(/^(?:\s*(?:(?:item|line|row|med(?:icine)?|rx)\s*#?\s*\d*\s*[:.)\-]?|#?\d+\s*[:.)\-]|\(\d+\)|\[\d+\]|[-*•])\s*)+/i, '');
  // Remove leading attribute label prefix if standalone attribute line
  s = s.replace(/^(?:dosage\s+strength|strength|dosage\s+form|form|dose|release(?:\s+type)?|pack\s+unit|quantity\s+unit|unit)\s*[:=-]\s*/i, '');
  // Remove leading dosage form prefix (e.g. "Tab.", "Cap.", "Syr.", "Inj.")
  s = s.replace(/^(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?s?|inj(?:ection)?s?|susp(?:ension)?s?|oint(?:ment)?s?|drops?)\.?\s+/i, '');
  // Remove trailing pack/quantity clauses
  s = s.replace(/\b(?:qty|quantity|dispensed|disp|supply)\s*[:=-]?[\s\S]*$/i, '');
  s = s.replace(/\b(?:pack(?:\s*size)?)\s*[:=-]?[\s\S]*$/i, '');
  s = s.replace(/\(\s*\d+\s*(?:tablets?|tabs?|capsules?|caps?|ml)[\s\S]*?\)/gi, '');
  s = s.replace(/\b\d+\s*(?:strips?|packs?|boxes?|bottles?)\s+of\s+\d+[\s\S]*$/i, '');
  s = s.replace(/\b(?:strip|pack|box|bottle)\s+of\s+\d+[\s\S]*$/i, '');
  s = s.replace(/(?:\s+[-–]\s+|\s+[xX×]\s*)\d+\s*(?:tablets?|tabs?|capsules?|caps?|strips?|packs?|bottles?|vials?|sachets?|ml)?\s*$/i, '');
  // Remove explicit dosage strength tokens
  s = s.replace(/\b\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mg(?:\s*\/\s*\d*\s*ml)?|mcg|g|ml|iu|%)\b/gi, ' ');
  // Remove explicit dosage form tokens
  s = s.replace(
    /\b(?:tablets?|tabs?\.?|capsules?|caps?\.?|syrups?|syr\.?|syp\.?|suspensions?|susp\.?|injections?|inj\.?|creams?|ointments?|oint\.?|gels?|drops?|inhalers?|sachets?|solutions?|lotions?)\b/gi,
    ' '
  );
  // Remove explicit release tokens at word boundaries
  s = s.replace(
    /\b(?:sustained\s+release|extended\s+release|delayed\s+release|controlled\s+release|immediate\s+release|modified\s+release|sr|er|xl|xr|dr|cr|ir|mr|ec)\b/gi,
    ' '
  );
  // Collapse whitespace and trim punctuation
  s = s.replace(/\s+/g, ' ').replace(/^[\s,:;.\-–()]+|[\s,:;.\-–()]+$/g, '').trim();
  return s;
}

function parseNaturalMedicineLine(trimmed) {
  const slots = {
    medicine_name: null,
    dosage_strength: null,
    dosage_form: null,
    release_type: null,
    quantity: null,
    quantity_unit: null,
    pack_size: null,
    pack_unit: null
  };

  let working = trimmed;

  // 1. Check combined "<qty> <strip/pack> of <pack_size> <tablets/caps>"
  const combinedPackQtyMatch = working.match(
    /\b(?:(?:qty|quantity|dispensed)\s*[:=-]?\s*)?(\d+)\s*(strip|pack|box|bottle)s?\s*(?:of|\()\s*(\d+)\s*(tablets?|tabs?|capsules?|caps?|ml|sachets?)?\)?/i
  );
  if (combinedPackQtyMatch) {
    slots.quantity = {
      rawValue: combinedPackQtyMatch[0].trim(),
      normalizedValue: String(Number(combinedPackQtyMatch[1]))
    };
    const normUnit = normalizeUnitToken(combinedPackQtyMatch[2]);
    if (normUnit) {
      slots.quantity_unit = {
        rawValue: combinedPackQtyMatch[2],
        normalizedValue: normUnit
      };
    }
    slots.pack_size = {
      rawValue: combinedPackQtyMatch[0].trim(),
      normalizedValue: String(Number(combinedPackQtyMatch[3]))
    };
    if (combinedPackQtyMatch[4]) {
      const normContainedUnit = normalizeUnitToken(combinedPackQtyMatch[4]);
      if (normContainedUnit) {
        slots.pack_unit = {
          rawValue: combinedPackQtyMatch[4],
          normalizedValue: normContainedUnit
        };
      }
    }
    working = working.replace(combinedPackQtyMatch[0], ' ');
  }

  // 2. Check explicit pack expressions if not already found
  if (!slots.pack_size) {
    const perStripMatch = working.match(
      /\(?(\d+)\s*(tablets?|tabs?|capsules?|caps?|units?|sachets?|ml)\s*(?:per|\/)\s*(?:strip|pack|box|bottle)s?\)?/i
    );
    if (perStripMatch) {
      slots.pack_size = {
        rawValue: perStripMatch[0].trim(),
        normalizedValue: String(Number(perStripMatch[1]))
      };
      const normPackUnit = normalizeUnitToken(perStripMatch[2]);
      if (normPackUnit) {
        slots.pack_unit = {
          rawValue: perStripMatch[2],
          normalizedValue: normPackUnit
        };
      }
      working = working.replace(perStripMatch[0], ' ');
    } else {
      const packOfMatch = working.match(
        /\b(?:strip|pack|box|bottle)s?\s+of\s+(\d+)\s*(tablets?|tabs?|capsules?|caps?|ml|sachets?)?\b/i
      );
      if (packOfMatch) {
        slots.pack_size = {
          rawValue: packOfMatch[0].trim(),
          normalizedValue: String(Number(packOfMatch[1]))
        };
        if (packOfMatch[2]) {
          const normPackUnit = normalizeUnitToken(packOfMatch[2]);
          if (normPackUnit) {
            slots.pack_unit = {
              rawValue: packOfMatch[2],
              normalizedValue: normPackUnit
            };
          }
        }
        working = working.replace(packOfMatch[0], ' ');
      } else {
        const packLabelMatch = working.match(
          /\bpack(?:\s*size)?\s*[:=-]?\s*(\d+)(?:\s*[xX×]\s*(\d+))?\s*(tablets?|tabs?|capsules?|caps?|strips?|packs?|boxes?|bottles?|ml)?\b/i
        );
        if (packLabelMatch) {
          const sizeVal = packLabelMatch[2] || packLabelMatch[1];
          slots.pack_size = {
            rawValue: packLabelMatch[0].trim(),
            normalizedValue: String(Number(sizeVal))
          };
          if (packLabelMatch[3]) {
            const normPackUnit = normalizeUnitToken(packLabelMatch[3]);
            if (normPackUnit) {
              slots.pack_unit = {
                rawValue: packLabelMatch[3],
                normalizedValue: normPackUnit
              };
            }
          }
          working = working.replace(packLabelMatch[0], ' ');
        }
      }
    }
  }

  // 3. Check explicit quantity expressions if not already found
  if (!slots.quantity) {
    const labeledQtyMatch = working.match(
      /\b(?:qty|quantity|dispensed|disp|supply)\s*[:=-]?\s*(\d+(?:\.\d+)?)(?:\s*(tablets?|tabs?|capsules?|caps?|strips?|packs?|boxes?|bottles?|vials?|tubes?|sachets?|ml|units?))?\b/i
    );
    if (labeledQtyMatch) {
      slots.quantity = {
        rawValue: labeledQtyMatch[0].trim(),
        normalizedValue: String(Number(labeledQtyMatch[1]))
      };
      if (labeledQtyMatch[2]) {
        const normUnit = normalizeUnitToken(labeledQtyMatch[2]);
        if (normUnit) {
          slots.quantity_unit = {
            rawValue: labeledQtyMatch[2],
            normalizedValue: normUnit
          };
        }
      }
      working = working.replace(labeledQtyMatch[0], ' ');
    } else {
      // Multiplier or trailing "<num> <unit>" after medicine description
      const multQtyMatch = working.match(
        /(?:^|\s)[xX×]\s*(\d+)\s*(tablets?|tabs?|capsules?|caps?|strips?|packs?|boxes?|bottles?|vials?|tubes?|sachets?)?\b/i
      );
      if (multQtyMatch) {
        slots.quantity = {
          rawValue: multQtyMatch[0].trim(),
          normalizedValue: String(Number(multQtyMatch[1]))
        };
        if (multQtyMatch[2]) {
          const normUnit = normalizeUnitToken(multQtyMatch[2]);
          if (normUnit) {
            slots.quantity_unit = {
              rawValue: multQtyMatch[2],
              normalizedValue: normUnit
            };
          }
        }
        working = working.replace(multQtyMatch[0], ' ');
      } else {
        const standaloneOrTrailingQty = working.match(
          /(?:^|(?:\s+[-–]\s+|\s{2,}))(\d+)\s+(tablets?|tabs?|capsules?|caps?|strips?|packs?|boxes?|bottles?|vials?|tubes?|sachets?)\s*$/i
        );
        if (standaloneOrTrailingQty) {
          slots.quantity = {
            rawValue: standaloneOrTrailingQty[0].trim(),
            normalizedValue: String(Number(standaloneOrTrailingQty[1]))
          };
          const normUnit = normalizeUnitToken(standaloneOrTrailingQty[2]);
          if (normUnit) {
            slots.quantity_unit = {
              rawValue: standaloneOrTrailingQty[2],
              normalizedValue: normUnit
            };
          }
          working = working.replace(standaloneOrTrailingQty[0], ' ');
        }
      }
    }
  }

  // 4. Extract dosage_strength from remaining working string
  const strengthMatch = working.match(
    /\b(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mg(?:\s*\/\s*\d*\s*ml)?|mcg|g|ml|iu|%))\b/i
  );
  if (strengthMatch) {
    slots.dosage_strength = {
      rawValue: strengthMatch[1].trim(),
      normalizedValue: strengthMatch[1].replace(/\s+/g, '').toLowerCase()
    };
  }

  // 5. Extract release_type from remaining working string
  const releaseMatch = working.match(
    /\b(Sustained\s+Release|Extended\s+Release|Delayed\s+Release|Controlled\s+Release|Immediate\s+Release|Modified\s+Release|SR|ER|XL|XR|DR|CR|IR|MR|EC)\b/i
  );
  if (releaseMatch) {
    slots.release_type = {
      rawValue: releaseMatch[1].trim(),
      normalizedValue: normalizeReleaseToken(releaseMatch[1])
    };
  }

  // 6. Extract dosage_form from remaining working string
  const formMatch = working.match(
    /\b(tablets?|tabs?\.?|capsules?|caps?\.?|syrups?|syr\.?|syp\.?|suspensions?|susp\.?|injections?|inj\.?|creams?|ointments?|oint\.?|gels?|drops?|inhalers?|sachets?|solutions?|lotions?)\b/i
  );
  if (formMatch) {
    const normForm = normalizeDosageFormToken(formMatch[1]);
    if (normForm) {
      slots.dosage_form = {
        rawValue: formMatch[1].trim(),
        normalizedValue: normForm
      };
    }
  }

  // 7. Determine if the remaining text contains a medicine_name anchor
  const cleanedName = cleanMedicineNameText(working);
  if (cleanedName && /[A-Za-z]{3,}/.test(cleanedName)) {
    const lowerWords = cleanedName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const hasKnownToken = lowerWords.some((w) => KNOWN_MEDICINE_TOKENS.has(w));
    const hasFormPrefix = /^(?:item\s*\d+[:.)]?|\d+[.)]|\(\d+\)|#\d+[:.)]?|rx[:\s-]*)?\s*(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?s?|inj(?:ection)?s?|susp(?:ension)?s?|oint(?:ment)?s?|drops?)\.?\s+[A-Za-z]/i.test(
      trimmed
    );
    const hasStrengthOrFormCompanion = Boolean(slots.dosage_strength || slots.dosage_form || slots.release_type);
    const isForbiddenNonMedicine = /^(?:total|claimed|amount|date|dr|doctor|patient|hospital|clinic|pharmacy|invoice|prescription|claim|subtotal|tax|gst|discount|signature|strength|dosage|dose|form|release|quantity|qty|pack|unit|units|route|frequency|duration)\b/i.test(
      cleanedName
    );

    if (!isForbiddenNonMedicine && (hasKnownToken || hasFormPrefix || hasStrengthOrFormCompanion)) {
      const safeRawMed = /[,;\n\r|]/.test(trimmed) ? cleanedName : trimmed;
      slots.medicine_name = {
        rawValue: safeRawMed,
        normalizedValue: cleanedName
      };
    }
  }

  return slots;
}

/**
 * Extract structured candidate fields, up to 3 candidate medicine rows, and layout/limit blockers
 * from OCR lines or pages.
 *
 * @param {Object|Array} input - OCR result `{ lines, rawText, confidence, pageNumber }`, array of lines, or `{ pages }`
 * @param {Object|string} [options] - `{ documentType, pageNumber, extractionMethod }`
 */
function extractMedicineRows(input, options = {}) {
  const opts = typeof options === 'string' ? { documentType: options } : options || {};
  const documentType = (opts.documentType || input?.documentType || 'PRESCRIPTION').toUpperCase();
  const defaultPageNumber = Number.isInteger(opts.pageNumber) && opts.pageNumber >= 1
    ? opts.pageNumber
    : Number.isInteger(input?.pageNumber) && input.pageNumber >= 1
    ? input.pageNumber
    : 1;
  const extractionMethod = opts.extractionMethod || input?.extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR';
  const defaultConfidence = opts.confidence ?? opts.extractionConfidence ?? input?.confidence ?? input?.extractionConfidence;

  // Normalize pages and lines
  const normalizedLines = [];
  if (typeof input === 'string') {
    for (const rawTextLine of input.split(/\r?\n/)) {
      normalizedLines.push({
        text: rawTextLine,
        confidence: defaultConfidence,
        bbox: opts.bbox ?? opts.boundingBox ?? null,
        pageNumber: defaultPageNumber
      });
    }
  } else if (Array.isArray(input)) {
    for (const line of input) {
      if (typeof line === 'string') {
        normalizedLines.push({
          text: line,
          confidence: defaultConfidence,
          bbox: null,
          pageNumber: defaultPageNumber
        });
      } else if (line && typeof line.text === 'string') {
        normalizedLines.push({
          text: line.text,
          confidence: line.confidence ?? line.extractionConfidence ?? defaultConfidence,
          bbox: line.bbox ?? line.boundingBox,
          pageNumber: Number.isInteger(line.pageNumber) && line.pageNumber >= 1 ? line.pageNumber : defaultPageNumber
        });
      }
    }
  } else if (input && typeof input === 'object') {
    if (Array.isArray(input.pages)) {
      for (const page of input.pages) {
        const pNum = Number.isInteger(page?.pageNumber) && page.pageNumber >= 1 ? page.pageNumber : defaultPageNumber;
        const pageText = typeof page?.rawText === 'string' ? page.rawText : typeof page?.text === 'string' ? page.text : '';
        const pageLines =
          Array.isArray(page?.lines) && page.lines.length > 0
            ? page.lines
            : pageText.trim().length > 0
            ? pageText.split(/\r?\n/).map((t) => ({ text: t, confidence: page.confidence ?? defaultConfidence, bbox: null }))
            : [];
        for (const line of pageLines) {
          if (line && typeof line.text === 'string') {
            normalizedLines.push({
              text: line.text,
              confidence: line.confidence ?? line.extractionConfidence ?? page.confidence ?? defaultConfidence,
              bbox: line.bbox ?? line.boundingBox ?? null,
              pageNumber: Number.isInteger(line.pageNumber) && line.pageNumber >= 1 ? line.pageNumber : pNum
            });
          }
        }
      }
    } else {
      const fullText = typeof input.rawText === 'string' ? input.rawText : typeof input.text === 'string' ? input.text : '';
      const rawLines =
        Array.isArray(input.lines) && input.lines.length > 0
          ? input.lines
          : fullText.trim().length > 0
          ? fullText.split(/\r?\n/).map((t) => ({ text: t, confidence: defaultConfidence, bbox: null }))
          : [];
      for (const line of rawLines) {
        if (line && typeof line.text === 'string') {
          normalizedLines.push({
            text: line.text,
            confidence: line.confidence ?? line.extractionConfidence ?? defaultConfidence,
            bbox: line.bbox ?? line.boundingBox ?? null,
            pageNumber: Number.isInteger(line.pageNumber) && line.pageNumber >= 1 ? line.pageNumber : defaultPageNumber
          });
        }
      }
    }
  }

  const documentFields = [];
  const allDetectedRows = [];
  const ungroupedConflictFields = [];
  const blockerCodeSet = new Set();
  const issues = [];

  let currentRow = null;

  for (const rawLine of normalizedLines) {
    const text = rawLine.text.trim();
    if (!text || isBoilerplateLine(text)) {
      continue;
    }

    const boundingBox = normalizeBoundingBox(rawLine.bbox);
    const extractionConfidence = normalizeConfidence(rawLine.confidence);
    const needsCorrection =
      extractionConfidence === null || extractionConfidence < CONFIDENCE_REVIEW_THRESHOLD;

    const lineMeta = {
      pageNumber: rawLine.pageNumber,
      boundingBox,
      extractionConfidence,
      needsCorrection,
      extractionMethod
    };

    // Extract document-level fields
    const docFieldsOnLine = extractDocumentLevelFieldsFromLine(text, documentType, lineMeta);
    for (const df of docFieldsOnLine) {
      documentFields.push({
        ...df,
        extractionMethod
      });
    }

    // Never extract medicine rows on CLAIM_FORM
    if (documentType === 'CLAIM_FORM') {
      continue;
    }

    // If the line only contained document-level metadata (date, total, Dr., Pharmacy), skip medicine parsing
    const isPureDocLevelLine =
      docFieldsOnLine.length > 0 &&
      !/\b(?:\d+\s*(?:mg|mcg|g|iu)\b|tab(?:let)?s?\b|cap(?:sule)?s?\b|syr(?:up)?s?\b|qty\b|quantity\b)/i.test(text);
    if (isPureDocLevelLine) {
      continue;
    }

    // Check for flat multi-medicine or competing-strengths line
    const layoutViolation = detectFlatMultiMedicineOrCompetingLine(text);
    if (layoutViolation) {
      blockerCodeSet.add('UNSUPPORTED_LAYOUT');
      issues.push({
        code: 'UNSUPPORTED_LAYOUT',
        reason: layoutViolation,
        pageNumber: rawLine.pageNumber,
        message: `Line on page ${rawLine.pageNumber} contains multiple medicines or competing strengths that cannot be safely split.`,
        rawText: text
      });
      ungroupedConflictFields.push({
        fieldType: 'medicine_name',
        rawValue: text,
        normalizedValue: text,
        pageNumber: rawLine.pageNumber,
        boundingBox,
        extractionMethod,
        extractionConfidence: extractionConfidence ?? 0.5,
        needsCorrection: true,
        candidateRowKey: null
      });
      currentRow = null;
      continue;
    }

    const parsedSlots = parseLineMedicineSlots(text);
    const presentSlotKeys = RECOGNIZED_MEDICINE_SLOTS.filter((k) => parsedSlots[k] !== null);
    if (presentSlotKeys.length === 0) {
      continue;
    }

    if (parsedSlots.medicine_name !== null) {
      // Start a new medicine row
      const rowIndex = allDetectedRows.length + 1;
      const candidateRowKey = `row_${rowIndex}`;
      const rowObj = {
        candidateRowKey,
        rowIndex,
        pageNumber: rawLine.pageNumber,
        rawText: text,
        slots: {
          medicine_name: null,
          dosage_strength: null,
          dosage_form: null,
          release_type: null,
          quantity: null,
          quantity_unit: null,
          pack_size: null,
          pack_unit: null
        }
      };

      for (const slotKey of presentSlotKeys) {
        const slotVal = parsedSlots[slotKey];
        rowObj.slots[slotKey] = {
          fieldType: slotKey,
          rawValue: slotVal.rawValue,
          normalizedValue: slotVal.normalizedValue,
          pageNumber: rawLine.pageNumber,
          boundingBox,
          extractionMethod,
          extractionConfidence,
          needsCorrection,
          candidateRowKey
        };
      }

      allDetectedRows.push(rowObj);
      currentRow = rowObj;
    } else {
      // Attribute-only continuation line (e.g. "500 mg", "Qty: 10", "Pack: 10 tablets/strip")
      const canAttachToCurrent =
        currentRow !== null &&
        (currentRow.pageNumber === rawLine.pageNumber || allDetectedRows.length === 1);

      if (!canAttachToCurrent) {
        blockerCodeSet.add('UNSUPPORTED_LAYOUT');
        issues.push({
          code: 'UNSUPPORTED_LAYOUT',
          reason: 'ORPHAN_MEDICINE_ATTRIBUTE_LINE',
          pageNumber: rawLine.pageNumber,
          message: `Attribute line on page ${rawLine.pageNumber} cannot be unambiguously linked to a medicine row.`,
          rawText: text
        });
        for (const slotKey of presentSlotKeys) {
          const slotVal = parsedSlots[slotKey];
          ungroupedConflictFields.push({
            fieldType: slotKey,
            rawValue: slotVal.rawValue,
            normalizedValue: slotVal.normalizedValue,
            pageNumber: rawLine.pageNumber,
            boundingBox,
            extractionMethod,
            extractionConfidence,
            needsCorrection: true,
            candidateRowKey: null
          });
        }
        continue;
      }

      for (const slotKey of presentSlotKeys) {
        const slotVal = parsedSlots[slotKey];
        const existingSlot = currentRow.slots[slotKey];
        if (!existingSlot) {
          currentRow.slots[slotKey] = {
            fieldType: slotKey,
            rawValue: slotVal.rawValue,
            normalizedValue: slotVal.normalizedValue,
            pageNumber: rawLine.pageNumber,
            boundingBox,
            extractionMethod,
            extractionConfidence,
            needsCorrection,
            candidateRowKey: currentRow.candidateRowKey
          };
        } else if (
          String(existingSlot.normalizedValue).toLowerCase() ===
          String(slotVal.normalizedValue).toLowerCase()
        ) {
          // Same normalized value on an explicit standalone column line: prefer standalone bbox/rawValue
          // while preserving conservative confidence & review flag
          const mergedConfidence =
            existingSlot.extractionConfidence === null || extractionConfidence === null
              ? null
              : Math.min(existingSlot.extractionConfidence, extractionConfidence);
          currentRow.slots[slotKey] = {
            fieldType: slotKey,
            rawValue: slotVal.rawValue,
            normalizedValue: existingSlot.normalizedValue,
            pageNumber: rawLine.pageNumber,
            boundingBox: boundingBox || existingSlot.boundingBox,
            extractionMethod,
            extractionConfidence: mergedConfidence,
            needsCorrection:
              existingSlot.needsCorrection ||
              needsCorrection ||
              mergedConfidence === null ||
              mergedConfidence < CONFIDENCE_REVIEW_THRESHOLD,
            candidateRowKey: currentRow.candidateRowKey
          };
        } else {
          // Competing different slot value on the same medicine row
          blockerCodeSet.add('UNSUPPORTED_LAYOUT');
          issues.push({
            code: 'UNSUPPORTED_LAYOUT',
            reason: 'COMPETING_ROW_SLOT_VALUES',
            pageNumber: rawLine.pageNumber,
            message: `Row "${currentRow.candidateRowKey}" has competing values for slot "${slotKey}".`,
            rawText: text
          });
          existingSlot.needsCorrection = true;
          ungroupedConflictFields.push({
            fieldType: slotKey,
            rawValue: slotVal.rawValue,
            normalizedValue: slotVal.normalizedValue,
            pageNumber: rawLine.pageNumber,
            boundingBox,
            extractionMethod,
            extractionConfidence,
            needsCorrection: true,
            candidateRowKey: null
          });
        }
      }
    }
  }

  const detectedRowCount = allDetectedRows.length;
  if (detectedRowCount > MAX_MEDICINE_ITEMS) {
    blockerCodeSet.add('ITEM_LIMIT_EXCEEDED');
    issues.push({
      code: 'ITEM_LIMIT_EXCEEDED',
      reason: 'MAX_MEDICINE_ROWS_EXCEEDED',
      pageNumber: allDetectedRows[MAX_MEDICINE_ITEMS]?.pageNumber || defaultPageNumber,
      message: `Detected ${detectedRowCount} medicine rows, exceeding the maximum supported limit of ${MAX_MEDICINE_ITEMS}.`,
      rawText: ''
    });
  }

  const hasLayoutOrLimitBlocker =
    blockerCodeSet.has('UNSUPPORTED_LAYOUT') || blockerCodeSet.has('ITEM_LIMIT_EXCEEDED');

  // Build candidate fields list (capped to MAX_MEDICINE_ITEMS emitted rows)
  const candidates = [];
  const medicineRows = [];
  const proposedGroups = [];

  for (const row of allDetectedRows.slice(0, MAX_MEDICINE_ITEMS)) {
    const rowFields = [];
    for (const slotKey of RECOGNIZED_MEDICINE_SLOTS) {
      const fieldCandidate = row.slots[slotKey];
      if (fieldCandidate) {
        const finalCandidate = {
          ...fieldCandidate,
          fieldName: fieldCandidate.fieldType,
          needsCorrection: hasLayoutOrLimitBlocker ? true : fieldCandidate.needsCorrection
        };
        rowFields.push(finalCandidate);
        candidates.push(finalCandidate);
      }
    }
    medicineRows.push({
      candidateRowKey: row.candidateRowKey,
      pageNumber: row.pageNumber,
      rawText: row.rawText,
      fields: rowFields,
      slots: row.slots
    });

    if (!hasLayoutOrLimitBlocker && rowFields.length > 0 && row.slots.medicine_name) {
      proposedGroups.push({
        candidateRowKey: row.candidateRowKey,
        anchorSlot: 'medicine_name',
        slotTypes: rowFields.map((f) => f.fieldType)
      });
    }
  }

  for (const conflictField of ungroupedConflictFields) {
    candidates.push({
      ...conflictField,
      fieldName: conflictField.fieldType
    });
  }

  // Deduplicate document-level fields by (fieldType, pageNumber, normalizedValue)
  const seenDocFields = new Set();
  const dedupedDocFields = [];
  for (const df of documentFields) {
    const key = `${df.fieldType}::${df.pageNumber}::${df.normalizedValue}`;
    if (!seenDocFields.has(key)) {
      seenDocFields.add(key);
      const enrichedDocField = {
        ...df,
        fieldName: df.fieldType
      };
      dedupedDocFields.push(enrichedDocField);
      candidates.push(enrichedDocField);
    }
  }

  const blockerCodes = Array.from(blockerCodeSet);
  const needsReview =
    blockerCodes.length > 0 ||
    candidates.some((c) => c.needsCorrection === true) ||
    (documentType !== 'CLAIM_FORM' && detectedRowCount === 0);

  return {
    documentType,
    candidates,
    fields: candidates,
    medicineRows,
    documentFields: dedupedDocFields,
    detectedRowCount,
    proposedGroups,
    blockerCodes,
    extractionBlockers: blockerCodes,
    issues,
    needsReview
  };
}

/**
 * Given persisted ExtractedField documents (with `_id`/`id` and `candidateRowKey`),
 * construct concrete `groups` (`[{ anchorFieldId, fieldIds }]`) for `AUTO_PROPOSED` grouping.
 */
function buildProposedGroupsFromPersistedFields(persistedFields = [], options = {}) {
  const blockerCodes = Array.isArray(options.blockerCodes)
    ? options.blockerCodes
    : Array.isArray(options.extractionBlockers)
    ? options.extractionBlockers
    : [];
  if (
    blockerCodes.includes('ITEM_LIMIT_EXCEEDED') ||
    blockerCodes.includes('UNSUPPORTED_LAYOUT')
  ) {
    return [];
  }

  const medicineFields = persistedFields.filter((f) =>
    RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType || f.fieldName)
  );
  if (medicineFields.length === 0) {
    return [];
  }

  // Every medicine field must have a non-empty candidateRowKey to auto-propose groups cleanly
  if (medicineFields.some((f) => !f.candidateRowKey || typeof f.candidateRowKey !== 'string')) {
    return [];
  }

  const byRowKey = new Map();
  for (const field of medicineFields) {
    const key = field.candidateRowKey;
    if (!byRowKey.has(key)) {
      byRowKey.set(key, []);
    }
    byRowKey.get(key).push(field);
  }

  if (byRowKey.size === 0 || byRowKey.size > MAX_MEDICINE_ITEMS) {
    return [];
  }

  const groups = [];
  for (const [rowKey, rowFields] of byRowKey.entries()) {
    const anchor = rowFields.find((f) => (f.fieldType || f.fieldName) === 'medicine_name');
    if (!anchor) {
      return [];
    }
    // Check no duplicate slot types in the same row
    const seenSlots = new Set();
    for (const rf of rowFields) {
      const slotType = rf.fieldType || rf.fieldName;
      if (seenSlots.has(slotType)) {
        return [];
      }
      seenSlots.add(slotType);
    }
    const anchorId = String(anchor.id || anchor._id);
    const fieldIds = rowFields.map((rf) => String(rf.id || rf._id));
    const pageNumbers = Array.from(
      new Set(
        rowFields
          .map((rf) => rf.pageNumber)
          .filter((p) => Number.isInteger(p) && p >= 1)
      )
    ).sort((a, b) => a - b);
    groups.push({
      candidateRowKey: rowKey,
      anchorFieldId: anchorId,
      fieldIds,
      pageNumbers
    });
  }

  return groups;
}

module.exports = {
  extractMedicineRows,
  buildProposedGroupsFromPersistedFields,
  normalizeBoundingBox,
  normalizeConfidence
};
