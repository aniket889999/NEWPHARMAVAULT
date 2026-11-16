const crypto = require('node:crypto');
const VerificationCase = require('../../models/verificationCaseModel');
const { caseScope } = require('../chatRagService');
const { buildCaseReconciliationSnapshot } = require('./caseReconciliationService');
const {
  withCaseMutationGuard,
  createControlledError
} = require('./caseEvidenceMutationService');

const SESSION_4_SCHEMA_VERSION = '2.0.0-session4';
const RECEIPT_VERSION = 'pv-s4-receipt-v1';
const RECEIPT_TTL_MS = 12 * 60 * 60 * 1000;
const DISCLAIMER =
  'Academic document-verification assistant, not medical advice, dosing guidance, substitution approval or insurance adjudication. An authorized human reviewer makes the final verification decision.';

const CASE_ID_REGEX = /^[a-f0-9]{24}$/;
const MEDICINE_ITEM_ID_REGEX = /^mi_[a-f0-9]{24}$/;
const ANSWER_ID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const MEDICINE_SLOT_TYPES = [
  'medicine_name',
  'dosage_strength',
  'dosage_form',
  'release_type',
  'quantity',
  'quantity_unit',
  'pack_size',
  'pack_unit'
];

const KNOWN_MEDICINE_TOKENS = [
  'paracetamol',
  'acetaminophen',
  'crocin',
  'dolo',
  'calpol',
  'metformin',
  'glycomet',
  'glucophage',
  'amoxicillin',
  'cetirizine',
  'cetzine',
  'zyrtec',
  'atorvastatin',
  'lipitor',
  'pantoprazole',
  'pan',
  'amlodipine',
  'azithromycin',
  'ibuprofen',
  'omeprazole',
  'losartan',
  'ciprofloxacin'
];

const MEDICATION_SYNONYM_GROUPS = [
  ['paracetamol', 'acetaminophen', 'crocin', 'dolo', 'calpol'],
  ['metformin', 'glycomet', 'glucophage'],
  ['cetirizine', 'cetzine', 'zyrtec'],
  ['atorvastatin', 'lipitor'],
  ['pantoprazole', 'pan'],
  ['amoxicillin'],
  ['amlodipine'],
  ['azithromycin'],
  ['ibuprofen'],
  ['omeprazole'],
  ['losartan'],
  ['ciprofloxacin']
];

