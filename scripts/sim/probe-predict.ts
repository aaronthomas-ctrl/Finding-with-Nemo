import 'dotenv/config';
import fs from 'node:fs'; import pg from 'pg';
import { simClient, closeSim } from './pg-supabase';
import { predictForClient } from '../../server/predict';
const a = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT!, 'utf8') } }); await a.connect();
const uid = (await a.query("select id from auth.users where email='aaronthomashermit@gmail.com'")).rows[0].id;
const orgB = '5eed0000-0000-4000-8000-00000000000b';
const c = (await a.query("select id from public.clients where org_id=$1 and name='Lone Star Cold Storage'", [orgB])).rows[0].id; await a.end();
const sb = simClient(uid);
const req: any = { sb, orgId: orgB, user: { id: uid }, role: 'owner' };
try { const t0 = Date.now(); const p = await predictForClient(req, c); console.log(Date.now() - t0, 'ms', JSON.stringify(p, null, 1).slice(0, 1500)); } catch (e: any) { console.log('THROWS', e.message); }
await closeSim();
