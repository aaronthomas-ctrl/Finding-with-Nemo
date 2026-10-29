import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

interface Note { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

/** In-app only: no email, SMS or push. New rows arrive live through Supabase Realtime. */
export function NotificationBell({ className = '' }: { className?: string }) {
  const { activeOrg, session } = useAuth();
  const orgId = activeOrg?.org_id;
  const navigate = useNavigate();
  const [items, setItems] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Note | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // The layout mounts a bell for the sidebar and one for phones. Realtime channels are shared by name, so each
  // instance needs its own, or the second one throws and React unmounts the whole app.
  const instance = useRef(Math.random().toString(36).slice(2, 8));

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from('notifications').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(30);
    setItems((data as Note[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !session) return;
    load();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel(`notifications:${orgId}:${instance.current}:${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `org_id=eq.${orgId}` }, (p) => {
          const n = p.new as Note;
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
          setToast(n);
          setTimeout(() => setToast((t) => (t?.id === n.id ? null : t)), 6000);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `org_id=eq.${orgId}` }, (p) => {
          const n = p.new as Note;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        })
        .subscribe();
    } catch (e) {
      // Live updates are a nicety: if they cannot start, the bell still works from the list it loaded.
      console.warn('[notifications] realtime unavailable:', e);
    }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [orgId, session, load]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = items.filter((n) => !n.read_at).length;
  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  };
  const go = (n: Note) => { markRead([n.id]); setOpen(false); setToast(null); if (n.link) navigate(n.link); };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
        <Bell className="w-5 h-5" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-[#161a22] border border-slate-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-sm font-medium text-slate-200">Notifications</span>
            {unread > 0 && <button onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><CheckCheck className="w-3 h-3" />Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {items.length === 0 && <p className="p-4 text-xs text-slate-500">Nothing yet. Watchers report here when something changes.</p>}
            {items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={`w-full text-left px-3 py-2.5 hover:bg-slate-800/60 ${n.read_at ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-2">
                  {!n.read_at && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200">{n.title}</div>
                    {n.body && <div className="text-[11px] text-slate-400 line-clamp-3">{n.body}</div>}
                    <div className="text-[10px] text-slate-600 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && !open && (
        <button onClick={() => go(toast)} className="fixed top-16 right-4 z-[70] w-72 text-left bg-[#161a22] border border-blue-500/40 rounded-xl p-3 shadow-2xl">
          <div className="text-xs font-medium text-slate-200">{toast.title}</div>
          {toast.body && <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{toast.body}</div>}
        </button>
      )}
    </div>
  );
}
