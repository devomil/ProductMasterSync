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
  products
} from '../../shared/schema';
import { eq, and, inArray, sql, lt } from 'drizzle-orm';

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
    const mappings = await db
      .select({
        id: productWalmartMapping.id,
        walmartItemId: productWalmartMapping.walmartItemId,
        mappingSource: productWalmartMapping.mappingSource,
        matchConfidence: productWalmartMapping.matchConfidence,
        isActive: productWalmartMapping.isActive,
        isVerified: productWalmartMapping.isVerified,
        product: {
          title: walmartProducts.title,
          brand: walmartProducts.brand,
          currentPrice: walmartProducts.currentPrice,
          inStock: walmartProducts.inStock,
          imageUrls: walmartProducts.imageUrls
        },
        marketIntelligence: {
          currentPrice: walmartMarketIntelligence.currentPrice,
          listPrice: walmartMarketIntelligence.listPrice,
          rating: walmartMarketIntelligence.rating,
          reviewCount: walmartMarketIntelligence.reviewCount,
          profitMarginPercent: walmartMarketIntelligence.profitMarginPercent,
          opportunityScore: walmartMarketIntelligence.opportunityScore
        }
      })
      .from(productWalmartMapping)
      .leftJoin(walmartProducts, eq(productWalmartMapping.walmartItemId, walmartProducts.walmartItemId))
      .leftJoin(walmartMarketIntelligence, eq(productWalmartMapping.walmartItemId, walmartMarketIntelligence.walmartItemId))
      .where(
        and(
          eq(productWalmartMapping.productId, productId),
          eq(productWalmartMapping.isActive, true)
        )
      );
    
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
