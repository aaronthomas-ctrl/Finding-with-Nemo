/**
 * A stand-in for the supabase-js client that talks straight to Postgres as a given user.
 * Every statement runs in a transaction with `set local role authenticated` and the user's id in the JWT claims
 * setting, which is exactly how PostgREST applies row level security. So the real agent loop and tools can be run
 * against the real database, with the same isolation a signed-in user gets, without needing that user's password.
 *
 * It implements only the query surface the server code uses. For testing; never imported by the app.
 */
import fs from 'node:fs';
import pg from 'pg';

let pool: pg.Pool | null = null;
const getPool = () => (pool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL, max: 4,
  ssl: process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') } : true,
}));
export const closeSim = async () => { await pool?.end(); pool = null; };

const jsonCols = new Map<string, Set<string>>();
async function jsonColumns(table: string): Promise<Set<string>> {
  if (!jsonCols.has(table)) {
    const { rows } = await getPool().query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and data_type in ('jsonb','json')", [table]);
    jsonCols.set(table, new Set(rows.map((r) => r.column_name)));
  }
  return jsonCols.get(table)!;
}

type Err = { message: string; code?: string } | null;
const q = (id: string) => `"${id.replace(/"/g, '')}"`;

/** Run one statement as the user. */
async function asUser<T>(uid: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    await c.query('begin');
    await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', 'authenticated', true)", [JSON.stringify({ sub: uid, role: 'authenticated' }), uid]);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

class Q implements PromiseLike<{ data: any; error: Err; count?: number | null }> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private cols = '*';
  private countOpt: { head?: boolean } | null = null;
  private where: Array<(p: any[]) => string> = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private payload: any = null;
  private onConflict: string | null = null;
  private ignoreDup = false;
  private wantsReturn = false;

  constructor(private uid: string, private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.cols = cols; else { this.wantsReturn = true; this.cols = cols; }
    if (opts?.count) this.countOpt = { head: opts.head };
    return this;
  }
  insert(rows: any) { this.op = 'insert'; this.payload = rows; return this; }
  upsert(rows: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = 'upsert'; this.payload = rows; this.onConflict = opts?.onConflict ?? null; this.ignoreDup = !!opts?.ignoreDuplicates; return this; }
  update(row: any) { this.op = 'update'; this.payload = row; return this; }
  delete() { this.op = 'delete'; return this; }

  private add(col: string, sql: string, val?: any, hasVal = true) { this.where.push((p) => { if (hasVal) { p.push(val); return `${q(col)} ${sql.replace('$$', `$${p.length}`)}`; } return `${q(col)} ${sql}`; }); return this; }
  eq(c: string, v: any) { return this.add(c, '= $$', v); }
  neq(c: string, v: any) { return this.add(c, '<> $$', v); }
  gt(c: string, v: any) { return this.add(c, '> $$', v); }
  gte(c: string, v: any) { return this.add(c, '>= $$', v); }
  lt(c: string, v: any) { return this.add(c, '< $$', v); }
  lte(c: string, v: any) { return this.add(c, '<= $$', v); }
  ilike(c: string, v: string) { return this.add(c, 'ilike $$', v); }
  in(c: string, vs: any[]) { return this.add(c, '= any($$)', vs); }
  is(c: string, v: null | boolean) { return this.add(c, v === null ? 'is null' : v ? 'is true' : 'is false', undefined, false); }
  not(c: string, op: string, v: any) {
    if (op === 'is') return this.add(c, v === null ? 'is not null' : `is not ${v}`, undefined, false);
    const map: Record<string, string> = { eq: '<>', neq: '=', gt: '<=', gte: '<', lt: '>=', lte: '>' };
    return this.add(c, `${map[op] ?? '<>'} $$`, v);
  }
  or(spec: string) {
    this.where.push((p) => '(' + splitTop(spec).map((part) => {
      const [col, op, ...rest] = part.split('.'); const val = rest.join('.');
      const sym: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
      if (op === 'is') return `${q(col)} is ${val}`;
      p.push(val === 'true' ? true : val === 'false' ? false : val);
      return `${q(col)} ${sym[op]} $${p.length}`;
    }).join(' or ') + ')');
    return this;
  }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push(`${q(col)} ${o?.ascending === false ? 'desc' : 'asc'}${o?.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'}`); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private async run() {
    const params: any[] = [];
    const jc = await jsonColumns(this.table);
    const whereSql = () => (this.where.length ? ' where ' + this.where.map((w) => w(params)).join(' and ') : '');
    const embeds: Array<{ alias: string; table: string; cols: string }> = [];
    const plain: string[] = [];
    for (const part of this.cols === '*' ? ['*'] : splitTop(this.cols)) {
      const m = part.match(/^(\w+):(\w+)\((.*)\)$/) ?? part.match(/^()(\w+)\((.*)\)$/);
      if (m) embeds.push({ alias: m[1] || m[2], table: m[2], cols: m[3] }); else plain.push(part);
    }
    const sel = plain.length || !embeds.length ? plain.map((c) => (c === '*' ? '*' : q(c))).join(', ') : '*';
    const proj = this.cols === '*' ? '*' : `${sel}${embeds.length ? ', *' : ''}`;

    const norm = (row: any) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, jc.has(k) || v === null || typeof v !== 'object' || v instanceof Date || Array.isArray(v) ? v : JSON.stringify(v)]));
    const ser = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, jc.has(k) && v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));

    return asUser(this.uid, async (c) => {
      let res: pg.QueryResult;
      if (this.op === 'select') {
        if (this.countOpt?.head) { res = await c.query(`select count(*)::int as n from public.${q(this.table)}${whereSql()}`, params); return { rows: [], count: res.rows[0].n }; }
        const sql = `select ${proj} from public.${q(this.table)}${whereSql()}${this.orders.length ? ' order by ' + this.orders.join(', ') : ''}${this.lim ? ` limit ${this.lim}` : ''}`;
        res = await c.query(sql, params);
      } else if (this.op === 'insert' || this.op === 'upsert') {
        const rows = ser(Array.isArray(this.payload) ? this.payload : [this.payload]);
        if (!rows.length) return { rows: [] };
        const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        const vals = rows.map((r) => '(' + cols.map((k) => { params.push(r[k] === undefined ? null : r[k]); return `$${params.length}`; }).join(', ') + ')').join(', ');
        let tail = '';
        if (this.op === 'upsert') {
          const conflict = (this.onConflict ?? 'id').split(',').map((s) => q(s.trim())).join(', ');
          tail = this.ignoreDup ? ` on conflict (${conflict}) do nothing` : ` on conflict (${conflict}) do update set ${cols.map((k) => `${q(k)} = excluded.${q(k)}`).join(', ')}`;
        }
        res = await c.query(`insert into public.${q(this.table)} (${cols.map(q).join(', ')}) values ${vals}${tail} returning *`, params);
      } else if (this.op === 'update') {
        const row = ser([this.payload])[0];
        const sets = Object.keys(row).map((k) => { params.push(row[k]); return `${q(k)} = $${params.length}`; });
        res = await c.query(`update public.${q(this.table)} set ${sets.join(', ')}${whereSql()} returning *`, params);
      } else {
        res = await c.query(`delete from public.${q(this.table)}${whereSql()} returning *`, params);
      }
      let rows = res.rows;
      // embedded relations: one extra query each, matched on the conventional foreign key
      for (const e of embeds) {
        const fk = e.table === 'organizations' ? 'org_id' : `${e.table.replace(/s$/, '')}_id`;
        const ids = [...new Set(rows.map((r) => r[fk]).filter(Boolean))];
        const sub = ids.length ? (await c.query(`select ${e.cols === '*' ? '*' : e.cols.split(',').map((x) => q(x.trim())).join(', ')}, id as __id from public.${q(e.table)} where id = any($1)`, [ids])).rows : [];
        rows = rows.map((r) => ({ ...r, [e.alias]: sub.find((s) => s.__id === r[fk]) ? (({ __id, ...rest }) => rest)(sub.find((s) => s.__id === r[fk])) : null }));
      }
      // return only the requested columns when a list was given
      if (this.cols !== '*' && plain.length && !plain.includes('*')) {
        const keep = new Set([...plain.map((p) => p.replace(/^.*:/, '')), ...embeds.map((e) => e.alias)]);
        rows = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))));
      }
      return { rows };
    }).then(({ rows, count }: any) => {
      const mutating = this.op !== 'select';
      if (mutating && !this.wantsReturn) return { data: null, error: null as Err };
      if (this.mode === 'single') return rows.length === 1 ? { data: rows[0], error: null as Err } : { data: null, error: { message: `Expected one row, got ${rows.length}`, code: 'PGRST116' } as Err };
      if (this.mode === 'maybe') return rows.length > 1 ? { data: null, error: { message: 'More than one row', code: 'PGRST116' } as Err } : { data: rows[0] ?? null, error: null as Err };
      return { data: rows, error: null as Err, count: count ?? null };
    }).catch((e: any) => ({ data: null, error: { message: e.message, code: e.code } as Err }));
  }

  then<R1, R2>(ok?: (v: any) => R1 | PromiseLike<R1>, bad?: (e: any) => R2 | PromiseLike<R2>) { return this.run().then(ok, bad); }
}

