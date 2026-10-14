import React, { useState } from 'react';
import { ExtractedField, DocumentType, DocumentItem } from '../types';
import { verificationApi } from '../api/verificationApi';
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Edit2,
  Check,
  X,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  Pill
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ExtractedFieldsEditorProps {
  caseId: string;
  fields: ExtractedField[];
  documents?: DocumentItem[];
  onFieldCorrected?: (updatedField: ExtractedField) => void;
  canEdit?: boolean;
}

export const ExtractedFieldsEditor: React.FC<ExtractedFieldsEditorProps> = ({
  caseId,
  fields,
  documents = [],
  onFieldCorrected,
  canEdit = true
}) => {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [expandedCandidatesFieldId, setExpandedCandidatesFieldId] = useState<string | null>(null);

  const documentTypes: DocumentType[] = ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'];

  const documentTypeTitles: Record<DocumentType, { title: string; badge: string }> = {
    PRESCRIPTION: { title: 'Prescription (Rx)', badge: 'bg-blue-100 text-blue-800' },
    PHARMACY_INVOICE: { title: 'Pharmacy Tax Invoice', badge: 'bg-emerald-100 text-emerald-800' },
    CLAIM_FORM: { title: 'Health Claim Submission', badge: 'bg-purple-100 text-purple-800' }
  };

  const handleStartEdit = (field: ExtractedField) => {
    setEditingFieldId(field.id || field._id || '');
    setEditValue(field.normalizedValue || field.rawValue || '');
  };

  const handleCancelEdit = () => {
    setEditingFieldId(null);
    setEditValue('');
  };

  const handleSaveEdit = async (fieldId: string) => {
    if (!editValue.trim()) {
      toast.error('Normalized value cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await verificationApi.correctExtractedField(caseId, fieldId, editValue.trim());
      toast.success('Field corrected successfully!');
      setEditingFieldId(null);
      if (onFieldCorrected) {
        onFieldCorrected(updated);
      }
    } catch (err: unknown) {
      console.error('Field correction failed:', err);
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = axiosErr.response?.data?.message || axiosErr.message || 'Failed to correct field';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPdfPending = documents.some(
    d => d.processingStatus === 'PDF_OCR_PENDING_RASTERIZATION' || (d.mimeType === 'application/pdf' && fields.length === 0)
  );

  return (
    <div className="space-y-6">
      {/* PDF Honest Status Notice Banner */}
      {hasPdfPending && (
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Image OCR is available in this MVP. PDF page rendering is the next planned module.
          </span>
        </div>
      )}

      {documentTypes.map(docType => {
        const docFields = fields.filter(f => f.documentType === docType);
        const { title, badge } = documentTypeTitles[docType];
        const docItem = documents.find(d => d.type === docType);
        const isPdfPendingDoc = docItem?.processingStatus === 'PDF_OCR_PENDING_RASTERIZATION';

        return (
          <div key={docType} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                <h4 className="font-semibold text-sm text-slate-800">{title}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
                  {docFields.length} extracted {docFields.length === 1 ? 'field' : 'fields'}
                </span>
                {isPdfPendingDoc && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    PDF Rasterization Pending
                  </span>
                )}
              </div>
            </div>

            {docFields.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {isPdfPendingDoc ? (
                  <span>PDF OCR is pending rasterization support. Upload a PNG, JPEG, or WEBP document for local image OCR.</span>
                ) : (
                  <span>No extracted fields available for this document type.</span>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {docFields.map(field => {
                  const fieldId = field.id || field._id || '';
                  const isEditing = editingFieldId === fieldId;
                  const confidenceVal = typeof field.confidenceScore === 'number' ? field.confidenceScore : 0.9;
                  const isLowConfidence = confidenceVal < 0.75;
                  const needsCorrection = field.needsCorrection || isLowConfidence;
                  const isCorrected = Boolean(field.correctedAt);
                  const ocrMethod = field.extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR';

                  return (
                    <div
                      key={fieldId}
                      className={`p-4 transition-colors ${
                        needsCorrection && !isCorrected ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 font-mono">
                              {field.fieldType.replace(/_/g, ' ')}
                            </span>

                            {/* Method Badge */}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {ocrMethod}
                            </span>

                            {/* Needs Correction Badge */}
                            {needsCorrection && !isCorrected && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" /> Needs Correction
                              </span>
                            )}

                            {/* Human Corrected Badge */}
                            {isCorrected && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> Human Corrected
                              </span>
                            )}

                            {/* Confidence Score */}
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                                isLowConfidence && !isCorrected
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Conf: {(confidenceVal * 100).toFixed(0)}%
                            </span>

                            {/* Document & Page Citation */}
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Layers className="w-3 h-3 text-slate-400" />
                              Page {field.pageNumber || 1} • {field.documentType || docType}
                            </span>
                          </div>

                          {/* Values View or Edit */}
                          {isEditing ? (
                            <div className="mt-2 flex items-center gap-2 max-w-md">
                              <input
                                type="text"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="flex-1 px-3 py-1.5 text-xs border rounded-lg border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter corrected value"
                                autoFocus
                                disabled={isSubmitting}
                              />
                              <button
                                onClick={() => handleSaveEdit(fieldId)}
                                disabled={isSubmitting}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                                className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-sm font-semibold text-slate-900">
                                {field.normalizedValue || field.rawValue}
                              </div>
                              {field.rawValue && field.rawValue !== field.normalizedValue && (
                                <span className="text-xs text-slate-400 font-normal">
                                  (Raw Value: "{field.rawValue}")
                                </span>
                              )}
                            </div>
                          )}

                          {/* Coordinates */}
                          {field.boundingBox && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              BBox: [{field.boundingBox.join(', ')}]
                            </div>
                          )}

                          {/* Explainable Medicine Resolution Card */}
                          {field.resolution && (
                            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                  <Pill className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Academic Medicine Resolution</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(!field.resolution.resolved || field.resolution.ambiguous) && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs human confirmation
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                                    Score: {Math.round((field.resolution.matchScore || 0) * 100)}%
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                    Basis: {field.resolution.matchBasis}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div>
                                  <span className="text-slate-400 block">Generic Name</span>
                                  <span className="font-semibold text-slate-900 truncate block">
                                    {field.resolution.canonical?.genericName || 'Unresolved'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Brand Name</span>
                                  <span className="font-medium text-slate-800 truncate block">
                                    {field.resolution.canonical?.brandName || field.rawValue || '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Strength</span>
                                  <span className="font-mono text-slate-800 block">
                                    {field.resolution.canonical?.strength || '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Dosage Form</span>
                                  <span className="text-slate-800 block">
                                    {field.resolution.canonical?.dosageForm || '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[10px] text-slate-400 italic">
                                Curated academic reference catalogue — not live regulatory verification.
                              </div>

                              {/* Ranked Candidates Viewer */}
                              {field.resolution.candidates && field.resolution.candidates.length > 0 && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCandidatesFieldId(
                                        expandedCandidatesFieldId === fieldId ? null : fieldId
                                      )
                                    }
                                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                  >
                                    {expandedCandidatesFieldId === fieldId ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" /> Hide Candidate Medicines ({field.resolution.candidates.length})
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" /> View Candidate Medicines ({field.resolution.candidates.length})
                                      </>
                                    )}
                                  </button>

                                  {expandedCandidatesFieldId === fieldId && (
                                    <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                                      <span className="text-[10px] text-slate-500 block mb-1">
                                        Candidate options from curated catalogue (review and manually confirm; no automatic changes):
                                      </span>
                                      {field.resolution.candidates.map((c, idx) => (
                                        <div
                                          key={c.id || c._id || idx}
                                          className="p-2 bg-white rounded border border-slate-200 hover:border-indigo-300 flex items-center justify-between gap-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="font-semibold text-xs text-slate-800">
                                              {c.genericName} <span className="font-normal text-slate-500">({c.brandName})</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              {c.strength} • {c.dosageForm} • {c.manufacturer || 'Approved Formulary'} • Match: {Math.round((c.matchScore || 0) * 100)}% ({c.matchBasis})
                                            </div>
                                          </div>
                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingFieldId(fieldId);
                                                setEditValue(c.genericName || c.brandName || '');
                                              }}
                                              className="px-2 py-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 shrink-0"
                                            >
                                              Prefill Correction
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {canEdit && !isEditing && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleStartEdit(field)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Correct</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
