import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, User, Loader2, Sparkles, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

const card = 'w-full max-w-2xl bg-[#12151a] border border-slate-800 rounded-2xl p-6 shadow-2xl';
const input = 'w-full px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm focus:border-blue-500 outline-none';
const primary = 'px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center gap-2';

interface PackTag { name: string; description: string; keywords: string[]; color: string; verified: boolean; quote: string | null; sourceUrl: string | null }
interface Pack {
  summary: string; offerings: string[]; target_customers: string[]; tags: PackTag[]; categories: string[];
  tier_rules: Array<{ tier: number; label: string; rule: string }>; product_lines: string[];
  presets: Array<{ name: string; lat: number; lng: number; radius_km: number }>; cadence_days: Record<string, number>;
  sourcesUsed: number; notes: string[];
}

export function OnboardingPage() {
  const { session, profile, loading, refresh, activeOrg } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState<'create' | 'join'>('create');
  const [f, setF] = useState({ name: '', website: '', country: '', cities: '', code: '' });
  const [need, setNeed] = useState({ text: '', website: '' });
  const [pack, setPack] = useState<Pack | null>(null);

  if (loading) return <div className="min-h-screen bg-[#0c0e12]" />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile && profile.onboarding_step >= 4) return <Navigate to="/" replace />;
  const step = profile?.onboarding_step ?? 1;
  const isBusiness = activeOrg?.org.kind !== 'personal';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); await refresh(); } catch (e: any) { setErr(e.message || 'Something went wrong'); } finally { setBusy(false); }
  };

  const chooseIndividual = () => run(async () => {
    const who = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'My';
    const { error } = await supabase.rpc('create_organization', { p_name: `${who} workspace`, p_kind: 'personal' });
    if (error) throw error;
  });
  const chooseBusiness = () => run(async () => {
    const { error } = await supabase.from('profiles').update({ is_business: true, onboarding_step: 2 }).eq('id', session.user.id);
    if (error) throw error;
  });
  const createOrg = () => run(async () => {
    const { data, error } = await supabase.rpc('create_organization', {
      p_name: f.name.trim(), p_kind: 'business', p_website: f.website.trim() || null, p_country: f.country.trim() || null });
    if (error) throw error;
    const cities = f.cities.split(',').map((c) => c.trim()).filter(Boolean);
    if (cities.length) await supabase.from('business_profiles').update({ config: { cities } }).eq('org_id', data);
    setNeed((n) => ({ ...n, website: f.website.trim() }));
  });
  const joinOrg = () => run(async () => {
    const { error } = await supabase.rpc('join_organization', { p_code: f.code.trim() });
    if (error) throw error;
    nav('/', { replace: true });
  });

  const buildPack = () => run(async () => {
    const res = await apiFetch('/api/onboarding/profile-pack', { method: 'POST', body: JSON.stringify(need) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not build the profile');
    setPack(data);
  });
  const approve = () => run(async () => {
    const res = await apiFetch('/api/onboarding/profile-pack/approve', {
      method: 'POST', body: JSON.stringify({ pack, lookingFor: isBusiness ? null : need.text }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save');
    nav('/', { replace: true });
  });

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 flex items-center justify-center p-4">
      <div className={card}>
        <div className="text-xs text-slate-500 mb-4">Step {Math.min(step, 3)} of 3</div>

        {step === 1 && (
          <>
            <h1 className="text-xl font-semibold text-slate-100">Are you using this for a business?</h1>
            <p className="text-sm text-slate-400 mt-1">This decides how we set up your workspace.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <button disabled={busy} onClick={chooseBusiness} className="p-4 rounded-xl border border-slate-700 hover:border-blue-500 text-left">
                <Building2 className="w-6 h-6 text-blue-400 mb-2" /><div className="font-medium">Yes, for a business</div>
                <div className="text-xs text-slate-400 mt-1">Create a team workspace or join one with an invite code.</div>
              </button>
              <button disabled={busy} onClick={chooseIndividual} className="p-4 rounded-xl border border-slate-700 hover:border-blue-500 text-left">
                <User className="w-6 h-6 text-emerald-400 mb-2" /><div className="font-medium">No, just me</div>
                <div className="text-xs text-slate-400 mt-1">Tell us what you are looking for and we will find it.</div>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-semibold text-slate-100">Your business</h1>
            <div className="flex gap-2 mt-4 text-sm">
              {(['create', 'join'] as const).map((k) => (
                <button key={k} onClick={() => setSub(k)} className={`px-3 py-1.5 rounded-lg ${sub === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                  {k === 'create' ? 'Create a workspace' : 'Join with invite code'}
                </button>
              ))}
            </div>
            {sub === 'create' ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">You become the owner.</p>
                <input className={input} placeholder="Business name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <input className={input} placeholder="Website (optional)" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
                <input className={input} placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
                <input className={input} placeholder="Cities you serve, comma separated" value={f.cities} onChange={(e) => setF({ ...f, cities: e.target.value })} />
                <button className={primary} disabled={busy || !f.name.trim()} onClick={createOrg}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Continue</button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">Your admin gives you the code and decides your role (admin, manager, sales or viewer).</p>
                <input className={input} placeholder="Invite code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
                <button className={primary} disabled={busy || !f.code.trim()} onClick={joinOrg}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Join</button>
              </div>
            )}
          </>
        )}

        {step === 3 && !pack && (
          <>
            <h1 className="text-xl font-semibold text-slate-100">{isBusiness ? 'Describe your business' : 'What are you looking for?'}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {isBusiness ? 'What you sell, and who buys it. We will research your public pages to fill in the rest.'
                : 'For example: "I want vegan bakeries near Marina to sell oat milk to".'}
            </p>
            <textarea className={`${input} mt-4 h-32`} value={need.text} onChange={(e) => setNeed({ ...need, text: e.target.value })}
              placeholder={isBusiness ? 'We supply ...' : 'I am looking for ...'} />
            {isBusiness && <input className={`${input} mt-3`} placeholder="Website (optional)" value={need.website} onChange={(e) => setNeed({ ...need, website: e.target.value })} />}
            <button className={`${primary} mt-4`} disabled={busy || (!need.text.trim() && !need.website.trim())} onClick={buildPack}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Researching and drafting, about 30 seconds' : 'Build my profile'}
            </button>
          </>
        )}

        {step === 3 && pack && (
          <>
            <h1 className="text-xl font-semibold text-slate-100">Review your profile</h1>
            <p className="text-xs text-slate-400 mt-1">Built from {pack.sourcesUsed} sources. Edit anything, then approve. Tags with a check have a quote found on a real source.</p>
            <label className="block text-xs text-slate-400 mt-4 mb-1">Summary</label>
            <textarea className={`${input} h-20`} value={pack.summary} onChange={(e) => setPack({ ...pack, summary: e.target.value })} />
            <div className="text-xs text-slate-400 mt-4 mb-2">Tags (click x to remove)</div>
            <div className="flex flex-wrap gap-2">
              {pack.tags.map((t, i) => (
                <span key={t.name} title={t.quote ? `"${t.quote}"${t.sourceUrl ? `  (${t.sourceUrl})` : ''}` : 'No source quote: unverified'}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border" style={{ borderColor: t.color, color: t.color }}>
                  {t.verified ? <CheckCircle2 className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 opacity-40" />}{t.name}
                  <button onClick={() => setPack({ ...pack, tags: pack.tags.filter((_, j) => j !== i) })} className="hover:text-white"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4 text-xs text-slate-300">
              <div><div className="text-slate-400 mb-1">Categories</div>{pack.categories.join(', ') || '-'}</div>
              <div><div className="text-slate-400 mb-1">Search areas</div>{pack.presets.map((p) => p.name).join(', ') || '-'}</div>
              <div className="sm:col-span-2"><div className="text-slate-400 mb-1">Tier rules</div>
                {pack.tier_rules.map((r) => <div key={r.tier}>Tier {r.tier} ({r.label}): {r.rule}</div>)}</div>
            </div>
            {pack.notes.length > 0 && <p className="text-xs text-amber-400 mt-3">{pack.notes.join(' ')}</p>}
            <div className="flex gap-3 mt-5">
              <button className={primary} disabled={busy} onClick={approve}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Approve and start</button>
              <button className="px-4 py-2.5 rounded-lg bg-slate-800 text-sm" onClick={() => setPack(null)}>Start over</button>
            </div>
          </>
        )}

        {err && <p className="mt-4 text-xs text-red-400">{err}</p>}
      </div>
    </div>
  );
}