export interface SimClient {
  from(table: string): Q;
  rpc(fn: string, args?: Record<string, any>): Promise<{ data: any; error: Err }>;
  storage: { from: (b: string) => any };
  auth: { getUser: () => Promise<any> };
}

/** A client that acts as this user id. RLS applies, so it sees and may change only what the user's memberships allow. */
export function simClient(uid: string): SimClient {
  return {
    from: (table) => new Q(uid, table),
    async rpc(fn, args = {}) {
      try {
        return await asUser(uid, async (c) => {
          const meta = (await c.query("select p.proretset from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1 limit 1", [fn])).rows[0];
          const keys = Object.keys(args);
          const call = `select * from public.${q(fn)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(', ')})`;
          const res = await c.query(call, keys.map((k) => (args[k] !== null && typeof args[k] === 'object' && !Array.isArray(args[k]) ? JSON.stringify(args[k]) : args[k])));
          if (meta?.proretset) return { data: res.rows, error: null };
          const row = res.rows[0];
          const scalar = row && Object.keys(row).length === 1 && Object.keys(row)[0] === fn ? row[fn] : row;
          return { data: scalar ?? null, error: null };
        });
      } catch (e: any) { return { data: null, error: { message: e.message, code: e.code } }; }
    },
    storage: { from: () => { throw new Error('storage is not simulated'); } },
    auth: { getUser: async () => ({ data: { user: { id: uid } }, error: null }) },
  };
}
