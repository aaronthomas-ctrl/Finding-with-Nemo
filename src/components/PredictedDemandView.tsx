import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Loader2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { announceMemories } from '../lib/memoryBus';
import { useAuth } from '../auth/AuthProvider';

interface Pred { id: string; client_id: string | null; project_id: string | null; need: string; expected_on: string | null; confidence: number | null; reasoning: string | null; evidence_ids: string[]; created_at: string }

/** Next-need predictions: interval statistics plus Ultra's reasoning over project stages and memories. */
export function PredictedDemandView() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Pred[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const [p, c, pr] = await Promise.all([
      supabase.from('predictions').select('*').eq('org_id', orgId).order('expected_on', { ascending: true, nullsFirst: false }).limit(200),
      supabase.from('clients').select('id,name').eq('org_id', orgId).order('name').limit(1000),
      supabase.from('projects').select('id,name').eq('org_id', orgId).limit(500),
    ]);
    setRows((p.data as Pred[]) ?? []); setClients(c.data ?? []); setProjects(pr.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (clientId?: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiFetch('/api/predictions/run', { method: 'POST', body: JSON.stringify({ clientId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Prediction failed');
      setMsg({ kind: 'ok', text: d.saved ? `Saved ${d.saved} prediction${d.saved === 1 ? '' : 's'} for ${d.clients} client${d.clients === 1 ? '' : 's'}.` : 'Not enough data yet: predictions need enquiry history, linked projects or memories.' });
      await load();
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }); } finally { setBusy(false); }
  };

  const cname = (id: string | null) => clients.find((c) => c.id === id)?.name ?? 'Unknown';
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.name;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-3xl w-full mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2"><Activity className="w-5 h-5 text-rose-400" />Predictions</h2>
        <p className="text-sm text-slate-400">What each client is likely to need next, with the reasons and the memories behind it. Low confidence means thin evidence.</p>
      </div>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <select className="px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={busy || !pick} onClick={() => run(pick)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm flex items-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Predict</button>
          <button disabled={busy} onClick={() => run()} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">Predict for clients with data</button>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}

      {rows.length === 0 && <p className="text-xs text-slate-500">No predictions yet.</p>}
      {rows.map((p) => (
        <div key={p.id} className="bg-[#12151a] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-100">{p.need}</div>
              <div className="text-xs text-slate-500"><button onClick={() => navigate(`/pipeline/${p.client_id}`)} className="text-blue-400 hover:underline">{cname(p.client_id)}</button>{pname(p.project_id) ? ` · project: ${pname(p.project_id)}` : ''}{p.expected_on ? ` · around ${new Date(p.expected_on).toLocaleDateString()}` : ''}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">{Math.round((p.confidence ?? 0) * 100)}%</div>
              <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1"><div className={`h-1.5 rounded-full ${(p.confidence ?? 0) >= 0.6 ? 'bg-emerald-500' : (p.confidence ?? 0) >= 0.35 ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${Math.round((p.confidence ?? 0) * 100)}%` }} /></div>
            </div>
          </div>
          {p.reasoning && <p className="text-xs text-slate-300">{p.reasoning}</p>}
          {p.evidence_ids?.length > 0 && (
            <button onClick={() => { announceMemories(p.evidence_ids); navigate('/memory'); }} className="text-[11px] text-blue-400 hover:underline">Show the {p.evidence_ids.length} memor{p.evidence_ids.length === 1 ? 'y' : 'ies'} behind this</button>
          )}
        </div>
      ))}
    </div>
  );
}
