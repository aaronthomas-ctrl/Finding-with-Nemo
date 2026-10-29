import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gauge, Users, ScrollText, Copy, Trash2, Plus, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveOrgId } from '../lib/api';
import { useAuth, type OrgRole } from '../auth/AuthProvider';

const card = 'bg-[#12151a] border border-slate-800 p-4 sm:p-6 rounded-xl';
const h3 = 'text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2';
const input = 'px-3 py-2 rounded-lg bg-[#0c0e12] border border-slate-700 text-sm outline-none focus:border-blue-500';
const ROLES: OrgRole[] = ['owner', 'admin', 'manager', 'sales', 'viewer'];
const ROLE_HELP: Record<OrgRole, string> = {
  owner: 'Everything, including members and settings',
  admin: 'Everything, including members and settings',
  manager: 'Everything except members and settings',
  sales: 'Their own clients and notes; reads shared ones',
  viewer: 'Read only',
};

interface Limits { tokens_per_day: number; tavily_per_day: number; google_per_day: number }
interface Day { day: string; tokens_in: number; tokens_out: number; tavily_credits: number; google_calls: number }

function Bar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{label}</span><span className="text-slate-500">{used.toLocaleString()} of {cap.toLocaleString()}</span></div>
      <div className="h-2 bg-slate-800 rounded-full"><div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
      {pct >= 90 && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Close to the daily cap. Calls stop at 100% until tomorrow.</p>}
    </div>
  );
}

/** Daily usage against the hard caps, per organisation. */
function UsageMeter() {
  const { isAdmin } = useAuth();
  const [days, setDays] = useState<Day[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [draft, setDraft] = useState<Limits | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const [u, o] = await Promise.all([
      supabase.from('usage_quota').select('*').eq('org_id', orgId).gte('day', since).order('day', { ascending: false }),
      supabase.from('organizations').select('plan_limits').eq('id', orgId).maybeSingle(),
    ]);
    setDays((u.data as Day[]) ?? []);
    const l = { tokens_per_day: 2_000_000, tavily_per_day: 100, google_per_day: 500, ...(o.data?.plan_limits ?? {}) } as Limits;
    setLimits(l); setDraft(l);
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = days.find((d) => d.day === new Date().toISOString().slice(0, 10));
  const save = async () => {
    const { error } = await supabase.from('organizations').update({ plan_limits: draft }).eq('id', getActiveOrgId()!);
    setMsg(error ? error.message : 'Limits saved.'); if (!error) load();
  };

  return (
    <section className={card}>
      <h3 className={h3}><Gauge className="w-5 h-5 text-slate-400" />Usage today</h3>
      {limits && (
        <div className="space-y-4">
          <Bar label="Model tokens (in and out)" used={(today?.tokens_in ?? 0) + (today?.tokens_out ?? 0)} cap={limits.tokens_per_day} />
          <Bar label="Tavily web credits" used={today?.tavily_credits ?? 0} cap={limits.tavily_per_day} />
          <Bar label="Google Maps calls" used={today?.google_calls ?? 0} cap={limits.google_per_day} />
          <p className="text-[11px] text-slate-500">Hard daily caps protect the budget. Web results are cached for seven days and bulk jobs use the smallest model.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-slate-500"><tr><th className="py-1 pr-3">Day</th><th className="pr-3">Tokens in</th><th className="pr-3">Tokens out</th><th className="pr-3">Tavily</th><th>Google</th></tr></thead>
              <tbody>{days.map((d) => <tr key={d.day} className="border-t border-slate-800"><td className="py-1 pr-3">{d.day}</td><td className="pr-3">{Number(d.tokens_in).toLocaleString()}</td><td className="pr-3">{Number(d.tokens_out).toLocaleString()}</td><td className="pr-3">{d.tavily_credits}</td><td>{d.google_calls}</td></tr>)}</tbody>
            </table>
            {days.length === 0 && <p className="text-xs text-slate-500 py-2">No usage recorded yet.</p>}
          </div>
          {isAdmin && draft && (
            <div className="grid sm:grid-cols-4 gap-2 items-end pt-2 border-t border-slate-800">
              {(['tokens_per_day', 'tavily_per_day', 'google_per_day'] as const).map((k) => (
                <label key={k} className="text-[11px] text-slate-500">{k === 'tokens_per_day' ? 'Tokens per day' : k === 'tavily_per_day' ? 'Tavily per day' : 'Google per day'}
                  <input type="number" min={0} className={`${input} w-full mt-1`} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} /></label>
              ))}
              <button onClick={save} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">Save limits</button>
            </div>
          )}
          {msg && <p className="text-xs text-slate-400">{msg}</p>}
        </div>
      )}
    </section>
  );
}

