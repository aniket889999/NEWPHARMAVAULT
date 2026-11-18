import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

/**
 * In-app confirmation dialog in the version-2.0 style (replaces window.confirm).
 * const [dialog, confirm] = useConfirm();  …  if (!(await confirm({...}))) return;  …  {dialog}
 */
export function useConfirm(): [React.ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setOptions(next);
  }), []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const danger = options?.tone !== 'primary';
  const dialog = options ? (
    <div className="fixed inset-0 bg-slate-900/40 z-[60] flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === 'Escape') close(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="confirm-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            {danger && <AlertTriangle className="w-5 h-5 text-rose-600" />} {options.title}
          </h3>
          <button type="button" onClick={() => close(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <p id="confirm-message" className="p-5 text-sm text-slate-600">{options.message}</p>
        <div className="px-5 pb-5 flex justify-end gap-2 text-xs">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">{options.cancelLabel || 'Cancel'}</button>
          <button type="button" autoFocus onClick={() => close(true)} className={`px-4 py-2 rounded-lg text-white font-bold ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>{options.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  ) : null;

  return [dialog, confirm];
}
