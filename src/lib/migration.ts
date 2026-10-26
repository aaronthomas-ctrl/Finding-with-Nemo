import { db } from '../db';
import { getLocalBrands, getLocalWarehouseProducts, getLocalCampaigns, getLocalStockPushes } from './stockData';

export async function runCampaignMigration() {
  console.log("Starting migration of campaign data...");
  const brands = getLocalBrands();
  const products = getLocalWarehouseProducts();
  const campaigns = getLocalCampaigns();
  const pushes = getLocalStockPushes();

  const stats = { brands: 0, productProfiles: 0, campaigns: 0, pushes: 0 };

  // Migrate Brands
  for (const b of brands) {
    const existing = await db.brands.get(b.id);
    if (!existing) {
      await db.brands.put({ 
        id: b.id, 
        brand_name: b.name, 
        brand_logo: null, 
        brand_description: b.description, 
        product_categories: b.categories, 
        created_at: new Date() 
      });
      stats.brands++;
    }
  }

  // Migrate Products
  for (const p of products) {
    const existing = await db.productProfiles.get(p.id);
    if (!existing) {
      await db.productProfiles.put({
        id: p.id,
        brand_id: p.brandId,
        product_name: p.name,
        product_category: p.materialCategory,
        product_type: 'CONSUMABLE', // default
        extracted_specs: { sku: p.sku, unit: p.unit, listPrice: p.listPrice, moq: p.moq },
        created_at: new Date()
      });
      stats.productProfiles++;
    }
  }

  // Migrate Campaigns
  for (const c of campaigns) {
    const existing = await db.campaigns.get(c.id);
    if (!existing) {
      await db.campaigns.put({
        id: c.id,
        title: c.title,
        description: c.goal,
        productLines: [c.brandName, c.productName],
        offerDetails: `Push Price: $${c.offerPrice} (${c.discountPercent}% off), MOQ: ${c.moq}`,
        validFrom: c.startDate,
        validTo: c.endDate,
        targetClientIds: c.targets.map((t: any) => t.clientId)
      });
      stats.campaigns++;
    }
  }

  // Migrate Pushes to interactions
  for (const p of pushes) {
    // Check if interaction already exists (simple dedupe by timestamp and clientId)
    const existingInteractions = await db.interactions.toArray();
    const alreadyExists = existingInteractions.find((i: any) => 
      i.clientId === p.clientId && 
      new Date(i.timestamp).getTime() === new Date(p.pushedAt).getTime()
    );

    if (!alreadyExists) {
      await db.interactions.add({
        id: p.id,
        clientId: p.clientId,
        timestamp: p.pushedAt,
        channel: p.channel,
        summary: `[Stock Push by ${p.salesmanName}] ${p.brandName} ${p.productName} (${p.sku}) - Status: ${p.status} @ $${p.priceOffered}. Notes: ${p.notes?.substring(0, 100) || ''}`,
      });
      stats.pushes++;
    }
  }

  console.log("Migration completed successfully:", stats);
  return stats;
}
