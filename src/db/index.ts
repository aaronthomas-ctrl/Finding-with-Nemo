import { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';
export { supabase };

export interface Client {
  id: string;
  name: string;
  address: string;
  region?: string;
  placeId?: string;
  geoSource?: string;
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
    region: string;
    primarySiteAddress: string;
    justification: string;
    territoryStatus: string;
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


export { db, useLiveQuery, DEFAULT_TEMPLATES } from './adapter';
