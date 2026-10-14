import React from 'react';
import { AuditEventItem } from '../types';
import {
  ShieldCheck,
  FileText,
  Edit3,
  Cpu,
  UserCheck,
  Archive,
  Clock,
  Activity
} from 'lucide-react';

interface AuditTrailViewProps {
  events: AuditEventItem[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ events }) => {
  const getActionDetails = (action: string) => {
    switch (action) {
      case 'CASE_CREATED':
        return { label: 'Case Initialized', icon: FileText, color: 'bg-blue-100 text-blue-700' };
      case 'DOCUMENT_UPLOADED':
        return { label: 'Document Ingested', icon: FileText, color: 'bg-indigo-100 text-indigo-700' };
      case 'EXTRACTED_FIELD_CORRECTED':
        return { label: 'Field Corrected (HITL)', icon: Edit3, color: 'bg-amber-100 text-amber-700' };
      case 'PIPELINE_STARTED':
      case 'PIPELINE_COMPLETED':
      case 'PIPELINE_FAILED':
        return { label: 'TrustRAG Processing', icon: Cpu, color: 'bg-purple-100 text-purple-700' };
      case 'REVIEW_DECISION_RECORDED':
        return { label: 'Review Adjudication', icon: UserCheck, color: 'bg-emerald-100 text-emerald-700' };
      case 'CASE_CLOSED':
        return { label: 'Case Archived', icon: Archive, color: 'bg-slate-100 text-slate-700' };
      default:
        return { label: action.replace(/_/g, ' '), icon: Activity, color: 'bg-slate-100 text-slate-700' };
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
        No audit events recorded for this case yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h4 className="font-semibold text-sm text-slate-900">Immutable Audit Trail</h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {events.length} {events.length === 1 ? 'event' : 'events'} logged
        </span>
      </div>

      <div className="p-5">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {events.map((evt, idx) => {
            const { label, icon: Icon, color } = getActionDetails(evt.action);
            const actorName = typeof evt.actorId === 'object' && evt.actorId !== null ? evt.actorId.name : 'User';

            return (
              <div key={evt.id || evt._id || idx} className="relative group">
                {/* Node icon */}
                <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs ${color}`}>
                  <Icon className="w-2.5 h-2.5" />
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 transition-colors hover:bg-slate-100/60">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 uppercase">
                        {evt.actorRole}
                      </span>
                      {actorName && (
                        <span className="text-xs text-slate-500 font-medium">
                          ({actorName})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(evt.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Sanitized Metadata Display */}
                  {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                    <div className="mt-2 text-xs flex flex-wrap gap-2">
                      {Object.entries(evt.metadata).map(([key, val]) => {
                        // Never display raw long strings or secrets
                        if (typeof val === 'object' && val !== null) return null;
                        return (
                          <div
                            key={key}
                            className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono text-slate-600"
                          >
                            <span className="text-slate-400 font-sans">{key}:</span> {String(val)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