function sha256Hex(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

function escapeMarkdown(raw) {
  return String(raw ?? '')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/[\\`*_{}[\]()#+\-|<>]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeId(val) {
  return typeof val === 'string' ? val.trim().toLowerCase() : String(val ?? '').trim().toLowerCase();
}

function isCaseId(val) {
  return typeof val === 'string' && CASE_ID_REGEX.test(val);
}

function isMedicineItemId(val) {
  return typeof val === 'string' && MEDICINE_ITEM_ID_REGEX.test(val);
}

function isAnswerId(val) {
  return typeof val === 'string' && ANSWER_ID_REGEX.test(val);
}

function getFieldId(field) {
  if (!field || typeof field !== 'object') return null;
  const candidate = field.id || field.fieldId || field._id;
  if (!candidate) return null;
  const s = normalizeId(String(candidate));
  return isCaseId(s) ? s : null;
}

function buildFieldMapFromSnapshot(snapshot) {
  const map = new Map();
  const groupingDocs = Array.isArray(snapshot?.groupingDocuments) ? snapshot.groupingDocuments : [];
  for (const gd of groupingDocs) {
    const docId = normalizeId(gd?.documentId);
    const docType = gd?.documentType || null;
    const fields = Array.isArray(gd?.fields) ? gd.fields : [];
    for (const f of fields) {
      const fid = getFieldId(f);
      if (!fid) continue;
      map.set(fid, {
        ...f,
        id: fid,
        documentId: isCaseId(normalizeId(f.documentId)) ? normalizeId(f.documentId) : docId,
        documentType: f.documentType || docType
      });
    }
  }

  for (const env of [snapshot?.prescription, snapshot?.invoice]) {
    if (!env || typeof env !== 'object') continue;
    const docId = normalizeId(env.documentId);
    const docType = env.documentType || null;
    const items = Array.isArray(env.medicineItems) ? env.medicineItems : [];
    for (const item of items) {
      const slots = item?.fields && typeof item.fields === 'object' ? item.fields : {};
      for (const [slotName, slotField] of Object.entries(slots)) {
        if (!slotField || typeof slotField !== 'object') continue;
        const fid = getFieldId(slotField);
        if (!fid) continue;
        const existing = map.get(fid) || {};
        map.set(fid, {
          ...existing,
          ...slotField,
          id: fid,
          fieldType: slotField.fieldType || existing.fieldType || slotName,
          documentId: isCaseId(normalizeId(slotField.documentId))
            ? normalizeId(slotField.documentId)
            : existing.documentId || docId,
          documentType: slotField.documentType || existing.documentType || docType,
          ownerItemId: item.itemId
        });
      }
    }
    const unassigned = Array.isArray(env.unassignedFields) ? env.unassignedFields : [];
    for (const uf of unassigned) {
      const fid = getFieldId(uf);
      if (!fid || map.has(fid)) continue;
      map.set(fid, {
        ...uf,
        id: fid,
        documentId: isCaseId(normalizeId(uf.documentId)) ? normalizeId(uf.documentId) : docId,
        documentType: uf.documentType || docType
      });
    }
  }

  return map;
}

function getCanonicalSlotField(item, slotName, fieldMap) {
  const rawSlot = item?.fields ? item.fields[slotName] : null;
  if (!rawSlot || typeof rawSlot !== 'object') return null;
  const fid = getFieldId(rawSlot);
  const fromMap = fid ? fieldMap.get(fid) : null;
  const merged = fromMap ? { ...rawSlot, ...fromMap, id: fid } : { ...rawSlot, id: fid };
  return {
    id: fid,
    documentId: isCaseId(normalizeId(merged.documentId || item?.documentId))
      ? normalizeId(merged.documentId || item?.documentId)
      : null,
    documentType: merged.documentType || item?.documentType || null,
    fieldType: String(merged.fieldType || slotName),
    rawValue: String(merged.rawValue ?? ''),
    normalizedValue: String(merged.normalizedValue ?? merged.rawValue ?? ''),
    pageNumber:
      Number.isInteger(merged.pageNumber) && merged.pageNumber >= 1 ? merged.pageNumber : 1,
    boundingBox: Array.isArray(merged.boundingBox) ? merged.boundingBox : null,
    extractionConfidence:
      typeof merged.extractionConfidence === 'number' && Number.isFinite(merged.extractionConfidence)
        ? Number(merged.extractionConfidence)
        : null,
    needsCorrection: Boolean(merged.needsCorrection),
    correctedBy: merged.correctedBy ? String(merged.correctedBy) : null
  };
}

function extractAllItems(snapshot, fieldMap) {
  const items = [];
  for (const env of [snapshot?.prescription, snapshot?.invoice]) {
    if (!env || typeof env !== 'object' || !Array.isArray(env.medicineItems)) continue;
    for (const item of env.medicineItems) {
      if (!item || !isMedicineItemId(item.itemId)) continue;
      const canonicalSlots = {};
      for (const slot of MEDICINE_SLOT_TYPES) {
        canonicalSlots[slot] = getCanonicalSlotField(item, slot, fieldMap);
      }
      items.push({
        ...item,
        documentId: normalizeId(item.documentId || env.documentId),
        documentType: item.documentType || env.documentType,
        canonicalSlots
      });
    }
  }
  return items;
}

function extractChoices(snapshot, allItems = null) {
  const fieldMap = buildFieldMapFromSnapshot(snapshot);
  const items = allItems || extractAllItems(snapshot, fieldMap);
  const choices = [];
  const seen = new Set();

  for (const item of items) {
    if (choices.length >= 6) break;
    if (!isMedicineItemId(item.itemId) || seen.has(item.itemId)) continue;
    if (!['PRESCRIPTION', 'PHARMACY_INVOICE'].includes(item.documentType)) continue;
    seen.add(item.itemId);

    const med = item.canonicalSlots.medicine_name;
    const strength = item.canonicalSlots.dosage_strength;
    const form = item.canonicalSlots.dosage_form;
    const qty = item.canonicalSlots.quantity;
    const qtyUnit = item.canonicalSlots.quantity_unit;

    const docLabel = item.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Invoice';
    const parts = [
      med ? escapeMarkdown(med.normalizedValue || med.rawValue) : 'Unnamed medicine'
    ];
    if (strength && (strength.normalizedValue || strength.rawValue)) {
      parts.push(escapeMarkdown(strength.normalizedValue || strength.rawValue));
    }
    if (form && (form.normalizedValue || form.rawValue)) {
      parts.push(escapeMarkdown(form.normalizedValue || form.rawValue));
    }
    let label = `${docLabel}: ${parts.join(' ')}`;
    if (qty && (qty.normalizedValue || qty.rawValue)) {
      const qVal = escapeMarkdown(qty.normalizedValue || qty.rawValue);
      const uVal =
        qtyUnit && (qtyUnit.normalizedValue || qtyUnit.rawValue)
          ? ` ${escapeMarkdown(qtyUnit.normalizedValue || qtyUnit.rawValue)}`
          : '';
      label += ` (Qty: ${qVal}${uVal})`;
    }
    label = label.trim().slice(0, 240) || `${docLabel} item ${item.itemId}`;

    choices.push({
      itemId: item.itemId,
      label,
      documentType: item.documentType
    });
  }

  return choices;
}

/**
 * Compute deterministic domain-separated dependency key -> SHA-256 hex map.
 * Never includes case evidenceRevision, snapshotToken, updatedAt, correctedAt, or wall clock.
 *
 * @param {Object} snapshot - Session 3 case reconciliation snapshot
 * @returns {Map<string, string>}
 */
function buildDependencyIndex(snapshot) {
  const index = new Map();
  if (!snapshot || typeof snapshot !== 'object') return index;

  const caseId = normalizeId(snapshot.caseId);
  const fieldMap = buildFieldMapFromSnapshot(snapshot);
  const groupingDocs = Array.isArray(snapshot.groupingDocuments) ? snapshot.groupingDocuments : [];
  const groupingByDocId = new Map();
  for (const gd of groupingDocs) {
    if (gd && gd.documentId) {
      groupingByDocId.set(normalizeId(gd.documentId), gd);
    }
  }

  // 1. Field-level keys
  const sortedFieldIds = [...fieldMap.keys()].sort();
  for (const fid of sortedFieldIds) {
    const f = fieldMap.get(fid);
    const key = `field:${fid}`;
    index.set(
      key,
      sha256Hex({
        domain: 'pv-s4-field-v1',
        caseId,
        documentId: normalizeId(f.documentId),
        documentType: String(f.documentType || ''),
        fieldId: fid,
        fieldType: String(f.fieldType || ''),
        rawValue: String(f.rawValue ?? ''),
        normalizedValue: String(f.normalizedValue ?? f.rawValue ?? ''),
        pageNumber: Number.isInteger(f.pageNumber) ? f.pageNumber : null,
        boundingBox: Array.isArray(f.boundingBox) ? f.boundingBox : null,
        extractionConfidence:
          typeof f.extractionConfidence === 'number' && Number.isFinite(f.extractionConfidence)
            ? Number(f.extractionConfidence)
            : null,
        needsCorrection: Boolean(f.needsCorrection),
        correctedBy: f.correctedBy ? String(f.correctedBy) : null
      })
    );
  }

  // 2. Document-level source lifecycle & coverage keys
  const docEntries = new Map();
  for (const env of [snapshot.prescription, snapshot.invoice]) {
    if (env && env.documentId) {
      const dId = normalizeId(env.documentId);
      docEntries.set(dId, {
        docId: dId,
        docType: env.documentType,
        envelope: env,
        groupingDoc: groupingByDocId.get(dId) || null
      });
    }
  }
  for (const [dId, gd] of groupingByDocId.entries()) {
    if (!docEntries.has(dId)) {
      const env =
        gd.documentType === 'PRESCRIPTION'
          ? snapshot.prescription
          : gd.documentType === 'PHARMACY_INVOICE'
            ? snapshot.invoice
            : null;
      if (env && normalizeId(env.documentId) === dId) {
        docEntries.set(dId, { docId: dId, docType: gd.documentType, envelope: env, groupingDoc: gd });
      } else if (
        (gd.documentType === 'PRESCRIPTION' && snapshot.prescription !== null) ||
        (gd.documentType === 'PHARMACY_INVOICE' && snapshot.invoice !== null)
      ) {
        docEntries.set(dId, { docId: dId, docType: gd.documentType, envelope: null, groupingDoc: gd });
      }
    }
  }

  for (const [dId, info] of [...docEntries.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { docType, envelope, groupingDoc } = info;
    const structuralNotices = (Array.isArray(snapshot.notices) ? snapshot.notices : [])
      .filter(
        (n) =>
          normalizeId(n?.documentId) === dId &&
          [
            'EXTRACTION_INCOMPLETE',
            'PAGE_COVERAGE_INCOMPLETE',
            'UNSUPPORTED_LAYOUT',
            'ITEM_LIMIT_EXCEEDED'
          ].includes(n.code)
      )
      .map((n) => n.code)
      .sort();

    index.set(
      `doc:${dId}:source`,
      sha256Hex({
        domain: 'pv-s4-doc-source-v1',
        caseId,
        documentId: dId,
        documentType: String(docType || ''),
        processingStatus: String(groupingDoc?.processingStatus || 'PROCESSED'),
        groupingStatus: envelope ? String(envelope.groupingStatus || '') : null,
        sha256: envelope?.sha256 || groupingDoc?.sha256 || null,
        extractionRunId: envelope?.extractionRunId || groupingDoc?.extractionRunId || null,
        coverage: envelope?.coverage
          ? {
              total: envelope.coverage.total ?? null,
              processed: envelope.coverage.processed ?? null,
              omitted: envelope.coverage.omitted ?? null,
              status: envelope.coverage.status ?? null,
              isComplete: Boolean(envelope.coverage.isComplete)
            }
          : null,
        structuralNotices
      })
    );
  }

  // 3. Item-level membership and slot keys
  const allItems = extractAllItems(snapshot, fieldMap);
  for (const item of allItems) {
    const dId = item.documentId;
    const gd = groupingByDocId.get(dId) || null;
    const anchorId = normalizeId(item.anchorFieldId);
    let matchingGroup = null;
    if (gd && Array.isArray(gd.groups)) {
      matchingGroup =
        gd.groups.find((g) => normalizeId(g?.anchorFieldId) === anchorId) ||
        gd.groups[(Number.isInteger(item.itemIndex) ? item.itemIndex : 1) - 1] ||
        null;
    }

    const envFieldIds = Array.isArray(item.fieldIds)
      ? [...item.fieldIds].map(normalizeId).sort()
      : [];
    const gdFieldIds =
      matchingGroup && Array.isArray(matchingGroup.fieldIds)
        ? [...matchingGroup.fieldIds].map(normalizeId).sort()
        : null;

    index.set(
      `item:${item.itemId}:membership`,
      sha256Hex({
        domain: 'pv-s4-item-membership-v1',
        caseId,
        documentId: dId,
        documentType: String(item.documentType || ''),
        itemId: item.itemId,
        anchorFieldId: anchorId,
        envelopeFieldIds: envFieldIds,
        groupingDocFieldIds: gdFieldIds,
        groupingStatus:
          item.documentType === 'PRESCRIPTION'
            ? snapshot.prescription?.groupingStatus || null
            : snapshot.invoice?.groupingStatus || null
      })
    );

    for (const slotName of MEDICINE_SLOT_TYPES) {
      const slotField = item.canonicalSlots[slotName];
      index.set(
        `item:${item.itemId}:slot:${slotName}`,
        sha256Hex({
          domain: 'pv-s4-item-slot-v1',
          caseId,
          documentId: dId,
          itemId: item.itemId,
          slotName,
          fieldId: slotField ? slotField.id : null,
          rawValue: slotField ? slotField.rawValue : null,
          normalizedValue: slotField ? slotField.normalizedValue : null,
          pageNumber: slotField ? slotField.pageNumber : null,
          extractionConfidence: slotField ? slotField.extractionConfidence : null,
          needsCorrection: slotField ? slotField.needsCorrection : null,
          correctedBy: slotField ? slotField.correctedBy : null
        })
      );
    }
  }

  // 4. Case-level status & comparison topology keys
  const claimNotices = (Array.isArray(snapshot.notices) ? snapshot.notices : [])
    .filter((n) => n && n.code !== 'LEGACY_FINDINGS_STALE')
    .map((n) => `${n.code}:${normalizeId(n.documentId) || 'case'}`)
    .sort();

  index.set(
    'case:status',
    sha256Hex({
      domain: 'pv-s4-case-status-v1',
      caseId,
      caseStatus: String(snapshot.caseStatus || ''),
      canVerify: Boolean(snapshot.reviewEligibility?.canVerify),
      allowedActions: [...(snapshot.reviewEligibility?.allowedActions || [])].sort(),
      blockerCodes: [...(snapshot.reviewEligibility?.blockerCodes || [])].sort(),
      notices: claimNotices
    })
  );

  index.set(
    'case:comparison',
    sha256Hex({
      domain: 'pv-s4-case-comparison-v1',
      caseId,
      rxDocId: normalizeId(snapshot.prescription?.documentId) || null,
      invDocId: normalizeId(snapshot.invoice?.documentId) || null,
      itemIds: allItems.map((it) => it.itemId).sort(),
      groupingModes: groupingDocs
        .map((gd) => `${normalizeId(gd?.documentId)}:${gd?.mode || 'UNCONFIRMED'}`)
        .sort(),
      comparisonStatus: snapshot.comparison?.status || null,
      hasInsufficientEvidence: Boolean(snapshot.comparison?.hasInsufficientEvidence),
      rows: Array.isArray(snapshot.comparison?.rows)
        ? snapshot.comparison.rows.map((r) => ({
            rowId: r.rowId,
            genericName: r.genericName || null,
            status: r.status,
            prescriptionItemId: r.prescriptionItemId,
            invoiceItemId: r.invoiceItemId,
            checks: {
              identity: r.checks?.identity || null,
              strength: r.checks?.strength || null,
              form: r.checks?.form || null,
              release: r.checks?.release || null,
              quantity: r.checks?.quantity || null
            },
            quantity: r.quantity || null,
            reasonCodes: [...(r.reasonCodes || [])].sort(),
            evidenceReferences: r.evidenceReferences || []
          }))
        : [],
      notices: claimNotices
    })
  );

  return index;
}

function classifyQuestion(message) {
  const text = String(message || '').trim();

  // 1. Urgent safety triggers
  if (
    /\b(chest pain|cannot breathe|can't breathe|difficulty breathing|breathing difficulty|shortness of breath|overdose|unconscious|seizure|severe allergic|anaphylaxis|stroke|suicid\w*|bleeding heavily|heart attack)\b/i.test(
      text
    )
  ) {
    return { kind: 'SAFETY', intent: 'UNSUPPORTED' };
  }

  // 2. Clinical advice, dosing decision, substitution, claim approval, fraud judgment, or off-topic triggers
  if (
    /\b(should i take|can i take|how much should i take|is it safe to take|safe for me|prescribe me|diagnos\w*|treat(?:ment)? for|symptoms? of|side effects?|adverse effects?|drug interactions?|contraindications?|pregnan\w*|breastfeeding|substitute with|switch to another|alternative medicine|approve (?:this|the) (?:insurance )?claim|reject (?:this|the) claim|reimburse\w*|policy coverage|is this fraud\w*|forged|write (?:python|javascript|java|c\+\+) code|write code|weather|stock market|recipe|joke|movie)\b/i.test(
      text
    )
  ) {
    return { kind: 'ABSTAIN', intent: 'UNSUPPORTED' };
  }

  // 3. Supported bounded case intents
  if (
    /\b(case status|verification status|review status|can (?:i|we|this case) verify|ready to verify|why is verify blocked|review blockers?|blocker codes?|allowed actions?|what status is (?:the|this) case|is (?:the|this) case verified|eligibility)\b/i.test(
      text
    )
  ) {
    return { kind: 'SUPPORTED', intent: 'CASE_STATUS' };
  }

  if (
    /\b(compare|comparison|reconcil\w*|match(?:es|ed|ing)?|mismatch\w*|discrepanc\w*|consistent|consistency|difference between|vs\.?|versus|align\w*)\b/i.test(
      text
    )
  ) {
    return { kind: 'SUPPORTED', intent: 'COMPARISON' };
  }

  if (
    /\b(strength|dosage strength|concentration|potency|how many mg|recorded mg|mg on)\b/i.test(text) ||
    (/\bdosage\b/i.test(text) && !/\bdosage form\b/i.test(text))
  ) {
    return { kind: 'SUPPORTED', intent: 'STRENGTH' };
  }

  if (
    /\b(quantity|qty|how many (?:tablets?|capsules?|strips?|packs?|bottles?|units?)|pack size|pack unit|dispensed count|prescribed count|recorded units?)\b/i.test(
      text
    )
  ) {
    return { kind: 'SUPPORTED', intent: 'QUANTITY' };
  }

  if (
    /\b(medicine name|what medicine|which medicine|drug name|brand|generic|identity|dosage form|release type|tablet or capsule|recorded medicine)\b/i.test(
      text
    )
  ) {
    return { kind: 'SUPPORTED', intent: 'IDENTITY' };
  }

  return { kind: 'ABSTAIN', intent: 'UNSUPPORTED' };
}

function getSynonymSetForToken(token) {
  const lower = String(token || '').toLowerCase();
  for (const group of MEDICATION_SYNONYM_GROUPS) {
    if (group.includes(lower)) {
      return new Set(group);
    }
  }
  return new Set([lower]);
}

function itemMatchesMedicineName(item, token, snapshot) {
  const synonyms = getSynonymSetForToken(token);
  const medSlot = item?.canonicalSlots?.medicine_name;
  const medText = `${medSlot?.normalizedValue || ''} ${medSlot?.rawValue || ''}`.toLowerCase();
  for (const syn of synonyms) {
    if (medText.includes(syn)) return true;
  }
  // Check paired reconciliation row identity if available
  const rows = Array.isArray(snapshot?.comparison?.rows) ? snapshot.comparison.rows : [];
  for (const r of rows) {
    if (r.prescriptionItemId === item.itemId || r.invoiceItemId === item.itemId) {
      const rowText = `${r.identity?.displayName || ''} ${r.identity?.prescriptionName || ''} ${r.identity?.invoiceName || ''}`.toLowerCase();
      for (const syn of synonyms) {
        if (rowText.includes(syn)) return true;
      }
    }
  }
  return false;
}

function extractMentionedMedicineTokens(message, allItems) {
  const lower = String(message || '').toLowerCase();
  const mentioned = new Set();
  for (const tok of KNOWN_MEDICINE_TOKENS) {
    const re = new RegExp(`\\b${tok}\\b`, 'i');
    if (re.test(lower)) {
      mentioned.add(tok);
    }
  }
  for (const item of allItems) {
    const medSlot = item?.canonicalSlots?.medicine_name;
    const norm = String(medSlot?.normalizedValue || medSlot?.rawValue || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/^\d/.test(w));
    for (const word of norm) {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(lower)) {
        mentioned.add(word);
      }
    }
  }
  return [...mentioned];
}

function detectRequestedDocType(message) {
  const lower = String(message || '').toLowerCase();
  const mentionsRx = /\b(prescription|prescribed|rx)\b/i.test(lower);
  const mentionsInv = /\b(invoice|invoiced|bill|dispensed|pharmacy invoice)\b/i.test(lower);
  if (mentionsRx && !mentionsInv) return 'PRESCRIPTION';
  if (mentionsInv && !mentionsRx) return 'PHARMACY_INVOICE';
  return null;
}

function collectRelevantWarnings(snapshot, targetItems, includeComparisonWarning = false) {
  const warnings = [];
  const addWarning = (w) => {
    const trimmed = String(w || '').trim().slice(0, 500);
    if (trimmed && !warnings.includes(trimmed) && warnings.length < 12) {
      warnings.push(trimmed);
    }
  };

  const groupingByDocId = new Map(
    (Array.isArray(snapshot?.groupingDocuments) ? snapshot.groupingDocuments : []).map((gd) => [
      normalizeId(gd.documentId),
      gd
    ])
  );

  const relevantDocIds = new Set(targetItems.map((it) => it.documentId));
  for (const docId of relevantDocIds) {
    const gd = groupingByDocId.get(docId);
    if (gd && gd.mode !== 'HUMAN_CONFIRMED') {
      addWarning(
        `Medicine item grouping on ${gd.documentType} is currently ${gd.mode} and has not been human-confirmed.`
      );
    }
    const env =
      gd?.documentType === 'PRESCRIPTION' || snapshot?.prescription?.documentId === docId
        ? snapshot?.prescription
        : snapshot?.invoice;
    if (env?.coverage && !env.coverage.isComplete) {
      addWarning(
        `${env.documentType} page coverage is incomplete (${env.coverage.processed ?? 0} of ${env.coverage.total ?? '?'} page(s) processed).`
      );
    }
  }

  for (const item of targetItems) {
    const hasUncertainSlot = Object.values(item.canonicalSlots || {}).some(
      (s) =>
        s &&
        (s.needsCorrection ||
          (typeof s.extractionConfidence === 'number' && s.extractionConfidence < 0.75))
    );
    if (item.needsCorrection || hasUncertainSlot) {
      addWarning(
        `Item ${item.itemId} on ${item.documentType} contains field(s) marked for human correction or OCR uncertainty.`
      );
    }
  }

  if (includeComparisonWarning && snapshot?.comparison) {
    if (snapshot.comparison.status === 'MISMATCH') {
      addWarning(
        'Cross-document medicine reconciliation detected a discrepancy; human verification is blocked.'
      );
    } else if (snapshot.comparison.hasInsufficientEvidence) {
      addWarning(
        'Cross-document medicine reconciliation has insufficient or unconfirmed evidence.'
      );
    }
  }

  return warnings;
}

/**
 * Pure deterministic case-bound answer builder.
 * Does not touch clock, random UUIDs, secrets, or database.
 *
 * @param {Object} params
 * @param {Object} params.snapshot - Session 3 case reconciliation snapshot
 * @param {string} params.message - User query
 * @param {string|null} [params.medicineItemId=null] - Optional selected medicine item ID
 * @returns {Object} AnswerDraft
 */
function buildCaseAnswer({ snapshot, message, medicineItemId = null }) {
  if (!snapshot || typeof snapshot !== 'object' || !isCaseId(normalizeId(snapshot.caseId))) {
    throw createControlledError(400, 'INVALID_SNAPSHOT', 'A valid Session 3 case snapshot is required.');
  }
  const caseId = normalizeId(snapshot.caseId);
  const evidenceRevision =
    Number.isInteger(snapshot.evidenceRevision) && snapshot.evidenceRevision >= 0
      ? snapshot.evidenceRevision
      : 0;

  const fieldMap = buildFieldMapFromSnapshot(snapshot);
  const allItems = extractAllItems(snapshot, fieldMap);
  const choices = extractChoices(snapshot, allItems);
  const choiceIds = new Set(choices.map((c) => c.itemId));
  const depIndex = buildDependencyIndex(snapshot);

  const makeNonSourcedDraft = ({ mode, intent, reply, warnings = [] }) => ({
    schemaVersion: SESSION_4_SCHEMA_VERSION,
    caseId,
    evidenceRevision,
    reply: String(reply).slice(0, 12000),
    mode,
    intent,
    medicineItemId: null,
    choices,
    sources: [],
    warnings: warnings.slice(0, 12),
    dependencyKeys: [],
    bindingToken: null,
    disclaimer: DISCLAIMER
  });

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage) {
    return makeNonSourcedDraft({
      mode: 'CLARIFY',
      intent: 'UNSUPPORTED',
      reply:
        'Please enter a bounded question about the recorded medicine strength, quantity, identity, cross-document comparison, or case verification status.'
    });
  }

  const classification = classifyQuestion(trimmedMessage);
  if (classification.kind === 'SAFETY') {
    return makeNonSourcedDraft({
      mode: 'SAFETY',
      intent: 'UNSUPPORTED',
      reply:
        'This may require urgent medical attention. Do not wait for a document-verification assistant response; contact local emergency services or a qualified clinician immediately.'
    });
  }

  if (classification.kind === 'ABSTAIN') {
    return makeNonSourcedDraft({
      mode: 'ABSTAIN',
      intent: 'UNSUPPORTED',
      reply:
        'I can only report and compare recorded fields from this verification case (strength, quantity, medicine identity, cross-document comparison, and case verification status). I cannot provide clinical dosing or treatment advice, substitution recommendations, fraud conclusions, insurance claim approvals, or off-topic answers.'
    });
  }

  const intent = classification.intent;
  const requestedDocType = detectRequestedDocType(trimmedMessage);

  // Validate explicit medicineItemId if provided
  let selectedItem = null;
  if (medicineItemId !== null && medicineItemId !== undefined) {
    if (!isMedicineItemId(medicineItemId)) {
      return makeNonSourcedDraft({
        mode: choices.length > 0 ? 'CLARIFY' : 'ABSTAIN',
        intent,
        reply:
          'The selected medicine item identifier is invalid. Please select one of the available medicine items in this case.'
      });
    }
    selectedItem = allItems.find((it) => it.itemId === medicineItemId && choiceIds.has(it.itemId)) || null;
    if (!selectedItem) {
      return makeNonSourcedDraft({
        mode: choices.length > 0 ? 'CLARIFY' : 'ABSTAIN',
        intent,
        reply:
          'The selected medicine item is not present in the current case snapshot. Please select a current medicine item from the case.'
      });
    }

    if (intent !== 'CASE_STATUS' && requestedDocType && selectedItem.documentType !== requestedDocType) {
      return makeNonSourcedDraft({
        mode: 'CLARIFY',
        intent,
        reply: 'Your question names a different document from the selected medicine item. Please select the intended prescription or invoice item.'
      });
    }

    // Check if the message explicitly names a conflicting medicine not matching selectedItem
    const mentionedTokens = extractMentionedMedicineTokens(trimmedMessage, allItems);
    if (
      mentionedTokens.length > 0 &&
      !mentionedTokens.every((tok) => itemMatchesMedicineName(selectedItem, tok, snapshot))
    ) {
      return makeNonSourcedDraft({
        mode: 'CLARIFY',
        intent,
        reply:
          'Your question mentions a medicine name that does not match the currently selected medicine item. Please clarify or select the intended medicine item from the choices.'
      });
    }
  }

  // Helper to build sources and dependency keys
  const sources = [];
  const seenSourceIds = new Set();
  const dependencyKeySet = new Set();

  const addDependencyKey = (key) => {
    if (key && depIndex.has(key) && dependencyKeySet.size < 64) {
      dependencyKeySet.add(key);
    }
  };

  const addFieldCitation = (item, slotName, labelOverride = null) => {
    if (!item || !choiceIds.has(item.itemId) || sources.length >= 12) return null;
    const slotField = item.canonicalSlots?.[slotName];
    if (!slotField || !slotField.id || !slotField.documentId) return null;
    const sourceId = `field:${slotField.id}`;
    const existing = sources.find((s) => s.sourceId === sourceId);
    if (existing) return existing.citation;

    const fingerprint = depIndex.get(sourceId);
    if (!fingerprint) return null;

    const citation = `S${sources.length + 1}`;
    const docLabel = item.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy Invoice';
    const slotTitle = labelOverride || slotName.replace(/_/g, ' ');
    const valText = escapeMarkdown(slotField.normalizedValue || slotField.rawValue || 'empty');
    const uncertaintyTag = slotField.needsCorrection ? ' (requires human confirmation)' : '';
    const confTag =
      typeof slotField.extractionConfidence === 'number'
        ? `, confidence ${slotField.extractionConfidence.toFixed(2)}`
        : '';

    sources.push({
      citation,
      sourceId,
      documentId: slotField.documentId,
      fieldId: slotField.id,
      pageNumber: slotField.pageNumber,
      itemId: item.itemId,
      title: `${docLabel} ${slotTitle} (page ${slotField.pageNumber})`.slice(0, 160),
      excerpt: `Recorded ${slotTitle}: "${valText}" on page ${slotField.pageNumber}${uncertaintyTag}${confTag}.`.slice(
        0,
        1000
      ),
      fingerprint
    });
    seenSourceIds.add(sourceId);
    addDependencyKey(sourceId);
    return citation;
  };

  // Handle CASE_STATUS intent
  if (intent === 'CASE_STATUS') {
    const statusFp = depIndex.get('case:status');
    if (!statusFp) {
      return makeNonSourcedDraft({
        mode: 'ABSTAIN',
        intent: 'CASE_STATUS',
        reply: 'Case status evidence is unavailable in the current snapshot.'
      });
    }
    const canVerify = Boolean(snapshot.reviewEligibility?.canVerify);
    const blockers = Array.isArray(snapshot.reviewEligibility?.blockerCodes)
      ? snapshot.reviewEligibility.blockerCodes
      : [];
    const allowedActions = Array.isArray(snapshot.reviewEligibility?.allowedActions)
      ? snapshot.reviewEligibility.allowedActions
      : [];

    const citation = 'S1';
    const blockerSummary =
      blockers.length > 0 ? `Active blockers: ${blockers.join(', ')}.` : 'No verification blockers.';
    sources.push({
      citation,
      sourceId: 'case:status',
      documentId: null,
      fieldId: null,
      pageNumber: null,
      itemId: null,
      title: 'Case verification status and review eligibility',
      excerpt: `Status: ${escapeMarkdown(snapshot.caseStatus)}; canVerify: ${canVerify}; allowedActions: ${
        allowedActions.join(', ') || 'none'
      }. ${escapeMarkdown(blockerSummary)}`.slice(0, 1000),
      fingerprint: statusFp
    });
    addDependencyKey('case:status');

    let itemSuffix = '';
    if (selectedItem) {
      const medCit = addFieldCitation(selectedItem, 'medicine_name', 'medicine name');
      addDependencyKey(`doc:${selectedItem.documentId}:source`);
      addDependencyKey(`item:${selectedItem.itemId}:membership`);
      addDependencyKey(`item:${selectedItem.itemId}:slot:medicine_name`);
      if (medCit) {
        const medVal = escapeMarkdown(
          selectedItem.canonicalSlots.medicine_name?.normalizedValue ||
            selectedItem.canonicalSlots.medicine_name?.rawValue
        );
        itemSuffix = ` Selected medicine item is **${medVal}** [${medCit}].`;
      }
    }

    const reply = `Current case status is **${escapeMarkdown(
      snapshot.caseStatus
    )}** [${citation}]. Human verification eligibility (\`canVerify\`): **${
      canVerify ? 'Yes' : 'No (blocked)'
    }** [${citation}]. ${escapeMarkdown(blockerSummary)} Allowed reviewer actions: **${
      allowedActions.length > 0 ? allowedActions.map(escapeMarkdown).join(', ') : 'none'
    }** [${citation}].${itemSuffix}`;

    const warnings = collectRelevantWarnings(snapshot, selectedItem ? [selectedItem] : allItems, true);

    return {
      schemaVersion: SESSION_4_SCHEMA_VERSION,
      caseId,
      evidenceRevision,
      reply,
      mode: 'LOCAL_CASE_EVIDENCE',
      intent: 'CASE_STATUS',
      medicineItemId: selectedItem ? selectedItem.itemId : null,
      choices,
      sources,
      warnings,
      dependencyKeys: [...dependencyKeySet],
      bindingToken: null,
      disclaimer: DISCLAIMER
    };
  }

  // If no grouped medicine items exist for medicine-level intents, abstain conservatively
  if (allItems.length === 0) {
    return makeNonSourcedDraft({
      mode: 'ABSTAIN',
      intent,
      reply:
        'No grouped medicine items are available in the current case snapshot. Complete OCR extraction and confirm medicine item grouping first.',
      warnings: collectRelevantWarnings(snapshot, [], true)
    });
  }

  // Resolve target item(s) when medicineItemId is not explicitly selected
  const mentionedTokens = extractMentionedMedicineTokens(trimmedMessage, allItems);

  if (!selectedItem && intent !== 'COMPARISON') {
    let candidates = [...allItems];
    if (requestedDocType) {
      candidates = candidates.filter((it) => it.documentType === requestedDocType);
    }
    if (mentionedTokens.length > 0) {
      const matchedByName = candidates.filter((it) =>
        mentionedTokens.some((tok) => itemMatchesMedicineName(it, tok, snapshot))
      );
      if (matchedByName.length === 0) {
        return makeNonSourcedDraft({
          mode: choices.length > 0 ? 'CLARIFY' : 'ABSTAIN',
          intent,
          reply:
            'No recorded medicine item in this case matches the medicine name in your question. Please select one of the recorded case medicine items.'
        });
      }
      candidates = matchedByName;
    }

    if (candidates.length === 0) {
      return makeNonSourcedDraft({
        mode: choices.length > 0 ? 'CLARIFY' : 'ABSTAIN',
        intent,
        reply:
          'No recorded medicine item was found on the requested document. Please select an available medicine item.'
      });
    }

    // Check if candidates span multiple distinct medicine rows or have different values across documents
    const distinctRows = new Set(
      candidates.map((it) => {
        const row = (snapshot.comparison?.rows || []).find(
          (r) => r.prescriptionItemId === it.itemId || r.invoiceItemId === it.itemId
        );
        return row ? row.rowId : it.itemId;
      })
    );

    if (distinctRows.size > 1 || (candidates.length > 1 && !requestedDocType)) {
      return makeNonSourcedDraft({
        mode: 'CLARIFY',
        intent,
        reply:
          'Multiple medicine items exist in this case. Please select the specific prescription or invoice medicine item you want to inspect.'
      });
    }

    selectedItem = candidates[0];
  }

  // Handle STRENGTH intent
  if (intent === 'STRENGTH') {
    const medCit = addFieldCitation(selectedItem, 'medicine_name', 'medicine name');
    const strCit = addFieldCitation(selectedItem, 'dosage_strength', 'dosage strength');

    addDependencyKey(`doc:${selectedItem.documentId}:source`);
    addDependencyKey(`item:${selectedItem.itemId}:membership`);
    addDependencyKey(`item:${selectedItem.itemId}:slot:medicine_name`);
    addDependencyKey(`item:${selectedItem.itemId}:slot:dosage_strength`);

    if (!medCit && !strCit) {
      return makeNonSourcedDraft({
        mode: 'ABSTAIN',
        intent: 'STRENGTH',
        reply: 'Recorded medicine name and dosage strength fields are missing for the selected item.'
      });
    }

    const docLabel =
      selectedItem.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy Invoice';
    const medField = selectedItem.canonicalSlots.medicine_name;
    const strField = selectedItem.canonicalSlots.dosage_strength;
    const medName = medField
      ? escapeMarkdown(medField.normalizedValue || medField.rawValue)
      : 'Unnamed medicine';

    let reply = '';
    if (strCit && strField) {
      const strVal = escapeMarkdown(strField.normalizedValue || strField.rawValue);
      const medRef = medCit ? ` [${medCit}]` : '';
      const uncertainNote =
        strField.needsCorrection || medField?.needsCorrection
          ? ' This recorded value is flagged for human confirmation.'
          : '';
      reply = `${docLabel} item **${medName}**${medRef} has recorded dosage strength **${strVal}** on page ${strField.pageNumber} [${strCit}].${uncertainNote}`;
    } else {
      reply = `${docLabel} item **${medName}** [${medCit}] does not have a recorded dosage strength field in the current extraction.`;
    }

    const warnings = collectRelevantWarnings(snapshot, [selectedItem], false);
    if (!strField) {
      warnings.push(`Dosage strength is missing for ${docLabel} item ${selectedItem.itemId}.`);
    }

    return {
      schemaVersion: SESSION_4_SCHEMA_VERSION,
      caseId,
      evidenceRevision,
      reply,
      mode: 'LOCAL_CASE_EVIDENCE',
      intent: 'STRENGTH',
      medicineItemId: selectedItem.itemId,
      choices,
      sources,
      warnings: warnings.slice(0, 12),
      dependencyKeys: [...dependencyKeySet],
      bindingToken: null,
      disclaimer: DISCLAIMER
    };
  }

  // Handle QUANTITY intent
  if (intent === 'QUANTITY') {
    const medCit = addFieldCitation(selectedItem, 'medicine_name', 'medicine name');
    const qtyCit = addFieldCitation(selectedItem, 'quantity', 'quantity');
    const unitCit = addFieldCitation(selectedItem, 'quantity_unit', 'quantity unit');
    const packSizeCit = addFieldCitation(selectedItem, 'pack_size', 'pack size');
    const packUnitCit = addFieldCitation(selectedItem, 'pack_unit', 'pack unit');
    const formCit = addFieldCitation(selectedItem, 'dosage_form', 'dosage form');

    addDependencyKey(`doc:${selectedItem.documentId}:source`);
    addDependencyKey(`item:${selectedItem.itemId}:membership`);
    for (const slot of [
      'medicine_name',
      'quantity',
      'quantity_unit',
      'pack_size',
      'pack_unit',
      'dosage_form'
    ]) {
      addDependencyKey(`item:${selectedItem.itemId}:slot:${slot}`);
    }

    if (sources.length === 0) {
      return makeNonSourcedDraft({
        mode: 'ABSTAIN',
        intent: 'QUANTITY',
        reply: 'Recorded quantity fields are missing for the selected medicine item.'
      });
    }

    const docLabel =
      selectedItem.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy Invoice';
    const medField = selectedItem.canonicalSlots.medicine_name;
    const qtyField = selectedItem.canonicalSlots.quantity;
    const unitField = selectedItem.canonicalSlots.quantity_unit;
    const packSizeField = selectedItem.canonicalSlots.pack_size;
    const packUnitField = selectedItem.canonicalSlots.pack_unit;
    const formField = selectedItem.canonicalSlots.dosage_form;

    const medName = medField
      ? escapeMarkdown(medField.normalizedValue || medField.rawValue)
      : 'Unnamed medicine';
    const parts = [];
    if (medCit) {
      parts.push(`${docLabel} item **${medName}** [${medCit}]`);
    } else {
      parts.push(`${docLabel} item **${medName}**`);
    }
    if (qtyCit && qtyField) {
      const qVal = escapeMarkdown(qtyField.normalizedValue || qtyField.rawValue);
      parts.push(`recorded quantity **${qVal}** [${qtyCit}]`);
    } else {
      parts.push('no recorded quantity field');
    }
    if (unitCit && unitField) {
      parts.push(`unit **${escapeMarkdown(unitField.normalizedValue || unitField.rawValue)}** [${unitCit}]`);
    }
    if (packSizeCit && packSizeField) {
      parts.push(
        `pack size **${escapeMarkdown(packSizeField.normalizedValue || packSizeField.rawValue)}** [${packSizeCit}]`
      );
    }
    if (packUnitCit && packUnitField) {
      parts.push(
        `pack unit **${escapeMarkdown(packUnitField.normalizedValue || packUnitField.rawValue)}** [${packUnitCit}]`
      );
    }
    if (formCit && formField) {
      parts.push(
        `dosage form **${escapeMarkdown(formField.normalizedValue || formField.rawValue)}** [${formCit}]`
      );
    }

    const reply = `${parts.join(', ')}.`;
    const warnings = collectRelevantWarnings(snapshot, [selectedItem], false);
    if (!qtyField || !unitField) {
      warnings.push(
        'Explicit quantity or supported unit is incomplete; quantity normalization remains conservative.'
      );
    }

    return {
      schemaVersion: SESSION_4_SCHEMA_VERSION,
      caseId,
      evidenceRevision,
      reply,
      mode: 'LOCAL_CASE_EVIDENCE',
      intent: 'QUANTITY',
      medicineItemId: selectedItem.itemId,
      choices,
      sources,
      warnings: warnings.slice(0, 12),
      dependencyKeys: [...dependencyKeySet],
      bindingToken: null,
      disclaimer: DISCLAIMER
    };
  }

  // Handle IDENTITY intent
  if (intent === 'IDENTITY') {
    const medCit = addFieldCitation(selectedItem, 'medicine_name', 'medicine name');
    const strCit = addFieldCitation(selectedItem, 'dosage_strength', 'dosage strength');
    const formCit = addFieldCitation(selectedItem, 'dosage_form', 'dosage form');
    const relCit = addFieldCitation(selectedItem, 'release_type', 'release type');

    addDependencyKey(`doc:${selectedItem.documentId}:source`);
    addDependencyKey(`item:${selectedItem.itemId}:membership`);
    for (const slot of ['medicine_name', 'dosage_strength', 'dosage_form', 'release_type']) {
      addDependencyKey(`item:${selectedItem.itemId}:slot:${slot}`);
    }

    if (sources.length === 0) {
      return makeNonSourcedDraft({
        mode: 'ABSTAIN',
        intent: 'IDENTITY',
        reply: 'Recorded identity fields are missing for the selected medicine item.'
      });
    }

    const docLabel =
      selectedItem.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Pharmacy Invoice';
    const medField = selectedItem.canonicalSlots.medicine_name;
    const strField = selectedItem.canonicalSlots.dosage_strength;
    const formField = selectedItem.canonicalSlots.dosage_form;
    const relField = selectedItem.canonicalSlots.release_type;

    const segments = [];
    if (medCit && medField) {
      segments.push(
        `medicine name **${escapeMarkdown(medField.normalizedValue || medField.rawValue)}** [${medCit}]`
      );
    }
    if (strCit && strField) {
      segments.push(
        `strength **${escapeMarkdown(strField.normalizedValue || strField.rawValue)}** [${strCit}]`
      );
    }
    if (formCit && formField) {
      segments.push(
        `dosage form **${escapeMarkdown(formField.normalizedValue || formField.rawValue)}** [${formCit}]`
      );
    }
    if (relCit && relField) {
      segments.push(
        `release type **${escapeMarkdown(relField.normalizedValue || relField.rawValue)}** [${relCit}]`
      );
    }

    const uncertainNote = medField?.needsCorrection
      ? ' Medicine identity is flagged as uncertain and requires human confirmation.'
      : '';
    const reply = `${docLabel} item (${selectedItem.itemId}) records ${segments.join(', ')}.${uncertainNote}`;
    const warnings = collectRelevantWarnings(snapshot, [selectedItem], false);

    return {
      schemaVersion: SESSION_4_SCHEMA_VERSION,
      caseId,
      evidenceRevision,
      reply,
      mode: 'LOCAL_CASE_EVIDENCE',
      intent: 'IDENTITY',
      medicineItemId: selectedItem.itemId,
      choices,
      sources,
      warnings: warnings.slice(0, 12),
      dependencyKeys: [...dependencyKeySet],
      bindingToken: null,
      disclaimer: DISCLAIMER
    };
  }

  // Handle COMPARISON intent
  const rows = Array.isArray(snapshot.comparison?.rows) ? snapshot.comparison.rows : [];
  let targetRows = rows;
  if (selectedItem) {
    targetRows = rows.filter(
      (r) => r.prescriptionItemId === selectedItem.itemId || r.invoiceItemId === selectedItem.itemId
    );
  } else if (mentionedTokens.length > 0) {
    const matchingItemIds = new Set(
      allItems
        .filter((it) => mentionedTokens.some((tok) => itemMatchesMedicineName(it, tok, snapshot)))
        .map((it) => it.itemId)
    );
    if (matchingItemIds.size === 0) {
      return makeNonSourcedDraft({
        mode: choices.length > 0 ? 'CLARIFY' : 'ABSTAIN',
        intent: 'COMPARISON',
        reply:
          'No recorded medicine item in this case matches the medicine name in your comparison query. Please select an available medicine item.'
      });
    }
    targetRows = rows.filter(
      (r) => matchingItemIds.has(r.prescriptionItemId) || matchingItemIds.has(r.invoiceItemId)
    );
  }

  const itemsById = new Map(allItems.map((it) => [it.itemId, it]));
  const itemsToCompare = [];
  if (targetRows.length > 0) {
    for (const r of targetRows) {
      if (r.prescriptionItemId && itemsById.has(r.prescriptionItemId)) {
        itemsToCompare.push(itemsById.get(r.prescriptionItemId));
      }
      if (r.invoiceItemId && itemsById.has(r.invoiceItemId)) {
        itemsToCompare.push(itemsById.get(r.invoiceItemId));
      }
    }
    if (!selectedItem && mentionedTokens.length === 0) {
      itemsToCompare.push(...allItems);
    }
  } else if (selectedItem) {
    itemsToCompare.push(selectedItem);
  } else {
    itemsToCompare.push(...allItems);
  }

  // Deduplicate itemsToCompare
  const uniqueCompareItems = [...new Map(itemsToCompare.map((it) => [it.itemId, it])).values()];

  // Check citation budget (max 12 sources)
  const requiredCitationsCount = uniqueCompareItems.reduce((acc, it) => {
    let c = 0;
    for (const slot of ['medicine_name', 'dosage_strength', 'dosage_form', 'quantity', 'quantity_unit']) {
      if (it.canonicalSlots?.[slot]?.id) c++;
    }
    return acc + c;
  }, 0);

  if (requiredCitationsCount > 12 && !selectedItem) {
    return makeNonSourcedDraft({
      mode: 'CLARIFY',
      intent: 'COMPARISON',
      reply:
        'Comparing all fields across every medicine item exceeds the 12-citation budget. Please select a specific medicine item to inspect its cross-document comparison.'
    });
  }

  const lineSummaries = [];
  for (const it of uniqueCompareItems) {
    addDependencyKey(`doc:${it.documentId}:source`);
    addDependencyKey(`item:${it.itemId}:membership`);
    for (const slot of MEDICINE_SLOT_TYPES) {
      addDependencyKey(`item:${it.itemId}:slot:${slot}`);
    }

    const cits = [];
    const medCit = addFieldCitation(it, 'medicine_name', 'medicine name');
    const strCit = addFieldCitation(it, 'dosage_strength', 'dosage strength');
    const formCit = addFieldCitation(it, 'dosage_form', 'dosage form');
    const qtyCit = addFieldCitation(it, 'quantity', 'quantity');
    const unitCit = addFieldCitation(it, 'quantity_unit', 'quantity unit');

    const docLabel = it.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Invoice';
    const medVal = escapeMarkdown(
      it.canonicalSlots.medicine_name?.normalizedValue ||
        it.canonicalSlots.medicine_name?.rawValue ||
        'Unnamed'
    );
    let desc = `${docLabel} **${medVal}**${medCit ? ` [${medCit}]` : ''}`;
    if (strCit && it.canonicalSlots.dosage_strength) {
      desc += `, strength **${escapeMarkdown(
        it.canonicalSlots.dosage_strength.normalizedValue ||
          it.canonicalSlots.dosage_strength.rawValue
      )}** [${strCit}]`;
    }
    if (formCit && it.canonicalSlots.dosage_form) {
      desc += `, form **${escapeMarkdown(
        it.canonicalSlots.dosage_form.normalizedValue || it.canonicalSlots.dosage_form.rawValue
      )}** [${formCit}]`;
    }
    if (qtyCit && it.canonicalSlots.quantity) {
      const qv = escapeMarkdown(
        it.canonicalSlots.quantity.normalizedValue || it.canonicalSlots.quantity.rawValue
      );
      const uv =
        unitCit && it.canonicalSlots.quantity_unit
          ? ` ${escapeMarkdown(
              it.canonicalSlots.quantity_unit.normalizedValue ||
                it.canonicalSlots.quantity_unit.rawValue
            )} [${unitCit}]`
          : '';
      desc += `, quantity **${qv}** [${qtyCit}]${uv}`;
    } else if (unitCit && it.canonicalSlots.quantity_unit) {
      // A unit may exist while the quantity is missing. Keep its source cited
      // and explicitly avoid inventing the missing numerical count.
      desc += `, quantity missing, recorded unit **${escapeMarkdown(
        it.canonicalSlots.quantity_unit.normalizedValue || it.canonicalSlots.quantity_unit.rawValue
      )}** [${unitCit}]`;
    }
    lineSummaries.push(desc);
  }

  if (sources.length === 0) {
    return makeNonSourcedDraft({
      mode: 'ABSTAIN',
      intent: 'COMPARISON',
      reply: 'Insufficient extracted field sources to perform cross-document comparison.'
    });
  }

  // Even a selected-item answer below explicitly states the whole-case outcome.
  // Bind that assertion to its actual content, not merely the selected source fields.
  addDependencyKey('case:comparison');
  if (selectedItem) {
    // Also depend on counterpart document sources if present
    for (const env of [snapshot.prescription, snapshot.invoice]) {
      if (env?.documentId) {
        addDependencyKey(`doc:${normalizeId(env.documentId)}:source`);
      }
    }
  }

  const rowOutcomeParts = targetRows.map((r) => {
    const reasons = Array.isArray(r.reasonCodes) && r.reasonCodes.length > 0
      ? ` (reasons: ${r.reasonCodes.map(escapeMarkdown).join(', ')})`
      : '';
    return `Row ${escapeMarkdown(r.genericName || r.rowId)}: status **${escapeMarkdown(
      r.status || 'INSUFFICIENT_EVIDENCE'
    )}**, identity check **${escapeMarkdown(r.checks?.identity || 'INSUFFICIENT_EVIDENCE')}**, strength check **${escapeMarkdown(
      r.checks?.strength || 'INSUFFICIENT_EVIDENCE'
    )}**, form check **${escapeMarkdown(r.checks?.form || 'INSUFFICIENT_EVIDENCE')}**, release check **${escapeMarkdown(r.checks?.release || 'INSUFFICIENT_EVIDENCE')}**, quantity check **${escapeMarkdown(r.checks?.quantity || 'INSUFFICIENT_EVIDENCE')}**${reasons}.`;
  });

  const overallCompStatus = snapshot.comparison?.status || 'INSUFFICIENT_EVIDENCE';
  const reply = `Cross-document comparison status: **${escapeMarkdown(
    overallCompStatus
  )}**. Recorded item evidence: ${lineSummaries.join('; ')}. ${rowOutcomeParts.join(' ')}`.trim();

  const warnings = collectRelevantWarnings(snapshot, uniqueCompareItems, true);

  return {
    schemaVersion: SESSION_4_SCHEMA_VERSION,
    caseId,
    evidenceRevision,
    reply,
    mode: 'LOCAL_CASE_EVIDENCE',
    intent: 'COMPARISON',
    medicineItemId: selectedItem ? selectedItem.itemId : null,
    choices,
    sources,
    warnings: warnings.slice(0, 12),
    dependencyKeys: [...dependencyKeySet],
    bindingToken: null,
    disclaimer: DISCLAIMER
  };
}

function deriveSigningKey(secret) {
  if (typeof secret !== 'string' || secret.trim().length < 16) {
    throw createControlledError(
      500,
      'ASSISTANT_SECRET_MISSING',
      'Server signing secret is missing or invalid.'
    );
  }
  return crypto
    .createHmac('sha256', secret)
    .update('pv-session4-binding-token-key-v1', 'utf8')
    .digest();
}

function signReceiptPayload(payloadObj, secret) {
  const signingKey = deriveSigningKey(secret);
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', signingKey)
    .update(`pv-s4-receipt-sig-v1.${payloadB64}`, 'utf8')
    .digest('base64url');
  return `pvr1.${payloadB64}.${sigB64}`;
}

function verifyReceiptToken(bindingToken, secret) {
  if (typeof bindingToken !== 'string' || bindingToken.length < 10 || bindingToken.length > 32768) {
    return null;
  }
  const parts = bindingToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'pvr1' || !parts[1] || !parts[2]) {
    return null;
  }
  const [, payloadB64, sigB64] = parts;
  const signingKey = deriveSigningKey(secret);
  const expectedSigBuf = crypto
    .createHmac('sha256', signingKey)
    .update(`pv-s4-receipt-sig-v1.${payloadB64}`, 'utf8')
    .digest();

  let actualSigBuf;
  try {
    actualSigBuf = Buffer.from(sigB64, 'base64url');
  } catch (_) {
    return null;
  }

  if (
    actualSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(actualSigBuf, expectedSigBuf)
  ) {
    return null;
  }

  try {
    const rawJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const parsed = JSON.parse(rawJson);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.v !== RECEIPT_VERSION ||
      !isCaseId(parsed.caseId) ||
      typeof parsed.userId !== 'string' ||
      !parsed.userId ||
      !isAnswerId(parsed.answerId) ||
      !Number.isSafeInteger(parsed.iat) ||
      !Number.isSafeInteger(parsed.exp) ||
      !Array.isArray(parsed.deps) ||
      parsed.deps.length === 0 ||
      parsed.deps.length > 64 ||
      !parsed.deps.every(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          typeof pair[0] === 'string' &&
          pair[0].length >= 1 &&
          pair[0].length <= 160 &&
          typeof pair[1] === 'string' &&
          /^[a-f0-9]{64}$/.test(pair[1])
      )
    ) {
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

/**
 * Pure function that finalizes an AnswerDraft into a signed CaseAssistantAnswer.
 *
 * @param {Object} params
 * @param {Object} params.draft - AnswerDraft from buildCaseAnswer
 * @param {Object} params.snapshot - Session 3 case reconciliation snapshot
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.secret - Server JWT_SECRET
 * @param {Date} [params.now=new Date()] - Server timestamp
 * @returns {Object} CaseAssistantAnswer
 */
function finalizeCaseAnswer({ draft, snapshot, userId, secret, now = new Date() }) {
  if (!draft || typeof draft !== 'object') {
    throw createControlledError(400, 'INVALID_DRAFT', 'Answer draft is required.');
  }
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw createControlledError(401, 'UNAUTHENTICATED', 'Authenticated userId is required.');
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) {
    throw createControlledError(400, 'INVALID_TIMESTAMP', 'Valid server timestamp is required.');
  }

  const caseId = normalizeId(snapshot?.caseId || draft.caseId);
  const evidenceRevision =
    Number.isInteger(snapshot?.evidenceRevision) && snapshot.evidenceRevision >= 0
      ? snapshot.evidenceRevision
      : Number.isInteger(draft.evidenceRevision) && draft.evidenceRevision >= 0
        ? draft.evidenceRevision
        : 0;
  const answerId = crypto.randomUUID();
  const generatedAt = nowDate.toISOString();

  if (draft.mode !== 'LOCAL_CASE_EVIDENCE') {
    return {
      schemaVersion: SESSION_4_SCHEMA_VERSION,
      caseId,
      answerId,
      generatedAt,
      evidenceRevision,
      reply: draft.reply,
      mode: draft.mode,
      intent: draft.intent,
      medicineItemId: null,
      choices: Array.isArray(draft.choices) ? draft.choices : [],
      sources: [],
      warnings: Array.isArray(draft.warnings) ? draft.warnings : [],
      dependencyKeys: [],
      bindingToken: null,
      disclaimer: draft.disclaimer || DISCLAIMER
    };
  }

  const depIndex = buildDependencyIndex(snapshot);
  const dependencyKeys = [...new Set(draft.dependencyKeys || [])].filter((k) => depIndex.has(k));
  const deps = dependencyKeys.map((k) => [k, depIndex.get(k)]);

  const iat = nowDate.getTime();
  const exp = iat + RECEIPT_TTL_MS;
  const bindingToken = signReceiptPayload(
    {
      v: RECEIPT_VERSION,
      caseId,
      userId: normalizedUserId,
      answerId,
      iat,
      exp,
      deps
    },
    secret
  );

  return {
    schemaVersion: SESSION_4_SCHEMA_VERSION,
    caseId,
    answerId,
    generatedAt,
    evidenceRevision,
    reply: draft.reply,
    mode: 'LOCAL_CASE_EVIDENCE',
    intent: draft.intent,
    medicineItemId: draft.medicineItemId ?? null,
    choices: Array.isArray(draft.choices) ? draft.choices : [],
    sources: Array.isArray(draft.sources) ? draft.sources : [],
    warnings: Array.isArray(draft.warnings) ? draft.warnings : [],
    dependencyKeys,
    bindingToken,
    disclaimer: draft.disclaimer || DISCLAIMER
  };
}

/**
 * Pure function that validates signed answer receipts against the current snapshot.
 *
 * @param {Object} params
 * @param {Object} params.snapshot - Session 3 case reconciliation snapshot
 * @param {Array<{answerId: string, bindingToken: string}>} params.receipts - 1..20 receipts
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.secret - Server JWT_SECRET
 * @param {Date} [params.now=new Date()] - Server timestamp
 * @returns {Object} FreshnessResponse
 */
function checkAnswerFreshness({ snapshot, receipts, userId, secret, now = new Date() }) {
  if (!snapshot || typeof snapshot !== 'object' || !isCaseId(normalizeId(snapshot.caseId))) {
    throw createControlledError(400, 'INVALID_SNAPSHOT', 'A valid Session 3 case snapshot is required.');
  }
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw createControlledError(401, 'UNAUTHENTICATED', 'Authenticated userId is required.');
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) {
    throw createControlledError(400, 'INVALID_TIMESTAMP', 'Valid server timestamp is required.');
  }

  validateReceiptsList(receipts);

  const caseId = normalizeId(snapshot.caseId);
  const evidenceRevision =
    Number.isInteger(snapshot.evidenceRevision) && snapshot.evidenceRevision >= 0
      ? snapshot.evidenceRevision
      : 0;
  const depIndex = buildDependencyIndex(snapshot);

  const results = receipts.map((r) => {
    const answerId = String(r.answerId);
    const verified = verifyReceiptToken(r.bindingToken, secret);

    if (
      !verified ||
      verified.caseId !== caseId ||
      verified.userId !== normalizedUserId ||
      verified.answerId.toLowerCase() !== answerId.toLowerCase()
    ) {
      return {
        answerId,
        status: 'UNVERIFIABLE',
        changedDependencyKeys: [],
        reasonCode: 'INVALID_RECEIPT'
      };
    }

    if (nowMs > verified.exp || nowMs < verified.iat - 60000) {
      return {
        answerId,
        status: 'UNVERIFIABLE',
        changedDependencyKeys: [],
        reasonCode: 'RECEIPT_EXPIRED'
      };
    }

    if (snapshot.caseStatus === 'PROCESSING') {
      return {
        answerId,
        status: 'UNVERIFIABLE',
        changedDependencyKeys: [],
        reasonCode: 'CASE_PROCESSING'
      };
    }

    const missingKeys = [];
    const changedKeys = [];

    for (const [depKey, expectedHash] of verified.deps) {
      if (!depIndex.has(depKey)) {
        missingKeys.push(depKey);
      } else if (depIndex.get(depKey) !== expectedHash) {
        changedKeys.push(depKey);
      }
    }

    if (missingKeys.length > 0 || changedKeys.length > 0) {
      return {
        answerId,
        status: 'STALE',
        changedDependencyKeys: [...new Set([...missingKeys, ...changedKeys])].slice(0, 64),
        reasonCode: missingKeys.length > 0 ? 'DEPENDENCY_MISSING' : 'EVIDENCE_CHANGED'
      };
    }

    return {
      answerId,
      status: 'FRESH',
      changedDependencyKeys: [],
      reasonCode: 'UNCHANGED_DEPENDENCIES'
    };
  });

  return {
    schemaVersion: SESSION_4_SCHEMA_VERSION,
    caseId,
    checkedAt: nowDate.toISOString(),
    evidenceRevision,
    results
  };
}

function validateAnswerInputs(message, medicineItemId) {
  if (typeof message !== 'string') {
    throw createControlledError(
      400,
      'INVALID_ASSISTANT_REQUEST',
      'message must be a string between 1 and 2000 trimmed characters.'
    );
  }
  const trimmed = message.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    throw createControlledError(
      400,
      'INVALID_ASSISTANT_REQUEST',
      'message must be between 1 and 2000 trimmed characters.'
    );
  }
  if (
    medicineItemId !== undefined &&
    medicineItemId !== null &&
    !isMedicineItemId(medicineItemId)
  ) {
    throw createControlledError(
      400,
      'INVALID_ASSISTANT_REQUEST',
      'medicineItemId must be null or match mi_<24 lowercase hex>.'
    );
  }
  return trimmed;
}

