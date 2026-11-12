import type { DocumentItem } from '../types';
import type { EvidenceReference } from '../reconciliation/types';

/** Never select the first document of a type when evidence names a specific source. */
export function resolveEvidenceSource(caseId: string, documents: DocumentItem[], reference: EvidenceReference) {
  const document = documents.find(doc => doc.caseId === caseId && (doc.id || doc._id) === reference.documentId);
  if (!document || !Number.isSafeInteger(reference.pageNumber) || reference.pageNumber < 1 || !reference.fieldId) return null;
  const pageLimit = Math.min(document.pageCount || 1, 3);
  return { documentId: reference.documentId, documentType: document.type, fieldId: reference.fieldId, pageNumber: reference.pageNumber, previewAvailable: reference.pageNumber <= pageLimit };
}
