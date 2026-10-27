// Runs one chat message through the real agent as a simulated user and prints everything that happens.
// Usage: npx tsx scripts/sim/probe-agent.ts <A|B|C> "message"
import 'dotenv/config';
import fs from 'node:fs'; import pg from 'pg';
import { simClient, closeSim } from './pg-supabase';
import { runAgent } from '../../server/agent/loop';
import { ORG_NAME } from '../eval/questions';

const [orgKey, ...rest] = process.argv.slice(2);
const message = rest.join(' ');
const a = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT!, 'utf8') } }); await a.connect();
const uid = (await a.query("select id from auth.users where email='aaronthomashermit@gmail.com'")).rows[0].id;
const orgId = (await a.query('select id from public.organizations where name=$1', [(ORG_NAME as any)[orgKey]])).rows[0].id; await a.end();
const sb = simClient(uid);
const t0 = Date.now();
let reply = ''; let threadId = '';
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
await runAgent({ sb, orgId, user: { id: uid }, role: 'owner' } as any, { message, ui: {} }, (e) => {
  if (e.type === 'text') reply += e.delta;
  else if (e.type === 'replace') { reply = e.text; log(`verifier replaced text (${e.notVerified} unverified)`); }
  else if (e.type === 'tool') log(`tool ${e.name} ${e.status}${e.summary ? ' - ' + e.summary.slice(0, 100) : ''}`);
  else if (e.type === 'memories') log(`recalled ${e.items.length} memories: ${e.items.slice(0, 3).map((m) => m.content.slice(0, 50)).join(' | ')}`);
  else if (e.type === 'proposal') log(`PROPOSAL: ${e.approval.summary}`);
  else if (e.type === 'ui') log(`ui action: ${e.action.type}`);
  else if (e.type === 'done') threadId = e.threadId;
  else if (e.type === 'error') log(`ERROR: ${e.message}`);
}, new AbortController().signal);
log('done');
console.log('\nREPLY:\n' + reply);
if (threadId) { const { data: runs } = await sb.from('agent_runs').select('id').eq('thread_id', threadId); const ids = (runs ?? []).map((r: any) => r.id); if (ids.length) await sb.from('approvals').delete().in('run_id', ids); await sb.from('chat_threads').delete().eq('id', threadId); if (ids.length) await sb.from('agent_runs').delete().in('id', ids); }
await closeSim();
