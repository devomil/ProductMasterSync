/**
 * Repository for Amazon marketplace data
 */

import { db } from '../db';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  products,
  amazonAsins,
  amazonMarketIntelligence,
  productAmazonLookup,
  productAsinMapping,
  amazonPriceHistory,
  amazonSyncLogs,
  type Product
} from '@shared/schema';

/**
 * Create an ASIN record in the amazon_asins table
 * @param asinData 
 */
export async function createAsinRecord(asinData: any): Promise<void> {
  try {
    await db.insert(amazonAsins).values({
      asin: asinData.asin,
      title: asinData.title || '',
      brand: asinData.brand || '',
      manufacturer: asinData.manufacturer || '',
      upc: asinData.upc || '',
      partNumber: asinData.partNumber || '',
      model: asinData.model || '',
      category: asinData.category || '',
      subcategory: asinData.subcategory || '',
      mainImageUrl: asinData.imageUrl || '',
      productType: asinData.productType || '',
      marketplace: 'US'
    }).onConflictDoNothing();
  } catch (error) {
    console.log(`ASIN ${asinData.asin} already exists or error inserting:`, error);
  }
}

/**
 * Get Amazon marketplace data for a product
 * @param productId 
 */
export async function getAmazonDataForProduct(productId: number): Promise<any[]> {
  // Get all ASINs mapped to this product and their data
  const mappings = await db
    .select({
      asin: productAsinMapping.asin,
      matchMethod: productAsinMapping.matchMethod,
      matchConfidence: productAsinMapping.matchConfidence,
      isVerified: productAsinMapping.isVerified,
      asinData: amazonAsins,
      intelligence: amazonMarketIntelligence
    })
    .from(productAsinMapping)
    .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
    .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .where(eq(productAsinMapping.productId, productId));

  return mappings;
}

/**
 * Save Amazon marketplace data for a product
 * @param data 
 */
export async function saveAmazonMarketData(data: any): Promise<any> {
  try {
    console.log('Repository received data:', JSON.stringify(data, null, 2));
    
    // Map only the core fields that we know exist in the database
    const filteredData = {
      asin: data.asin,
      current_price: data.currentPrice,
      list_price: data.listPrice,
      sales_rank: data.salesRank,
      category_rank: data.categoryRank,
      in_stock: data.inStock,
      fulfillment_method: data.fulfillmentMethod,
      is_prime: data.isPrime,
      profit_margin_percent: data.profitMarginPercent,
      opportunity_score: data.opportunityScore,
      competition_level: data.competitionLevel,
      estimated_sales_per_month: data.estimatedSalesPerMonth,
      // Amazon fees (from Product Fees API)
      referral_fee: data.referralFee,
      fba_fee: data.fbaFee,
      variable_closing_fee: data.variableClosingFee,
      total_fees: data.totalFees,
      last_fee_check: data.lastFeeCheck,
      // Listing restrictions (from Listings Restrictions API)
      can_list: data.canList,
      listing_restrictions: data.listingRestrictions,
      // Buy box price
      buy_box_price: data.buyBoxPrice
    };
    
    console.log('Filtered data for DB upsert:', JSON.stringify(filteredData, null, 2));
    
    // Try insert first, then update on conflict
    try {
      const [savedData] = await db
        .insert(amazonMarketIntelligence)
        .values(filteredData)
        .returning();
      return savedData;
    } catch (insertError: any) {
      // If duplicate key error (23505), update the existing record
      if (insertError.code === '23505') {
        console.log(`[Repository] ASIN ${filteredData.asin} already exists, updating...`);
        const [updatedData] = await db
          .update(amazonMarketIntelligence)
          .set(filteredData)
          .where(eq(amazonMarketIntelligence.asin, filteredData.asin))
          .returning();
        return updatedData;
      }
      // Re-throw other errors
      throw insertError;
    }
  } catch (error: any) {
    console.error('Error saving Amazon market data:', error);
    throw error;
  }
}

/**
 * Create a product-to-ASIN mapping
 * @param mappingData 
 */
export async function createProductAsinMapping(mappingData: any): Promise<any> {
  try {
    const [savedMapping] = await db
      .insert(productAsinMapping)
      .values({
        productId: mappingData.productId,
        asin: mappingData.asin,
        mappingSource: mappingData.mappingSource || 'api_search',
        matchMethod: mappingData.matchMethod || 'upc_match',
        matchConfidence: mappingData.matchConfidence || 95,
        isActive: mappingData.isActive !== false,
        isVerified: mappingData.isVerified || false,
        isDirectCompetitor: mappingData.isDirectCompetitor || true,
        isSimilarProduct: mappingData.isSimilarProduct || false,
        opportunityScore: mappingData.opportunityScore,
        confidenceScore: mappingData.confidenceScore || 0.85,
        source: mappingData.source || 'sp_api'
      })
      .onConflictDoNothing()
      .returning();
    
    console.log(`✅ Created product mapping: Product ${mappingData.productId} → ASIN ${mappingData.asin}`);
    return savedMapping;
  } catch (error: any) {
    if (error.code === '23505') {
      console.log(`🔄 Product mapping already exists: Product ${mappingData.productId} → ASIN ${mappingData.asin}`);
      return null;
    }
    console.error('Error creating product ASIN mapping:', error);
    throw error;
  }
}

