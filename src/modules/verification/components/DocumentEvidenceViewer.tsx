import React, { useState, useEffect, useRef } from 'react';
import {
  DocumentItem,
  DocumentType,
  ExtractedField,
  BoundingBox,
  RiskSignal,
  ConsistencyCheck,
  EvidenceItem
} from '../types';
import { verificationApi } from '../api/verificationApi';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Info,
  Layers,
  Crosshair,
  ShieldAlert,
  Pill,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DocumentEvidenceViewerProps {
  caseId: string;
  documents: DocumentItem[];
  extractedFields: ExtractedField[];
  riskSignals?: RiskSignal[];
  consistencyChecks?: ConsistencyCheck[];
  evidenceItems?: EvidenceItem[];
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  initialDocumentType?: DocumentType;
}

/**
 * Checks whether the bounding box has valid non-zero normalized coordinates [x_min, y_min, x_max, y_max].
 */
export function hasValidBoundingBox(bbox?: BoundingBox | number[] | null): bbox is BoundingBox {
  if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) return false;
  const [x0, y0, x1, y1] = bbox;
  // Missing or [0,0,0,0]
  if (x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) return false;
  // Non-positive width or height
  if (x1 <= x0 || y1 <= y0) return false;
  return true;
}

export const DocumentEvidenceViewer: React.FC<DocumentEvidenceViewerProps> = ({
  caseId,
  documents = [],
  extractedFields = [],
  riskSignals = [],
  consistencyChecks = [],
  evidenceItems = [],
  selectedFieldId: externalSelectedFieldId,
  onSelectField,
  initialDocumentType = 'PRESCRIPTION'
}) => {
  const [activeType, setActiveType] = useState<DocumentType>(initialDocumentType);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [internalSelectedFieldId, setInternalSelectedFieldId] = useState<string | null>(null);
  const selectedFieldId = externalSelectedFieldId !== undefined ? externalSelectedFieldId : internalSelectedFieldId;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showViewerCandidates, setShowViewerCandidates] = useState<boolean>(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  const documentTypes: DocumentType[] = ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'];

  const typeLabels: Record<DocumentType, { title: string; badge: string; description: string }> = {
    PRESCRIPTION: {
      title: 'Prescription (Rx)',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'Clinical prescription issued by physician'
    },
    PHARMACY_INVOICE: {
      title: 'Pharmacy Invoice',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'Dispensing pharmacy tax invoice & receipt'
    },
    CLAIM_FORM: {
      title: 'Claim Form',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Health insurance claim submission form'
    }
  };

  // Find active document metadata
  const activeDocument = documents.find(d => d.type === activeType);

  const isPdfDocument = Boolean(
    activeDocument &&
      (activeDocument.mimeType === 'application/pdf' ||
        activeDocument.originalFilename?.toLowerCase().endsWith('.pdf'))
  );

  const totalPages = Math.min(activeDocument?.pageCount || 1, 3);

  // Helper to handle field selection and notify parent, auto-switching page for PDFs if needed
  const handleSelectField = (fieldId: string | null) => {
    setInternalSelectedFieldId(fieldId);
    if (onSelectField) {
      onSelectField(fieldId);
    }
    if (fieldId) {
      const field = activeFields.find(f => (f.id || f._id) === fieldId);
      if (field && field.pageNumber && field.pageNumber !== currentPage && isPdfDocument) {
        setCurrentPage(field.pageNumber);
      }
    }
  };

  // Find high-risk field associations
  const { highRiskFieldIds, highRiskFieldTypes } = React.useMemo(() => {
    const ids = new Set<string>();
    const types = new Set<string>();

    // From high/critical risk signals
    const highSignals = riskSignals.filter(s => s.severity === 'HIGH' || s.severity === 'CRITICAL');
    for (const sig of highSignals) {
      if (sig.signalType.toLowerCase().includes('dosage')) types.add('dosage_strength');
      if (sig.signalType.toLowerCase().includes('medicine')) types.add('medicine_name');
      if (sig.signalType.toLowerCase().includes('quantity')) types.add('dispensed_quantity');
      if (sig.signalType.toLowerCase().includes('amount') || sig.signalType.toLowerCase().includes('price')) types.add('total_amount');
    }

    // From failed consistency checks
    const failedChecks = consistencyChecks.filter(c => c.status === 'FAIL' || c.severity === 'CRITICAL');
    for (const check of failedChecks) {
      if (check.fieldDifferences) {
        Object.keys(check.fieldDifferences).forEach(k => types.add(k.toLowerCase()));
      }
      if (check.checkType.toLowerCase().includes('dosage')) types.add('dosage_strength');
      if (check.checkType.toLowerCase().includes('medicine')) types.add('medicine_name');
      if (check.checkType.toLowerCase().includes('quantity')) types.add('dispensed_quantity');
      if (check.checkType.toLowerCase().includes('price') || check.checkType.toLowerCase().includes('amount')) types.add('total_amount');
    }

    return { highRiskFieldIds: ids, highRiskFieldTypes: types };
  }, [riskSignals, consistencyChecks]);

  // Determine field display status: 'selected' | 'high_risk' | 'low_confidence' | 'verified'
  const getFieldStatus = (field: ExtractedField) => {
    const fieldId = field.id || field._id;
    if (fieldId && selectedFieldId === fieldId) {
      return 'selected';
    }
    if (
      (fieldId && highRiskFieldIds.has(fieldId)) ||
      highRiskFieldTypes.has(field.fieldType.toLowerCase())
    ) {
      return 'high_risk';
    }
    if (
      field.needsCorrection ||
      (typeof field.confidenceScore === 'number' && field.confidenceScore < 0.75)
    ) {
      return 'low_confidence';
    }
    return 'verified';
  };

  // Color mappings
  const statusStyles = {
    selected: {
      border: 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-500/25',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      label: 'Selected Field',
      dot: 'bg-indigo-600'
    },
    high_risk: {
      border: 'border-red-600 ring-2 ring-red-400 bg-red-500/25',
      badge: 'bg-red-100 text-red-800 border-red-300',
      label: 'High-Risk Mismatch',
      dot: 'bg-red-600'
    },
    low_confidence: {
      border: 'border-amber-500 ring-1 ring-amber-300 bg-amber-500/20',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      label: 'Needs Correction / Low Confidence',
      dot: 'bg-amber-500'
    },
    verified: {
      border: 'border-teal-600 ring-1 ring-teal-300 bg-teal-500/20',
      badge: 'bg-teal-100 text-teal-800 border-teal-300',
      label: 'Verified / High Confidence',
      dot: 'bg-teal-600'
    }
  };

  // Active fields for currently selected document
  const activeFields = extractedFields.filter(f => {
    if (activeDocument) {
      const docId = activeDocument.id || activeDocument._id;
      return f.documentId === docId || f.documentType === activeType;
    }
    return f.documentType === activeType;
  });

  // Overlays filtered by selected page
  const visibleFields = activeFields.filter(f => (f.pageNumber || 1) === (isPdfDocument ? currentPage : 1));

  const selectedField = activeFields.find(f => (f.id || f._id) === selectedFieldId);

  // Fetch document binary content via authenticated Blob API
  // Manages temporary Object URL lifecycle and revokes previous URL on change or unmount
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    async function loadContent() {
      if (!activeDocument) {
        setImageUrl(null);
        setDocError(null);
        return;
      }

      const docId = activeDocument.id || activeDocument._id;
      if (!docId) return;

      try {
        setIsLoadingDoc(true);
        setDocError(null);

        let blob: Blob;
        if (isPdfDocument) {
          // Work Order 5B: Fetch rendered page preview as authenticated Blob
          blob = await verificationApi.getDocumentPagePreview(caseId, docId, currentPage);
        } else {
          // Standard single-page image document
          blob = await verificationApi.getDocumentContent(caseId, docId);
        }

        if (!isMounted) return;

        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;
        setImageUrl(objectUrl);
      } catch (err: any) {
        if (!isMounted) return;
        const msg =
          err.response?.data?.message || err.message || 'Failed to retrieve secure document content';
        setDocError(msg);
        setImageUrl(null);
      } finally {
        if (isMounted) {
          setIsLoadingDoc(false);
        }
      }
    }

    loadContent();

    // Revoke object URL when changing page, document, or leaving screen
    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [caseId, activeDocument?.id, activeDocument?._id, activeType, currentPage, isPdfDocument]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header & Disclaimer */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Secure Visual Document & Evidence Reviewer
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source document inspection with verified local OCR coordinate overlays.
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-teal-200" />
              <span>Teal: Verified</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
              <span>Amber: Review Required</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-200" />
              <span>Red: High-Risk</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200" />
              <span>Indigo: Selected</span>
            </span>
          </div>
        </div>

        {/* Mandatory Regulatory & Reviewer Disclaimer */}
        <div className="mt-3 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
            <span className="font-semibold text-indigo-950">
              Local PDF rendering and OCR — reviewer validation required.
            </span>
            <span className="text-[11px] text-indigo-700">
              OCR highlights are evidence aids. The reviewer validates the source document before making a decision.
            </span>
          </div>
        </div>
      </div>

      {/* Document Selector Tabs */}
      <div className="flex items-center border-b border-slate-200 bg-white px-4 gap-2 overflow-x-auto">
        {documentTypes.map(type => {
          const doc = documents.find(d => d.type === type);
          const isSelected = activeType === type;
          const { title } = typeLabels[type];

          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setActiveType(type);
                setCurrentPage(1);
                setZoomLevel(1);
              }}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                isSelected
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{title}</span>
              {doc ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {doc.mimeType?.replace('image/', '').replace('application/', '').toUpperCase()}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                  Pending
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Reviewer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Left: Document Canvas / Visual Viewer (8 cols) */}
        <div className="lg:col-span-8 p-4 bg-slate-100/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
          {/* Zoom and Document Actions Bar */}
          <div className="flex flex-wrap items-center justify-between pb-3 mb-2 border-b border-slate-200 text-xs gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 truncate">
                {activeDocument ? activeDocument.originalFilename : `${typeLabels[activeType].title} (Not Uploaded)`}
              </span>
              {activeDocument && (
                <span className="text-[11px] font-mono text-slate-400">
                  {(activeDocument.sizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
            </div>

            {/* Page Navigation Controls for PDFs */}
            {isPdfDocument && activeDocument && (
              <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1 || isLoadingDoc}
                  className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] font-semibold text-slate-700 px-1">
                  Page {currentPage} of {totalPages}
                  {(activeDocument.pageCount || 1) > 3 && (
                    <span className="text-slate-400 text-[10px] ml-1">({activeDocument.pageCount} total)</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages || isLoadingDoc}
                  className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Page Quick Select Pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    disabled={isLoadingDoc}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      currentPage === p
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Pg {p}
                  </button>
                ))}

                {(activeDocument.pageCount || 1) > 3 && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-1">
                    MVP max 3 pages
                  </span>
                )}
              </div>
            )}

            {/* Zoom Controls (Images & Rendered PDF Page Previews) */}
            {imageUrl && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-600 px-1.5">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ml-1"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Visual Display Container */}
          <div className="flex-1 flex items-center justify-center overflow-auto rounded-lg bg-slate-900/5 p-2 min-h-[460px]">
            {isLoadingDoc ? (
              <div className="text-center p-8">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-600">
                  {isPdfDocument ? `Rendering page ${currentPage} preview...` : 'Fetching protected document content...'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Local TrustRAG in-memory preview pipeline</p>
              </div>
            ) : docError ? (
              <div className="w-full max-w-md p-6 bg-white border border-red-200 rounded-xl text-center shadow-xs">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h4 className="font-bold text-sm text-slate-900 mb-1">Document Preview Unavailable</h4>
                <p className="text-xs text-slate-500">{docError}</p>
                {/* Academic note: Upgrades Work Order 4B placeholder ("PDF stored securely. Page rendering and PDF OCR are planned.") to active local rendering & OCR. */}
              </div>
            ) : !activeDocument ? (
              <div className="text-center p-8 text-slate-400 text-xs">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No {typeLabels[activeType].title} Uploaded</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Upload a PDF, PNG, JPEG, or WEBP document to view local OCR bounding boxes.
                </p>
              </div>
            ) : imageUrl ? (
              /* Image / Rendered PDF Canvas with Relative Coordinate Overlays */
              <div
                ref={imageContainerRef}
                className="relative inline-block transition-transform duration-150 ease-out origin-center"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={imageUrl}
                  alt={`Source document: ${activeDocument.originalFilename}${isPdfDocument ? ` (Page ${currentPage})` : ''}`}
                  className="max-w-full max-h-[580px] object-contain rounded shadow-xs select-none block"
                  draggable={false}
                />

                {/* Real OCR Bounding Box Overlays (filtered strictly to active page) */}
                {visibleFields.map(field => {
                  if (!hasValidBoundingBox(field.boundingBox)) {
                    return null; // Never draw misleading box when coordinates missing or [0,0,0,0]
                  }

                  const [x0, y0, x1, y1] = field.boundingBox;
                  const fieldId = field.id || field._id || '';
                  const status = getFieldStatus(field);
                  const style = statusStyles[status];
                  const isSelected = selectedFieldId === fieldId;

                  const leftPct = `${x0 * 100}%`;
                  const topPct = `${y0 * 100}%`;
                  const widthPct = `${Math.max(1, (x1 - x0) * 100)}%`;
                  const heightPct = `${Math.max(1, (y1 - y0) * 100)}%`;

                  return (
                    <button
                      key={fieldId || `${field.fieldType}-${x0}-${field.pageNumber || 1}`}
                      type="button"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectField(fieldId)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectField(fieldId);
                        }
                      }}
                      className={`absolute cursor-pointer transition-all border-2 rounded-xs focus:outline-hidden ${style.border} ${
                        isSelected ? 'z-30 scale-[1.02]' : 'z-10 hover:z-20 hover:scale-[1.01]'
                      }`}
                      style={{
                        left: leftPct,
                        top: topPct,
                        width: widthPct,
                        height: heightPct
                      }}
                      title={`${field.fieldType}: "${field.normalizedValue || field.rawValue}" (${(field.confidenceScore * 100).toFixed(0)}% conf) - Pg ${field.pageNumber || 1}`}
                      aria-label={`Highlight for ${field.fieldType} on page ${field.pageNumber || 1}`}
                    >
                      {/* Floating pill badge when selected or hovered */}
                      {isSelected && (
                        <span className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight bg-slate-900 text-white whitespace-nowrap shadow-xs pointer-events-none z-40">
                          {field.fieldType} (Pg {field.pageNumber || 1})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Highlighted fields:{' '}
              {visibleFields.filter(f => hasValidBoundingBox(f.boundingBox)).length} of {visibleFields.length}
              {isPdfDocument && ` on Page ${currentPage}`}
            </span>
            <span>Private In-Memory Blob Preview</span>
          </div>
        </div>

        {/* Right: Extracted OCR Fields List & Inspection Inspector (4 cols) */}
        <div className="lg:col-span-4 p-4 flex flex-col justify-between bg-white overflow-y-auto max-h-[700px]">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-700" />
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Extracted OCR Fields ({activeFields.length})
                </h4>
              </div>
              <span className="text-[10px] text-slate-400">Click field to locate</span>
            </div>

            {/* Field Details Inspector (when a field is selected) */}
            {selectedField ? (
              <div className="mb-4 p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                      Selected Field Inspection
                    </span>
                    <h5 className="font-bold text-sm text-slate-900 capitalize">
                      {selectedField.fieldType.replace(/_/g, ' ')}
                    </h5>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      statusStyles[getFieldStatus(selectedField)].badge
                    }`}
                  >
                    {statusStyles[getFieldStatus(selectedField)].label}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Raw OCR Value:</span>
                    <span className="font-mono bg-white px-2 py-1 rounded border border-slate-200 block text-slate-800 break-words">
                      {selectedField.rawValue || '<empty>'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Normalized Value:</span>
                    <span className="font-semibold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 block break-words">
                      {selectedField.normalizedValue || '<empty>'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Page / Confidence:</span>
                      <span className="font-bold text-slate-800 font-mono">
                        Pg {selectedField.pageNumber || 1} • {(selectedField.confidenceScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Extraction Method:</span>
                      <span className="font-medium text-slate-700 truncate block">
                        {selectedField.extractionMethod || 'LOCAL_OCR'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 text-[11px]">
                    <span className="text-slate-400 block">Location Coordinates:</span>
                    {hasValidBoundingBox(selectedField.boundingBox) ? (
                      <span className="font-mono text-slate-600 flex items-center gap-1 mt-0.5">
                        <Crosshair className="w-3 h-3 text-indigo-500" />
                        [{selectedField.boundingBox.map(n => n.toFixed(3)).join(', ')}] (Page {selectedField.pageNumber || 1})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium mt-0.5">
                        <AlertCircle className="w-3 h-3 text-slate-400" />
                        Source location unavailable
                      </span>
                    )}
                  </div>

                  {/* Explainable Medicine Resolution Inspector */}
                  {selectedField.resolution && (
                    <div className="mt-2.5 p-2.5 bg-white border border-indigo-200 rounded-lg text-xs space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                          <Pill className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Academic Resolution</span>
                        </div>
                        {(!selectedField.resolution.resolved || selectedField.resolution.ambiguous) && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Needs human confirmation
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Generic Name:</span>
                          <span className="font-semibold text-slate-900 truncate block">
                            {selectedField.resolution.canonical?.genericName || 'Unresolved'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Brand Name:</span>
                          <span className="font-medium text-slate-800 truncate block">
                            {selectedField.resolution.canonical?.brandName || selectedField.rawValue || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Strength:</span>
                          <span className="font-mono text-slate-800 block">
                            {selectedField.resolution.canonical?.strength || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Dosage Form:</span>
                          <span className="text-slate-800 block">
                            {selectedField.resolution.canonical?.dosageForm || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
                        <span>Basis: {selectedField.resolution.matchBasis}</span>
                        <span>Score: {Math.round((selectedField.resolution.matchScore || 0) * 100)}%</span>
                      </div>

                      <div className="text-[9px] text-slate-400 italic">
                        Curated academic reference catalogue — not live regulatory verification.
                      </div>

                      {selectedField.resolution.candidates && selectedField.resolution.candidates.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowViewerCandidates(!showViewerCandidates)}
                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            {showViewerCandidates ? (
                              <>
                                <ChevronUp className="w-3 h-3" /> Hide Candidates ({selectedField.resolution.candidates.length})
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" /> View Candidates ({selectedField.resolution.candidates.length})
                              </>
                            )}
                          </button>

                          {showViewerCandidates && (
                            <div className="mt-1.5 space-y-1 max-h-36 overflow-y-auto">
                              {selectedField.resolution.candidates.map((cand, cIdx) => (
                                <div key={cand.id || cand._id || cIdx} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                                  <div className="font-semibold text-slate-800">
                                    {cand.genericName} <span className="font-normal text-slate-500">({cand.brandName})</span>
                                  </div>
                                  <div className="text-slate-500">
                                    {cand.strength} • {cand.dosageForm} • Match: {Math.round((cand.matchScore || 0) * 100)}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* List of Extracted Fields */}
            {activeFields.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                {isPdfDocument
                  ? 'No fields extracted from PDF document. Human reviewer validation required.'
                  : 'No fields extracted for this document.'}
              </div>
            ) : (
              <div className="space-y-2">
                {activeFields.map(field => {
                  const fieldId = field.id || field._id || '';
                  const isSelected = selectedFieldId === fieldId;
                  const status = getFieldStatus(field);
                  const style = statusStyles[status];
                  const hasBbox = hasValidBoundingBox(field.boundingBox);
                  const isUnresolvedMed = field.resolution && (!field.resolution.resolved || field.resolution.ambiguous);

                  return (
                    <button
                      key={fieldId || `${field.fieldType}-${field.pageNumber || 1}`}
                      type="button"
                      onClick={() => handleSelectField(fieldId)}
                      className={`w-full text-left p-3 rounded-lg border transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {field.fieldType.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPdfDocument && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Pg {field.pageNumber || 1}
                            </span>
                          )}
                          {isUnresolvedMed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Needs confirmation
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400">
                            {(field.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 font-medium truncate mb-1">
                        {field.normalizedValue || field.rawValue}
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        {hasBbox ? (
                          <span className="text-indigo-600 font-medium flex items-center gap-1">
                            <Crosshair className="w-2.5 h-2.5" />
                            Location linked (Pg {field.pageNumber || 1})
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Source location unavailable
                          </span>
                        )}

                        {field.needsCorrection ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Needs Correction
                          </span>
                        ) : (
                          <span className="text-teal-700 font-medium">Verified</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Case: {caseId.slice(-8)}</span>
            <span>Document Evidence Module</span>
          </div>
        </div>
      </div>
    </div>
  );
};
