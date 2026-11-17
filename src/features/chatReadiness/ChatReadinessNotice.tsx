import type { ChatCapabilities } from './presentation';
import { readinessPresentation } from './presentation';

export function ChatReadinessNotice({ capabilities, privateScope = false, now }: { capabilities: ChatCapabilities | null; privateScope?: boolean; now?: number }) {
  const value = readinessPresentation(capabilities, privateScope, now);
  return <section aria-label="Chat provider readiness" role="status" className={'mt-1 max-w-xl text-[10px] leading-4 ' + (value.tone === 'warning' ? 'text-amber-800' : value.tone === 'verified' ? 'text-teal-800' : 'text-slate-500')}>
    <p className="font-medium">{value.title}</p>
    <p>{value.detail}{value.checkedAt ? ' Observed ' + new Date(value.checkedAt).toLocaleTimeString() + '.' : ''}</p>
  </section>;
}
