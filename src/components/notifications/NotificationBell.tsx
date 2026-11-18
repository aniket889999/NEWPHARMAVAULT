import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { claimsApi, NotificationItem } from '../../api/claimsApi';

const POLL_MS = 30_000;

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await claimsApi.notifications();
      setItems(data.items);
      setUnread(data.unread);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = async (item: NotificationItem) => {
    if (!item.readAt) { await claimsApi.markRead(item.id).catch(() => {}); }
    setOpen(false);
    void load();
    if (item.link) navigate(item.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) void load(); }}
        className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={async () => { await claimsApi.markAllRead().catch(() => {}); void load(); }} className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {failed && <p className="p-4 text-xs text-amber-800 bg-amber-50">Notifications could not be loaded.</p>}
            {!failed && items.length === 0 && <p className="p-4 text-xs text-slate-500">No notifications yet.</p>}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${item.readAt ? '' : 'bg-teal-50/40'}`}>
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  {!item.readAt && <span className="w-1.5 h-1.5 rounded-full bg-teal-600 flex-shrink-0" />}
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString('en-IN')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
