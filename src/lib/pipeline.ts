import { v4 as uuidv4 } from 'uuid';
import { db, Client } from '../db';
import { CompanyResult } from '../types';

function normalizeName(name: string): string {
  // uppercase, strip punctuation and suffixes LLC/FZE/FZC/LTD/CO
  return name
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\b(LLC|FZE|FZC|LTD|CO|INC|CORP)\b/g, '')
    .trim();
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

function stringSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function editDistance(s1: string, s2: string): number {
  const costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0)
        costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

export type DedupeResult = {
  isDuplicate: boolean;
  existingClient?: Client;
};

export async function checkDuplicate(company: CompanyResult): Promise<DedupeResult> {
  const normName = normalizeName(company?.name || "");
  const existingClients = await db.clients.toArray();
  
  for (const client of existingClients) {
    const existingNorm = normalizeName(client.name);
    if (normName === existingNorm) {
      return { isDuplicate: true, existingClient: client };
    }
    
    // Check location + similarity
    if (client.lat && client.lng && company?.location?.latitude && company?.location?.longitude) {
      const dist = haversineDistance(
        client.lat, client.lng,
        company?.location?.latitude, company?.location?.longitude
      );
      if (dist < 100) {
        const sim = stringSimilarity(normName, existingNorm);
        if (sim > 0.85) {
          return { isDuplicate: true, existingClient: client };
        }
      }
    }
  }
  
  return { isDuplicate: false };
}

export async function saveCompanyToPipeline(company: CompanyResult): Promise<Client> {
  const newClient: Client = {
    id: uuidv4(),
    name: company?.name || "",
    address: company?.address || "",
    lat: company?.location?.latitude,
    lng: company?.location?.longitude,
    phone: company?.phone || '',
    website: company?.website || '',
    backgroundBlurb: company?.summary || '',
    category: ["EPC Contractor", "Steel Fabricator", "Oilfield & Petrochemical Services", "Electromechanical/MEP", "Marine/Shipbuilding", "Welding Trade/Distributor", "Trader", "Other"].includes(company.category as string) ? company.category : "Other",
    tier: (company.tier as 1 | 2 | 3 | 4) || 4,
    status: company.businessStatus || "New", // use businessStatus if available
    googleMapsLink: company.googleMapsUri || '',
    metadata: {
      googleMapsUri: company.googleMapsUri || '',
      googleMapsLink: company.googleMapsUri || ''
    },
    whatTheyDo: company?.summary || '',
    tags: Array.from(new Set([...(company?.tags || []), ...(company?.foundByTags || [])])), // merge existing and foundByTags
    contacts: [],
    nextFollowUpDate: null,
    retryFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tier1: {
      isWatch: false,
      emirate: "",
      primarySiteAddress: "",
      justification: "",
      allocationStatus: "Open",
      allocatedTo: "",
      allocatedProductLines: []
    }
  };
  
  await db.clients.add(newClient);
  return newClient;
}
