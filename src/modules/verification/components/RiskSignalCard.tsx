import React from 'react';
import { RiskSignal } from '../types';
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, Eye } from 'lucide-react';

interface RiskSignalCardProps {
  signal: RiskSignal;
  onSelectEvidence?: (evidenceId: string) => void;
  onViewSourceDocument?: (evidenceId?: string) => void;
}

export const RiskSignalCard: React.FC<RiskSignalCardProps> = ({
  signal,
  onSelectEvidence,
  onViewSourceDocument
}) => {
  const severityStyles = {
    LOW: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      border: 'border-blue-200',
      icon: Info,
      iconColor: 'text-blue-500'
    },
    MEDIUM: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      border: 'border-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-500'
    },
    HIGH: {
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      border: 'border-orange-200',
      icon: AlertTriangle,
      iconColor: 'text-orange-600'
    },
    CRITICAL: {
      badge: 'bg-red-50 text-red-700 border-red-200',
      border: 'border-red-300',
      icon: AlertOctagon,
      iconColor: 'text-red-600'
    }
  };

  const style = severityStyles[signal.severity] || severityStyles.MEDIUM;
  const Icon = style.icon;

  return (
    <div className={`p-4 rounded-xl border bg-white shadow-2xs ${style.border} mb-3 transition-all hover:shadow-xs`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 bg-slate-50 border border-slate-100 ${style.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-sm text-slate-900 tracking-tight">
                {signal.signalType.replace(/_/g, ' ')}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
                {signal.severity}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Score: {(signal.score * 100).toFixed(0)}%
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {signal.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-1">
          {signal.reviewRequired && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              Review Required
            </span>
          )}
          {signal.isMitigated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Mitigated
            </span>
          )}
        </div>
      </div>

      {signal.triggeringEvidence && signal.triggeringEvidence.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px]">Cited Evidence:</span>
            <div className="flex flex-wrap gap-1.5">
              {signal.triggeringEvidence.map((evId, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectEvidence?.(evId)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 border border-slate-200 transition-colors"
                  title={`View cited evidence ${evId}`}
                >
                  #{String(evId).slice(-6)}
                </button>
              ))}
            </div>
          </div>
          {onViewSourceDocument && (
            <button
              type="button"
              onClick={() => onViewSourceDocument(signal.triggeringEvidence[0])}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors shrink-0"
              title="Inspect evidence on source document"
            >
              <Eye className="w-3 h-3" />
              <span>Inspect Source</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
