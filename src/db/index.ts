import { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';
export { supabase };

export interface Client {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  website: string;
  backgroundBlurb: string;
  category: string;
  tier: 1 | 2 | 3 | 4;
  status: string;
  whatTheyDo: string;
  tags?: string[];
  sourceTags?: string[];
  googleMapsLink?: string;
  googleSearchResults?: {
    summary: string;
    sources: Array<{ title: string; uri: string; domain?: string; snippet?: string }>;
    searchQueries?: string[];
    fetchedAt: string;
    groundedWith?: string;
    quotaNotice?: boolean;
  };
  contacts: { name: string; role: string; mobile: string; email: string; }[];
  nextFollowUpDate: Date | null;
  retryFlag: boolean;
  autoTagged?: boolean;
  
  metadata?: Record<string, any>;
  tier1?: {
    isWatch: boolean;
    emirate: string;
    primarySiteAddress: string;
    justification: string;
    allocationStatus: string;
    allocatedTo: string;
    allocatedProductLines: string[];
  };
  restrictedBrands?: string[];
  targetBrands?: string[];
  createdAt: Date;
  updatedAt: Date;
}
export interface Lead {
  id: string;
  clientId: string;
  date: Date;
  note: string;
  productLine: string;
  estValue: number | null;
  stage?: string;
  linkedCampaignId?: string;
  linkedProductIds?: string[];
  brandId?: string;

}
export interface Enquiry {
  id: string;
  clientId: string;
  date: Date;
  productLine: string;
  itemDescription: string;
  quantity: number;
  department: string;
  outcome: string;
}
export interface Interaction {
  id: string;
  clientId: string;
  timestamp: Date;
  channel: string;
  summary: string;
}
export interface Campaign {
  id: string;
  title: string;
  description: string;
  productLines: string[];
  offerDetails: string;
  validFrom: Date;
  validTo: Date;
  targetClientIds: string[];
  perClientState: Record<string, string>;
}
export interface TemplateChannels {
  WhatsApp: string;
  EmailSubject: string;
  EmailBody: string;
  LinkedIn: string;
}

export interface Brand {
  id: string;
  brandName: string;
  brandLogo: string;
  brandDescription: string;
  brandWebsite: string;
  productCategories: string[];
}

export interface ProductProfile {
  id: string;
  brandId: string;
  productCategory: string;
  productName: string;
  productType: string;
  factSheetFile: string;
  extractedSpecs: string;
  productImages: string[];
  linkedConsumables: string[];
  tags: string[];
}


export interface CampaignTarget {
  id: string;
  campaignId: string;
  campaignCreativeId?: string;
  clientId: string;
  state: string;
  sentAt?: Date;
  respondedAt?: Date;
  convertedAt?: Date;
  responseDeadline?: Date;
}

export interface CampaignCreative {
  id: string;
  brandId: string;
  title: string;
  linkedProductIds: string[];
  htmlFile: string;
  bodyTextVariant: string;
  subjectLine: string;
  imageHostingUrls: string[];
  status: string; // DRAFT | ACTIVE | ARCHIVED
}

export interface ActivityEvent {
  id: string;
  eventType: string; // CUSTOMER_VIEWED | BRAND_VIEWED | PRODUCT_PROFILE_VIEWED | CATEGORY_SEARCHED | CAMPAIGN_VIEWED
  clientId?: string;
  brandId?: string;
  productId?: string;
  category?: string;
  timestamp: Date;
  user: string;
}

export interface Settings {
  id: string; 
  cadenceDays: { 1: number; 2: number; 3: number; 4: number };
  distributedBrands?: string[];
  templates: {
    firstOutreach: TemplateChannels;
    followUp: TemplateChannels;
    campaign: TemplateChannels;
  };
}
export interface Tier1Employee {
  id: string;
  clientId: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  linkedin: string;
  processNotes: string;
  avgReplyTime: string;
  preferredChannel: string;
}
export interface Tier1Opportunity {
  id: string;
  clientId: string;
  stage: string;
  value: number | null;
  productLine: string;
  ownerEmployeeId: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Tier1StageTransition {
  id: string;
  opportunityId: string;
  stage: string;
  date: Date;
  employeeId: string;
}
export interface Tier1Project {
  id: string;
  clientId: string;
  name: string;
  location: string;
  clientRole: string;
  status: string;
  relevance: string;
  sourceLink: string;
  createdAt: Date;
}
export interface ClientSearchResult {
  id?: string;
  clientId: string;
  companyName: string;
  summary: string;
  sources: Array<{ title: string; uri: string; domain?: string; snippet?: string }>;
  searchQueries?: string[];
  groundedWith?: string;
  searchedAt?: string | Date;
  createdAt?: string | Date;
}

export const PRODUCT_LINES = [
  "ESAB Machines", "ESAB Consumables", "EWM Machines", "Callington", "CNC/Automated", "AMC/Service", "Grindex", "SPX", "Victor"
];

function toCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj && typeof obj === 'object') {
    const newObj: any = {};
    for (const k in obj) {
      if (k === 'created_at') newObj.createdAt = new Date(obj[k]);
      else if (k === 'updated_at') newObj.updatedAt = new Date(obj[k]);
      else if (k === 'searched_at') newObj.searchedAt = obj[k] ? new Date(obj[k]) : null;
      else if (k === 'next_follow_up_date') newObj.nextFollowUpDate = obj[k] ? new Date(obj[k]) : null;
      else if (k === 'timestamp') newObj.timestamp = new Date(obj[k]);
      else if (k === 'occurred_at') newObj.timestamp = new Date(obj[k]);
      else if (k === 'date') newObj.date = new Date(obj[k]);
      else if (k === 'valid_from') newObj.validFrom = new Date(obj[k]);
      else if (k === 'valid_to') newObj.validTo = new Date(obj[k]);
      else if (k === 'client_id') newObj.clientId = obj[k];
      else if (k === 'company_name') newObj.companyName = obj[k];
      else if (k === 'search_queries') newObj.searchQueries = Array.isArray(obj[k]) ? obj[k] : [];
      else if (k === 'grounded_with') newObj.groundedWith = obj[k];
      else if (k === 'sources') newObj.sources = Array.isArray(obj[k]) ? obj[k] : [];
      else if (k.includes('_')) {
        const camelK = k.replace(/_([a-z])/g, (g:any) => g[1].toUpperCase());
        newObj[camelK] = toCamel(obj[k]);
      } else {
        newObj[k] = toCamel(obj[k]);
      }
    }
    // If it's a client, ensure these arrays exist to avoid UI crashes
    if (newObj.name !== undefined && newObj.status !== undefined) {
      if (!newObj.contacts) newObj.contacts = [];
      if (!newObj.tags) newObj.tags = [];
      if (!newObj.restrictedBrands) newObj.restrictedBrands = [];
      if (!newObj.targetBrands) newObj.targetBrands = [];
      if (!newObj.googleMapsLink && newObj.metadata) {
        newObj.googleMapsLink = newObj.metadata.googleMapsLink || newObj.metadata.googleMapsUri || newObj.metadata.google_maps_link;
      }
      if (!newObj.sourceTags && newObj.metadata?.sourceTags) {
        newObj.sourceTags = newObj.metadata.sourceTags;
      }
      if (!newObj.googleSearchResults && newObj.metadata?.googleSearchResults) {
        newObj.googleSearchResults = newObj.metadata.googleSearchResults;
      } else if (!newObj.googleSearchResults && (newObj as any).google_search_results) {
        newObj.googleSearchResults = (newObj as any).google_search_results;
      }
      if (newObj.tier === 1 && !newObj.tier1) {
        newObj.tier1 = {
          isWatch: false,
          emirate: '',
          primarySiteAddress: '',
          justification: '',
          allocationStatus: 'Open',
          allocatedTo: '',
          allocatedProductLines: []
        };
      }
    }
    return newObj;
  }
  return obj;
}

