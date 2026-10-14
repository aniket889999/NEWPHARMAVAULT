import React from 'react';
import { VerificationCaseStatus } from '../types';
import {
  FilePlus,
  Files,
  CheckCircle2,
  Cpu,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Archive
} from 'lucide-react';

interface LifecycleStepperProps {
  currentStatus: VerificationCaseStatus;
}

interface StepConfig {
  id: string;
  label: string;
  description: string;
  statuses: VerificationCaseStatus[];
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Case created',
    statuses: ['DRAFT'],
    icon: FilePlus
  },
  {
    id: 'docs_pending',
    label: 'Documents',
    description: 'Ingesting 3 docs',
    statuses: ['DOCUMENTS_PENDING'],
    icon: Files
  },
  {
    id: 'ready',
    label: 'Ready',
    description: 'Tri-doc uploaded',
    statuses: ['READY_FOR_PROCESSING'],
    icon: CheckCircle2
  },
  {
    id: 'processing',
    label: 'Processing',
    description: 'AI & checks running',
    statuses: ['PROCESSING'],
    icon: Cpu
  },
  {
    id: 'review_needed',
    label: 'Needs Review',
    description: 'HITL required',
    statuses: ['NEEDS_CORRECTION', 'NEEDS_REVIEW'],
    icon: AlertTriangle
  },
  {
    id: 'adjudicated',
    label: 'Decision',
    description: 'Human decision',
    statuses: ['VERIFIED', 'REJECTED'],
    icon: ShieldCheck
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Final archived',
    statuses: ['CLOSED'],
    icon: Archive
  }
];

export const LifecycleStepper: React.FC<LifecycleStepperProps> = ({ currentStatus }) => {
  // Determine index of current status
  const currentStepIndex = STEPS.findIndex(step => step.statuses.includes(currentStatus));

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Case Verification Lifecycle
          </h3>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
            Current Status:
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
              currentStatus === 'VERIFIED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : currentStatus === 'REJECTED'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : currentStatus === 'NEEDS_REVIEW' || currentStatus === 'NEEDS_CORRECTION'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : currentStatus === 'PROCESSING'
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse'
                : currentStatus === 'READY_FOR_PROCESSING'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {currentStatus.replace(/_/g, ' ')}
            </span>
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Step {Math.max(1, currentStepIndex + 1)} of {STEPS.length}
        </div>
      </div>

      {/* Stepper Bar */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-4 right-4 h-0.5 bg-slate-200 -z-0 hidden md:block" />

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 relative z-10">
          {STEPS.map((step, idx) => {
            const isCurrent = step.statuses.includes(currentStatus);
            const isPast = currentStepIndex > idx;
            const Icon = isCurrent && currentStatus === 'REJECTED' ? XCircle : step.icon;

            let badgeBg = 'bg-slate-100 text-slate-400 border-slate-300';
            let textColor = 'text-slate-400';

            if (isCurrent) {
              if (currentStatus === 'VERIFIED') {
                badgeBg = 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-4 ring-emerald-100';
                textColor = 'text-emerald-700 font-bold';
              } else if (currentStatus === 'REJECTED') {
                badgeBg = 'bg-red-600 text-white border-red-600 shadow-md ring-4 ring-red-100';
                textColor = 'text-red-700 font-bold';
              } else if (currentStatus === 'NEEDS_REVIEW' || currentStatus === 'NEEDS_CORRECTION') {
                badgeBg = 'bg-amber-500 text-white border-amber-500 shadow-md ring-4 ring-amber-100';
                textColor = 'text-amber-800 font-bold';
              } else if (currentStatus === 'PROCESSING') {
                badgeBg = 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-4 ring-indigo-100 animate-pulse';
                textColor = 'text-indigo-700 font-bold';
              } else {
                badgeBg = 'bg-blue-600 text-white border-blue-600 shadow-md ring-4 ring-blue-100';
                textColor = 'text-blue-700 font-bold';
              }
            } else if (isPast) {
              badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-400';
              textColor = 'text-slate-700 font-medium';
            }

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center text-center p-2 rounded-lg transition-all ${
                  isCurrent ? 'bg-slate-50/80 border border-slate-200' : ''
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${badgeBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-2 ${textColor}`}>
                  {step.label}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight hidden lg:block">
                  {step.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
