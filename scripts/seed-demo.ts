/**
 * Seeds three synthetic organisations (a cafe supplier, a solar installer, a dental supplier) into the database.
 * Everything is invented. Nothing here is real client data.
 *
 *   npm run seed -- --email you@example.com            attach the three orgs to an existing account as owner
 *   npm run seed -- --email you@example.com --activate make the cafe supplier your active org and skip onboarding
 *   npm run seed -- --reset                            remove only the three seeded orgs (fixed ids), nothing else
 *
 * It connects with DATABASE_URL (verified TLS), so it bypasses row level security like any admin script.
 * It never creates accounts and never touches passwords: the account must already exist.
 */
import 'dotenv/config';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { UMAP } from 'umap-js';
import { embed } from '../server/llm';
import { seal } from '../server/crypto';
import { verifyQuote } from '../server/evidence';
import { ORGS, type SeedOrg } from './seed/data';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } : true });
const q = async (sql: string, params: any[] = []) => (await db.query(sql, params)).rows;

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const day = (n: number) => new Date(Date.now() + n * 864e5);
const dateOnly = (n: number) => day(n).toISOString().slice(0, 10);
const vec = (v: number[]) => `[${v.join(',')}]`;

const COLORS: Record<string, string> = { fact: '#38bdf8', interaction: '#a78bfa', voice: '#f59e0b', profile: '#34d399', project: '#f472b6', prediction: '#fb7185', web: '#94a3b8', chat: '#64748b' };
const TOPIC: Record<string, { ask: string; note: string }> = {
  '5eed0000-0000-4000-8000-00000000000a': { ask: 'a quote for weekly oat milk deliveries', note: 'tasted the new barista oat milk and liked the foam' },
  '5eed0000-0000-4000-8000-00000000000b': { ask: 'a roof and energy-use assessment', note: 'shared twelve months of electricity bills' },
  '5eed0000-0000-4000-8000-00000000000c': { ask: 'a digital scanner demo', note: 'asked about training for the nursing team' },
};
const RUMOUR: Record<string, [string, string]> = {
  '5eed0000-0000-4000-8000-00000000000a': ['Dune Coffee Co is rumoured to be switching to a competing supplier group.', 'a forum post'],
  '5eed0000-0000-4000-8000-00000000000b': ['A competitor is said to be offering free battery upgrades to school districts.', 'an industry chat thread'],
  '5eed0000-0000-4000-8000-00000000000c': ['Stockport Family Dentistry may be changing ownership next year.', 'a trade newsletter comment'],
};

interface Mem { content: string; kind: keyof typeof COLORS; verified: boolean; factId?: string; sourceId?: string; clientId?: string; projectId?: string }

