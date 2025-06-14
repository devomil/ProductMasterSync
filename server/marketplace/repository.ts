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
  type Product
} from '@shared/schema';

/**
 * Get Amazon marketplace data for a product
 * @param productId 
 */
export async function getAmazonDataForProduct(productId: number): Promise<any[]> {
  return await db
    .select()
    .from(amazonMarketIntelligence)
    .where(eq(amazonMarketIntelligence.asin, productId.toString()))
    .orderBy(desc(amazonMarketIntelligence.updatedAt));
}

/**
 * Save Amazon marketplace data for a product
 * @param data 
 */
export async function saveAmazonMarketData(data: any): Promise<any> {
  try {
    const [savedData] = await db
      .insert(amazonMarketIntelligence)
      .values({
        ...data,
        updatedAt: new Date()
      })
      .returning();
    return savedData;
  } catch (error: any) {
    if (error.code === '23505') {
      // Duplicate key error - fetch existing record instead of updating
      const [existingData] = await db
        .select()
        .from(amazonMarketIntelligence)
        .where(
          and(
            eq(amazonMarketIntelligence.asin, data.asin),
            eq(amazonMarketIntelligence.marketplaceId, data.marketplaceId || 'ATVPDKIKX0DER')
          )
        );
      return existingData;
    }
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
 * Get sync statistics
 */
export async function getSyncStats() {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN result = 'not_found' THEN 1 ELSE 0 END) as notFound,
        SUM(CASE WHEN result = 'rate_limited' THEN 1 ELSE 0 END) as rateLimited,
        AVG(response_time_ms) as avgResponseTime
      FROM amazon_sync_logs
      WHERE sync_started_at > NOW() - INTERVAL '24 hours'
    `);

    // Extract the first row from the result
    const stats = result.rows && result.rows.length > 0 ? result.rows[0] : null;
    
    return stats || { 
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