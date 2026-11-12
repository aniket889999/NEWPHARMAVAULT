import { createComparisonView } from '../reconciliation/comparisonViewModel';
import { MEDICINE_SLOTS } from '../reconciliation/types';
import { CASE_STATES, INTEGRATION_CODES, type CaseReconciliationSnapshot, type GroupingDocument, type GroupingDraft, type ConfirmGroupsRequest, type GroupingField, type ReviewAction, type SnapshotReviewRequest } from './types';

type Obj = Record<string, unknown>;
const object = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Obj, keys: string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
export const isEntityId = (value: unknown): value is string => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
export const isSnapshotToken = (value: unknown): value is string => typeof value === 'string' && /^rs_[a-f0-9]{64}$/.test(value);
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const nullableId = (value: unknown): boolean => value === null || isEntityId(value);
const date = (value: unknown): boolean => value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
const code = (value: unknown): boolean => INTEGRATION_CODES.some(known => known === value);
const correctionRoles = ['pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin'];
const reviewRoles = [...correctionRoles, 'super_admin'];
export const isCorrectionRole = (role: string | undefined): boolean => !!role && correctionRoles.includes(role);
export const isReviewRole = (role: string | undefined): boolean => !!role && reviewRoles.includes(role);
export const isMutableCase = (state: string): boolean => !['VERIFIED', 'REJECTED', 'CLOSED', 'PROCESSING'].includes(state) && CASE_STATES.some(value => value === state);

export function candidateNeedsCorrection(field: GroupingField): boolean {
  const partial = Boolean(field.correctedBy) !== Boolean(field.correctedAt);
  const completed = Boolean(field.correctedBy && field.correctedAt) && !field.needsCorrection;
  return field.needsCorrection || partial || (field.extractionConfidence === null || (field.extractionConfidence < 0.75 && !completed));
}