/**
 * Get products that need Amazon marketplace data sync
 * Criteria:
 * - Has a UPC code
 * - Either never synced (lastAmazonSync is null) or hasn't been synced in the last 24 hours
 * - Excludes products with amazonSyncStatus = 'processing'
 * @param limit Maximum number of products to return
 */
export async function getProductsForAmazonSync(limit: number = 10): Promise<Product[]> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return await db
    .select()
    .from(products)
    .where(
      and(
        sql`${products.upc} IS NOT NULL AND ${products.upc} != ''`,
        sql`(${products.lastAmazonSync} IS NULL OR ${products.lastAmazonSync} < ${oneDayAgo.toISOString()})`,
        sql`(${products.amazonSyncStatus} != 'processing' OR ${products.amazonSyncStatus} IS NULL)`
      )
    )
    .limit(limit);
}

/**
 * Update product Amazon sync status
 * @param productId 
 * @param status 
 */
export async function updateProductAmazonSyncStatus(
  productId: number,
  status: string
): Promise<void> {
  await db
    .update(products)
    .set({
      amazonSyncStatus: status,
      ...(status === 'success' || status === 'error' ? { lastAmazonSync: new Date() } : {})
    })
    .where(eq(products.id, productId));
}

/**
 * Create a sync log entry
 * @param logData 
 */
export async function createSyncLog(logData: any): Promise<void> {
  await db.execute(sql`
    INSERT INTO amazon_sync_logs (product_id, upc, batch_id, sync_status, asins_found, sync_duration_ms)
    VALUES (${logData.product_id}, ${logData.upc}, ${logData.batch_id}, ${logData.sync_status}, ${logData.asins_found}, ${logData.sync_duration_ms})
  `);
}

/**
 * Generate a batch ID for grouping sync operations
 */
export function generateBatchId(): string {
  return `batch-${uuidv4().slice(0, 8)}-${Date.now()}`;
}

/**
 * Get sync logs for a batch
 * @param batchId 
 */
export async function getSyncLogsByBatch(batchId: string) {
  return await db
    .select()
    .from(amazonSyncLogs)
    .where(eq(amazonSyncLogs.batchId, batchId))
    .orderBy(desc(amazonSyncLogs.syncStartedAt));
}

/**
 * Get sync logs for a product
 * @param productId 
 */
export async function getSyncLogsForProduct(productId: number) {
  return await db
    .select()
    .from(amazonSyncLogs)
    .where(eq(amazonSyncLogs.productId, productId))
    .orderBy(desc(amazonSyncLogs.syncStartedAt));
}

/**
 * Get recent sync logs
 * @param limit - Number of logs to return (default 50)
 */
export async function getRecentSyncLogs(limit: number = 50) {
  return await db
    .select({
      id: amazonSyncLogs.id,
      productId: amazonSyncLogs.productId,
      productName: products.name,
      productSku: products.sku,
      batchId: amazonSyncLogs.batchId,
      syncStartedAt: amazonSyncLogs.syncStartedAt,
      syncCompletedAt: amazonSyncLogs.syncCompletedAt,
      result: amazonSyncLogs.result,
      responseTimeMs: amazonSyncLogs.responseTimeMs,
      errorMessage: amazonSyncLogs.errorMessage,
      upc: amazonSyncLogs.upc,
      asin: amazonSyncLogs.asin,
    })
    .from(amazonSyncLogs)
    .leftJoin(products, eq(amazonSyncLogs.productId, products.id))
    .orderBy(desc(amazonSyncLogs.syncStartedAt))
    .limit(limit);
}

/**
 * Get sync statistics
 */
export async function getSyncStats() {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(COUNT(*), 0) as total,
        COALESCE(SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END), 0) as successful,
        COALESCE(SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END), 0) as failed,
        COALESCE(SUM(CASE WHEN result = 'not_found' THEN 1 ELSE 0 END), 0) as notFound,
        COALESCE(SUM(CASE WHEN result = 'rate_limited' THEN 1 ELSE 0 END), 0) as rateLimited,
        COALESCE(AVG(response_time_ms), 0) as avgResponseTime
      FROM amazon_sync_logs
      WHERE sync_started_at > NOW() - INTERVAL '24 hours'
    `);

    // Extract the first row from the result
    const stats = result.rows && result.rows.length > 0 ? result.rows[0] : null;
    
    // Convert string numbers to actual numbers
    if (stats) {
      return {
        total: Number(stats.total) || 0,
        successful: Number(stats.successful) || 0,
        failed: Number(stats.failed) || 0,
        notFound: Number(stats.notfound) || 0,
        rateLimited: Number(stats.ratelimited) || 0,
        avgResponseTime: Number(stats.avgresponsetime) || 0
      };
    }
    
    return { 
      total: 0, 
      successful: 0, 
      failed: 0, 
      notFound: 0, 
      rateLimited: 0,
      avgResponseTime: 0
    };
  } catch (error) {
    console.error('Error getting sync stats:', error);
    return { 
      total: 0, 
      successful: 0, 
      failed: 0, 
      notFound: 0, 
      rateLimited: 0,
      avgResponseTime: 0
    };
  }
}