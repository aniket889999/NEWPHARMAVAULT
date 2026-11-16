import { isCaseId } from './contract';
interface SourceDocument { id?: string; _id?: string; caseId: string; type: string; pageCount?: number | null }
interface SourceField { id?: string; _id?: string; caseId: string; documentId: string; pageNumber?: number }
export type RequestedSource = { documentId: string; fieldId: string; pageNumber: number; documentType: string };
export function resolveCaseSourceQuery(caseId: string, params: URLSearchParams, documents: SourceDocument[], fields: SourceField[]): RequestedSource | 'INVALID' | null {
  const docId = params.get('documentId'), fieldId = params.get('fieldId'), rawPage = params.get('pageNumber');
  if (docId === null && fieldId === null && rawPage === null) return null;
  if (!isCaseId(caseId) || !isCaseId(docId) || !isCaseId(fieldId) || !rawPage || !/^[1-9]\d{0,4}$/.test(rawPage) ||
    params.getAll('documentId').length !== 1 || params.getAll('fieldId').length !== 1 || params.getAll('pageNumber').length !== 1) return 'INVALID';
  const pageNumber = Number(rawPage);
  const doc = documents.find(d => d.caseId === caseId && (d.id || d._id) === docId);
  const field = fields.find(f => f.caseId === caseId && f.documentId === docId && (f.id || f._id) === fieldId && f.pageNumber === pageNumber);
  if (!doc || !field || !['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'].includes(doc.type) ||
    (typeof doc.pageCount === 'number' && pageNumber > doc.pageCount)) return 'INVALID';
  return { documentId: docId, fieldId, pageNumber, documentType: doc.type };
}
