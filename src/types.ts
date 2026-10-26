export * from './types/stockist';

export interface CompanyResult {
  id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  category: string;
  rating?: number;
  phone?: string;
  website?: string;
  status?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  openingHours?: string[];
  summary?: string;
  insights?: string;
  enriching?: boolean;
  enrichError?: string;
  insightsLoading?: boolean;
  tags?: string[];
  foundByTags?: string[];
  tier?: number;
  isSaved?: boolean;
  isExistingCustomer?: boolean;
  parentCustomerName?: string;
  matchedZoneName?: string;
  emirate?: string;
}


export interface PolygonZone {
  id: string;
  name: string;
  path: google.maps.LatLngLiteral[];
  createdAt: string;
  tags?: string[];
}
