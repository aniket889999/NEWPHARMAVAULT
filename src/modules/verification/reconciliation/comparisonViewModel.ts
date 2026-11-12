import {
  COMPARISON_STATUSES, MEDICINE_SLOTS, REASON_CODES,
  type ComparisonStatus, type ComparisonView, type EvidenceReference,
  type LinkedMedicineField, type MedicineItemsEnvelope, type ReconciliationResult,
} from './types';

// Rendering boundary only: validates context/integrity; never calculates matches or medicine equivalence.
type RecordValue = Record<string, unknown>;
const isObject = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_:-]{1,128}$/.test(value);
const integer = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum;
const unique = (values: unknown[]): boolean => new Set(values).size === values.length;
const nullableId = (value: unknown): boolean => value === null || id(value);
const numberOrNull = (value: unknown): boolean => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000_000);
const status = (value: unknown): value is ComparisonStatus => COMPARISON_STATUSES.some(item => item === value);
const checkStatus = (value: unknown): boolean => status(value) || value === 'NOT_APPLICABLE';
const coverageStatuses = ['COMPLETE', 'INCOMPLETE', 'UNKNOWN', 'CONTRADICTORY'] as const;
const hasKeys = (value: RecordValue, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const reasons = (value: unknown): value is ReconciliationResult['reasonCodes'] => Array.isArray(value) && value.length <= REASON_CODES.length && unique(value) && value.every(code => REASON_CODES.some(known => known === code));
const itemId = (value: unknown): value is string => typeof value === 'string' && /^mi_[a-f0-9]{24}$/.test(value);
const optionalItemId = (value: unknown): boolean => value === null || itemId(value);
const isCoverageStatus = (value: unknown): boolean => coverageStatuses.some(known => known === value);

function parseEnvelope(value: unknown, caseId: string, type: 'PRESCRIPTION' | 'PHARMACY_INVOICE'): MedicineItemsEnvelope | null {
  if (!isObject(value) || value.schemaVersion !== '2.0.0-session1' || value.caseId !== caseId || !id(value.documentId) || value.documentType !== type || value.maxAllowedItems !== 3 || typeof value.reviewRequired !== 'boolean') return null;
  if (!hasKeys(value, ['schemaVersion', 'caseId', 'documentId', 'documentType', 'groupingStatus', 'detectedGroupCount', 'maxAllowedItems', 'reviewRequired', 'coverage', 'medicineItems', 'issues', 'issueCodes'])) return null;
  if (!['GROUPED', 'LEGACY_SINGLE_ITEM', 'UNRESOLVED'].includes(String(value.groupingStatus)) || !integer(value.detectedGroupCount)) return null;
  if (!Array.isArray(value.medicineItems) || value.medicineItems.length > 3 || !Array.isArray(value.issues) || !Array.isArray(value.issueCodes)) return null;
  if ((value.issues.length || value.issueCodes.length) && !value.reviewRequired) return null;
  if (value.groupingStatus === 'UNRESOLVED' && (value.medicineItems.length !== 0 || !value.reviewRequired)) return null;
  if (value.groupingStatus === 'LEGACY_SINGLE_ITEM' && value.medicineItems.length !== 1) return null;
  if (value.groupingStatus === 'GROUPED' && value.medicineItems.length === 0) return null;
  if (value.groupingStatus !== 'UNRESOLVED' && value.detectedGroupCount !== value.medicineItems.length) return null;
  const coverage = value.coverage;
  if (!isObject(coverage) || !isCoverageStatus(coverage.status) || typeof coverage.isComplete !== 'boolean') return null;
  if (!hasKeys(coverage, ['status', 'isComplete', 'total', 'processed', 'omitted', 'reportedStatus'])) return null;
  if (![coverage.total, coverage.processed, coverage.omitted].every(count => count === null || integer(count))) return null;
  if (coverage.total !== null && !integer(coverage.total, 1)) return null;
  if (![null, 'COMPLETE', 'INCOMPLETE'].includes(coverage.reportedStatus as null | string)) return null;
  if (coverage.status === 'COMPLETE' && (!coverage.isComplete || !integer(coverage.total, 1) || coverage.processed !== coverage.total || coverage.omitted !== 0 || coverage.reportedStatus === 'INCOMPLETE')) return null;
  if (coverage.status !== 'COMPLETE' && (coverage.isComplete || !value.reviewRequired)) return null;
  const usedItems = new Set<string>(), usedFields = new Set<string>();
  for (const medicine of value.medicineItems) {
    if (!isObject(medicine) || !itemId(medicine.itemId) || usedItems.has(medicine.itemId) || medicine.caseId !== caseId || medicine.documentId !== value.documentId || medicine.documentType !== type || medicine.groupingMode !== value.groupingStatus) return null;
    if (!hasKeys(medicine, ['itemId', 'caseId', 'documentId', 'documentType', 'groupingMode', 'anchorFieldId', 'fieldIds', 'pageNumbers', 'needsCorrection', 'fields'])) return null;
    usedItems.add(medicine.itemId);
    if (typeof medicine.needsCorrection !== 'boolean' || !id(medicine.anchorFieldId) || !isObject(medicine.fields) || !hasKeys(medicine.fields, MEDICINE_SLOTS)) return null;
    if (!Array.isArray(medicine.fieldIds) || !medicine.fieldIds.length || medicine.fieldIds.length > 8 || !medicine.fieldIds.every(id) || !unique(medicine.fieldIds)) return null;
    if (!Array.isArray(medicine.pageNumbers) || !medicine.pageNumbers.length || !medicine.pageNumbers.every(page => integer(page, 1)) || !unique(medicine.pageNumbers)) return null;
    const linkedIds: string[] = [], pages = new Set<number>();
    for (const slot of MEDICINE_SLOTS) {
      const linked = medicine.fields[slot];
      if (linked === null && slot !== 'medicine_name') continue;
      if (!isObject(linked) || !id(linked.id) || usedFields.has(linked.id) || linked.caseId !== caseId || linked.documentId !== value.documentId || linked.fieldType !== slot) return null;
      if (!hasKeys(linked, ['id', 'caseId', 'documentId', 'fieldType', 'rawValue', 'normalizedValue', 'pageNumber', 'boundingBox', 'extractionMethod', 'extractionConfidence', 'needsCorrection', 'correctedBy', 'correctedAt', 'resolution'])) return null;
      if (linked.extractionMethod !== null && (typeof linked.extractionMethod !== 'string' || !linked.extractionMethod.trim())) return null;
      if (typeof linked.rawValue !== 'string' || !linked.rawValue.trim() || typeof linked.normalizedValue !== 'string' || !integer(linked.pageNumber, 1)) return null;
      if (coverage.total !== null && (linked.pageNumber as number) > (coverage.total as number)) return null;
      if (typeof linked.needsCorrection !== 'boolean' || typeof linked.extractionConfidence !== 'number' || !Number.isFinite(linked.extractionConfidence) || linked.extractionConfidence < 0 || linked.extractionConfidence > 1 || !nullableId(linked.correctedBy)) return null;
      if (linked.correctedAt !== null && (typeof linked.correctedAt !== 'string' || Number.isNaN(Date.parse(linked.correctedAt)))) return null;
      if (!linked.needsCorrection && ((linked.correctedBy !== null) !== (linked.correctedAt !== null))) return null;
      if (!linked.needsCorrection && linked.extractionConfidence < 0.75 && (!linked.correctedBy || !linked.correctedAt)) return null;
      if (linked.needsCorrection && (!medicine.needsCorrection || !value.reviewRequired)) return null;
      if (linked.boundingBox !== null && (!Array.isArray(linked.boundingBox) || linked.boundingBox.length !== 4 || !linked.boundingBox.every(n => typeof n === 'number' && Number.isFinite(n)))) return null;
      linkedIds.push(linked.id); pages.add(linked.pageNumber); usedFields.add(linked.id);
    }
    const anchor = medicine.fields.medicine_name;
    if (!isObject(anchor) || anchor.id !== medicine.anchorFieldId || linkedIds.length !== medicine.fieldIds.length || !linkedIds.every(key => (medicine.fieldIds as string[]).includes(key))) return null;
    if (pages.size !== medicine.pageNumbers.length || !medicine.pageNumbers.every(page => pages.has(page))) return null;
    if ((medicine.needsCorrection || ['dosage_strength', 'dosage_form', 'quantity'].some(slot => (medicine.fields as RecordValue)[slot] === null)) && !value.reviewRequired) return null;
  }
  return value as unknown as MedicineItemsEnvelope;
}

function parseResultShape(value: unknown): ReconciliationResult | null {
  const keys = ['schemaVersion', 'rulesetVersion', 'caseId', 'documentIds', 'status', 'reviewRequired', 'humanDecisionRequired', 'coverage', 'hasInsufficientEvidence', 'reasonCodes', 'rows', 'summary'];
  if (!isObject(value) || !hasKeys(value, keys) || value.schemaVersion !== '2.0.0-session2' || value.rulesetVersion !== 'academic-reconciliation/1.0.0' || !id(value.caseId) || !status(value.status)) return null;
  if (typeof value.reviewRequired !== 'boolean' || value.humanDecisionRequired !== true || typeof value.hasInsufficientEvidence !== 'boolean' || !reasons(value.reasonCodes)) return null;
  if (!isObject(value.documentIds) || !hasKeys(value.documentIds, ['prescription', 'invoice']) || !Object.values(value.documentIds).every(nullableId)) return null;
  if (!isObject(value.coverage) || !hasKeys(value.coverage, ['prescription', 'invoice']) || !Object.values(value.coverage).every(item => item === 'MISSING' || isCoverageStatus(item))) return null;
  if (!isObject(value.summary) || !hasKeys(value.summary, ['consistent', 'mismatch', 'insufficientEvidence']) || !Object.values(value.summary).every(count => integer(count) && count <= 6)) return null;
  if (!Array.isArray(value.rows) || value.rows.length > 6) return null;
  const usedRows = new Set<string>();
  for (const row of value.rows) {
    if (!isObject(row) || !hasKeys(row, ['rowId', 'prescriptionItemId', 'invoiceItemId', 'genericName', 'status', 'checks', 'quantity', 'reasonCodes', 'evidenceReferences'])) return null;
    if (typeof row.rowId !== 'string' || !/^mr_[a-f0-9]{24}$/.test(row.rowId) || usedRows.has(row.rowId)) return null;
    usedRows.add(row.rowId);
    if (!optionalItemId(row.prescriptionItemId) || !optionalItemId(row.invoiceItemId) || (row.prescriptionItemId === null && row.invoiceItemId === null) || !status(row.status) || !reasons(row.reasonCodes)) return null;
    if (row.genericName !== null && (typeof row.genericName !== 'string' || !row.genericName.trim() || row.genericName.length > 160)) return null;
    if (!isObject(row.checks) || !hasKeys(row.checks, ['identity', 'strength', 'form', 'release', 'quantity']) || !Object.values(row.checks).every(checkStatus)) return null;
    if (row.status === 'CONSISTENT' && Object.values(row.checks).some(check => check === 'MISMATCH' || check === 'INSUFFICIENT_EVIDENCE')) return null;
    if (Object.values(row.checks).includes('MISMATCH') && row.status !== 'MISMATCH') return null;
    if (!isObject(row.quantity) || !hasKeys(row.quantity, ['prescriptionBaseQuantity', 'invoiceBaseQuantity', 'baseUnit']) || !numberOrNull(row.quantity.prescriptionBaseQuantity) || !numberOrNull(row.quantity.invoiceBaseQuantity) || ![null, 'tablet', 'capsule', 'mL'].includes(row.quantity.baseUnit as string | null)) return null;
    if (row.quantity.baseUnit === null && (row.quantity.prescriptionBaseQuantity !== null || row.quantity.invoiceBaseQuantity !== null)) return null;
    if (row.checks.quantity === 'CONSISTENT' && (row.quantity.baseUnit === null || row.quantity.prescriptionBaseQuantity === null || row.quantity.invoiceBaseQuantity === null)) return null;
    if (!Array.isArray(row.evidenceReferences) || !row.evidenceReferences.length || row.evidenceReferences.length > 16) return null;
    const refs = new Set<string>();
    for (const ref of row.evidenceReferences) {
      if (!isObject(ref) || !hasKeys(ref, ['documentId', 'fieldId', 'pageNumber']) || !id(ref.documentId) || !id(ref.fieldId) || !integer(ref.pageNumber, 1)) return null;
      const key = `${ref.documentId}|${ref.fieldId}|${ref.pageNumber}`; if (refs.has(key)) return null; refs.add(key);
    }
  }
  return value as unknown as ReconciliationResult;
}

export function effectiveFieldText(field: LinkedMedicineField | null): string {
  return field ? field.normalizedValue.trim() || field.rawValue : 'Not provided';
}

export function createComparisonView(input: { expectedCaseId: string; result: unknown; prescription: unknown; invoice: unknown }): ComparisonView {
  const invalid: ComparisonView = { state: 'invalid', message: 'The comparison could not be verified for this case. Refresh the evidence before reviewing it.' };
  if (input.result === null || input.result === undefined) return { state: 'empty', message: 'A document comparison has not been loaded.' };
  if (!id(input.expectedCaseId)) return invalid;
  const result = parseResultShape(input.result);
  if (!result || result.caseId !== input.expectedCaseId) return invalid;
  const prescription = input.prescription === null ? null : parseEnvelope(input.prescription, input.expectedCaseId, 'PRESCRIPTION');
  const invoice = input.invoice === null ? null : parseEnvelope(input.invoice, input.expectedCaseId, 'PHARMACY_INVOICE');
  if ((input.prescription !== null && !prescription) || (input.invoice !== null && !invoice)) return invalid;
  if (result.documentIds.prescription !== (prescription?.documentId ?? null) || result.documentIds.invoice !== (invoice?.documentId ?? null)) return invalid;
  if (prescription && invoice && prescription.documentId === invoice.documentId) return invalid;
  if (result.coverage.prescription !== (prescription?.coverage.status ?? 'MISSING') || result.coverage.invoice !== (invoice?.coverage.status ?? 'MISSING')) return invalid;
  const sourceUncertainty = !prescription || !invoice || prescription.reviewRequired || invoice.reviewRequired;
  if (sourceUncertainty && !result.hasInsufficientEvidence) return invalid;
  const rxItems = new Map((prescription?.medicineItems ?? []).map(item => [item.itemId, item]));
  const invItems = new Map((invoice?.medicineItems ?? []).map(item => [item.itemId, item]));
  const usedRx = new Set<string>(), usedInv = new Set<string>();
  const rows: Extract<ComparisonView, { state: 'ready' }>['rows'] = [];
  for (const row of result.rows) {
    const rx = row.prescriptionItemId ? rxItems.get(row.prescriptionItemId) : null;
    const inv = row.invoiceItemId ? invItems.get(row.invoiceItemId) : null;
    if ((row.prescriptionItemId && (!rx || usedRx.has(row.prescriptionItemId))) || (row.invoiceItemId && (!inv || usedInv.has(row.invoiceItemId)))) return invalid;
    if (row.prescriptionItemId) usedRx.add(row.prescriptionItemId);
    if (row.invoiceItemId) usedInv.add(row.invoiceItemId);
    const evidence: typeof rows[number]['evidence'] = [];
    for (const reference of row.evidenceReferences) {
      let found = false;
      for (const [medicine, side] of [[rx, 'Prescription'], [inv, 'Invoice']] as const) {
        if (!medicine || reference.documentId !== medicine.documentId) continue;
        for (const slot of MEDICINE_SLOTS) {
          const linked = medicine.fields[slot];
          if (linked?.id === reference.fieldId && linked.pageNumber === reference.pageNumber) {
            evidence.push({ reference, side, slot }); found = true;
          }
        }
      }
      if (!found) return invalid;
    }
    if (row.reasonCodes.some(code => !result.reasonCodes.includes(code))) return invalid;
    rows.push({ comparison: row, prescription: rx ?? null, invoice: inv ?? null, evidence });
  }
  if (usedRx.size !== rxItems.size || usedInv.size !== invItems.size) return invalid;
  const count = (value: ComparisonStatus): number => result.rows.filter(row => row.status === value).length;
  if (result.summary.consistent !== count('CONSISTENT') || result.summary.mismatch !== count('MISMATCH') || result.summary.insufficientEvidence !== count('INSUFFICIENT_EVIDENCE')) return invalid;
  const rowUnknown = result.rows.some(row => row.status === 'INSUFFICIENT_EVIDENCE' || Object.values(row.checks).includes('INSUFFICIENT_EVIDENCE'));
  if (rowUnknown && !result.hasInsufficientEvidence) return invalid;
  if (count('MISMATCH') > 0 && result.status !== 'MISMATCH') return invalid;
  if (result.status !== 'CONSISTENT' && !result.reviewRequired) return invalid;
  if (result.hasInsufficientEvidence && (!result.reviewRequired || result.status === 'CONSISTENT')) return invalid;
  if (result.status === 'INSUFFICIENT_EVIDENCE' && !result.hasInsufficientEvidence) return invalid;
  if (result.status === 'CONSISTENT' && (!rows.length || count('CONSISTENT') !== rows.length || sourceUncertainty)) return invalid;
  return { state: 'ready', result, rows };
}

export function evidenceKey(reference: EvidenceReference): string {
  return `${reference.documentId}:${reference.fieldId}:${reference.pageNumber}`;
}