function validateReceiptsList(receipts) {
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > 20) {
    throw createControlledError(
      400,
      'INVALID_FRESHNESS_REQUEST',
      'receipts must be an array of 1 to 20 receipt objects.'
    );
  }
  const seenIds = new Set();
  for (const r of receipts) {
    if (
      !r ||
      typeof r !== 'object' ||
      Array.isArray(r) ||
      Object.keys(r).length !== 2 ||
      !Object.prototype.hasOwnProperty.call(r, 'answerId') ||
      !Object.prototype.hasOwnProperty.call(r, 'bindingToken') ||
      !isAnswerId(r.answerId) ||
      typeof r.bindingToken !== 'string' ||
      r.bindingToken.length < 1 ||
      r.bindingToken.length > 32768
    ) {
      throw createControlledError(
        400,
        'INVALID_FRESHNESS_REQUEST',
        'Each receipt must contain only a valid UUID answerId and a non-empty bindingToken.'
      );
    }
    const lowerId = r.answerId.toLowerCase();
    if (seenIds.has(lowerId)) {
      throw createControlledError(
        400,
        'INVALID_FRESHNESS_REQUEST',
        'receipts must contain unique answerId values.'
      );
    }
    seenIds.add(lowerId);
  }
}

async function authorizeAndBuildSnapshot({ caseId, user, tenantContext, beforeSnapshot = null }) {
  let scopeFilter;
  try {
    scopeFilter = caseScope(caseId, user, tenantContext);
  } catch (err) {
    throw createControlledError(
      err.statusCode || 400,
      err.statusCode === 401
        ? 'UNAUTHENTICATED'
        : err.statusCode === 403
          ? 'FORBIDDEN'
          : 'INVALID_CASE_ID',
      err.message || 'Access denied.'
    );
  }

  const initialCase = await VerificationCase.findOne(scopeFilter).select('_id status');
  if (!initialCase) {
    throw createControlledError(404, 'CASE_NOT_FOUND', 'Verification case not found.');
  }

  if (typeof beforeSnapshot === 'function') {
    beforeSnapshot();
  }

  const canonicalCaseId = String(initialCase._id);
  return withCaseMutationGuard(canonicalCaseId, async () => {
    const innerFilter = caseScope(canonicalCaseId, user, tenantContext);
    const vCase = await VerificationCase.findOne(innerFilter);
    if (!vCase) {
      throw createControlledError(404, 'CASE_NOT_FOUND', 'Verification case not found.');
    }
    const snapshot = await buildCaseReconciliationSnapshot({ vCase, user });
    return { vCase, snapshot };
  });
}

