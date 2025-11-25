/**
 * Walmart Marketplace Repository
 * 
 * Handles all database operations for Walmart marketplace data
 */

import { db } from '../db';
import { 
  walmartProducts, 
  walmartMarketIntelligence, 
  walmartTaxonomy,
  productWalmartMapping,
  products,
  walmartPricingInsights
} from '../../shared/schema';
import { eq, and, inArray, sql, lt, desc } from 'drizzle-orm';
import type { WalmartPricingInsightItem } from '../utils/walmart-api';

// Marketplace presence tracking (created manually in DB)
const marketplacePresence = {
  id: sql`id`,
  productId: sql`product_id`,
  marketplace: sql`marketplace`,
  availabilityStatus: sql`availability_status`,
  lastCheckedAt: sql`last_checked_at`,
  nextCheckAfter: sql`next_check_after`,
  notes: sql`notes`
};

/**
 * Create or update Walmart product record
 */
export async function upsertWalmartProduct(productData: any) {
  try {
    const existingProduct = await db
      .select()
      .from(walmartProducts)
      .where(eq(walmartProducts.walmartItemId, productData.walmartItemId))
      .limit(1);

    if (existingProduct.length > 0) {
      // Update existing product
      const [updated] = await db
        .update(walmartProducts)
        .set({
          ...productData,
          updatedAt: new Date()
        })
        .where(eq(walmartProducts.walmartItemId, productData.walmartItemId))
        .returning();
      
      console.log(`[Walmart Repo] Updated product: ${productData.walmartItemId}`);
      return updated;
    } else {
      // Insert new product
      const [inserted] = await db
        .insert(walmartProducts)
        .values(productData)
        .returning();
      
      console.log(`[Walmart Repo] Created new product: ${productData.walmartItemId}`);
      return inserted;
    }
  } catch (error) {
    console.error('[Walmart Repo] Error upserting product:', error);
    throw error;
  }
}

/**
 * Save Walmart market intelligence data
 */
