import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, User, Loader2, X, Plus, Check, Ban, History, Square, Wrench, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type UiAction =
  | { type: 'navigate'; to: string }
  | { type: 'draw_area'; path: Array<{ lat: number; lng: number }>; label?: string }
  | { type: 'focus_place'; name: string; lat: number; lng: number }
  | { type: 'show_places'; places: Array<{ id: string; name: string; address: string; lat: number; lng: number; category?: string; website?: string; placeId: string; region?: string }> }
  | { type: 'show_nearby'; clientIds: string[]; center: { lat: number; lng: number }; radiusKm: number }
  | { type: 'open_route'; clientIds: string[]; routeId?: string }
  | { type: 'highlight_memories'; ids: string[] };

interface Proposal { id: string; tool: string; summary: string; payload: any; bulk: boolean; state?: 'pending' | 'working' | 'approved' | 'rejected' | 'error'; note?: string; excluded?: number[] }
interface ToolEvent { id: string; name: string; status: 'running' | 'done' | 'error' | 'blocked'; summary?: string }
interface Msg { role: 'user' | 'assistant'; text: string; tools?: ToolEvent[]; proposals?: Proposal[] }

interface AgentPanelProps {
  bounds?: google.maps.LatLngBounds | null;
  customPath?: google.maps.LatLngLiteral[] | null;
  searchedPlace?: { name: string; location: { lat: number; lng: number } } | null;
  onUiAction?: (a: UiAction) => void;
  onRefreshDB?: () => void;
  isHidden?: boolean;
}

const WELCOME: Msg = { role: 'assistant', text: "Hi! Tell me who you want to find, and I'll set up tags, search the map, save companies and plan your visits. Anything that changes your data is shown to you first." };

const TOOL_LABEL: Record<string, string> = {
  search_places: 'Searching the map', draw_search_area: 'Drawing the area', suggest_search_tags: 'Working out tags',
  plan_route: 'Planning the route', research_company: 'Researching on the web', find_nearby_saved_clients: 'Checking nearby clients',
  whats_due_today: 'Checking what is due', get_client: 'Reading the client', auto_tag_batch: 'Reading websites',
};

