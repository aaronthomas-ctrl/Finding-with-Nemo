import { useCallback, useEffect, useState } from 'react';
import { Eye, Play, Plus, Trash2, Loader2, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface W { id: string; client_id: string | null; kind: 'website' | 'social' | 'news' | 'projects'; target: string; every: 'daily' | 'weekly'; last_run_at: string | null; active: boolean }
interface Run { id: string; status: 'ok' | 'changed' | 'failed'; summary: string | null; started_at: string }

const KINDS: Record<W['kind'], { label: string; hint: string }> = {
  website: { label: 'Website', hint: 'https://example.com/news' },
  social: { label: 'Social page', hint: 'linkedin.com/company/name or instagram.com/name (public pages only)' },
  news: { label: 'News', hint: 'Company or topic, e.g. "Green Sprout Cafe"' },
  projects: { label: 'Upcoming projects', hint: 'e.g. "new cafe openings in Dubai Marina"' },
};
const field = 'w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500';

export function WatchersView() {
  const { canWrite } = useAuth();
  const [list, setList] = useState<W[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string; website: string | null }>>([]);
  const [runs, setRuns] = useState<Record<string, Run[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: 'website' as W['kind'], target: '', clientId: '', every: 'daily' as W['every'] });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const [w, c] = await Promise.all([
      supabase.from('watchers').select('id,client_id,kind,target,every,last_run_at,active').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('clients').select('id,name,website').eq('org_id', orgId).order('name').limit(500),
    ]);
    setList((w.data as W[]) ?? []);
    setClients(c.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadRuns = async (id: string) => {
    const { data } = await supabase.from('watcher_runs').select('id,status,summary,started_at').eq('watcher_id', id).order('started_at', { ascending: false }).limit(8);
    setRuns((r) => ({ ...r, [id]: (data as Run[]) ?? [] }));
  };

  const add = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('watchers').insert({
      org_id: getActiveOrgId(), client_id: form.clientId || null, created_by: u.user?.id, kind: form.kind, target: form.target.trim(), every: form.every,
    });
    if (error) setMsg({ kind: 'err', text: error.message });
    else { setForm({ ...form, target: '' }); setMsg(null); load(); }
  };

  const run = async (id?: string) => {
    setRunning(id ?? 'all'); setMsg(null);
    try {
      const res = await apiFetch('/api/watchers/run', { method: 'POST', body: JSON.stringify(id ? { id } : { force: true }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Run failed');
      const changed = d.outcomes.filter((o: any) => o.status === 'changed').length;
      setMsg({ kind: 'ok', text: `Checked ${d.ran} watcher${d.ran === 1 ? '' : 's'}: ${changed} changed.${d.retryFlagsChanged ? ` ${d.retryFlagsChanged} clients flagged for a retry.` : ''}` });
      await load();
      if (id) { await loadRuns(id); setOpen(id); }
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }); } finally { setRunning(null); }
  };

  const toggle = async (w: W) => { await supabase.from('watchers').update({ active: !w.active }).eq('id', w.id); load(); };
  const remove = async (w: W) => { await supabase.from('watchers').delete().eq('id', w.id); load(); };
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-3xl w-full mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2"><Eye className="w-5 h-5 text-blue-400" />Watchers</h2>
          <p className="text-sm text-slate-400">Keep an eye on a client's website, public social page, news, or upcoming projects. You get a notification when something that matters changes.</p>
        </div>
        {canWrite && list.length > 0 && (
          <button onClick={() => run()} disabled={!!running} className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 flex items-center gap-2">
            {running === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Run all now
          </button>
        )}
      </div>
      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}

      {canWrite && (
        <section className="bg-[#12151a] border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as W['kind'] })}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className={field} value={form.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setForm({ ...form, clientId: e.target.value, target: form.kind === 'website' && c?.website ? c.website : form.target }); }}>
              <option value="">Client (optional)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={field} value={form.every} onChange={(e) => setForm({ ...form, every: e.target.value as W['every'] })}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </div>
          <input className={field} placeholder={KINDS[form.kind].hint} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          <button onClick={add} disabled={form.target.trim().length < 3} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Add watcher</button>
        </section>
      )}

      <section className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-500">No watchers yet.</p>}
        {list.map((w) => (
          <div key={w.id} className={`bg-[#12151a] border border-slate-800 rounded-xl ${w.active ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-3 p-3">
              <button className="min-w-0 text-left" onClick={() => { const o = open === w.id ? null : w.id; setOpen(o); if (o) loadRuns(w.id); }}>
                <div className="text-sm text-slate-200 truncate">{KINDS[w.kind].label}: {w.target}</div>
                <div className="text-[11px] text-slate-500">{name(w.client_id) ? `${name(w.client_id)}, ` : ''}{w.every}, {w.last_run_at ? `last run ${new Date(w.last_run_at).toLocaleString()}` : 'never run'}</div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {canWrite && <button onClick={() => run(w.id)} disabled={!!running || !w.active} title="Run now" className="p-2 rounded-lg hover:bg-slate-800 text-blue-400 disabled:opacity-40">{running === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button>}
                {canWrite && <button onClick={() => toggle(w)} title={w.active ? 'Pause' : 'Resume'} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><Pause className="w-4 h-4" /></button>}
                {canWrite && <button onClick={() => remove(w)} title="Delete" className="p-2 rounded-lg hover:bg-slate-800 text-slate-500"><Trash2 className="w-4 h-4" /></button>}
                {open === w.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </div>
            {open === w.id && (
              <div className="px-3 pb-3 space-y-1.5">
                {(runs[w.id] ?? []).length === 0 && <p className="text-xs text-slate-500">No runs yet. Press Run now.</p>}
                {(runs[w.id] ?? []).map((r) => (
                  <div key={r.id} className="text-xs flex gap-2">
                    <span className={`shrink-0 px-1.5 rounded border ${r.status === 'changed' ? 'border-emerald-500/50 text-emerald-300' : r.status === 'failed' ? 'border-red-500/50 text-red-300' : 'border-slate-600 text-slate-400'}`}>{r.status}</span>
                    <span className="text-slate-300">{r.summary}<span className="text-slate-600"> {new Date(r.started_at).toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
