// Gives an EXISTING account owner access to the three synthetic demo organisations, so they appear in its org selector.
// Run it yourself with the email you sign in with:
//
//   node --env-file=.env scripts/attach-demo-orgs.mjs you@example.com
//
// It only inserts memberships on the three seeded organisations (fixed ids starting 5eed0000), and only for an account
// that already exists. It never creates accounts and never touches passwords. Undo: `npm run seed -- --reset`.
import fs from 'node:fs';
import pg from 'pg';

const email = process.argv[2];
if (!email) { console.error('usage: node --env-file=.env scripts/attach-demo-orgs.mjs <email>'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } });
await c.connect();
const user = (await c.query('select id from auth.users where lower(email) = lower($1)', [email])).rows[0];
if (!user) { console.error(`No account with email ${email}. Sign up first.`); process.exit(1); }
const r = await c.query(
  `insert into public.memberships (org_id, user_id, role)
   select id, $1, 'owner' from public.organizations where id::text like '5eed0000%'
   on conflict do nothing returning org_id`, [user.id]);
console.log(`${email}: added to ${r.rowCount} demo organisation(s). Reload the app and use the organisation selector in the sidebar.`);
await c.end();