interface Member { user_id: string; role: OrgRole; created_at: string }
interface Invite { id: string; code: string; role: OrgRole; expires_at: string }

/** Members, roles and invite codes. Owners and admins only (the database enforces it too). */
function Members() {
  const { session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<OrgRole>('sales');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    const [m, i] = await Promise.all([
      supabase.from('memberships').select('user_id,role,created_at').eq('org_id', orgId).order('created_at'),
      supabase.from('org_invites').select('id,code,role,expires_at').eq('org_id', orgId).is('used_by', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ]);
    const rows = (m.data as Member[]) ?? [];
    setMembers(rows); setInvites((i.data as Invite[]) ?? []);
    if (rows.length) {
      const { data } = await supabase.from('profiles').select('id,full_name').in('id', rows.map((r) => r.user_id));
      setNames(Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || ''])));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setMemberRole = async (u: string, r: OrgRole) => {
    const { error } = await supabase.from('memberships').update({ role: r }).eq('org_id', getActiveOrgId()!).eq('user_id', u);
    setMsg(error ? error.message : null); load();
  };
  const remove = async (u: string) => {
    const { error } = await supabase.from('memberships').delete().eq('org_id', getActiveOrgId()!).eq('user_id', u);
    setMsg(error ? error.message : null); load();
  };
  const invite = async () => {
    const { error } = await supabase.from('org_invites').insert({ org_id: getActiveOrgId(), role, created_by: session?.user.id });
    setMsg(error ? error.message : null); load();
  };
  const revoke = async (id: string) => { await supabase.from('org_invites').delete().eq('id', id); load(); };

  return (
    <section className={card}>
      <h3 className={h3}><Users className="w-5 h-5 text-slate-400" />Members and roles</h3>
      <div className="space-y-2">
        {members.map((m) => {
          const me = m.user_id === session?.user.id;
          return (
            <div key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0"><div className="text-slate-200 truncate">{names[m.user_id] || `Member ${m.user_id.slice(0, 6)}`}{me ? ' (you)' : ''}</div><div className="text-[11px] text-slate-500">{ROLE_HELP[m.role]}</div></div>
              <div className="flex items-center gap-2 shrink-0">
                {me
                  ? <span title="You cannot change your own role, so the organisation always keeps an owner." className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300">{m.role} · you</span>
                  : <select value={m.role} onChange={(e) => setMemberRole(m.user_id, e.target.value as OrgRole)} className={`${input} py-1`}>
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>}
                {!me && <button onClick={() => remove(m.user_id)} className="p-1.5 text-slate-500 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          );
        })}
      </div>
      {members.length === 1 && <p className="text-xs text-slate-500 mt-3">You are the only member. Create an invite code below, send it to a teammate, and they pick it up when they join. Then you can change their role here.</p>}
      <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} className={input}>{ROLES.filter((r) => r !== 'owner').map((r) => <option key={r}>{r}</option>)}</select>
          <button onClick={invite} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" />New invite code</button>
          <span className="text-[11px] text-slate-500">Codes work once and expire in 7 days.</span>
        </div>
        {invites.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 text-xs">
            <span><code className="text-slate-200 bg-black/30 px-2 py-1 rounded">{i.code}</code> <span className="text-slate-500">as {i.role}, until {new Date(i.expires_at).toLocaleDateString()}</span></span>
            <span className="flex gap-1.5">
              <button onClick={() => navigator.clipboard?.writeText(i.code)} className="p-1.5 text-slate-400 hover:text-slate-200" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => revoke(i.id)} className="p-1.5 text-slate-500 hover:text-red-400" title="Revoke"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        ))}
        {msg && <p className="text-xs text-red-400">{msg}</p>}
      </div>
    </section>
  );
}