const CLIENT_VALID_COLUMNS = new Set([
  'id',
  'name',
  'address',
  'lat',
  'lng',
  'phone',
  'website',
  'background_blurb',
  'category',
  'tier',
  'status',
  'what_they_do',
  'contacts',
  'next_follow_up_date',
  'retry_flag',
  'tier1',
  'created_at',
  'updated_at',
  'tags',
  'restricted_brands',
  'auto_tagged',
  'metadata',
  'target_brands'
]);

function toSnake(obj: any, isClient: boolean = false, isCampaign: boolean = false): any {
  if (Array.isArray(obj)) return obj.map((o: any) => toSnake(o, isClient, isCampaign));
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const newObj: any = {};
    for (const k in obj) {
      if (isClient && ['nameNormalized', 'googleMapsLink', 'google_maps_link', 'googleMapsUri', 'sourceTags', 'source_tags', 'googleSearchResults', 'google_search_results'].includes(k)) {
        continue;
      }
      if (isCampaign && ['targetClientIds', 'perClientState'].includes(k)) {
        continue;
      }
      if (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp' || k === 'date' || k === 'validFrom' || k === 'validTo' || k === 'nextFollowUpDate' || k === 'searchedAt') {
        const snakeK = k.replace(/[A-Z]/g, (letter:any) => `_${letter.toLowerCase()}`);
        newObj[snakeK] = obj[k] ? new Date(obj[k]).toISOString() : null;
      } else {
        const snakeK = k.replace(/[A-Z]/g, (letter:any) => `_${letter.toLowerCase()}`);
        newObj[snakeK] = toSnake(obj[k], false, false); // Don't propagate to nested objects
      }
    }

    if (isClient) {
      // Validate category against clients_category_check constraint ('EPC Contractor', 'Steel Fabricator', etc.)
      const ALLOWED_CLIENT_CATEGORIES = new Set([
        'EPC Contractor',
        'Steel Fabricator',
        'Oilfield & Petrochemical Services',
        'Electromechanical/MEP',
        'Marine/Shipbuilding',
        'Welding Trade/Distributor',
        'Trader',
        'Other'
      ]);

      if (newObj.category && !ALLOWED_CLIENT_CATEGORIES.has(newObj.category)) {
        newObj.metadata = newObj.metadata || {};
        if (!newObj.metadata.originalCategory) {
          newObj.metadata.originalCategory = newObj.category;
        }
        newObj.category = 'Other';
      }

      // Safely preserve Google Maps Link, source tags & google search results in metadata JSONB without violating table schema
      const gLink = obj.googleMapsLink || obj.google_maps_link || obj.googleMapsUri || obj.metadata?.googleMapsLink || obj.metadata?.googleMapsUri;
      const sTags = obj.sourceTags || obj.source_tags || obj.metadata?.sourceTags;
      const gSearch = obj.googleSearchResults || obj.google_search_results || obj.metadata?.googleSearchResults;
      if (gLink || sTags || gSearch) {
        newObj.metadata = {
          ...(newObj.metadata || {}),
          ...(gLink ? { googleMapsLink: gLink, googleMapsUri: gLink } : {}),
          ...(sTags ? { sourceTags: sTags } : {}),
          ...(gSearch ? { googleSearchResults: gSearch } : {})
        };
      }

      // Ensure no non-existent columns are sent to Supabase clients table
      for (const key of Object.keys(newObj)) {
        if (!CLIENT_VALID_COLUMNS.has(key)) {
          if (newObj[key] !== undefined && key !== 'metadata') {
            newObj.metadata = newObj.metadata || {};
            newObj.metadata[key] = newObj[key];
          }
          delete newObj[key];
        }
      }
    }

    return newObj;
  }
  return obj;
}

