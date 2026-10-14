// External explanations receive fixed vocabulary and local evidence aliases.
// No document text, filenames, party names, medicine values or persistent IDs.
const SOURCE_TYPES = new Set(['CASE_DOCUMENT', 'CANONICAL_CATALOG', 'OFFICIAL_REGISTRY']);
const CHECK_TYPES = new Set([
  'MEDICINE_NAME_CONSISTENCY', 'DOSAGE_STRENGTH_CONSISTENCY',
  'DOSAGE_FORM_CONSISTENCY', 'QUANTITY_CONSISTENCY',
  'DATE_SEQUENCE_CONSISTENCY', 'DOCUMENT_TRIANGLE_COMPLETENESS'
]);
const SIGNAL_TYPES = new Set([
  'LOW_OCR_CONFIDENCE', 'MISSING_REQUIRED_FIELD', 'MEDICINE_STRENGTH_MISMATCH',
  'MEDICINE_NAME_MISMATCH', 'QUANTITY_MISMATCH', 'DATE_INCONSISTENCY',
  'DUPLICATE_DOCUMENT_SIGNAL', 'UNRESOLVED_MEDICINE_IDENTITY',
  'DOSAGE_FORM_DISCREPANCY', 'AMBIGUOUS_MEDICINE_IDENTITY',
  'INSUFFICIENT_EVIDENCE', 'CONFLICTING_MULTI_PAGE_DATA'
]);
const CHECK_STATUSES = new Set(['PASS', 'FAIL', 'INCONCLUSIVE']);
const SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function buildStructuredEvidencePayload({ evidenceItems = [], checks = [], signals = [] }) {
  const aliasToId = new Map();
  const idToAlias = new Map();
  const evidence = [];

  for (const item of evidenceItems.slice(0, 200)) {
    const id = String(item._id || item.id || '');
    if (!/^[a-f\d]{24}$/i.test(id) || !SOURCE_TYPES.has(item.sourceType) || idToAlias.has(id)) continue;
    const alias = `E${evidence.length + 1}`;
    aliasToId.set(alias, id);
    idToAlias.set(id, alias);
    evidence.push({ evidenceId: alias, sourceType: item.sourceType });
  }

  const aliasesFor = (ids) => [...new Set((Array.isArray(ids) ? ids : [])
    .map(id => idToAlias.get(String(id)))
    .filter(Boolean))];

  const safeChecks = [];
  for (const check of checks.slice(0, 100)) {
    if (!CHECK_TYPES.has(check.checkType) || !CHECK_STATUSES.has(check.status)) continue;
    const evidenceItemIds = aliasesFor(check.evidenceItemIds);
    if (evidenceItemIds.length === 0) continue;
    safeChecks.push({ checkType: check.checkType, status: check.status, evidenceItemIds });
  }

  const safeSignals = [];
  for (const signal of signals.slice(0, 100)) {
    if (!SIGNAL_TYPES.has(signal.signalType) || !SEVERITIES.has(signal.severity)) continue;
    const evidenceItemIds = aliasesFor(signal.evidenceItemIds);
    if (evidenceItemIds.length === 0) continue;
    safeSignals.push({ signalType: signal.signalType, severity: signal.severity, evidenceItemIds });
  }

  return {
    payload: { evidence, checks: safeChecks, signals: safeSignals },
    aliasToId
  };
}

function mapEvidenceAliases(result, aliasToId) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.findings)) {
    throw new Error('Invalid structured explanation.');
  }
  const mapIds = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => !aliasToId.has(id))) {
      throw new Error('Invalid explanation evidence reference.');
    }
    return [...new Set(ids.map(id => aliasToId.get(id)))];
  };

  return {
    summary: result.summary,
    findings: result.findings.map(finding => ({
      statement: finding.statement,
      status: finding.status,
      evidenceItemIds: mapIds(finding.evidenceItemIds)
    })),
    evidenceItemIds: mapIds(result.evidenceItemIds),
    uncertainty: ['LOW', 'MEDIUM', 'HIGH'].includes(result.uncertainty) ? result.uncertainty : 'HIGH'
  };
}

module.exports = { buildStructuredEvidencePayload, mapEvidenceAliases };
