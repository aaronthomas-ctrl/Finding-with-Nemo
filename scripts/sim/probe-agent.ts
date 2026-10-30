// Runs chat messages through the real agent as a simulated user and prints everything that happens.
// Usage: UI='{"polygon":[...],"tags":["x"]}' npx tsx scripts/sim/probe-agent.ts <A|B|C|MINE> "message" ["second message"]
import 'dotenv/config';
import fs from 'node:fs'; import pg from 'pg';
import { simClient, closeSim } from './pg-supabase';
import { runAgent } from '../../server/agent/loop';
import { ORG_NAME } from '../eval/questions';

const [orgKey, ...messages] = process.argv.slice(2);
const ui = process.env.UI ? JSON.parse(process.env.UI) : {};
const a = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT!, 'utf8') } }); await a.connect();
const uid = (await a.query("select id from auth.users where email='aaronthomashermit@gmail.com'")).rows[0].id;
const orgId = orgKey === 'MINE'
  ? (await a.query("select default_org_id id from public.profiles where id=$1", [uid])).rows[0].id
  : (await a.query('select id from public.organizations where name=$1', [(ORG_NAME as any)[orgKey]])).rows[0].id;
await a.end();
const sb = simClient(uid);
const threads: string[] = [];
let threadId: string | undefined;

for (const message of messages) {
  const t0 = Date.now();
  let reply = '';
  const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  console.log(`\n>>> ${message}`);
  await runAgent({ sb, orgId, user: { id: uid }, role: 'owner' } as any, { message, ui, threadId }, (e) => {
    if (e.type === 'text') reply += e.delta;
    else if (e.type === 'replace') reply = e.text;
    else if (e.type === 'tool') { if (e.status !== 'running') log(`tool ${e.name} ${e.status}${e.summary ? ' - ' + e.summary.slice(0, 110) : ''}`); }
    else if (e.type === 'proposal') log(`PROPOSAL: ${e.approval.summary}${e.approval.payload?.tags ? ' | tags: ' + e.approval.payload.tags.join(',') : ''}`);
    else if (e.type === 'ui') log(`ui action: ${e.action.type}${(e.action as any).start ? ' (start: ' + (e.action as any).start.name + ')' : ''}`);
    else if (e.type === 'done') { threadId = e.threadId; if (!threads.includes(e.threadId)) threads.push(e.threadId); }
    else if (e.type === 'error') log(`ERROR: ${e.message}`);
  }, new AbortController().signal);
  console.log('REPLY: ' + reply.trim().slice(-500));
}

for (const t of threads) {
  const { data: runs } = await sb.from('agent_runs').select('id').eq('thread_id', t); const ids = (runs ?? []).map((r: any) => r.id);
  if (ids.length && process.env.SHOW_ARGS) { const { data: calls } = await sb.from('agent_tool_calls').select('tool,args').in('run_id', ids); for (const c of calls ?? []) console.log('  call', c.tool, JSON.stringify(c.args).slice(0, 240)); }
  if (ids.length) await sb.from('approvals').delete().in('run_id', ids);
  await sb.from('chat_threads').delete().eq('id', t);
  if (ids.length) await sb.from('agent_runs').delete().in('id', ids);
}
await closeSim();