interface Audit { id: number; actor_id: string | null; action: string; entity: string | null; details: any; created_at: string }
interface Call { id: string; tool: string; is_write: boolean; blocked: boolean; result: any; created_at: string }

/** Every approval and every agent tool call, with the ones that were blocked called out. */
function AuditLog() {
  const [tab, setTab] = useState<'activity' | 'calls'>('activity');
  const [audit, setAudit] = useState<Audit[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);

  useEffect(() => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    (async () => {
      const [a, c] = await Promise.all([
        supabase.from('audit_log').select('id,actor_id,action,entity,details,created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(150),
        supabase.from('agent_tool_calls').select('id,tool,is_write,blocked,result,created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(150),
      ]);
      const rows = (a.data as Audit[]) ?? [];
      setAudit(rows); setCalls((c.data as Call[]) ?? []);
      const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id,full_name').in('id', ids);
        setNames(Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || ''])));
      }
    })();
  }, []);

  const shownAudit = useMemo(() => audit.filter((r) => !filter || `${r.action} ${r.entity}`.toLowerCase().includes(filter.toLowerCase())), [audit, filter]);
  const shownCalls = useMemo(() => calls.filter((r) => (!filter || r.tool.includes(filter.toLowerCase())) && (!blockedOnly || r.blocked)), [calls, filter, blockedOnly]);
  const blockedCount = calls.filter((c) => c.blocked).length;

  return (
    <section className={card}>
      <h3 className={h3}><ScrollText className="w-5 h-5 text-slate-400" />Audit log</h3>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(['activity', 'calls'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{t === 'activity' ? 'Approvals and changes' : `Agent tool calls (${calls.length})`}</button>)}
        <input className={`${input} py-1.5 ml-auto w-40`} placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {tab === 'calls' && <label className="text-xs text-slate-400 flex items-center gap-1.5"><input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} />Blocked only ({blockedCount})</label>}
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
        {tab === 'activity' && shownAudit.map((r) => (
          <div key={r.id} className="py-2 text-xs">
            <div className="flex justify-between gap-3"><span className="text-slate-200">{r.action.replace(/_/g, ' ')}{r.entity ? ` · ${r.entity}` : ''}</span><span className="text-slate-500 shrink-0">{new Date(r.created_at).toLocaleString()}</span></div>
            <div className="text-slate-500">{names[r.actor_id ?? ''] || (r.actor_id ? `Member ${r.actor_id.slice(0, 6)}` : 'System')}{r.details?.summary ? `: ${String(r.details.summary).slice(0, 140)}` : ''}</div>
          </div>
        ))}
        {tab === 'calls' && shownCalls.map((r) => (
          <div key={r.id} className="py-2 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-slate-200">{r.tool}{r.is_write ? ' (write)' : ''} {r.blocked && <span className="ml-1 px-1.5 rounded border border-amber-500/50 text-amber-300">blocked</span>}</span>
              <span className="text-slate-500 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="text-slate-500 truncate">{String(r.result?.preview ?? '').slice(0, 160)}</div>
          </div>
        ))}
        {((tab === 'activity' && !shownAudit.length) || (tab === 'calls' && !shownCalls.length)) && <p className="text-xs text-slate-500 py-3">Nothing to show.</p>}
      </div>
    </section>
  );
}

export function AdminPanels() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <div className="space-y-8">
      <UsageMeter />
      <Members />
      <AuditLog />
    </div>
  );
}