const tableMap: Record<string, string> = {
  clients: 'clients',
  leads: 'leads',
  enquiries: 'enquiries',
  interactions: 'interactions',
  campaigns: 'campaigns',
  settings: 'settings',
  tier1Employees: 'tier1_employees',
  tier1Opportunities: 'tier1_opportunities',
  tier1StageTransitions: 'tier1_stage_transitions',
  tier1Projects: 'tier1_projects',
  clientSearchResults: 'client_search_results',
  client_search_results: 'client_search_results',
  search_zones: 'search_zones',
  searchZones: 'search_zones'
};

class Collection implements PromiseLike<any> {
  constructor(public tableName: string, public filters: any[] = []) {}
  
  equals(val: any) {
    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.val = val;
    return this;
  }

  reverse() {
    this.filters.push({ type: 'reverse' });
    return this;
  }
  
  sortBy(field: string) {
    this.filters.push({ type: 'sortBy', field });
    return this;
  }

  async toArray() {
    let query: any = supabase.from(this.tableName).select('*');
    
    let isReverse = false;
    let sortByField = '';

    for (const f of this.filters) {
      if (f.type === 'eq') {
        const sn = f.field.replace(/[A-Z]/g, (l:string) => `_${l.toLowerCase()}`);
        query = query.eq(sn, f.val);
      } else if (f.type === 'reverse') {
        isReverse = true;
      } else if (f.type === 'sortBy') {
        sortByField = f.field;
      }
    }

    if (sortByField) {
       const sn = sortByField.replace(/[A-Z]/g, (l:string) => `_${l.toLowerCase()}`);
       query = query.order(sn, { ascending: !isReverse });
    } else if (this.tableName === 'interactions') {
       query = query.order('timestamp', { ascending: !isReverse });
    } else if (this.tableName === 'enquiries') {
       query = query.order('date', { ascending: !isReverse });
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase error: ${error.message}`);
    
    let res = (data || []).map(toCamel);
    if (!sortByField && isReverse) {
      res = res.reverse();
    }
    return res;
  }

  then(onfulfilled?: any, onrejected?: any): any {
    return this.toArray().then(onfulfilled, onrejected);
  }
}

class TableAdapter {
  constructor(public name: string) {}

  get tableName() {
    return tableMap[this.name] || this.name;
  }

  async bulkAdd(items: any[]) {
    const data = items.map(item => toSnake(item, this.tableName === 'clients', this.tableName === 'campaigns'));
    const { error } = await supabase.from(this.tableName).insert(data);
    if (error) throw new Error(`Supabase error bulk inserting into ${this.name}: ${error.message}`);
  }

  async add(item: any) {
    const data = toSnake(item, this.tableName === 'clients', this.tableName === 'campaigns');
    const { error } = await supabase.from(this.tableName).insert(data);
    if (error) throw new Error(`Supabase error inserting into ${this.name}: ${error.message}`);
  }

  async put(item: any) {
    const data = toSnake(item, this.tableName === 'clients', this.tableName === 'campaigns');
    if (this.tableName === 'settings') {
      data.id = 1;
    }
    const { error } = await supabase.from(this.tableName).upsert(data);
    if (error) throw new Error(`Supabase error upserting into ${this.name}: ${error.message}`);
  }

  async delete(id: string) {
    const { error } = await supabase.from(this.tableName).delete().eq('id', id);
    if (error) throw new Error(`Supabase error deleting from ${this.name}: ${error.message}`);
  }

  async update(id: string, changes: any) {
    const data = toSnake(changes, this.tableName === 'clients', this.tableName === 'campaigns');
    if (this.tableName === 'settings' && id === 'default') {
      id = '1';
      if (data.id === 'default') data.id = 1;
    }
    const { error } = await supabase.from(this.tableName).update(data).eq('id', id);
    if (error) throw new Error(`Supabase error updating ${this.name}: ${error.message}`);
  }

  async get(id: string) {
    if (this.tableName === 'settings' && id === 'default') {
      id = '1';
    }
    const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw new Error(`Supabase error: ${error.message}`);
    
    // Auto-initialize settings if not found
    if (!data && this.tableName === 'settings' && id === '1') {
      const defaultChannels = {
        WhatsApp: "Hi {contact_name}, this is regarding {company}. We have some updates on {product_line}.",
        EmailSubject: "Updates for {company}",
        EmailBody: "Hi {contact_name},\\n\\nWe wanted to reach out regarding {company} and your interest in {product_line}.\\n\\nBest,\\nTeam",
        LinkedIn: "Hi {contact_name}, let's connect! I work with companies like {company}."
      };
      const defaultSettings = {
        id: 1,
        cadence_days: { "1": 7, "2": 14, "3": 30, "4": 30 },
        distributed_brands: ["EWM", "Callington", "ESAB Machines", "ESAB Consummables", "ESAB Wear Parts", "Grindex", "SPY", "Umbrella", "Victor", "Arcmaster Oven", "Arcmaster Accessories"],
        templates: {
          first_outreach: { ...defaultChannels },
          follow_up: { ...defaultChannels },
          campaign: { ...defaultChannels }
        }
      };
      await supabase.from(this.tableName).insert(defaultSettings);
      const camelData = toCamel(defaultSettings);
      camelData.id = 'default';
      return camelData;
    }

    const camelData = data ? toCamel(data) : undefined;
    if (camelData && this.tableName === 'settings') {
      camelData.id = 'default';
    }
    return camelData;
  }

  async toArray() {
    const { data, error } = await supabase.from(this.tableName).select('*');
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data || []).map(toCamel);
  }

  where(field: string) {
    return new Collection(this.tableName, [{ type: 'eq', field }]);
  }

  orderBy(field: string) {
    return new Collection(this.tableName, [{ type: 'sortBy', field }]);
  }
  
  filter(fn: any) {
    const coll = new Collection(this.tableName, []);
    const oldToArray = coll.toArray.bind(coll);
    coll.toArray = async () => {
      const all = await oldToArray();
      return all.filter(fn);
    };
    return coll;
  }

  async clear() {
    const { error } = await supabase.from(this.tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Supabase error: ${error.message}`);
  }

