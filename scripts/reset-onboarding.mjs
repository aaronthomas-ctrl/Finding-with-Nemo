// Puts a user back at onboarding step 3 and clears the generated profile, tags, products and sources of their default org.
// Usage: node --env-file=.env scripts/reset-onboarding.mjs <user-email>
import fs from 'node:fs'; import pg from 'pg';
const email = process.argv[2];
if (!email) { console.error('usage: reset-onboarding.mjs <email>'); process.exit(1); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } });
await c.connect();
const { rows } = await c.query('select p.id, p.default_org_id from public.profiles p join auth.users u on u.id = p.id where u.email = $1', [email]);
if (!rows[0]?.default_org_id) { console.error('no such user or org'); process.exit(1); }
const org = rows[0].default_org_id;
await c.query('begin');
for (const t of ['tag_definitions', 'products', 'evidence', 'sources']) await c.query(`delete from public.${t} where org_id = $1`, [org]);
await c.query("update public.business_profiles set summary=null, looking_for=null, offerings='[]', target_customers='[]', config='{}', status='pending', approved_by=null, approved_at=null where org_id=$1", [org]);
await c.query('update public.profiles set onboarding_step = 3 where id = $1', [rows[0].id]);
await c.query('commit');
console.log('reset org', org);
await c.end();
