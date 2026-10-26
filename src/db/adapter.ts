import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch, getActiveOrgId } from '../lib/api';

/**
 * Org-scoped data layer. The screens still talk to `db.clients.toArray()` and friends,
 * but every row now carries org_id, typed columns come from the new schema, and any extra
 * UI-only field is kept in a `metadata` jsonb column. Phone, email and contacts are encrypted
 * by the server (see /api/pii/*) before they reach the database.
 */

const snake = (k: string) => k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
const orgId = () => {
  const id = getActiveOrgId();
  if (!id) throw new Error('No active organisation');
  return id;
};

// ---- encryption helpers (server holds the key) ----
const opened = new Map<string, string | null>();
async function openAll(sealed: Array<string | null | undefined>): Promise<void> {
  const todo = [...new Set(sealed.filter((s): s is string => !!s && !opened.has(s)))];
  if (!todo.length) return;
  for (let i = 0; i < todo.length; i += 400) {
    const chunk = todo.slice(i, i + 400);
    const res = await apiFetch('/api/pii/open', { method: 'POST', body: JSON.stringify({ items: chunk }) });
    const { opened: out } = await res.json();
    chunk.forEach((c, j) => opened.set(c, out?.[j] ?? null));
  }
}
async function sealValues(values: Record<string, string | null | undefined>): Promise<Record<string, string | null>> {
  const entries = Object.entries(values).filter(([, v]) => typeof v === 'string' && v !== '');
  const out: Record<string, string | null> = {};
  if (!entries.length) return out;
  const res = await apiFetch('/api/pii/seal', { method: 'POST', body: JSON.stringify({ values: Object.fromEntries(entries) }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not encrypt');
  Object.assign(out, data.sealed);
  for (const [k, sealed] of Object.entries<string | null>(data.sealed)) if (sealed) opened.set(sealed, values[k] as string);
  return out;
}

// ---- table specs ----
interface Spec {
  table: string;
  cols: string[];
  rename?: Record<string, string>; // legacy camelCase key -> db column
  dates?: string[]; // db columns returned as Date
  meta?: boolean;
  toRow?: (item: any, row: any, meta: any) => Promise<void> | void;
  fromRow?: (row: any, out: any) => void;
  /** column to filter by when the legacy code looks a row up by id */
  idCol?: string;
}

const clientCols = ['id', 'owner_id', 'name', 'normalized_name', 'place_id', 'address', 'region', 'lat', 'lng', 'geo_source',
  'places_fetched_at', 'website', 'phone_enc', 'email_enc', 'category', 'tags', 'tier', 'status', 'is_watch', 'territory_status',
  'next_follow_up', 'last_contacted_at', 'retry_flag', 'metadata', 'created_at', 'updated_at'];

const INTERACTION_KINDS = ['call', 'visit', 'email', 'message', 'note', 'voice_note'];
const kindFor = (channel: string) => {
  const c = String(channel || '').toLowerCase();
  if (INTERACTION_KINDS.includes(c)) return c;
  if (/call|phone/.test(c)) return 'call';
  if (/visit|meeting|site/.test(c)) return 'visit';
  if (/mail/.test(c)) return 'email';
  if (/whatsapp|sms|linkedin|message|chat/.test(c)) return 'message';
  return 'note';
};

const SPECS: Record<string, Spec> = {
  clients: {
    table: 'clients', cols: clientCols, meta: true,
    rename: { nextFollowUpDate: 'next_follow_up', phone: 'phone_enc', email: 'email_enc' },
    dates: ['created_at', 'updated_at', 'next_follow_up', 'last_contacted_at', 'places_fetched_at'],
    async toRow(item, row, meta) {
      const sealed = await sealValues({ phone: item.phone, email: item.email });
      if ('phone' in item) row.phone_enc = sealed.phone ?? null;
      if ('email' in item) row.email_enc = sealed.email ?? null;
      if (Array.isArray(item.contacts)) {
        const s = await sealValues({ c: JSON.stringify(item.contacts) });
        meta.contacts_enc = s.c ?? null;
        delete meta.contacts;
      }
      if (item.tier1) {
        row.is_watch = !!item.tier1.isWatch;
        row.territory_status = item.tier1.territoryStatus ?? null;
        if (item.tier1.region) row.region = item.tier1.region;
        const { isWatch, territoryStatus, region, ...rest } = item.tier1;
        meta.keyAccount = rest;
        delete meta.tier1;
      }
      if (item.name) row.normalized_name = String(item.name).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
      // Places-sourced coordinates must be refreshed or cleared within 30 days; Geocoding results may be kept.
      if (row.lat != null && row.lng != null && !row.geo_source) {
        row.geo_source = 'places';
        row.places_fetched_at = new Date().toISOString();
      }
      for (const k of ['nameNormalized', 'googleMapsUri', 'google_maps_link']) delete meta[k];
    },
    fromRow(row, out) {
      out.phone = row.phone_enc ? opened.get(row.phone_enc) ?? '' : '';
      out.email = row.email_enc ? opened.get(row.email_enc) ?? '' : '';
      const enc = row.metadata?.contacts_enc;
      try { out.contacts = enc && opened.get(enc) ? JSON.parse(opened.get(enc)!) : []; } catch { out.contacts = []; }
      out.nextFollowUpDate = row.next_follow_up ? new Date(row.next_follow_up) : null;
      out.tags ??= [];
      out.restrictedBrands ??= [];
      out.targetBrands ??= [];
      if (row.is_watch || row.tier === 1) {
        out.tier1 = { isWatch: !!row.is_watch, region: row.region || '', territoryStatus: row.territory_status || 'Open', ...(row.metadata?.keyAccount || {}) };
      }
      delete out.phoneEnc; delete out.emailEnc; delete out.nextFollowUp;
    },
  },
  leads: {
    table: 'leads', meta: true, cols: ['id', 'client_id', 'product_id', 'owner_id', 'title', 'value', 'currency', 'stage', 'created_at', 'metadata'],
    rename: { note: 'title', estValue: 'value', date: 'created_at' }, dates: ['created_at'],
    toRow(_i, row) { row.title ||= 'Lead'; },
    fromRow(row, out) { out.note = row.title; out.estValue = row.value == null ? null : Number(row.value); out.date = new Date(row.created_at); },
  },
  enquiries: {
    table: 'enquiries', meta: true, cols: ['id', 'client_id', 'lead_id', 'product_id', 'details', 'quantity', 'status', 'received_at', 'metadata'],
    rename: { itemDescription: 'details', date: 'received_at' }, dates: ['received_at'],
    fromRow(row, out) { out.itemDescription = row.details; out.date = new Date(row.received_at); out.quantity = row.quantity == null ? 0 : Number(row.quantity); out.outcome ??= row.status; },
  },
  interactions: {
    table: 'interactions', meta: true, cols: ['id', 'client_id', 'contact_id', 'user_id', 'kind', 'summary', 'voice_note_id', 'occurred_at', 'metadata'],
    rename: { timestamp: 'occurred_at', channel: 'kind' }, dates: ['occurred_at'],
    toRow(item, row, meta) { if (item.channel) { row.kind = kindFor(item.channel); meta.channel = item.channel; } },
    fromRow(row, out) { out.timestamp = new Date(row.occurred_at); out.channel = row.metadata?.channel ?? row.kind; },
  },
  campaigns: {
    table: 'campaigns', meta: true, cols: ['id', 'name', 'product_id', 'brand_id', 'starts_on', 'ends_on', 'status', 'pitch', 'created_at', 'metadata'],
    rename: { title: 'name', validFrom: 'starts_on', validTo: 'ends_on', offerDetails: 'pitch' }, dates: ['created_at', 'starts_on', 'ends_on'],
    fromRow(row, out) { out.title = row.name; out.validFrom = row.starts_on ? new Date(row.starts_on) : null; out.validTo = row.ends_on ? new Date(row.ends_on) : null; out.offerDetails = row.pitch ?? ''; out.productLines ??= []; out.targetClientIds ??= []; out.perClientState ??= {}; },
  },
  campaign_targets: {
    table: 'campaign_targets', meta: true, cols: ['campaign_id', 'client_id', 'status', 'metadata'], rename: { state: 'status' }, idCol: 'metadata->>id',
    toRow(item, _row, meta) { if (item.id) meta.id = item.id; },
    fromRow(row, out) { out.state = row.status; out.id = row.metadata?.id ?? `${row.campaign_id}:${row.client_id}`; },
  },
  brands: {
    table: 'brands', meta: true, cols: ['id', 'name', 'is_own', 'created_at', 'metadata'], rename: { brandName: 'name' }, dates: ['created_at'],
    fromRow(row, out) { out.brandName = row.name; },
  },
  products: {
    table: 'products', meta: true, cols: ['id', 'name', 'line', 'description', 'created_at', 'metadata'], rename: { productName: 'name', productCategory: 'line' }, dates: ['created_at'],
    fromRow(row, out) { out.productName = row.name; out.productCategory = row.line; },
  },
  search_zones: {
    table: 'search_zones', meta: true, cols: ['id', 'name', 'tags', 'geometry', 'created_by', 'created_at', 'metadata'], dates: ['created_at'],
    toRow(item, row) {
      if (Array.isArray(item.path)) row.geometry = { type: 'polygon', path: item.path };
      if (typeof item.name === 'string' && item.name.includes('|||')) {
        const [n, t] = item.name.split('|||');
        row.name = n.trim();
        row.tags = t.split(',').map((x: string) => x.trim()).filter(Boolean);
      }
    },
    // Callers still see "Name ||| tag1,tag2"; the database keeps name and tags in separate columns.
    fromRow(row, out) {
      out.path = row.geometry?.path ?? [];
      out.name = row.tags?.length ? `${row.name} ||| ${row.tags.join(',')}` : row.name;
    },
  },
};

const DB_TO_LEGACY: Record<string, Record<string, string>> = {};
for (const [k, s] of Object.entries(SPECS)) {
  DB_TO_LEGACY[k] = {};
  for (const [legacy, col] of Object.entries(s.rename ?? {})) DB_TO_LEGACY[k][col] = legacy;
}

const isoDate = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

async function toRow(spec: Spec, item: any, forUpdate: boolean) {
  const row: any = {};
  const meta: any = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || k === 'orgId') continue;
    if (k === 'metadata' && v && typeof v === 'object') { Object.assign(meta, v); continue; }
    const col = spec.rename?.[k] ?? snake(k);
    if (spec.cols.includes(col) && col !== 'metadata') row[col] = isoDate(v);
    else if (spec.meta) meta[k] = v instanceof Date ? v.toISOString() : v;
  }
  if (spec.toRow) await spec.toRow(item, row, meta);
  if (!forUpdate) row.org_id = orgId();
  if (spec.meta && Object.keys(meta).length) row.metadata = meta;
  // keep only real columns
  for (const k of Object.keys(row)) if (k !== 'org_id' && !spec.cols.includes(k)) delete row[k];
  return row;
}

function fromRow(key: string, spec: Spec, row: any) {
  const out: any = {};
  for (const [col, val] of Object.entries<any>(row)) {
    if (col === 'org_id') continue;
    const name = DB_TO_LEGACY[key][col] ?? camel(col);
    out[name] = spec.dates?.includes(col) ? (val ? new Date(val) : null) : val;
  }
  if (row.metadata && typeof row.metadata === 'object') {
    for (const [mk, mv] of Object.entries(row.metadata)) if (!(mk in out)) out[mk] = mv;
  }
  spec.fromRow?.(row, out);
  return out;
}

async function hydrate(key: string, rows: any[]) {
  if (key === 'clients') {
    await openAll(rows.flatMap((r) => [r.phone_enc, r.email_enc, r.metadata?.contacts_enc]));
  }
  return rows.map((r) => fromRow(key, SPECS[key], r));
}

class Collection implements PromiseLike<any> {
  private eq: Array<{ field: string; val: any }> = [];
  private sort: { field: string; asc: boolean } | null = null;
  private clientFn: ((x: any) => boolean) | null = null;
  constructor(private key: string, field?: string) { if (field) this.eq.push({ field, val: undefined }); }
  equals(val: any) { this.eq[this.eq.length - 1].val = val; return this; }
  reverse() { this.sort = { field: this.sort?.field ?? '', asc: false }; return this; }
  sortBy(field: string) { this.sort = { field, asc: this.sort ? this.sort.asc : true }; return this; }
  filter(fn: (x: any) => boolean) { this.clientFn = fn; return this; }
  private col(field: string) { const s = SPECS[this.key]; return s.rename?.[field] ?? snake(field); }
  async toArray() {
    const spec = SPECS[this.key];
    let q: any = supabase.from(spec.table).select('*').eq('org_id', orgId());
    for (const f of this.eq) q = q.eq(this.col(f.field), f.val);
    if (this.sort?.field) q = q.order(this.col(this.sort.field), { ascending: this.sort.asc });
    const { data, error } = await q;
    if (error) throw new Error(`Supabase error: ${error.message}`);
    let rows = await hydrate(this.key, data || []);
    if (!this.sort?.field && this.sort && !this.sort.asc) rows = rows.reverse();
    return this.clientFn ? rows.filter(this.clientFn) : rows;
  }
  then(a?: any, b?: any): any { return this.toArray().then(a, b); }
}

class TableAdapter {
  constructor(private key: string) {}
  private get spec() { return SPECS[this.key]; }
  private idFilter(q: any, id: string) { return q.eq(this.spec.idCol ?? 'id', id); }

  async add(item: any) { await this.bulkAdd([item]); }
  async bulkAdd(items: any[]) {
    if (!items.length) return;
    const rows = await Promise.all(items.map((i) => toRow(this.spec, i, false)));
    const { error } = await supabase.from(this.spec.table).insert(rows);
    if (error) throw new Error(`Could not save to ${this.key}: ${error.message}`);
  }
  async put(item: any) {
    const row = await toRow(this.spec, item, false);
    const { error } = await supabase.from(this.spec.table).upsert(row);
    if (error) throw new Error(`Could not save to ${this.key}: ${error.message}`);
  }
  async update(id: string, changes: any) {
    const row = await toRow(this.spec, changes, true);
    if (this.spec.meta && row.metadata) {
      // merge, so a partial change never drops other metadata keys
      const { data } = await this.idFilter(supabase.from(this.spec.table).select('metadata').eq('org_id', orgId()), id).maybeSingle();
      row.metadata = { ...(data?.metadata ?? {}), ...row.metadata };
    }
    if (!Object.keys(row).length) return;
    const { error } = await this.idFilter(supabase.from(this.spec.table).update(row).eq('org_id', orgId()), id);
    if (error) throw new Error(`Could not update ${this.key}: ${error.message}`);
  }
  async delete(id: string) {
    const { error } = await this.idFilter(supabase.from(this.spec.table).delete().eq('org_id', orgId()), id);
    if (error) throw new Error(`Could not delete from ${this.key}: ${error.message}`);
  }
  async get(id: string) {
    const { data, error } = await this.idFilter(supabase.from(this.spec.table).select('*').eq('org_id', orgId()), id).maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data ? (await hydrate(this.key, [data]))[0] : undefined;
  }
  async toArray() { return new Collection(this.key).toArray(); }
  where(field: string) { return new Collection(this.key, field); }
  orderBy(field: string) { return new Collection(this.key).sortBy(field); }
  filter(fn: (x: any) => boolean) { return new Collection(this.key).filter(fn); }
  async count() {
    const { count, error } = await supabase.from(this.spec.table).select('*', { count: 'exact', head: true }).eq('org_id', orgId());
    if (error) throw new Error(error.message);
    return count || 0;
  }
  async clear() {
    const { error } = await supabase.from(this.spec.table).delete().eq('org_id', orgId());
    if (error) throw new Error(error.message);
  }
}

// ---- settings live in business_profiles.config ----
export const DEFAULT_TEMPLATES = (() => {
  const ch = {
    WhatsApp: 'Hi {contact_name}, this is {salesman_name}. I wanted to reach out about {company}.',
    EmailSubject: 'Quick hello for {company}',
    EmailBody: 'Hi {contact_name},\n\nI wanted to reach out regarding {company}.\n\nBest,\n{salesman_name}',
    LinkedIn: "Hi {contact_name}, I'd like to connect. I work with companies like {company}.",
  };
  return { firstOutreach: { ...ch }, followUp: { ...ch }, campaign: { ...ch } };
})();

class SettingsAdapter {
  private async load() {
    const { data, error } = await supabase.from('business_profiles').select('config').eq('org_id', orgId()).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.config ?? {}) as any;
  }
  private shape(cfg: any) {
    return {
      id: 'default',
      cadenceDays: { 1: 7, 2: 14, 3: 30, 4: 60, ...(cfg.cadence_days ?? {}) },
      distributedBrands: cfg.product_lines ?? [],
      templates: cfg.templates ?? DEFAULT_TEMPLATES,
    };
  }
  async get(_id?: string) { return this.shape(await this.load()); }
  async toArray() { return [await this.get()]; }
  async put(s: any) { await this.update('default', s); }
  async update(_id: string, s: any) {
    const cfg = await this.load();
    if (s.cadenceDays) cfg.cadence_days = s.cadenceDays;
    if (s.distributedBrands) cfg.product_lines = s.distributedBrands;
    if (s.templates) cfg.templates = s.templates;
    const { error } = await supabase.from('business_profiles').update({ config: cfg }).eq('org_id', orgId());
    if (error) throw new Error(`Could not save settings: ${error.message}`);
  }
}

