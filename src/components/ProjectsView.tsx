import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Trash2, Loader2, Check, Ban, Sparkles, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface Project { id: string; name: string; site: string | null; region: string | null; stage: string | null; starts_on: string | null; ends_on: string | null; description: string | null }
interface Participant { client_id: string; role: string | null }
interface Proposal { id: string; project_id: string; client_id: string; role: string | null; reason: string; score: number | null }

const field = 'w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500';
const STAGES = ['planning', 'tender', 'design', 'construction', 'operating', 'completed'];

export function ProjectsView() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [parts, setParts] = useState<Record<string, Participant[]>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [add, setAdd] = useState({ name: '', site: '', stage: 'planning' });
  const [link, setLink] = useState({ clientId: '', role: 'supplier' });

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const [p, pp, lp, c] = await Promise.all([
      supabase.from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(300),
      supabase.from('project_participants').select('project_id,client_id,role').eq('org_id', orgId).limit(2000),
      supabase.from('link_proposals').select('id,project_id,client_id,role,reason,score').eq('org_id', orgId).eq('status', 'pending').order('score', { ascending: false }).limit(50),
      supabase.from('clients').select('id,name').eq('org_id', orgId).order('name').limit(1000),
    ]);
    setProjects((p.data as Project[]) ?? []);
    const map: Record<string, Participant[]> = {};
    (pp.data ?? []).forEach((x: any) => { (map[x.project_id] ??= []).push(x); });
    setParts(map);
    setProposals((lp.data as Proposal[]) ?? []);
    setClients(c.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cname = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Unknown client';
  const pname = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project';
  const sel = projects.find((p) => p.id === selected) ?? null;

  const extract = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiFetch('/api/projects/extract', { method: 'POST', body: JSON.stringify({ text }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not read that text');
      setMsg({ kind: 'ok', text: `Found ${d.projects.length} project${d.projects.length === 1 ? '' : 's'}, ${d.proposals} suggested link${d.proposals === 1 ? '' : 's'} to review.${d.unlinked?.length ? ` Not in your clients: ${d.unlinked.slice(0, 4).join(', ')}.` : ''}${d.dropped ? ` ${d.dropped} items had no matching quote and were dropped.` : ''}` });
      setText(''); await load();
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }); } finally { setBusy(false); }
  };

  const decide = async (p: Proposal, decision: 'approve' | 'reject') => {
    const res = await apiFetch(`/api/projects/links/${p.id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) });
    if (!res.ok) setMsg({ kind: 'err', text: (await res.json()).error }); else load();
  };

  const create = async () => {
    const { error } = await supabase.from('projects').insert({ org_id: getActiveOrgId(), name: add.name.trim(), site: add.site.trim() || null, stage: add.stage });
    if (error) setMsg({ kind: 'err', text: error.message }); else { setAdd({ name: '', site: '', stage: 'planning' }); load(); }
  };
  const remove = async (id: string) => { await supabase.from('projects').delete().eq('id', id); setSelected(null); load(); };
  const addLink = async () => {
    const { error } = await supabase.from('project_participants').upsert({ org_id: getActiveOrgId(), project_id: selected, client_id: link.clientId, role: link.role }, { onConflict: 'project_id,client_id' });
    if (error) setMsg({ kind: 'err', text: error.message }); else { setLink({ ...link, clientId: '' }); load(); }
  };
  const unlink = async (client_id: string) => { await supabase.from('project_participants').delete().eq('project_id', selected!).eq('client_id', client_id); load(); };
  const setStage = async (stage: string) => { await supabase.from('projects').update({ stage }).eq('id', selected!); load(); };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2"><Building2 className="w-5 h-5 text-pink-400" />Projects</h2>
        <p className="text-sm text-slate-400">Projects and the companies around them. Suggested links come with the quote that supports them, and nothing is linked until you approve.</p>
      </div>
      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}

      {proposals.length > 0 && (
        <section className="border border-blue-500/30 bg-blue-500/5 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2"><Link2 className="w-4 h-4 text-blue-400" />Suggested links ({proposals.length})</h3>
          {proposals.map((p) => (
            <div key={p.id} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-slate-200"><button onClick={() => navigate(`/pipeline/${p.client_id}`)} className="text-blue-400 hover:underline">{cname(p.client_id)}</button> as {p.role ?? 'participant'} in {pname(p.project_id)} <span className="text-slate-500">(match {Math.round((p.score ?? 0) * 100)}%)</span></div>
                <div className="text-slate-500 truncate" title={p.reason}>{p.reason}</div>
              </div>
              {canWrite && <span className="flex gap-1.5 shrink-0">
                <button onClick={() => decide(p, 'approve')} className="px-2.5 py-1 rounded bg-emerald-600 text-white flex items-center gap-1"><Check className="w-3 h-3" />Link</button>
                <button onClick={() => decide(p, 'reject')} className="px-2.5 py-1 rounded bg-slate-700 text-slate-200 flex items-center gap-1"><Ban className="w-3 h-3" />No</button>
              </span>}
            </div>
          ))}
        </section>
      )}

      {canWrite && (
        <section className="bg-[#12151a] border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-sm font-medium text-slate-200 flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-400" />Find projects in text</div>
          <textarea className={`${field} h-24`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an article, tender notice or meeting notes. Only projects with an exact supporting quote are kept." />
          <button onClick={extract} disabled={busy || text.trim().length < 40} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Find projects</button>
          <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
            <input className={`${field} sm:col-span-2`} placeholder="Or add one by hand: project name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
            <input className={field} placeholder="Site" value={add.site} onChange={(e) => setAdd({ ...add, site: e.target.value })} />
            <button onClick={create} disabled={add.name.trim().length < 2} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm text-slate-200 flex items-center justify-center gap-1"><Plus className="w-4 h-4" />Add</button>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {projects.length === 0 && <p className="text-xs text-slate-500">No projects yet.</p>}
          {projects.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className={`w-full text-left p-3 rounded-xl border ${selected === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#12151a] hover:border-slate-600'}`}>
              <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
              <div className="text-[11px] text-slate-500">{[p.stage, p.site || p.region].filter(Boolean).join(', ') || 'No details'} · {(parts[p.id] ?? []).length} linked</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {sel ? (
            <section className="bg-[#12151a] border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{sel.name}</h3>
                  <p className="text-xs text-slate-500">{[sel.site, sel.region].filter(Boolean).join(', ')}{sel.starts_on ? ` · from ${sel.starts_on}` : ''}{sel.ends_on ? ` · to ${sel.ends_on}` : ''}</p>
                </div>
                {canWrite && <button onClick={() => remove(sel.id)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
              {sel.description && <p className="text-sm text-slate-300">{sel.description}</p>}
              <div className="flex items-center gap-2 text-xs"><span className="text-slate-500">Stage</span>
                <select disabled={!canWrite} className="px-2 py-1 rounded bg-[#0c0e12] border border-slate-700" value={sel.stage ?? ''} onChange={(e) => setStage(e.target.value)}>
                  <option value="">unknown</option>{STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2">Companies involved</div>
                {(parts[sel.id] ?? []).length === 0 && <p className="text-xs text-slate-500">None linked yet.</p>}
                {(parts[sel.id] ?? []).map((x) => (
                  <div key={x.client_id} className="flex items-center justify-between text-sm py-1">
                    <span><button onClick={() => navigate(`/pipeline/${x.client_id}`)} className="text-blue-400 hover:underline">{cname(x.client_id)}</button> <span className="text-slate-500 text-xs">{x.role}</span></span>
                    {canWrite && <button onClick={() => unlink(x.client_id)} className="text-slate-600 hover:text-slate-300 text-xs">remove</button>}
                  </div>
                ))}
                {canWrite && (
                  <div className="grid sm:grid-cols-3 gap-2 mt-2">
                    <select className={field} value={link.clientId} onChange={(e) => setLink({ ...link, clientId: e.target.value })}><option value="">Link a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input className={field} value={link.role} onChange={(e) => setLink({ ...link, role: e.target.value })} placeholder="Role" />
                    <button onClick={addLink} disabled={!link.clientId} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm text-slate-200">Link</button>
                  </div>
                )}
              </div>
            </section>
          ) : <p className="text-sm text-slate-500">Select a project.</p>}
        </div>
      </div>
    </div>
  );
}
