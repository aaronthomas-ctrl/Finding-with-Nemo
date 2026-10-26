import 'dotenv/config';
import { predictForClient } from '../server/predict';

const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const tables: Record<string, any> = {
  clients: { id: 'c1', name: 'Green Sprout Cafe', category: 'Cafe', tier: 1, tags: ['plant-based'], region: 'Dubai' },
  business_profiles: { summary: 'Supplies oat milk and coffee equipment to cafes.', config: { product_lines: ['Oat milk', 'Espresso machines'] } },
  organizations: { id: 'o', name: 'Bean & Co', kind: 'business', country: 'UAE' },
  enquiries: [{ received_at: d(120), details: 'Oat milk', metadata: { productLine: 'Oat milk' } }, { received_at: d(90), details: 'Oat milk', metadata: { productLine: 'Oat milk' } }, { received_at: d(60), details: 'Oat milk', metadata: { productLine: 'Oat milk' } }, { received_at: d(30), details: 'Oat milk', metadata: { productLine: 'Oat milk' } }],
  project_participants: [{ role: 'owner', project: { id: 'p1', name: 'Marina second branch', stage: 'construction', starts_on: null, ends_on: '2027-01-15', description: 'Second branch opening in January 2027', site: 'Marina Walk' } }],
  tag_definitions: [],
};
const sb: any = {
  from: (t: string) => { const data = tables[t] ?? null; const c: any = new Proxy({}, { get: (_x, p) => p === 'then' ? (f: any) => f({ data, error: null }) : p === 'maybeSingle' || p === 'single' ? async () => ({ data: Array.isArray(data) ? data[0] : data, error: null }) : () => c }); return c; },
  rpc: async (fn: string) => fn === 'match_memories' ? ({ data: [], error: null }) : ({ data: null, error: null }),
};
const preds = await predictForClient({ sb, orgId: 'o', user: { id: 'u' } } as any, 'c1');
console.log(JSON.stringify(preds, null, 1));
