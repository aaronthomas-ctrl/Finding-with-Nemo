import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { simClient, closeSim } from './pg-supabase';
import { embed } from '../../server/llm';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT!, 'utf8') } });
await admin.connect();
const uid = (await admin.query("select id from auth.users where email = 'aaronthomashermit@gmail.com'")).rows[0].id as string;
const orgA = '5eed0000-0000-4000-8000-00000000000a', orgB = '5eed0000-0000-4000-8000-00000000000b';
await admin.end();

const me = simClient(uid), stranger = simClient(randomUUID());
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };

const a = await me.from('clients').select('id').eq('org_id', orgA);
check('member sees own org clients', a.data?.length === 24, `${a.data?.length}`);
const s = await stranger.from('clients').select('id').eq('org_id', orgA);
check('stranger sees no clients', (s.data?.length ?? 0) === 0, `${s.data?.length}`);
const sm = await stranger.from('memories').select('id').eq('org_id', orgA);
check('stranger sees no memories', (sm.data?.length ?? 0) === 0);
const sn = await stranger.from('notifications').select('id').eq('org_id', orgA);
check('stranger sees no notifications', (sn.data?.length ?? 0) === 0);

const ins = await stranger.from('clients').insert({ org_id: orgA, name: 'intruder' }).select('id').single();
check('stranger cannot insert into the org', !!ins.error, ins.error?.message.slice(0, 70));
const upd = await stranger.from('clients').update({ tier: 1 }).eq('org_id', orgA).select('id');
check('stranger cannot update', (upd.data?.length ?? 0) === 0);
const del = await stranger.from('clients').delete().eq('org_id', orgA).select('id');
check('stranger cannot delete', (del.data?.length ?? 0) === 0);
const own = await stranger.from('organizations').update({ name: 'hacked' }).eq('id', orgA).select('id');
check('stranger cannot rename the org', (own.data?.length ?? 0) === 0);
const mem = await stranger.from('memberships').insert({ org_id: orgA, user_id: (await stranger.auth.getUser()).data.user.id, role: 'owner' });
check('stranger cannot make themselves owner', !!mem.error, mem.error?.message.slice(0, 70));

// member operations that the app relies on
const emb = await me.from('project_participants').select('role,project:projects(id,name,stage)').eq('org_id', orgA).limit(2);
check('embedded select works', !!emb.data?.[0]?.project?.name, JSON.stringify(emb.data?.[0]).slice(0, 80));
const pat = await me.from('injection_patterns').select('pattern,description');
check('shared injection patterns readable', (pat.data?.length ?? 0) >= 12, `${pat.data?.length}`);
const us = await me.rpc('add_usage', { p_org: orgA, p_tokens_in: 10, p_tokens_out: 5, p_tavily: 0, p_google: 0 });
check('add_usage counts', !us.error && us.data?.tokens_in > 0, us.error?.message);
const neg = await me.rpc('add_usage', { p_org: orgA, p_tokens_in: -100, p_tokens_out: 0, p_tavily: 0, p_google: 0 });
check('negative usage rejected', !!neg.error);
const strangerUsage = await stranger.rpc('add_usage', { p_org: orgA, p_tokens_in: 1, p_tokens_out: 0, p_tavily: 0, p_google: 0 });
check('stranger cannot add usage to the org', !!strangerUsage.error);
const [qv] = await embed(['espresso machine quote']);
const mm = await me.rpc('match_memories', { p_org: orgA, p_embedding: `[${qv.join(',')}]`, p_count: 3 });
check('match_memories returns rows', Array.isArray(mm.data) && mm.data.length === 3, mm.error?.message);
const mmStranger = await stranger.rpc('match_memories', { p_org: orgA, p_embedding: `[${qv.join(',')}]`, p_count: 3 });
check('match_memories hides other orgs from strangers', (mmStranger.data?.length ?? 0) === 0);
const nt = await me.rpc('notify', { p_org: orgA, p_user: uid, p_kind: 'test', p_title: 'sim test', p_body: null, p_link: null });
check('notify works for a member', !nt.error && !!nt.data, nt.error?.message);
const ntBad = await stranger.rpc('notify', { p_org: orgA, p_user: null, p_kind: 'test', p_title: 'x', p_body: null, p_link: null });
check('notify refused for a stranger', !!ntBad.error);
const clean = await me.from('notifications').update({ read_at: new Date().toISOString() }).eq('title', 'sim test').select('id');
check('user may only mark read', (clean.data?.length ?? 0) >= 1);
const orgSwitch = await me.from('profiles').select('default_org_id,onboarding_step').eq('id', uid).single();
check('own profile readable', !orgSwitch.error, JSON.stringify(orgSwitch.data));
const tenant = await me.from('clients').select('org_id').eq('org_id', orgB).limit(1);
check('member of two orgs reads both', tenant.data?.length === 1);

console.log(fails ? `\n${fails} checks failed` : '\nAll isolation checks passed');
await closeSim();
process.exit(fails ? 1 : 0);