// ---- web research history is cached on the client row ----
class SearchResultsAdapter {
  async add(item: any) {
    const { clientId, ...rest } = item;
    await new TableAdapter('clients').update(clientId, { metadata: { googleSearchResults: { ...rest, fetchedAt: rest.searchedAt } } });
  }
  where(_field: string) {
    let val: any;
    const c: any = {
      equals: (v: any) => { val = v; return c; },
      reverse: () => c, sortBy: () => c,
      toArray: async () => {
        const row = await new TableAdapter('clients').get(val);
        const g = row?.googleSearchResults;
        return g ? [{ ...g, clientId: val, companyName: row.name, searchedAt: g.fetchedAt }] : [];
      },
      then: (a?: any, b?: any) => c.toArray().then(a, b),
    };
    return c;
  }
  async toArray() { return []; }
}

/** Tables from the earlier prototype that no longer exist. Kept inert so leftover callers do not crash. */
class InertAdapter {
  async add() {} async bulkAdd() {} async put() {} async update() {} async delete() {} async clear() {}
  async get() { return undefined; } async toArray() { return []; } async count() { return 0; }
  where() { const c: any = { equals: () => c, reverse: () => c, sortBy: () => c, toArray: async () => [], then: (a?: any) => Promise.resolve([]).then(a) }; return c; }
  orderBy() { return this.where(); } filter() { return this.where(); }
}

export const db = {
  clients: new TableAdapter('clients') as any,
  leads: new TableAdapter('leads') as any,
  enquiries: new TableAdapter('enquiries') as any,
  interactions: new TableAdapter('interactions') as any,
  campaigns: new TableAdapter('campaigns') as any,
  campaignTargets: new TableAdapter('campaign_targets') as any,
  brands: new TableAdapter('brands') as any,
  productProfiles: new TableAdapter('products') as any,
  products: new TableAdapter('products') as any,
  searchZones: new TableAdapter('search_zones') as any,
  settings: new SettingsAdapter() as any,
  clientSearchResults: new SearchResultsAdapter() as any,
  campaignCreatives: new InertAdapter() as any,
  activityEvents: new InertAdapter() as any,
  on: (evt: string, cb: any) => { if (evt === 'ready') setTimeout(cb, 0); },
  open: () => Promise.resolve(),
};

export function useLiveQuery(queryFn: () => Promise<any>, deps: any[] = []): any {
  const [data, setData] = useState<any>(undefined);
  useEffect(() => {
    let mounted = true;
    queryFn().then((res) => { if (mounted) setData(res); }).catch((err) => console.error('useLiveQuery error:', err));
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}