export function AgentPanel({ bounds, customPath, searchedPlace, onUiAction, onRefreshDB, isHidden = false }: AgentPanelProps) {
  const { canWrite } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [threadId, setThreadId] = useState<string | null>(() => { try { return sessionStorage.getItem('agent_thread'); } catch { return null; } });
  const [threads, setThreads] = useState<Array<{ id: string; title: string | null }>>([]);
  const [showThreads, setShowThreads] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen]);

  const loadThreads = useCallback(async () => {
    const { data } = await supabase.from('chat_threads').select('id,title').order('created_at', { ascending: false }).limit(15);
    setThreads(data ?? []);
  }, []);

  // Chat memory lives in the database, so reload the open thread's messages.
  const openThread = useCallback(async (id: string | null) => {
    setThreadId(id);
    try { id ? sessionStorage.setItem('agent_thread', id) : sessionStorage.removeItem('agent_thread'); } catch { /* ignore */ }
    if (!id) { setMessages([WELCOME]); return; }
    const { data } = await supabase.from('chat_messages').select('role,content,metadata').eq('thread_id', id).in('role', ['user', 'assistant']).order('created_at');
    const msgs: Msg[] = (data ?? []).map((m: any) => ({ role: m.role, text: m.content, tools: [], proposals: [] }));
    setMessages(msgs.length ? msgs : [WELCOME]);
  }, []);
  useEffect(() => { if (isOpen && threadId && messages.length === 1 && messages[0] === WELCOME) openThread(threadId); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLast = (fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages((prev) => [...prev.filter((m) => m !== WELCOME), { role: 'user', text }, { role: 'assistant', text: '', tools: [], proposals: [] }]);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const res = await apiFetch('/api/agent/chat', {
        method: 'POST', signal: ctl.signal,
        body: JSON.stringify({
          message: text, threadId,
          ui: {
            bounds: bounds ? { low: { lat: bounds.getSouthWest().lat(), lng: bounds.getSouthWest().lng() }, high: { lat: bounds.getNorthEast().lat(), lng: bounds.getNorthEast().lng() } } : null,
            polygon: customPath ?? null, place: searchedPlace ?? null,
          },
        }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || 'Could not reach the agent');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const p of parts) {
          if (!p.startsWith('data: ')) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.type === 'text') patchLast((m) => ({ ...m, text: m.text + ev.delta }));
          else if (ev.type === 'tool') patchLast((m) => ({ ...m, tools: [...(m.tools ?? []).filter((t) => t.id !== ev.id), { id: ev.id, name: ev.name, status: ev.status, summary: ev.summary }] }));
          else if (ev.type === 'proposal') patchLast((m) => ({ ...m, proposals: [...(m.proposals ?? []), { ...ev.approval, state: 'pending' }] }));
          else if (ev.type === 'ui') onUiAction?.(ev.action);
          else if (ev.type === 'error') patchLast((m) => ({ ...m, text: m.text + `\n\nError: ${ev.message}` }));
          else if (ev.type === 'done') { setThreadId(ev.threadId); try { sessionStorage.setItem('agent_thread', ev.threadId); } catch { /* ignore */ } }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') patchLast((m) => ({ ...m, text: m.text + `\n\nError: ${e.message}` }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const decide = async (msgIdx: number, p: Proposal, decision: 'approve' | 'reject', confirm = false) => {
    const set = (patch: Partial<Proposal>) => setMessages((prev) => prev.map((m, i) => i !== msgIdx ? m : { ...m, proposals: m.proposals!.map((x) => x.id === p.id ? { ...x, ...patch } : x) }));
    set({ state: 'working' });
    const res = await apiFetch(`/api/agent/approvals/${p.id}/decide`, { method: 'POST', body: JSON.stringify({ decision, confirm, exclude: p.excluded ?? [] }) });
    const data = await res.json();
    if (res.status === 409 && data.needsConfirm) { set({ state: 'pending', note: 'This changes many items. Press Approve again to confirm.', bulk: false }); return; }
    if (!res.ok) { set({ state: 'error', note: data.error }); return; }
    set({ state: decision === 'approve' ? 'approved' : 'rejected', note: data.message });
    for (const a of data.ui ?? []) onUiAction?.(a);
    if (decision === 'approve') onRefreshDB?.();
  };

  const toggleExclude = (msgIdx: number, p: Proposal, i: number) => {
    const ex = new Set(p.excluded ?? []);
    ex.has(i) ? ex.delete(i) : ex.add(i);
    setMessages((prev) => prev.map((m, k) => k !== msgIdx ? m : { ...m, proposals: m.proposals!.map((x) => x.id === p.id ? { ...x, excluded: [...ex] } : x) }));
  };

  if (isHidden) return null;
  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-20 md:bottom-6 right-4 md:right-6 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl z-50 flex items-center gap-2">
        <Bot className="w-6 h-6" /><span className="font-medium hidden sm:inline">Ask AI</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-20 top-14 md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[640px] bg-[#161a22] border border-slate-700 shadow-2xl z-50 flex flex-col rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-800 bg-[#1a1d23] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2"><div className="p-1.5 bg-blue-500/20 rounded-lg"><Bot className="w-4 h-4 text-blue-400" /></div><h2 className="font-semibold text-slate-200 text-sm">AI Co-Pilot</h2></div>
        <div className="flex items-center gap-1">
          <button title="New chat" onClick={() => openThread(null)} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg"><Plus className="w-4 h-4" /></button>
          <button title="History" onClick={() => { setShowThreads(!showThreads); loadThreads(); }} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg"><History className="w-4 h-4" /></button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {showThreads && (
        <div className="border-b border-slate-800 bg-[#12151a] max-h-40 overflow-y-auto">
          {threads.length === 0 && <p className="p-3 text-xs text-slate-500">No earlier chats.</p>}
          {threads.map((t) => <button key={t.id} onClick={() => { openThread(t.id); setShowThreads(false); }} className="block w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 truncate">{t.title || 'Chat'}</button>)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="max-w-[85%] space-y-2 min-w-0">
              {(m.tools ?? []).map((t) => (
                <div key={t.id} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  {t.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : t.status === 'blocked' ? <ShieldCheck className="w-3 h-3 text-amber-400" /> : <Wrench className="w-3 h-3" />}
                  {TOOL_LABEL[t.name] ?? t.name.replace(/_/g, ' ')}{t.status === 'blocked' ? ' (blocked)' : t.status === 'error' ? ' (failed)' : ''}
                </div>
              ))}
              {(m.text || (busy && idx === messages.length - 1 && !(m.proposals?.length))) && (
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 break-words ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1a1d23] text-slate-300 border border-slate-700 rounded-tl-none'}`}>
                  {m.text ? <ReactMarkdown components={{ a: ({ children, href }) => <span title={href}>{children}</span>, img: () => null }}>{m.text}</ReactMarkdown> : <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                </div>
              )}
              {(m.proposals ?? []).map((p) => {
                const list: any[] = p.payload?.companies ?? p.payload?.tags ?? p.payload?.proposals ?? [];
                return (
                  <div key={p.id} className="border border-blue-500/30 bg-blue-500/5 rounded-xl p-3 text-xs space-y-2">
                    <div className="text-slate-200 font-medium">{p.summary}</div>
                    {p.state === 'pending' && list.length > 1 && (
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {list.map((it, i) => (
                          <label key={i} className="flex items-center gap-2 text-slate-400">
                            <input type="checkbox" checked={!(p.excluded ?? []).includes(i)} onChange={() => toggleExclude(idx, p, i)} />
                            <span className="truncate">{it.name ?? it.title ?? String(it)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {p.note && <div className={p.state === 'error' ? 'text-red-400' : 'text-slate-400'}>{p.note}</div>}
                    {(p.state === 'pending' || p.state === 'working') && (
                      <div className="flex gap-2">
                        <button disabled={!canWrite || p.state === 'working'} onClick={() => decide(idx, p, 'approve', p.note?.includes('Press Approve again'))} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1"><Check className="w-3 h-3" />Approve</button>
                        <button disabled={p.state === 'working'} onClick={() => decide(idx, p, 'reject')} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1"><Ban className="w-3 h-3" />Reject</button>
                      </div>
                    )}
                    {p.state === 'approved' && <div className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Approved</div>}
                    {p.state === 'rejected' && <div className="text-slate-500">Rejected</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-slate-800 bg-[#1a1d23] shrink-0">
        <div className="relative flex items-center">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} disabled={busy}
            placeholder="Find vegan bakeries near the Marina..."
            className="w-full bg-black/40 border border-slate-700 rounded-full pl-4 pr-12 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {busy
            ? <button onClick={() => abortRef.current?.abort()} className="absolute right-1.5 p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-full"><Square className="w-4 h-4" /></button>
            : <button onClick={send} disabled={!input.trim()} className="absolute right-1.5 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full disabled:opacity-50"><Send className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
}