export function parseCaseSnapshot(value: unknown, expectedCaseId: string): CaseReconciliationSnapshot | null {
  if (!isEntityId(expectedCaseId) || !object(value) || !exact(value, ['schemaVersion', 'caseId', 'caseStatus', 'snapshotToken', 'evidenceRevision', 'prescription', 'invoice', 'comparison', 'groupingDocuments', 'permissions', 'reviewEligibility', 'notices', 'legacyFindingsCurrent'])) return null;
  if (value.schemaVersion !== '2.0.0-session3' || value.caseId !== expectedCaseId || !CASE_STATES.some(state => state === value.caseStatus) || !isSnapshotToken(value.snapshotToken) || !integer(value.evidenceRevision) || value.legacyFindingsCurrent !== false) return null;
  if (!object(value.permissions) || !exact(value.permissions, ['canCorrectFields', 'canConfirmGroups', 'canReview']) || !Object.values(value.permissions).every(flag => typeof flag === 'boolean')) return null;
  const eligibility = value.reviewEligibility;
  if (!object(eligibility) || !exact(eligibility, ['canVerify', 'blockerCodes', 'allowedActions']) || typeof eligibility.canVerify !== 'boolean' || !Array.isArray(eligibility.blockerCodes) || !eligibility.blockerCodes.every(code) || new Set(eligibility.blockerCodes).size !== eligibility.blockerCodes.length) return null;
  if (!Array.isArray(eligibility.allowedActions) || !eligibility.allowedActions.every(action => ['VERIFY', 'RETURN_FOR_CORRECTION', 'ESCALATE'].includes(String(action))) || new Set(eligibility.allowedActions).size !== eligibility.allowedActions.length) return null;
  if ((!value.permissions.canReview && eligibility.allowedActions.length) || (!eligibility.canVerify && eligibility.allowedActions.includes('VERIFY')) || (eligibility.canVerify && eligibility.blockerCodes.length)) return null;
  if (!['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(String(value.caseStatus)) && (eligibility.canVerify || eligibility.allowedActions.length)) return null;
  if (!Array.isArray(value.groupingDocuments) || value.groupingDocuments.length > 20 || !Array.isArray(value.notices) || value.notices.length > 100) return null;
  const documentIds = new Set<string>(); const sourceFieldIds = new Set<string>();
  for (const doc of value.groupingDocuments) {
    if (!object(doc) || !exact(doc, ['documentId', 'documentType', 'processingStatus', 'mode', 'observedItemCount', 'confirmedBy', 'confirmedAt', 'groups', 'fields']) || !isEntityId(doc.documentId) || documentIds.has(doc.documentId) || !['PRESCRIPTION', 'PHARMACY_INVOICE'].includes(String(doc.documentType))) return null;
    documentIds.add(doc.documentId);
    if (!['PENDING', 'EXTRACTING', 'EXTRACTED', 'PROCESSED', 'FAILED', 'PDF_OCR_PENDING_RASTERIZATION'].includes(String(doc.processingStatus)) || !['UNCONFIRMED', 'AUTO_PROPOSED', 'HUMAN_CONFIRMED', 'STALE'].includes(String(doc.mode))) return null;
    if ((doc.observedItemCount !== null && (!integer(doc.observedItemCount, 1) || doc.observedItemCount > 3)) || !nullableId(doc.confirmedBy) || !date(doc.confirmedAt)) return null;
    if (!Array.isArray(doc.fields) || doc.fields.length > 200 || !Array.isArray(doc.groups) || doc.groups.length > 3) return null;
    const fields = new Map<string, Obj>();
    for (const field of doc.fields) {
      if (!object(field) || !exact(field, ['id', 'caseId', 'documentId', 'fieldType', 'rawValue', 'normalizedValue', 'pageNumber', 'extractionConfidence', 'needsCorrection', 'correctedBy', 'correctedAt']) || !isEntityId(field.id) || sourceFieldIds.has(field.id) || field.caseId !== expectedCaseId || field.documentId !== doc.documentId || !MEDICINE_SLOTS.some(slot => slot === field.fieldType)) return null;
      if (typeof field.rawValue !== 'string' || typeof field.normalizedValue !== 'string' || field.rawValue.length > 10000 || field.normalizedValue.length > 10000 || !integer(field.pageNumber, 1) || typeof field.needsCorrection !== 'boolean' || !nullableId(field.correctedBy) || !date(field.correctedAt)) return null;
      if (field.extractionConfidence !== null && (typeof field.extractionConfidence !== 'number' || !Number.isFinite(field.extractionConfidence) || field.extractionConfidence < 0 || field.extractionConfidence > 1)) return null;
      fields.set(field.id, field); sourceFieldIds.add(field.id);
    }
    const claimed = new Set<string>(); const anchors = new Set<string>();
    for (const group of doc.groups) {
      if (!object(group) || !exact(group, ['anchorFieldId', 'fieldIds']) || !isEntityId(group.anchorFieldId) || anchors.has(group.anchorFieldId) || fields.get(group.anchorFieldId)?.fieldType !== 'medicine_name' || !Array.isArray(group.fieldIds) || !group.fieldIds.length || group.fieldIds.length > 8 || !group.fieldIds.includes(group.anchorFieldId)) return null;
      anchors.add(group.anchorFieldId);
      const slots = new Set<unknown>();
      for (const member of group.fieldIds) {
        if (!isEntityId(member) || !fields.has(member) || claimed.has(member)) return null;
        const field = fields.get(member)!;
        if (slots.has(field.fieldType)) return null;
        slots.add(field.fieldType); claimed.add(member);
      }
    }
    if (doc.mode === 'HUMAN_CONFIRMED' && (!doc.confirmedBy || !doc.confirmedAt || doc.observedItemCount !== doc.groups.length || claimed.size !== fields.size || !doc.groups.length)) return null;
  }
  for (const notice of value.notices) if (!object(notice) || !exact(notice, ['code', 'documentId', 'message']) || !code(notice.code) || !nullableId(notice.documentId) || typeof notice.message !== 'string' || !notice.message.trim() || notice.message.length > 1000) return null;
  if (value.comparison !== null) {
    const view = createComparisonView({ expectedCaseId, result: value.comparison, prescription: value.prescription, invoice: value.invoice });
    if (view.state !== 'ready') return null;
    for (const envelope of [value.prescription, value.invoice]) {
      if (!object(envelope) || !Array.isArray(envelope.medicineItems)) continue;
      const doc = value.groupingDocuments.find(candidate => object(candidate) && candidate.documentId === envelope.documentId) as GroupingDocument | undefined;
      if (!doc || doc.documentType !== envelope.documentType) return null;
      for (const item of envelope.medicineItems) {
        if (!object(item) || !object(item.fields)) return null;
        if (doc.mode === 'HUMAN_CONFIRMED') {
          const group = doc.groups.find(candidate => candidate.anchorFieldId === item.anchorFieldId);
          if (!group || !Array.isArray(item.fieldIds) || item.fieldIds.length !== group.fieldIds.length || !group.fieldIds.every(id => (item.fieldIds as unknown[]).includes(id))) return null;
        }
        for (const linked of Object.values(item.fields)) if (linked !== null) {
          if (!object(linked)) return null;
          const source = doc.fields.find(field => field.id === linked.id);
          if (!source || source.fieldType !== linked.fieldType || source.rawValue !== linked.rawValue || source.normalizedValue !== linked.normalizedValue || source.pageNumber !== linked.pageNumber || source.extractionConfidence !== linked.extractionConfidence || source.needsCorrection !== linked.needsCorrection || source.correctedBy !== linked.correctedBy || source.correctedAt !== linked.correctedAt) return null;
        }
      }
    }
    if (eligibility.canVerify && (view.result.status !== 'CONSISTENT' || view.result.hasInsufficientEvidence || value.groupingDocuments.length !== 2 || value.groupingDocuments.some(doc => !object(doc) || doc.mode !== 'HUMAN_CONFIRMED' || !['PROCESSED', 'EXTRACTED'].includes(String(doc.processingStatus)) || (doc.fields as GroupingField[]).some(candidateNeedsCorrection)))) return null;
  } else if (value.prescription !== null || value.invoice !== null || eligibility.canVerify || !eligibility.blockerCodes.length) return null;
  return value as unknown as CaseReconciliationSnapshot;
}

export function createGroupingDraft(doc: GroupingDocument): GroupingDraft {
  const assignments: Record<string, string> = {};
  for (const field of doc.fields) assignments[field.id] = field.fieldType === 'medicine_name' ? field.id : '';
  for (const group of doc.groups) for (const member of group.fieldIds) if (Object.prototype.hasOwnProperty.call(assignments, member)) assignments[member] = group.anchorFieldId;
  const names = doc.fields.filter(field => field.fieldType === 'medicine_name');
  if (!doc.groups.length && names.length === 1) for (const field of doc.fields) assignments[field.id] = names[0].id;
  return { assignments, observedItemCount: doc.observedItemCount ?? names.length, completenessAttested: false };
}

export function buildGroupingRequest(doc: GroupingDocument, draft: GroupingDraft, snapshotToken: string): { payload: ConfirmGroupsRequest | null; error: string | null } {
  if (!isSnapshotToken(snapshotToken)) return { payload: null, error: 'Refresh the current case snapshot first.' };
  const anchors = doc.fields.filter(field => field.fieldType === 'medicine_name');
  if (!anchors.length || anchors.length > 3 || draft.observedItemCount !== anchors.length || !integer(draft.observedItemCount, 1)) return { payload: null, error: 'The visible item count must match one to three extracted medicine rows. Missing rows require a better source, not invented fields.' };
  if (!draft.completenessAttested) return { payload: null, error: 'Inspect the original document and confirm that all visible medicine rows are represented.' };
  const groups = anchors.map(anchor => ({ anchorFieldId: anchor.id, fieldIds: [] as string[] }));
  for (const field of doc.fields) {
    const assigned = draft.assignments[field.id]; const group = groups.find(candidate => candidate.anchorFieldId === assigned);
    if (!group || (field.fieldType === 'medicine_name' && assigned !== field.id)) return { payload: null, error: 'Assign every extracted medicine field to its correct source row.' };
    if (group.fieldIds.some(member => doc.fields.find(candidate => candidate.id === member)?.fieldType === field.fieldType)) return { payload: null, error: 'A row contains competing values for the same field. Correct the source extraction before confirming.' };
    group.fieldIds.push(field.id);
  }
  return { payload: { snapshotToken, observedItemCount: draft.observedItemCount, completenessAttested: true, groups }, error: null };
}

export function canSubmitAction(snapshot: CaseReconciliationSnapshot | null, role: string | undefined, action: ReviewAction): boolean {
  return !!snapshot && isReviewRole(role) && snapshot.permissions.canReview && snapshot.reviewEligibility.allowedActions.includes(action) && (action !== 'VERIFY' || snapshot.reviewEligibility.canVerify);
}

export function buildReviewRequest(snapshot: CaseReconciliationSnapshot | null, role: string | undefined, action: ReviewAction, reasonCode: string, notes: string): SnapshotReviewRequest | null {
  if (!canSubmitAction(snapshot, role, action) || !snapshot || !isSnapshotToken(snapshot.snapshotToken) || !reasonCode.trim() || reasonCode.trim().length > 80 || notes.trim().length < 10 || notes.trim().length > 2000) return null;
  return { snapshotToken: snapshot.snapshotToken, action, reasonCode: reasonCode.trim(), notes: notes.trim() };
}

export function safeApiMessage(error: unknown, fallback = 'The operation could not be completed. Refresh the current case and retry.'): string {
  if (!object(error)) return fallback;
  const response = object(error.response) ? error.response : null;
  const data = response && object(response.data) ? response.data : null;
  const machine = data?.code;
  if (machine === 'STALE_REVIEW_SNAPSHOT') return 'The evidence changed. Refresh and inspect the current snapshot before submitting again.';
  if (machine === 'CASE_BUSY') return 'This case is being updated. Wait briefly, then refresh.';
  if (machine === 'REVIEW_BLOCKED') return 'Verification is blocked by unresolved evidence. Return for correction or escalate.';
  return fallback;
}