export async function saveWalmartMarketData(marketData: any) {
  try {
    // Ensure the Walmart product exists first
    const productExists = await db
      .select()
      .from(walmartProducts)
      .where(eq(walmartProducts.walmartItemId, marketData.walmartItemId))
      .limit(1);

    if (productExists.length === 0) {
      throw new Error(`Walmart product ${marketData.walmartItemId} not found. Please create product first.`);
    }

    // Check if market intelligence already exists
    const existing = await db
      .select()
      .from(walmartMarketIntelligence)
      .where(eq(walmartMarketIntelligence.walmartItemId, marketData.walmartItemId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      const [updated] = await db
        .update(walmartMarketIntelligence)
        .set({
          ...marketData,
          updatedAt: new Date()
        })
        .where(eq(walmartMarketIntelligence.walmartItemId, marketData.walmartItemId))
        .returning();
      
      return updated;
    } else {
      // Insert new record
      const [inserted] = await db
        .insert(walmartMarketIntelligence)
        .values(marketData)
        .returning();
      
      return inserted;
    }
  } catch (error) {
    console.error('[Walmart Repo] Error saving market data:', error);
    throw error;
  }
}

/**
 * Save Walmart taxonomy data
 */
export async function saveWalmartTaxonomy(taxonomyData: any) {
  try {
    const existing = await db
      .select()
      .from(walmartTaxonomy)
      .where(eq(walmartTaxonomy.categoryId, taxonomyData.categoryId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(walmartTaxonomy)
        .set({
          ...taxonomyData,
          updatedAt: new Date(),
          lastSyncedAt: new Date()
        })
        .where(eq(walmartTaxonomy.categoryId, taxonomyData.categoryId))
        .returning();
      
      return updated;
    } else {
      // Insert new
      const [inserted] = await db
        .insert(walmartTaxonomy)
        .values({
          ...taxonomyData,
          lastSyncedAt: new Date()
        })
        .returning();
      
      return inserted;
    }
  } catch (error) {
    console.error('[Walmart Repo] Error saving taxonomy:', error);
    throw error;
  }
}

/**
 * Create product-to-Walmart mapping
 */
export async function createProductWalmartMapping(mappingData: any) {
  try {
    const [mapping] = await db
      .insert(productWalmartMapping)
      .values(mappingData)
      .returning();
    
    console.log(`[Walmart Repo] Created mapping: Product ${mappingData.productId} -> Walmart ${mappingData.walmartItemId}`);
    return mapping;
  } catch (error) {
    console.error('[Walmart Repo] Error creating mapping:', error);
    throw error;
  }
}

/**
 * Get products that need Walmart sync
 */
export async function getProductsForWalmartSync(limit: number = 100) {
  try {
    const productsToSync = await db
      .select({
        id: products.id,
        name: products.name,
        upc: products.upc,
        sku: products.sku
      })
      .from(products)
      .where(
        and(
          sql`${products.upc} IS NOT NULL`,
          sql`${products.id} NOT IN (
            SELECT product_id FROM ${productWalmartMapping}
            WHERE is_active = true
          )`
        )
      )
      .limit(limit);
    
    return productsToSync;
  } catch (error) {
    console.error('[Walmart Repo] Error getting products for sync:', error);
    throw error;
  }
}

/**
 * Get Walmart market intelligence for an item
 */
export async function getWalmartMarketIntelligence(walmartItemId: string) {
  try {
    const [marketData] = await db
      .select()
      .from(walmartMarketIntelligence)
      .where(eq(walmartMarketIntelligence.walmartItemId, walmartItemId))
      .limit(1);
    
    return marketData || null;
  } catch (error) {
    console.error('[Walmart Repo] Error fetching market intelligence:', error);
    throw error;
  }
}

/**
 * Get product Walmart mappings
 */
export async function getProductWalmartMappings(productId: number) {
  try {
    const rawMappings = await db
      .select({
        id: productWalmartMapping.id,
        walmartItemId: productWalmartMapping.walmartItemId,
        mappingSource: productWalmartMapping.mappingSource,
        matchConfidence: productWalmartMapping.matchConfidence,
        isActive: productWalmartMapping.isActive,
        isVerified: productWalmartMapping.isVerified,
        productTitle: walmartProducts.title,
        productBrand: walmartProducts.brand,
        productCurrentPrice: walmartProducts.currentPrice,
        productListPrice: walmartProducts.listPrice,
        productInStock: walmartProducts.inStock,
        productAvailabilityStatus: walmartProducts.availabilityStatus,
        productLifecycleStatus: walmartProducts.lifecycleStatus,
        productImageUrls: walmartProducts.imageUrls,
        productCategoryPath: walmartProducts.categoryPath,
        productCategoryName: walmartProducts.categoryName,
        productTaxonomyId: walmartProducts.taxonomyId,
        productSellerName: walmartProducts.sellerName,
        productSellerMarketplace: walmartProducts.sellerMarketplace,
        productWfsEligible: walmartProducts.wfsEligible,
        productAverageRating: walmartProducts.averageRating,
        productTotalReviews: walmartProducts.totalReviews,
        productDescription: walmartProducts.description,
        productShortDescription: walmartProducts.shortDescription,
        productUpc: walmartProducts.upc,
        productGtin: walmartProducts.gtin,
        productWeight: walmartProducts.weight,
        productDimensions: walmartProducts.dimensions
      })
      .from(productWalmartMapping)
      .leftJoin(walmartProducts, eq(productWalmartMapping.walmartItemId, walmartProducts.walmartItemId))
      .where(
        and(
          eq(productWalmartMapping.productId, productId),
          eq(productWalmartMapping.isActive, true)
        )
      );
    
    const mappings = rawMappings.map(row => ({
      id: row.id,
      walmartItemId: row.walmartItemId,
      mappingSource: row.mappingSource,
      matchConfidence: row.matchConfidence,
      isActive: row.isActive,
      isVerified: row.isVerified,
      product: row.productTitle ? {
        title: row.productTitle,
        brand: row.productBrand,
        currentPrice: row.productCurrentPrice,
        listPrice: row.productListPrice,
        inStock: row.productInStock,
        availabilityStatus: row.productAvailabilityStatus,
        lifecycleStatus: row.productLifecycleStatus,
        imageUrls: row.productImageUrls,
        categoryPath: row.productCategoryPath,
        categoryName: row.productCategoryName,
        taxonomyId: row.productTaxonomyId,
        sellerName: row.productSellerName,
        sellerMarketplace: row.productSellerMarketplace,
        wfsEligible: row.productWfsEligible,
        averageRating: row.productAverageRating,
        totalReviews: row.productTotalReviews,
        description: row.productDescription,
        shortDescription: row.productShortDescription,
        upc: row.productUpc,
        gtin: row.productGtin,
        weight: row.productWeight,
        dimensions: row.productDimensions
      } : null,
      marketIntelligence: null
    }));
    
    return mappings;
  } catch (error) {
    console.error('[Walmart Repo] Error fetching product mappings:', error);
    throw error;
  }
}

/**
 * Get all Walmart taxonomy categories
 */
export async function getAllWalmartTaxonomy() {
  try {
    const taxonomy = await db
      .select()
      .from(walmartTaxonomy)
      .where(eq(walmartTaxonomy.isActive, true))
      .orderBy(walmartTaxonomy.level, walmartTaxonomy.categoryName);
    
    return taxonomy;
  } catch (error) {
    console.error('[Walmart Repo] Error fetching taxonomy:', error);
    throw error;
  }
}

/**
 * Search Walmart products by UPC
 */
export async function searchWalmartProductsByUPC(upc: string) {
  try {
    const products = await db
      .select()
      .from(walmartProducts)
      .where(eq(walmartProducts.upc, upc));
    
    return products;
  } catch (error) {
    console.error('[Walmart Repo] Error searching products by UPC:', error);
    throw error;
  }
}

/**
 * Get Walmart opportunities for purchasing analysis
 */
export async function getWalmartOpportunities(minOpportunityScore: number = 50) {
  try {
    const opportunities = await db
      .select({
        productId: productWalmartMapping.productId,
        walmartItemId: productWalmartMapping.walmartItemId,
        productName: products.name,
        walmartTitle: walmartProducts.title,
        walmartPrice: walmartMarketIntelligence.currentPrice,
        opportunityScore: walmartMarketIntelligence.opportunityScore,
        profitMargin: walmartMarketIntelligence.profitMarginPercent,
        rating: walmartMarketIntelligence.rating,
        reviewCount: walmartMarketIntelligence.reviewCount,
        inStock: walmartMarketIntelligence.inStock,
        competitionLevel: walmartMarketIntelligence.competitionLevel
      })
      .from(productWalmartMapping)
      .innerJoin(products, eq(productWalmartMapping.productId, products.id))
      .innerJoin(walmartProducts, eq(productWalmartMapping.walmartItemId, walmartProducts.walmartItemId))
      .innerJoin(walmartMarketIntelligence, eq(productWalmartMapping.walmartItemId, walmartMarketIntelligence.walmartItemId))
      .where(
        and(
          sql`${walmartMarketIntelligence.opportunityScore} >= ${minOpportunityScore}`,
          eq(productWalmartMapping.isActive, true),
          eq(walmartMarketIntelligence.inStock, true)
        )
      )
      .orderBy(sql`${walmartMarketIntelligence.opportunityScore} DESC`)
      .limit(100);
    
    return opportunities;
  } catch (error) {
    console.error('[Walmart Repo] Error fetching opportunities:', error);
    throw error;
  }
}

/**
 * Bulk insert Walmart taxonomy
 */
export async function bulkInsertWalmartTaxonomy(taxonomyArray: any[]) {
  try {
    if (taxonomyArray.length === 0) {
      return [];
    }

    const inserted = await db
      .insert(walmartTaxonomy)
      .values(taxonomyArray)
      .onConflictDoUpdate({
        target: walmartTaxonomy.categoryId,
        set: {
          categoryName: sql`EXCLUDED.category_name`,
          parentCategoryId: sql`EXCLUDED.parent_category_id`,
          categoryPath: sql`EXCLUDED.category_path`,
          level: sql`EXCLUDED.level`,
          productTypeGroupName: sql`EXCLUDED.product_type_group_name`,
          productTypeName: sql`EXCLUDED.product_type_name`,
          departmentName: sql`EXCLUDED.department_name`,
          departmentNumber: sql`EXCLUDED.department_number`,
          description: sql`EXCLUDED.description`,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        }
      })
      .returning();
    
    console.log(`[Walmart Repo] Bulk inserted/updated ${inserted.length} taxonomy records`);
    return inserted;
  } catch (error) {
    console.error('[Walmart Repo] Error bulk inserting taxonomy:', error);
    throw error;
  }
}

/**
 * Record marketplace presence (available, not_found, error)
 */
export async function recordMarketplacePresence(
  productId: number,
  marketplace: string,
  status: 'available' | 'not_found' | 'error',
  notes?: string
) {
  try {
    // Calculate next check time based on status
    const now = new Date();
    let nextCheckAfter: Date | null = null;
    
    if (status === 'not_found') {
      // Don't check again for 30 days if not found
      nextCheckAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (status === 'error') {
      // Retry errors after 1 day
      nextCheckAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (status === 'available') {
      // Recheck available items every 7 days
      nextCheckAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    await db.execute(sql`
      INSERT INTO marketplace_presence (product_id, marketplace, availability_status, last_checked_at, next_check_after, notes)
      VALUES (${productId}, ${marketplace}, ${status}, ${now}, ${nextCheckAfter}, ${notes || null})
      ON CONFLICT (product_id, marketplace)
      DO UPDATE SET
        availability_status = ${status},
        last_checked_at = ${now},
        next_check_after = ${nextCheckAfter},
        notes = ${notes || null}
    `);
    
    console.log(`[Walmart Repo] Recorded ${marketplace} presence for product ${productId}: ${status}`);
  } catch (error) {
    console.error('[Walmart Repo] Error recording marketplace presence:', error);
    throw error;
  }
}

/**
 * Get products for Walmart sync (excluding recently checked ones)
 */
export async function getProductsForWalmartSyncWithPresence(limit: number = 100) {
  try {
    const productsToSync = await db.execute(sql`
      SELECT p.id, p.name, p.upc, p.sku
      FROM products p
      LEFT JOIN marketplace_presence mp ON p.id = mp.product_id AND mp.marketplace = 'walmart'
      WHERE p.upc IS NOT NULL
        AND p.id NOT IN (
          SELECT product_id FROM product_walmart_mapping WHERE is_active = true
        )
        AND (
          mp.id IS NULL
          OR mp.next_check_after IS NULL
          OR mp.next_check_after < NOW()
        )
      LIMIT ${limit}
    `);
    
    return productsToSync.rows;
  } catch (error) {
    console.error('[Walmart Repo] Error getting products for sync with presence:', error);
    throw error;
  }
}

// ============================================================================
// PRICING INSIGHTS REPOSITORY FUNCTIONS
// ============================================================================

/**
 * Helper to convert dollar amounts to cents
 */
function toCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

/**
 * Upsert a single pricing insight record
 */
export async function upsertPricingInsight(insight: WalmartPricingInsightItem) {
  try {
    const data = {
      sku: insight.sku,
      itemName: insight.itemName,
      currentPrice: toCents(insight.currentPrice),
      buyBoxBasePrice: toCents(insight.buyBoxBasePrice),
      buyBoxTotalPrice: toCents(insight.buyBoxTotalPrice),
      buyBoxWinRate: insight.buyBoxWinRate,
      competitorPrice: toCents(insight.competitorPrice),
      comparisonPrice: toCents(insight.comparisonPrice),
      priceDifferential: insight.priceDifferential,
      priceCompetitiveScore: insight.priceCompetitiveScore,
      priceCompetitive: insight.priceCompetitive,
      fulfillment: insight.fulfillment,
      inventoryCount: insight.inventoryCount,
      repricerStrategyType: insight.repricerStrategyType,
      repricerStrategyName: insight.repricerStrategyName,
      repricerStatus: insight.repricerStatus,
      repricerMinPrice: toCents(insight.repricerMinPrice),
      repricerMaxPrice: toCents(insight.repricerMaxPrice),
      promoStatus: insight.promoStatus,
      reducedReferralStatus: insight.reducedReferralStatus,
      walmartFundedStatus: insight.walmartFundedStatus,
      inDemand: insight.inDemand,
      traffic: insight.traffic,
      gmv30: toCents(insight.gmv30),
      potentialGmvLift: toCents(insight.potentialGmvLift),
      dataFetchedAt: new Date(),
      updatedAt: new Date()
    };

    const existing = await db
      .select()
      .from(walmartPricingInsights)
      .where(eq(walmartPricingInsights.sku, insight.sku))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(walmartPricingInsights)
        .set(data)
        .where(eq(walmartPricingInsights.sku, insight.sku))
        .returning();
      
      return updated;
    } else {
      const [inserted] = await db
        .insert(walmartPricingInsights)
        .values(data)
        .returning();
      
      return inserted;
    }
  } catch (error) {
    console.error('[Walmart Repo] Error upserting pricing insight:', error);
    throw error;
  }
}

/**
 * Bulk upsert pricing insights
 */
export async function bulkUpsertPricingInsights(insights: WalmartPricingInsightItem[]) {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const insight of insights) {
    try {
      const existing = await db
        .select({ id: walmartPricingInsights.id })
        .from(walmartPricingInsights)
        .where(eq(walmartPricingInsights.sku, insight.sku))
        .limit(1);

      await upsertPricingInsight(insight);
      
      if (existing.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error) {
      console.error(`[Walmart Repo] Error upserting insight for SKU ${insight.sku}:`, error);
      errors++;
    }
  }

  console.log(`[Walmart Repo] Bulk upsert complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  
  return { inserted, updated, errors };
}

/**
 * Get pricing insight by SKU
 */
export async function getPricingInsightBySku(sku: string) {
  try {
    const [insight] = await db
      .select()
      .from(walmartPricingInsights)
      .where(eq(walmartPricingInsights.sku, sku))
      .limit(1);
    
    return insight || null;
  } catch (error) {
    console.error('[Walmart Repo] Error getting pricing insight:', error);
    throw error;
  }
}

/**
 * Get all pricing insights with pagination
 */
export async function getPricingInsights(page: number = 1, limit: number = 50) {
  try {
    const offset = (page - 1) * limit;
    
    const insights = await db
      .select()
      .from(walmartPricingInsights)
      .orderBy(desc(walmartPricingInsights.gmv30))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(walmartPricingInsights);

    return {
      insights,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit)
    };
  } catch (error) {
    console.error('[Walmart Repo] Error getting pricing insights:', error);
    throw error;
  }
}

/**
 * Get high-demand pricing insights (in demand with good traffic)
 */
export async function getHighDemandInsights(limit: number = 100) {
  try {
    const insights = await db
      .select()
      .from(walmartPricingInsights)
      .where(eq(walmartPricingInsights.inDemand, true))
      .orderBy(desc(walmartPricingInsights.gmv30))
      .limit(limit);
    
    return insights;
  } catch (error) {
    console.error('[Walmart Repo] Error getting high-demand insights:', error);
    throw error;
  }
}

/**
 * Get pricing insights statistics
 */
export async function getPricingInsightsStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN in_demand = true THEN 1 END) as in_demand_count,
        COUNT(CASE WHEN price_competitive = true THEN 1 END) as price_competitive_count,
        COUNT(CASE WHEN traffic = 'High' THEN 1 END) as high_traffic_count,
        COUNT(CASE WHEN traffic = 'Medium' THEN 1 END) as medium_traffic_count,
        COUNT(CASE WHEN traffic = 'Low' THEN 1 END) as low_traffic_count,
        COALESCE(SUM(gmv30), 0) as total_gmv30,
        COALESCE(SUM(potential_gmv_lift), 0) as total_potential_gmv_lift,
        AVG(price_competitive_score) as avg_price_competitive_score,
        MAX(data_fetched_at) as last_sync_at
      FROM walmart_pricing_insights
    `);
    
    return result.rows[0] || {};
  } catch (error) {
    console.error('[Walmart Repo] Error getting pricing insights stats:', error);
    throw error;
  }
}

/**
 * Get pricing insights for products in our catalog (by matching SKU)
 */
export async function getPricingInsightsForCatalog() {
  try {
    const result = await db.execute(sql`
      SELECT 
        wpi.*,
        wp.walmart_item_id,
        wp.title as walmart_title,
        p.id as product_id,
        p.name as product_name,
        p.sku as internal_sku,
        p.cost as product_cost
      FROM walmart_pricing_insights wpi
      LEFT JOIN walmart_products wp ON wpi.sku = wp.sku
      LEFT JOIN product_walmart_mapping pwm ON wp.walmart_item_id = pwm.walmart_item_id
      LEFT JOIN products p ON pwm.product_id = p.id
      ORDER BY wpi.gmv30 DESC NULLS LAST
    `);
    
    return result.rows;
  } catch (error) {
    console.error('[Walmart Repo] Error getting pricing insights for catalog:', error);
    throw error;
  }
}
