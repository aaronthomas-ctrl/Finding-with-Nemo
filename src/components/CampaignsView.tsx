import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Sparkles, Loader2, X, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useProductLines } from '../lib/profile';

const STATES = ['planned', 'sent', 'responded', 'converted', 'declined'];
const input = 'w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500';

interface Pitch { whatsApp?: string; email?: string; emailSubject?: string; callScript?: string }

export function CampaignsView() {
  const { canWrite } = useAuth();
  const productLines = useProductLines();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', offer: '', line: '', from: '', to: '', tag: '', tier: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, cl, t] = await Promise.all([db.campaigns.toArray(), db.clients.toArray(), db.campaignTargets.toArray()]);
    setCampaigns(c.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)));
    setClients(cl);
    setTargets(t);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const allTags = useMemo(() => Array.from(new Set(clients.flatMap((c) => c.tags ?? []))).sort(), [clients]);
  const picked = useMemo(() => clients.filter((c) =>
    (!form.tag || (c.tags ?? []).includes(form.tag)) && (!form.tier || String(c.tier) === form.tier)), [clients, form.tag, form.tier]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const id = uuidv4();
      await db.campaigns.add({
        id, title: form.title.trim(), offerDetails: form.offer.trim(), status: 'draft',
        validFrom: form.from || null, validTo: form.to || null, productLines: form.line ? [form.line] : [],
      });
      await db.campaignTargets.bulkAdd(picked.map((c) => ({ id: uuidv4(), campaignId: id, clientId: c.id, state: 'planned' })));
      setCreating(false); setForm({ title: '', offer: '', line: '', from: '', to: '', tag: '', tier: '' });
      await load(); setOpenId(id);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const draftPitch = async (c: any) => {
    setBusy(true); setError(null);
    try {
      const res = await apiFetch('/api/generate-campaign-pitch', {
        method: 'POST',
        body: JSON.stringify({ productName: c.title, brandName: '', category: (c.productLines ?? [])[0] ?? '', targetCategories: [], offerPrice: '', regularPrice: '', discountPercent: 0, moq: '', sku: '', notes: c.offerDetails }),
      });
      const pitch: Pitch = await res.json();
      if (!res.ok) throw new Error((pitch as any).error || 'Pitch failed');
      await db.campaigns.update(c.id, { metadata: { pitch } });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const setState = async (t: any, state: string) => {
    await db.campaignTargets.update(t.id, { state, metadata: { id: t.id, [`${state}At`]: new Date().toISOString() } });
    await load();
  };

  const open = campaigns.find((c) => c.id === openId);
  const openTargets = targets.filter((t) => t.campaignId === openId);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2"><Megaphone className="w-5 h-5 text-blue-400" /> Campaigns</h2>
          <p className="text-sm text-slate-400">Pick a group of clients, draft a pitch, track who responded.</p>
        </div>
        {canWrite && <button onClick={() => setCreating(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm flex items-center gap-2"><Plus className="w-4 h-4" />New campaign</button>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {creating && (
        <section className="bg-[#12151a] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between"><h3 className="font-medium text-slate-200">New campaign</h3><button onClick={() => setCreating(false)}><X className="w-4 h-4" /></button></div>
          <input className={input} placeholder="Campaign name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className={`${input} h-20`} placeholder="What is the offer?" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} />
          <div className="grid sm:grid-cols-4 gap-3">
            <select className={input} value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
              <option value="">Product or service</option>{productLines.map((p) => <option key={p}>{p}</option>)}
            </select>
            <input type="date" className={input} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            <input type="date" className={input} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <select className={input} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
              <option value="">Any tier</option>{[1, 2, 3, 4].map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          </div>
          <select className={input} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
            <option value="">Any tag</option>{allTags.map((t) => <option key={t as string}>{t as string}</option>)}
          </select>
          <p className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" />{picked.length} clients match</p>
          <button disabled={busy || !form.title.trim() || picked.length === 0} onClick={create}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm">{busy ? 'Saving' : 'Create'}</button>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {campaigns.length === 0 && <p className="text-sm text-slate-500">No campaigns yet.</p>}
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)}
              className={`w-full text-left p-3 rounded-xl border ${openId === c.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#12151a] hover:border-slate-600'}`}>
              <div className="font-medium text-slate-200 text-sm">{c.title}</div>
              <div className="text-xs text-slate-500">{targets.filter((t) => t.campaignId === c.id).length} targets, {c.status}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {open ? (
            <>
              <section className="bg-[#12151a] border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-medium text-slate-100">{open.title}</h3>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{open.offerDetails || 'No offer text.'}</p>
                {canWrite && (
                  <button disabled={busy} onClick={() => draftPitch(open)} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-blue-400" />}Draft pitch with AI
                  </button>
                )}
                {open.pitch && (
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {([['WhatsApp', open.pitch.whatsApp], ['Email', `${open.pitch.emailSubject ?? ''}\n\n${open.pitch.email ?? ''}`], ['Call script', open.pitch.callScript]] as const).map(([k, v]) => v ? (
                      <div key={k} className="bg-[#0c0e12] rounded-lg p-3 border border-slate-800"><div className="text-slate-400 mb-1">{k}</div><div className="whitespace-pre-wrap text-slate-200">{v}</div></div>
                    ) : null)}
                  </div>
                )}
              </section>
              <section className="bg-[#12151a] border border-slate-800 rounded-xl divide-y divide-slate-800">
                {openTargets.map((t) => {
                  const cl = clients.find((c) => c.id === t.clientId);
                  return (
                    <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-200 truncate">{cl?.name ?? 'Unknown client'}</span>
                      <select disabled={!canWrite} value={t.state} onChange={(e) => setState(t, e.target.value)} className="px-2 py-1 rounded bg-[#0c0e12] border border-slate-700 text-xs">
                        {STATES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  );
                })}
              </section>
            </>
          ) : <p className="text-sm text-slate-500">Select a campaign.</p>}
        </div>
      </div>
    </div>
  );
}