/**
 * Authorized asynchronous case-assistant answer endpoint service.
 */
async function answerCase({
  caseId,
  user,
  tenantContext,
  message,
  medicineItemId = null,
  rawBody = null
}) {
  const { snapshot } = await authorizeAndBuildSnapshot({
    caseId,
    user,
    tenantContext,
    beforeSnapshot: () => {
      if (rawBody !== null) {
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          throw createControlledError(
            400,
            'INVALID_ASSISTANT_REQUEST',
            'Request body must be a JSON object.'
          );
        }
        const allowedKeys = new Set(['message', 'medicineItemId']);
        for (const k of Object.keys(rawBody)) {
          if (!allowedKeys.has(k)) {
            throw createControlledError(
              400,
              'INVALID_ASSISTANT_REQUEST',
              `Unsupported request field: ${k}.`
            );
          }
        }
      }
      validateAnswerInputs(message, medicineItemId);
    }
  });
  const trimmedMessage = validateAnswerInputs(message, medicineItemId);
  const secret = process.env.JWT_SECRET;
  const draft = buildCaseAnswer({
    snapshot,
    message: trimmedMessage,
    medicineItemId: medicineItemId ?? null
  });
  return finalizeCaseAnswer({
    draft,
    snapshot,
    userId: String(user._id || user.id),
    secret,
    now: new Date()
  });
}