  async count() {
    const { count, error } = await supabase.from(this.tableName).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return count || 0;
  }
}

export const db = {
  clients: new TableAdapter('clients') as any,
  leads: new TableAdapter('leads') as any,
  enquiries: new TableAdapter('enquiries') as any,
  interactions: new TableAdapter('interactions') as any,
  campaigns: new TableAdapter('campaigns') as any,
  brands: new TableAdapter('brands') as any,
  productProfiles: new TableAdapter('product_profiles') as any,
  campaignCreatives: new TableAdapter('campaign_creatives') as any,
  activityEvents: new TableAdapter('activity_events') as any,
  campaignTargets: new TableAdapter('campaign_targets') as any,

  settings: new TableAdapter('settings') as any,
  searchZones: new TableAdapter('search_zones') as any,
  tier1Employees: new TableAdapter('tier1Employees') as any,
  tier1Opportunities: new TableAdapter('tier1Opportunities') as any,
  tier1StageTransitions: new TableAdapter('tier1StageTransitions') as any,
  tier1Projects: new TableAdapter('tier1Projects') as any,
  clientSearchResults: new TableAdapter('client_search_results') as any,
  on: (evt: string, cb: any) => {
    if (evt === 'ready') setTimeout(cb, 500);
  },
  open: () => Promise.resolve()
};

export function useLiveQuery(queryFn: () => Promise<any>, deps: any[] = []): any {
  const [data, setData] = useState<any>(undefined);

  useEffect(() => {
    let mounted = true;
    queryFn().then(res => {
      if (mounted) setData(res);
    }).catch(err => {
      console.error('useLiveQuery error:', err);
    });
    return () => { mounted = false; };
  }, deps);

  return data;
}
