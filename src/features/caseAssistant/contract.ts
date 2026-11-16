import { CASE_ASSISTANT_SCHEMA, FRESHNESS_REASONS } from './types';
import type { AnswerReceipt, CaseAssistantAnswer, FreshnessResponse, MedicineChoice } from './types';

export const isCaseId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
export const isMedicineItemId = (value: unknown): value is string => typeof value === 'string' && /^mi_[a-f0-9]{24}$/.test(value);
export const isAnswerId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const text = (v: unknown, max: number, min = 1): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const stringList = (v: unknown, count: number, max: number): v is string[] => Array.isArray(v) && v.length <= count && v.every(x => text(x, max));
const unique = (v: string[]) => new Set(v).size === v.length;
const nullable = (v: unknown, check: (s: unknown) => boolean) => v === null || check(v);

export function parseMedicineChoices(value: unknown): MedicineChoice[] | null {
  if (!Array.isArray(value) || value.length > 6 || !value.every(v => object(v) &&
    exact(v, ['itemId', 'label', 'documentType']) && isMedicineItemId(v.itemId) && text(v.label, 240) &&
    typeof v.documentType === 'string' && ['PRESCRIPTION', 'PHARMACY_INVOICE'].includes(v.documentType))) return null;
  if (!unique(value.map(v => v.itemId))) return null;
  return value as MedicineChoice[];
}

export function parseCaseAnswer(value: unknown, expectedCaseId: string, expectedItemId?: string | null): CaseAssistantAnswer | null {
  if (!isCaseId(expectedCaseId) || !object(value) ||
    !exact(value, ['schemaVersion', 'caseId', 'answerId', 'generatedAt', 'evidenceRevision', 'reply', 'mode', 'intent', 'medicineItemId', 'choices', 'sources', 'warnings', 'dependencyKeys', 'bindingToken', 'disclaimer']) ||
    value.schemaVersion !== CASE_ASSISTANT_SCHEMA || value.caseId !== expectedCaseId || !isAnswerId(value.answerId) ||
    !iso(value.generatedAt) || !integer(value.evidenceRevision) || !text(value.reply, 12000) ||
    typeof value.mode !== 'string' || !['LOCAL_CASE_EVIDENCE', 'CLARIFY', 'ABSTAIN', 'SAFETY'].includes(value.mode) ||
    typeof value.intent !== 'string' || !['STRENGTH', 'QUANTITY', 'IDENTITY', 'COMPARISON', 'CASE_STATUS', 'UNSUPPORTED'].includes(value.intent) ||
    !nullable(value.medicineItemId, isMedicineItemId) || !parseMedicineChoices(value.choices) ||
    !stringList(value.warnings, 12, 500) || !stringList(value.dependencyKeys, 64, 160) ||
    !unique(value.dependencyKeys as string[]) || !text(value.disclaimer, 600) ||
    !nullable(value.bindingToken, v => text(v, 32768)) || !Array.isArray(value.sources) || value.sources.length > 12) return null;
  if (expectedItemId && value.mode === 'LOCAL_CASE_EVIDENCE' && value.medicineItemId !== expectedItemId) return null;
  const choices = value.choices as MedicineChoice[];
  if (value.medicineItemId && !choices.some(v => v.itemId === value.medicineItemId)) return null;
  const sourceKeys = ['citation', 'sourceId', 'documentId', 'fieldId', 'pageNumber', 'itemId', 'title', 'excerpt', 'fingerprint'];
  if (!value.sources.every((s, i) => object(s) && exact(s, sourceKeys) && s.citation === 'S' + (i + 1) &&
    text(s.sourceId, 160) && text(s.title, 160) && text(s.excerpt, 1000) && hash(s.fingerprint) &&
    nullable(s.documentId, isCaseId) && nullable(s.fieldId, isCaseId) && nullable(s.pageNumber, v => integer(v, 1)) &&
    nullable(s.itemId, isMedicineItemId) && (!s.itemId || choices.some(c => c.itemId === s.itemId)) &&
    (s.fieldId === null || (s.documentId !== null && s.pageNumber !== null && s.itemId !== null)) &&
    (s.documentId !== null || (s.fieldId === null && s.pageNumber === null)))) return null;
  const sources = value.sources as CaseAssistantAnswer['sources'];
  const reply = value.reply as string;
  if (!unique(sources.map(s => s.sourceId))) return null;
  const citations = new Set(sources.map(s => '[' + s.citation + ']'));
  if ([...reply.matchAll(/\[S\d+\]/g)].some(m => !citations.has(m[0]))) return null;
  if (value.mode !== 'LOCAL_CASE_EVIDENCE') {
    if (sources.length || value.dependencyKeys.length || value.bindingToken !== null) return null;
  } else if (!sources.length || !value.dependencyKeys.length || !value.bindingToken ||
    sources.some(s => !reply.includes('[' + s.citation + ']'))) return null;
  return value as unknown as CaseAssistantAnswer;
}

export function parseFreshnessResponse(value: unknown, expectedCaseId: string, receipts: AnswerReceipt[]): FreshnessResponse | null {
  if (!object(value) || !exact(value, ['schemaVersion', 'caseId', 'checkedAt', 'evidenceRevision', 'results']) ||
    value.schemaVersion !== CASE_ASSISTANT_SCHEMA || value.caseId !== expectedCaseId || !isCaseId(expectedCaseId) ||
    !iso(value.checkedAt) || !integer(value.evidenceRevision) || !Array.isArray(value.results) ||
    value.results.length !== receipts.length || !receipts.length || receipts.length > 20 || !unique(receipts.map(r => r.answerId))) return null;
  const ids = new Set(receipts.map(r => r.answerId));
  if (!value.results.every(r => object(r) && exact(r, ['answerId', 'status', 'changedDependencyKeys', 'reasonCode']) &&
    isAnswerId(r.answerId) && ids.has(r.answerId) && typeof r.status === 'string' && ['FRESH', 'STALE', 'UNVERIFIABLE'].includes(r.status) &&
    stringList(r.changedDependencyKeys, 64, 160) && unique(r.changedDependencyKeys as string[]) &&
    FRESHNESS_REASONS.includes(r.reasonCode as typeof FRESHNESS_REASONS[number]) &&
    (r.status !== 'FRESH' || (r.reasonCode === 'UNCHANGED_DEPENDENCIES' && r.changedDependencyKeys.length === 0)) &&
    (r.status !== 'STALE' || ['EVIDENCE_CHANGED', 'DEPENDENCY_MISSING'].includes(String(r.reasonCode))) &&
    (r.status !== 'UNVERIFIABLE' || ['INVALID_RECEIPT', 'RECEIPT_EXPIRED', 'CASE_PROCESSING'].includes(String(r.reasonCode))))) return null;
  if (!unique(value.results.map(r => r.answerId))) return null;
  return value as unknown as FreshnessResponse;
}

export function caseSourceHref(caseId: string, source: CaseAssistantAnswer['sources'][number]): string | null {
  if (!isCaseId(caseId)) return null;
  if (!source.documentId || !source.fieldId || !source.pageNumber) return '/cases/' + caseId;
  if (!isCaseId(source.documentId) || !isCaseId(source.fieldId) || !integer(source.pageNumber, 1)) return null;
  const query = new URLSearchParams({ documentId: source.documentId, fieldId: source.fieldId, pageNumber: String(source.pageNumber) });
  return '/cases/' + caseId + '?' + query;
}