/**
 * Authorized asynchronous case-assistant freshness endpoint service.
 */
async function freshnessForCase({ caseId, user, tenantContext, receipts, rawBody = null }) {
  const { snapshot } = await authorizeAndBuildSnapshot({
    caseId,
    user,
    tenantContext,
    beforeSnapshot: () => {
      if (rawBody !== null) {
        if (
          !rawBody ||
          typeof rawBody !== 'object' ||
          Array.isArray(rawBody) ||
          Object.keys(rawBody).length !== 1 ||
          !Object.prototype.hasOwnProperty.call(rawBody, 'receipts')
        ) {
          throw createControlledError(
            400,
            'INVALID_FRESHNESS_REQUEST',
            'Request body must be a JSON object containing only receipts.'
          );
        }
      }
      validateReceiptsList(receipts);
    }
  });
  validateReceiptsList(receipts);
  const secret = process.env.JWT_SECRET;
  return checkAnswerFreshness({
    snapshot,
    receipts,
    userId: String(user._id || user.id),
    secret,
    now: new Date()
  });
}

module.exports = {
  SESSION_4_SCHEMA_VERSION,
  DISCLAIMER,
  buildCaseAnswer,
  buildDependencyIndex,
  finalizeCaseAnswer,
  checkAnswerFreshness,
  answerCase,
  freshnessForCase
};
