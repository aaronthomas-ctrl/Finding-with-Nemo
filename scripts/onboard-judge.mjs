// Gives an existing account a real workspace and approved profile, as onboarding would, with NO clients or invented data.
//   node --env-file=.env scripts/onboard-judge.mjs you@example.com
// The profile describes the product story: welding supplies sold to fabricators and EPC contractors in the UAE.
import fs from 'node:fs';
import pg from 'pg';

const email = process.argv[2];
if (!email) { console.error('usage: node --env-file=.env scripts/onboard-judge.mjs <email>'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } });
await c.connect();
const user = (await c.query('select id from auth.users where lower(email) = lower($1)', [email])).rows[0];
if (!user) { console.error(`No account with email ${email}.`); process.exit(1); }
const existing = (await c.query('select count(*)::int n from public.memberships where user_id = $1', [user.id])).rows[0].n;
if (existing > 0) { console.error(`${email} already has ${existing} workspace(s); not adding another.`); process.exit(1); }

const tags = [
  ['epc-contractor', 'Engineering, procurement and construction contractor', ['EPC', 'contractor', 'engineering procurement construction'], '#3b82f6'],
  ['steel-fabricator', 'Structural steel fabrication workshop', ['fabrication', 'structural steel', 'steel works'], '#a16207'],
  ['pipe-spool', 'Pipe spool and pressure piping shop', ['pipe spool', 'piping'], '#06b6d4'],
  ['pressure-vessel', 'Pressure vessel and heat exchanger work', ['pressure vessel', 'heat exchanger'], '#f59e0b'],
  ['shipyard', 'Marine and shipyard welding', ['shipyard', 'marine', 'offshore'], '#8b5cf6'],
  ['shutdown-maintenance', 'Plant shutdown and maintenance welding', ['shutdown', 'turnaround', 'maintenance'], '#22c55e'],
];
const config = {
  cities: ['Ras Al Khaimah'],
  categories: ['EPC contractor', 'Fabrication workshop', 'Pipe and spool shop', 'Shipyard', 'Maintenance contractor', 'Other'],
  tier_rules: [
    { tier: 1, label: 'Best fit', rule: 'EPC contractor or large fabricator with a live project and high weekly consumables use' },
    { tier: 2, label: 'Good fit', rule: 'Fabrication workshop or pipe spool shop with steady orders' },
    { tier: 3, label: 'Possible', rule: 'Maintenance contractor or shipyard that welds occasionally' },
    { tier: 4, label: 'Low priority', rule: 'Everything else' },
  ],
  presets: [
    { name: 'Ras Al Khaimah', lat: 25.7895, lng: 55.9432, radius_km: 12 },
    { name: 'Sharjah Industrial Area', lat: 25.3, lng: 55.43, radius_km: 6 },
    { name: 'Jebel Ali Free Zone', lat: 25.005, lng: 55.06, radius_km: 8 },
    { name: 'Mussafah Industrial Area', lat: 24.35, lng: 54.49, radius_km: 6 },
  ],
  cadence_days: { 1: 7, 2: 14, 3: 30, 4: 60 },
  product_lines: ['Welding electrodes', 'Flux-cored and TIG wire', 'Shielding gas', 'Weld consumables'],
};

await c.query('begin');
try {
  const org = (await c.query(
    `insert into public.organizations (name, kind, country, created_by) values ('Welding Supplies (judge workspace)', 'business', 'United Arab Emirates', $1) returning id`, [user.id])).rows[0].id;
  await c.query(`insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')`, [org, user.id]);
  await c.query(
    `insert into public.business_profiles (org_id, summary, offerings, target_customers, config, status, approved_by, approved_at)
     values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, 'approved', $6, now())`,
    [org,
      'Supplies welding electrodes, wire, shielding gas and consumables to steel fabricators, pipe spool shops and EPC contractors in the UAE.',
      JSON.stringify(['Welding electrodes and filler wire', 'Shielding gas', 'Weld consumables']),
      JSON.stringify(['EPC contractors', 'Steel and structural fabricators', 'Pipe spool and pressure vessel shops', 'Shipyards']),
      JSON.stringify(config), user.id]);
  for (const [name, description, keywords, color] of tags) {
    await c.query(
      `insert into public.tag_definitions (org_id, name, description, keywords, negative_keywords, color, origin, status) values ($1,$2,$3,$4,'{}',$5,'agent','approved')`,
      [org, name, description, keywords, color]);
  }
  for (const name of config.product_lines) await c.query('insert into public.products (org_id, name) values ($1, $2)', [org, name]);
  await c.query('update public.profiles set default_org_id = $1, is_business = true, onboarding_step = 4 where id = $2', [org, user.id]);
  await c.query('commit');
  console.log(`Onboarded ${email}: workspace created with ${tags.length} tags, 4 search areas, no clients.`);
} catch (e) {
  await c.query('rollback');
  throw e;
}
await c.end();
