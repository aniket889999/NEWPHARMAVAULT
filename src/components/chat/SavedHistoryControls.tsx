import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';

export function SavedHistoryControls() {
  const {historyEnabled,historyLoading,historyError,enableSavedHistory,clearSavedHistory}=useChatStore();
  const [consent,setConsent]=useState(false),[deleting,setDeleting]=useState(false);
  return <section className="space-y-2 text-[11px] leading-5" aria-label="Saved public chat controls">
    <p className="font-medium text-slate-700">{historyLoading?'Checking saved history…':historyEnabled?'Saved public history is on':'Session-only chats'}</p>
    {historyEnabled?<p className="text-slate-500">Up to 20 saved chats, 200 messages each within account storage limits. Context is restored on reopen. Deleted after 30 days without saved-history activity. Private/personal case turns are not saved here.</p>:<p className="text-slate-500">Encrypted context stays in this conversation; session chats clear on refresh/sign-out. You can opt in to account-based public chat history.</p>}
    {!historyEnabled && <button disabled={historyLoading} onClick={()=>{setConsent(!consent);setDeleting(false);}} className="rounded border border-teal-200 px-2 py-1 text-teal-800 disabled:opacity-40">Enable saved public chats</button>}
    {consent && !historyEnabled && <div className="rounded-lg border border-teal-200 bg-teal-50 p-2">
      <p>Your typed questions and cited answers will be stored in your account, not browser storage. They may contain health details you type; avoid private identifiers. This starts a new chat. Older session-only chats remain unsaved.</p>
      <button disabled={historyLoading} onClick={()=>{setConsent(false);void enableSavedHistory();}} className="mt-2 rounded bg-teal-800 px-2 py-1 text-white disabled:opacity-40">I agree — enable saving</button>
    </div>}
    <button disabled={historyLoading} onClick={()=>{setDeleting(!deleting);setConsent(false);}} className="block text-rose-700 underline disabled:opacity-40">Disable &amp; delete saved history</button>
    {deleting && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2"><p>Delete every saved public chat and disable saving? This cannot be undone.</p><button disabled={historyLoading} onClick={()=>{setDeleting(false);void clearSavedHistory();}} className="mt-2 rounded border border-rose-300 px-2 py-1 text-rose-800">Yes — delete saved history</button></div>}
    {historyError && <p role="alert" className="text-amber-800">{historyError}</p>}
  </section>;
}
