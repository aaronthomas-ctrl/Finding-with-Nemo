export interface Brand {
  id: string;
  name: string;
  logoBadge: string;
  country: string;
  categories: string[];
  description: string;
  specialties: string[];
  stockItemCount: number;
}

export interface WarehouseProduct {
  id: string;
  sku: string;
  name: string;
  brandId: string;
  brandName: string;
  materialCategory: string;
  specification: string;
  unit: string;
  warehouseStockQty: number;
  reservedQty: number;
  availableQty: number;
  warehouseLocation: string;
  batchNumber: string;
  listPrice: number;
  suggestedPushPrice: number;
  discountPercent: number;
  moq: number;
  targetCustomerCategories: string[];
  inventoryStatus: 'Overstock Push' | 'Fast Mover' | 'Clearance' | 'New Brand' | 'Standard Stock';
  keySellingPoints: string[];
  packagingDetails: string;
}

export type PushStatus =
  | 'Pitch Made'
  | 'Sample Sent'
  | 'Quoted'
  | 'Under Negotiation'
  | 'Ordered'
  | 'Declined - Has Stock'
  | 'Declined - Price'
  | 'Follow-up Due';

export type PushChannel = 'WhatsApp' | 'Email' | 'Call' | 'Visit' | 'Meeting';

export interface StockPushLog {
  id: string;
  clientId: string;
  clientName: string;
  clientCategory: string;
  productId: string;
  productName: string;
  brandId: string;
  brandName: string;
  sku: string;
  salesmanName: string;
  pushedAt: string | Date;
  status: PushStatus;
  priceOffered: number;
  qtyDiscussed: number;
  channel: PushChannel;
  notes: string;
  campaignId?: string;
  campaignTitle?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CollisionRecord {
  hasCollision: boolean;
  previousSalesman: string;
  pushedAt: string | Date;
  previousStatus: string;
  previousNotes: string;
  priceOffered?: number;
  daysAgo: number;
}

export interface CampaignClientTarget {
  id: string;
  campaignId: string;
  clientId: string;
  clientName: string;
  clientCategory: string;
  tier: number;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  address: string;
  assignedSalesman: string;
  status: 'Pending' | 'Contacted' | 'Sample Sent' | 'Quoted' | 'Ordered' | 'Declined';
  priceOffered: number;
  quantityDiscussed?: number;
  quantityOrdered?: number;
  revenueWon?: number;
  channelUsed?: PushChannel;
  notes?: string;
  lastContactedAt?: string | Date;
  collisionInfo?: CollisionRecord;
  personalizedPitchWhatsApp?: string;
  personalizedPitchEmail?: string;
  personalizationContext?: string;
}

export interface StockCampaign {
  id: string;
  title: string;
  goal: string;
  targetCustomerCategories: string[];
  brandId: string;
  brandName: string;
  productId: string;
  productName: string;
  sku: string;
  materialCategory: string;
  offerPrice: number;
  regularPrice: number;
  discountPercent: number;
  moq: number;
  status: 'Active' | 'Completed' | 'Paused' | 'Draft';
  startDate: string | Date;
  endDate: string | Date;
  assignedSalesmen: string[];
  pitchTemplateWhatsApp: string;
  pitchTemplateEmail: string;
  pitchCallScript: string;
  targetClientIds: string[];
  targets: CampaignClientTarget[];
  metrics: {
    totalTargets: number;
    contactedCount: number;
    samplesSentCount: number;
    quotedCount: number;
    orderedCount: number;
    declinedCount: number;
    totalRevenueWon: number;
    stockPushedQty: number;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Salesman {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  avatarColor: string;
  activePushesCount: number;
  totalRevenueGenerated: number;
}
