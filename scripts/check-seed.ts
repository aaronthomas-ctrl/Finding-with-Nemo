import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';
import { embed } from '../server/llm';
import { open } from '../server/crypto';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT!, 'utf8') } });
await c.connect();
const tables = ['clients', 'interactions', 'leads', 'enquiries', 'memories', 'memory_links', 'facts', 'evidence', 'projects', 'link_proposals', 'predictions', 'watchers', 'watcher_runs', 'notifications', 'voice_notes', 'routes', 'campaigns'];
const orgs = (await c.query("select id, name from public.organizations where id::text like '5eed0000%' order by name")).rows;
for (const o of orgs) {
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = (await c.query(`select count(*)::int n from public.${t} where org_id = $1`, [o.id])).rows[0].n;
  const m = (await c.query('select count(*) filter (where verified)::int v, count(*) filter (where not verified)::int u, count(*) filter (where x is null)::int nopos from public.memories where org_id=$1', [o.id])).rows[0];
  const due = (await c.query('select count(*)::int n from public.clients where org_id=$1 and (next_follow_up <= current_date or retry_flag)', [o.id])).rows[0].n;
  console.log(o.name, JSON.stringify(counts), 'memories verified/unverified/unpositioned:', m.v, m.u, m.nopos, '| due or retry:', due);
}
const a = orgs.find((x) => x.name.startsWith('Bean'))!;
const [qv] = await embed(['which cafe wants a quote for oat milk?']);
const r = await c.query('select id, kind, left(content, 90) content, similarity from public.match_memories($1, $2::extensions.vector, 4)', [a.id, `[${qv.join(',')}]`]);
console.log('\nrecall "which cafe wants a quote for oat milk?":'); r.rows.forEach((x) => console.log(' ', x.similarity.toFixed(2), x.kind.padEnd(11), x.content));
const ph = (await c.query('select phone_enc from public.clients where org_id=$1 limit 1', [a.id])).rows[0].phone_enc;
console.log('\nphone stored encrypted:', ph.slice(0, 24) + '...', '-> opens as', open(ph));
const mem = (await c.query("select count(*)::int n from public.memberships where org_id::text like '5eed0000%'")).rows[0].n;
console.log('memberships on seeded orgs:', mem);
await c.end();
