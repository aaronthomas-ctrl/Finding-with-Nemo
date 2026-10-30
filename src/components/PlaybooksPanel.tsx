import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw, Undo2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface Query { label: string; q: string; domains?: string[] }
interface Playbooks { version: number; updated_at: string; source: string; focus: string; search: string; client_research: string; chat_style: string; queries: Query[] }

const field = 'w-full bg-[#0c0e12] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
const SOURCE: Record<string, string> = { onboarding: 'written at onboarding', activity: 'updated from your activity', manual: 'edited by hand' };

/** The standing instructions the agent and research tools follow, written from onboarding and kept current from activity. */
export function PlaybooksPanel() {
  const { activeOrg, canWrite } = useAuth();
  const [pb, setPb] = useState<Playbooks | null>(null);
  const [hasPrev, setHasPrev] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const id = activeOrg?.org_id ?? getActiveOrgId();
    if (!id) return;
    const { data } = await supabase.from('business_profiles').select('config').eq('org_id', id).maybeSingle();
    const cfg: any = data?.config ?? {};
    setPb(cfg.playbooks ?? null);
    setHasPrev(!!cfg.playbooks_prev);
  }, [activeOrg?.org_id]);
  useEffect(() => { load(); }, [load]);

  const call = async (path: string, label: string, body?: unknown) => {
    setBusy(label); setMsg(null);
    try {
      const res = await apiFetch(`/api/profile/playbooks/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Something went wrong');
      if (path === 'refresh') setMsg({ kind: 'ok', text: d.updated ? 'Updated from your recent searching, saving and chats.' : d.reason || 'Nothing to update.' });
      else setMsg({ kind: 'ok', text: path === 'save' ? 'Saved.' : 'Restored the earlier version.' });
      await load();
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }); } finally { setBusy(null); }
  };

  const set = (k: keyof Playbooks, v: string) => pb && setPb({ ...pb, [k]: v });
  const setQuery = (i: number, q: string) => pb && setPb({ ...pb, queries: pb.queries.map((x, j) => (j === i ? { ...x, q } : x)) });

  return (
    <section className="bg-[#12151a] border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-400" />Agent playbooks</h3>
          <p className="text-xs text-slate-400 mt-1">Standing instructions the chat agent and research follow for your profile. They are written at onboarding and refined from what you search, save and ask.</p>
        </div>
        {pb && <span className="text-[11px] text-slate-500 shrink-0 text-right">Version {pb.version}<br />{SOURCE[pb.source] ?? pb.source}<br />{new Date(pb.updated_at).toLocaleDateString()}</span>}
      </div>

      {!pb && <p className="text-sm text-slate-500">No playbooks yet. Use "Update from my activity" to write the first ones from your profile.</p>}

      {pb && (
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400">What research should look for</label><textarea className={`${field} h-16`} value={pb.focus} onChange={(e) => set('focus', e.target.value)} disabled={!canWrite} /></div>
          <div><label className="text-xs text-slate-400">How to find prospects</label><textarea className={`${field} h-24`} value={pb.search} onChange={(e) => set('search', e.target.value)} disabled={!canWrite} /></div>
          <div><label className="text-xs text-slate-400">How to research one client or company</label><textarea className={`${field} h-28`} value={pb.client_research} onChange={(e) => set('client_research', e.target.value)} disabled={!canWrite} /></div>
          <div><label className="text-xs text-slate-400">How the agent talks to you</label><textarea className={`${field} h-16`} value={pb.chat_style} onChange={(e) => set('chat_style', e.target.value)} disabled={!canWrite} /></div>
          <div>
            <label className="text-xs text-slate-400">Web searches run for each company ({'{company}'} is filled in)</label>
            <div className="space-y-2 mt-1">
              {pb.queries.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 w-24 shrink-0 truncate" title={q.domains?.join(', ')}>{q.label}{q.domains?.length ? ` (${q.domains[0]})` : ''}</span>
                  <input className={field} value={q.q} onChange={(e) => setQuery(i, e.target.value)} disabled={!canWrite} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!!busy} onClick={() => call('refresh', 'refresh')} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm flex items-center gap-2">
            {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Update from my activity
          </button>
          {pb && <button disabled={!!busy} onClick={() => call('save', 'save', { playbooks: pb })} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 flex items-center gap-2">{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save my edits</button>}
          {hasPrev && <button disabled={!!busy} onClick={() => call('restore', 'restore')} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 flex items-center gap-2"><Undo2 className="w-4 h-4" />Restore previous</button>}
          <span className="text-[11px] text-slate-500">They also update on their own after enough new searching, saving and chatting.</span>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
    </section>
  );
}
