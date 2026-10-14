import React, { useState } from 'react';
import { EvidenceItem } from '../types';
import {
  ShieldCheck,
  Database,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  AlertCircle,
  Eye
} from 'lucide-react';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  isHighlighted?: boolean;
  onViewDocument?: (docType?: string, docId?: string) => void;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, isHighlighted, onViewDocument }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOfficial = evidence.sourceType === 'OFFICIAL_SOURCE_REGISTRY';
  const isCurated = evidence.sourceType === 'CURATED_MEDICINE_KNOWLEDGE';
  const isPrivate = evidence.sourceType === 'PRIVATE_CASE_DATA';

  const tierLabels: Record<number, { label: string; badge: string }> = {
    1: { label: 'Tier 1: Official Allow-List', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    2: { label: 'Tier 2: Curated Medicine Catalog', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    3: { label: 'Tier 3: Clinical Prescription', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    4: { label: 'Tier 4: Pharmacy Invoice', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    5: { label: 'Tier 5: Health Claim Form', badge: 'bg-purple-100 text-purple-800 border-purple-200' }
  };

  const currentTier = tierLabels[evidence.trustTier] || {
    label: `Tier ${evidence.trustTier}`,
    badge: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  const SourceIcon = isOfficial ? ShieldCheck : isCurated ? Database : FileSpreadsheet;

  return (
    <div
      id={`evidence-${evidence.id || evidence._id}`}
      className={`rounded-xl border transition-all ${
        isHighlighted
          ? 'ring-2 ring-indigo-500 bg-indigo-50/40 border-indigo-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
      } p-4 mb-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${
            isOfficial ? 'bg-indigo-100 text-indigo-700' : isCurated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
          }`}>
            <SourceIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {evidence.sourceLabel}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${currentTier.badge}`}>
                {currentTier.label}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                ID: {String(evidence.id || evidence._id || '').slice(-6)}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium line-clamp-2">
              "{evidence.citationText}"
            </p>

            {/* Mandatory Regulatory Notice for Official Registry */}
            {isOfficial && (
              <div className="mt-2 text-[11px] bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md px-2.5 py-1.5 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Local allow-listed reference registry — not live regulatory verification.</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          title={isExpanded ? 'Collapse lineage' : 'Expand lineage'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Lineage Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2">
          <div>
            <span className="font-semibold text-slate-700">Relevance Reason: </span>
            <span className="text-slate-600">{evidence.relevanceReason}</span>
          </div>

          {evidence.documentReference && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Document Grounding Coordinate:
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400">Doc Type: </span>
                  <span className="font-medium text-slate-800">{evidence.documentReference.documentType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Page: </span>
                  <span className="font-medium text-slate-800">{evidence.documentReference.pageNumber ?? 1}</span>
                </div>
              </div>
              {evidence.documentReference.boundingBox && (
                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  Bounding Box: [{evidence.documentReference.boundingBox.join(', ')}]
                </div>
              )}
              {onViewDocument && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => onViewDocument(evidence.documentReference?.documentType, evidence.documentReference?.documentId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Inspect Document Evidence</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
            <span>Retrieved: {new Date(evidence.retrievedAt).toLocaleString()}</span>
            <span>Source Type: {evidence.sourceType}</span>
          </div>
        </div>
      )}
    </div>
  );
};