async function seedOrg(o: SeedOrg, userId: string | null) {
  const rand = rng([...o.id].reduce((a, c) => a + c.charCodeAt(0), 0));
  await db.query('begin');
  try {
    await q('insert into public.organizations (id, name, kind, country, created_by) values ($1,$2,$3,$4,$5)', [o.id, o.name, 'business', o.country, userId]);
    await q(`insert into public.business_profiles (org_id, summary, offerings, target_customers, config, status, approved_at) values ($1,$2,$3,$4,$5,'approved',now())`, [
      o.id, o.summary, JSON.stringify(o.offerings), JSON.stringify(o.targets),
      JSON.stringify({ categories: o.categories, tier_rules: o.tierRules, presets: o.presets, cadence_days: { 1: 7, 2: 14, 3: 30, 4: 60 }, product_lines: o.products }),
    ]);
    if (userId) await q(`insert into public.memberships (org_id, user_id, role) values ($1,$2,'owner')`, [o.id, userId]);
    for (const t of o.tags) await q(`insert into public.tag_definitions (org_id, name, description, keywords, color, origin, status) values ($1,$2,$3,$4,$5,'seed','approved')`, [o.id, t.name, t.description, t.keywords, t.color]);
    for (const p of o.products) await q('insert into public.products (org_id, name) values ($1,$2)', [o.id, p]);

    // ---- clients ----
    const clientId = new Map<string, string>();
    const phoneBase = o.phonePrefix;
    for (let i = 0; i < o.clients.length; i++) {
      const [name, category, tags, tier, status] = o.clients[i];
      const preset = o.presets[i % o.presets.length];
      const r = preset.radius_km * 0.7 * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      const lat = preset.lat + (r / 111) * Math.sin(a), lng = preset.lng + (r / (111 * Math.cos((preset.lat * Math.PI) / 180))) * Math.cos(a);
      const offsets = [-3, 0, 2, 5, 10, 21, -1, 0, 7, 14, null, 3];
      const off = offsets[(i * 5 + (tier === 1 ? 0 : 3)) % offsets.length];
      const id = randomUUID();
      clientId.set(name, id);
      await q(`insert into public.clients (id, org_id, owner_id, name, normalized_name, address, region, lat, lng, geo_source, phone_enc, category, tags, tier, status, next_follow_up, metadata, created_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'geocoding',$10,$11,$12,$13,$14,$15,'{"synthetic":true}',$16)`, [
        id, o.id, userId, name, name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''), `${(i * 7 + 12) % 90 + 1} ${o.streets[i % o.streets.length]}, ${preset.name}`, o.region, lat, lng,
        seal(`${phoneBase} ${String(100 + i).padStart(4, '0')}`), category, tags, tier, status, off === null ? null : dateOnly(off), day(-(20 + i * 2)),
      ]);
    }

    // ---- interactions (eight busiest clients) ----
    const topic = TOPIC[o.id];
    const kinds = ['call', 'visit', 'email', 'message', 'note'];
    const intMems: Mem[] = [];
    const busy = [...o.clients].sort((a, b) => a[3] - b[3]).slice(0, 8);
    for (let i = 0; i < busy.length; i++) {
      const [name] = busy[i];
      for (let j = 0; j < 2 + (i % 2); j++) {
        const kind = kinds[(i + j) % kinds.length];
        const summary = [`Discussed ${topic.ask}.`, `${name} ${topic.note}.`, `Followed up on ${topic.ask}; waiting for their reply.`][j % 3];
        await q(`insert into public.interactions (org_id, client_id, user_id, kind, summary, occurred_at) values ($1,$2,$3,$4,$5,$6)`, [o.id, clientId.get(name), userId, kind, summary, day(-(3 + i * 4 + j * 6))]);
        if (j === 0) intMems.push({ kind: 'interaction', content: `${kind} with ${name}: ${summary}`, verified: true, clientId: clientId.get(name) });
      }
    }
    await q('select public.sweep_retry_flags($1)', [o.id]);

    // ---- leads, enquiries ----
    for (const l of o.leads) await q(`insert into public.leads (org_id, client_id, owner_id, title, value, stage) values ($1,$2,$3,$4,$5,$6)`, [o.id, clientId.get(l.client), userId, l.title, l.value, l.stage]);
    for (const e of o.enquiryClients) {
      for (let k = 0; k < e.count; k++) {
        await q(`insert into public.enquiries (org_id, client_id, details, quantity, status, received_at, metadata) values ($1,$2,$3,$4,'closed',$5,$6)`, [o.id, clientId.get(e.client), e.item, 10 + k, day(-(e.gapDays * (e.count - k))), JSON.stringify({ productLine: e.item })]);
      }
    }

    // ---- sources, evidence, facts (the Evidence Gate, enforced here too) ----
    const mems: Mem[] = [];
    for (const d of o.docs) {
      const cid = d.clientName ? clientId.get(d.clientName) : undefined;
      const [src] = await q(`insert into public.sources (org_id, kind, url, title, content, content_hash) values ($1,$2,$3,$4,$5,md5($5)) returning id`, [o.id, d.kind === 'web' ? 'tavily' : d.kind, d.url ?? null, d.title, d.text]);
      for (const f of d.facts) {
        if (!verifyQuote(d.text, f.quote)) throw new Error(`Seed fact has no matching quote in "${d.title}": ${f.quote}`);
        const [ev] = await q(`insert into public.evidence (org_id, source_id, quote, verified) values ($1,$2,$3,true) returning id`, [o.id, src.id, f.quote]);
        const [fact] = await q(`insert into public.facts (org_id, client_id, claim, evidence_id, status) values ($1,$2,$3,$4,'verified') returning id`, [o.id, cid ?? null, f.claim, ev.id]);
        mems.push({ kind: d.kind === 'web' ? 'web' : 'fact', content: f.claim, verified: true, factId: fact.id, sourceId: src.id, clientId: cid });
      }
    }
    // One unverified claim with no quote, so the dim dots and "unverified" labels have something to show.
    const [rum, from] = RUMOUR[o.id];
    const [rumFact] = await q(`insert into public.facts (org_id, claim, status) values ($1,$2,'unverified') returning id`, [o.id, rum]);
    mems.push({ kind: 'web', content: `${rum} (from ${from}, unconfirmed)`, verified: false, factId: rumFact.id });

    // ---- voice note (encrypted) ----
    const vc = clientId.get(o.voice.client)!;
    const [vn] = await q(`insert into public.voice_notes (org_id, client_id, user_id, storage_path, language, duration_s, transcript_enc, translation_enc, status) values ($1,$2,$3,'seed/placeholder.webm',$4,41,$5,$6,'extracted') returning id`, [o.id, vc, userId, o.voice.language, seal(o.voice.original), seal(o.voice.english)]);
    await q(`insert into public.interactions (org_id, client_id, user_id, kind, summary, voice_note_id, occurred_at) values ($1,$2,$3,'voice_note',$4,$5,$6)`, [o.id, vc, userId, o.voice.english, vn.id, day(-2)]);
    mems.push({ kind: 'voice', content: o.voice.english, verified: true, clientId: vc });

    // ---- profile, interaction, project, prediction memories ----
    mems.push({ kind: 'profile', content: o.summary, verified: true });
    o.offerings.forEach((x) => mems.push({ kind: 'profile', content: `Offering: ${x}`, verified: true }));
    o.targets.forEach((x) => mems.push({ kind: 'profile', content: `Target customer: ${x}`, verified: true }));
    mems.push(...intMems);

    // ---- projects, participants, link proposals ----
    for (const p of o.projects) {
      const [pr] = await q(`insert into public.projects (org_id, name, site, region, stage, starts_on, ends_on, description) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [o.id, p.name, p.site, o.region, p.stage, p.startsInDays === null ? null : dateOnly(p.startsInDays), p.endsInDays === null ? null : dateOnly(p.endsInDays), p.description]);
      for (const part of p.participants) await q(`insert into public.project_participants (org_id, project_id, client_id, role) values ($1,$2,$3,$4)`, [o.id, pr.id, clientId.get(part.client), part.role]);
      mems.push({ kind: 'project', content: `Project ${p.name} at ${p.site} (${p.stage}). ${p.description}`, verified: true, projectId: pr.id });
      if (p.proposal) {
        const text = `${p.proposal.quote}. The announcement was published this week.`;
        const [src] = await q(`insert into public.sources (org_id, kind, title, content, content_hash) values ($1,'user','Project source',$2,md5($2)) returning id`, [o.id, text]);
        if (!verifyQuote(text, p.proposal.quote)) throw new Error('proposal quote mismatch');
        const [ev] = await q(`insert into public.evidence (org_id, source_id, quote, verified) values ($1,$2,$3,true) returning id`, [o.id, src.id, p.proposal.quote]);
        await q(`insert into public.link_proposals (org_id, project_id, client_id, role, reason, score, evidence_id) values ($1,$2,$3,$4,$5,0.82,$6)`, [o.id, pr.id, clientId.get(p.proposal.client), p.proposal.role, `${p.proposal.client} is named in connection with ${p.name}: "${p.proposal.quote}"`, ev.id]);
      }
    }
    for (const pd of o.predictions) {
      await q(`insert into public.predictions (org_id, client_id, need, expected_on, confidence, reasoning) values ($1,$2,$3,$4,$5,$6)`, [o.id, clientId.get(pd.client), pd.need, dateOnly(pd.inDays), pd.confidence, pd.reasoning]);
      mems.push({ kind: 'prediction', content: `Predicted need for ${pd.client}: ${pd.need} around ${dateOnly(pd.inDays)}. ${pd.reasoning}`, verified: false, clientId: clientId.get(pd.client) });
    }

    // ---- embeddings and memories ----
    const vectors: number[][] = [];
    for (let i = 0; i < mems.length; i += 48) vectors.push(...(await embed(mems.slice(i, i + 48).map((m) => m.content))));
    const memIds: Array<{ id: string; clientId?: string; projectId?: string; at: number }> = [];
    for (let i = 0; i < mems.length; i++) {
      const m = mems[i];
      const [row] = await q(`insert into public.memories (org_id, kind, content, embedding, color, fact_id, source_id, client_id, project_id, verified, created_at) values ($1,$2,$3,$4::extensions.vector,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [o.id, m.kind, m.content, vec(vectors[i]), COLORS[m.kind], m.factId ?? null, m.sourceId ?? null, m.clientId ?? null, m.projectId ?? null, m.verified, day(-(40 - i % 40))]);
      memIds.push({ id: row.id, clientId: m.clientId, projectId: m.projectId, at: i });
    }
    // 3D positions (UMAP) and links between memories of the same client or project
    const coords = new UMAP({ nComponents: 3, nNeighbors: Math.min(15, mems.length - 1), minDist: 0.3, random: rand }).fit(vectors);
    const maxAbs = Math.max(1e-6, ...coords.flat().map(Math.abs));
    await q('select public.set_memory_positions($1,$2::jsonb)', [o.id, JSON.stringify(memIds.map((m, i) => ({ id: m.id, x: (coords[i][0] / maxAbs) * 300, y: (coords[i][1] / maxAbs) * 300, z: (coords[i][2] / maxAbs) * 300 })))]);
    for (const key of ['clientId', 'projectId'] as const) {
      const groups = new Map<string, typeof memIds>();
      for (const m of memIds) if (m[key]) groups.set(m[key]!, [...(groups.get(m[key]!) ?? []), m]);
      for (const g of groups.values()) for (let i = 1; i < g.length; i++) await q(`insert into public.memory_links (org_id, from_id, to_id, relation) values ($1,$2,$3,$4) on conflict do nothing`, [o.id, g[i - 1].id, g[i].id, key === 'clientId' ? 'same_client' : 'same_project']);
    }

    // ---- watchers, runs, notifications ----
    for (const w of o.watchers) {
      const wc = w.client ? clientId.get(w.client) : null;
      const [wr] = await q(`insert into public.watchers (org_id, client_id, created_by, kind, target, every, last_hash, last_run_at) values ($1,$2,$3,$4,$5,'daily','seedhash',$6) returning id`, [o.id, wc ?? null, userId, w.kind, w.target, day(-1)]);
      await q(`insert into public.watcher_runs (org_id, watcher_id, status, summary, started_at) values ($1,$2,'ok','Baseline saved. Changes will be reported from the next run.',$3)`, [o.id, wr.id, day(-5)]);
      await q(`insert into public.watcher_runs (org_id, watcher_id, status, summary, started_at) values ($1,$2,'changed',$3,$4)`, [o.id, wr.id, w.changedSummary, day(-1)]);
      await q(`insert into public.notifications (org_id, user_id, kind, title, body, link) values ($1,$2,'watcher',$3,$4,'/watchers')`, [o.id, userId, `Change detected: ${w.target}`.slice(0, 120), w.changedSummary]);
    }

    // ---- zone, saved route, campaign, push log, usage ----
    const zp = o.presets[o.zone.preset];
    const d = zp.radius_km / 111;
    await q(`insert into public.search_zones (org_id, name, tags, geometry, created_by) values ($1,$2,$3,$4,$5)`, [o.id, o.zone.name, o.zone.tags, JSON.stringify({ type: 'polygon', path: [{ lat: zp.lat - d, lng: zp.lng - d }, { lat: zp.lat - d, lng: zp.lng + d }, { lat: zp.lat + d, lng: zp.lng + d }, { lat: zp.lat + d, lng: zp.lng - d }] }), userId]);

    const stops = busy.slice(0, 4).map((c) => c[0]);
    const [rt] = await q(`insert into public.routes (org_id, user_id, name, plan_date, total_distance_m, total_duration_s) values ($1,$2,$3,$4,18400,3300) returning id`, [o.id, userId, `Route ${dateOnly(0)}`, dateOnly(0)]);
    for (let i = 0; i < stops.length; i++) await q(`insert into public.route_stops (org_id, route_id, client_id, seq, leg_distance_m, leg_duration_s) values ($1,$2,$3,$4,$5,$6)`, [o.id, rt.id, clientId.get(stops[i]), i + 1, 3000 + i * 900, 600 + i * 120]);

    const [camp] = await q(`insert into public.campaigns (org_id, name, status, pitch, starts_on, ends_on) values ($1,$2,'active',$3,$4,$5) returning id`, [o.id, o.campaign.name, o.campaign.pitch, dateOnly(0), dateOnly(30)]);
    const targets = o.clients.filter((c) => c[2].includes(o.campaign.tag)).slice(0, 8);
    for (let i = 0; i < targets.length; i++) await q(`insert into public.campaign_targets (org_id, campaign_id, client_id, status) values ($1,$2,$3,$4)`, [o.id, camp.id, clientId.get(targets[i][0]), ['planned', 'sent', 'responded'][i % 3]]);
    if (targets[1]) await q(`insert into public.push_logs (org_id, campaign_id, client_id, user_id, channel, note, metadata, pushed_at) values ($1,$2,$3,$4,'message','Sent the offer by message',$5,$6)`, [o.id, camp.id, clientId.get(targets[1][0]), userId, JSON.stringify({ offer: o.campaign.name }), day(-4)]);
    for (let n = 0; n < 5; n++) await q(`insert into public.usage_quota (org_id, day, tokens_in, tokens_out, tavily_credits, google_calls) values ($1,$2,$3,$4,$5,$6)`, [o.id, dateOnly(-n), 90_000 + n * 21_000, 24_000 + n * 6_000, 6 + n * 3, 20 + n * 9]);

    await db.query('commit');
    console.log(`  ${o.name}: ${o.clients.length} clients, ${mems.length} memories, ${o.projects.length} projects`);
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

await db.connect();
try {
  await q('delete from public.organizations where id = any($1::uuid[])', [ORGS.map((o) => o.id)]);
  console.log('Removed any earlier copy of the three seeded organisations.');
  if (!flag('reset')) {
    const email = opt('email');
    const user = email ? (await q('select id from auth.users where lower(email) = lower($1)', [email]))[0] : null;
    if (email && !user) throw new Error(`No account with email ${email}. Sign up first, then run the seed again.`);
    console.log(user ? `Attaching the orgs to ${email} as owner.` : 'No --email given: orgs are created without members (nobody can see them yet).');
    for (const o of ORGS) await seedOrg(o, user?.id ?? null);
    if (user && flag('activate')) {
      await q('update public.profiles set default_org_id = $1, onboarding_step = 4, is_business = true where id = $2', [ORGS[0].id, user.id]);
      console.log(`Active organisation set to ${ORGS[0].name}. Use the switcher in the sidebar to move between the three.`);
    }
    console.log('Done. All data is synthetic.');
  }
} finally {
  await db.end();
}
