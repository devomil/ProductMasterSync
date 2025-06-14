/**
 * Enhanced Repository for Amazon Marketplace Intelligence
 * 
 * Supports comprehensive competitive analysis with:
 * - Multiple ASINs per product
 * - UPC and MFG# search tracking
 * - Profitability analysis
 * - Price and rank history
 */

import { db } from '../db';
import { eq, and, isNull, desc, sql, or, lt } from 'drizzle-orm';
import {
  products,
  amazonAsins,
  amazonMarketIntelligence,
  productAmazonLookup,
  productAsinMapping,
  amazonPriceHistory,
  type Product
} from '../../shared/schema';

/**
 * Save ASIN data to the enhanced database structure
 */
export async function saveAmazonAsin(asinData: any): Promise<any> {
  const [savedAsin] = await db
    .insert(amazonAsins)
    .values(asinData)
    .onConflictDoUpdate({
      target: amazonAsins.asin,
      set: {
        ...asinData,
        lastUpdatedAt: new Date(),
        updatedAt: new Date()
      }
    })
    .returning();

  return savedAsin;
}

/**
 * Save marketplace intelligence data
 */
export async function saveMarketIntelligence(intelligenceData: any): Promise<any> {
  const [savedIntelligence] = await db
    .insert(amazonMarketIntelligence)
    .values(intelligenceData)
    .onConflictDoUpdate({
      target: amazonMarketIntelligence.asin,
      set: {
        ...intelligenceData,
        updatedAt: new Date()
      }
    })
    .returning();

  return savedIntelligence;
}

/**
 * Get comprehensive Amazon data for a product
 */
export async function getProductAmazonData(productId: number) {
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
 * Create or update product lookup record
 */
export async function createProductLookup(data: any): Promise<any> {
  const [lookup] = await db
    .insert(productAmazonLookup)
    .values(data)
    .onConflictDoUpdate({
      target: productAmazonLookup.productId,
      set: {
        ...data,
        updatedAt: new Date()
      }
    })
    .returning();

  return lookup;
}

/**
 * Update lookup search status
 */
export async function updateLookupStatus(
  lookupId: number,
  method: string,
  status: string,
  asinsFound: number,
  nextMethod?: string
): Promise<void> {
  await db
    .update(productAmazonLookup)
    .set({
      searchMethod: method,
      searchStatus: status,
      asinsFound,
      nextSearchMethod: nextMethod || null,
      lastSearchAt: new Date(),
      shouldRetryAt: nextMethod ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      updatedAt: new Date()
    })
    .where(eq(productAmazonLookup.id, lookupId));
}

/**
 * Link ASIN to product
 */
export async function linkAsinToProduct(data: any): Promise<void> {
  await db
    .insert(productAsinMapping)
    .values(data)
    .onConflictDoNothing();
}

/**
 * Save price history record
 */
export async function savePriceHistory(data: any): Promise<void> {
  await db
    .insert(amazonPriceHistory)
    .values(data);
}

/**
 * Get products needing Amazon lookup
 */
export async function getProductsNeedingLookup(limit: number = 10) {
  const productsToProcess = await db
    .select()
    .from(products)
    .leftJoin(productAmazonLookup, eq(products.id, productAmazonLookup.productId))
    .where(
      or(
        isNull(productAmazonLookup.id),
        and(
          eq(productAmazonLookup.searchStatus, 'not_found'),
          lt(productAmazonLookup.shouldRetryAt, new Date())
        )
      )
    )
    .limit(limit);

  return productsToProcess;
}

/**
 * Get ASIN intelligence with price history
 */
export async function getAsinIntelligenceWithHistory(asin: string) {
  const intelligence = await db
    .select()
    .from(amazonMarketIntelligence)
    .where(eq(amazonMarketIntelligence.asin, asin));

  const priceHistory = await db
    .select()
    .from(amazonPriceHistory)
    .where(eq(amazonPriceHistory.asin, asin))
    .orderBy(desc(amazonPriceHistory.capturedAt))
    .limit(30); // Last 30 records

  return {
    intelligence: intelligence[0] || null,
    priceHistory
  };
}

/**
 * Get top opportunity ASINs for a product
 */
export async function getTopOpportunityAsins(productId: number, limit: number = 5) {
  const opportunities = await db
    .select({
      asin: productAsinMapping.asin,
      matchMethod: productAsinMapping.matchMethod,
      opportunityScore: amazonMarketIntelligence.opportunityScore,
      profitMarginPercent: amazonMarketIntelligence.profitMarginPercent,
      estimatedSalesPerMonth: amazonMarketIntelligence.estimatedSalesPerMonth,
      currentPrice: amazonMarketIntelligence.currentPrice,
      salesRank: amazonMarketIntelligence.salesRank,
      asinData: amazonAsins
    })
    .from(productAsinMapping)
    .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
    .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .where(eq(productAsinMapping.productId, productId))
    .orderBy(desc(amazonMarketIntelligence.opportunityScore))
    .limit(limit);

  return opportunities;
}

/**
 * Calculate aggregate opportunity metrics for a product
 */
export async function getProductOpportunityMetrics(productId: number) {
  const results = await db
    .select({
      totalAsins: sql<number>`count(*)`,
      avgOpportunityScore: sql<number>`avg(${amazonMarketIntelligence.opportunityScore})`,
      maxOpportunityScore: sql<number>`max(${amazonMarketIntelligence.opportunityScore})`,
      avgProfitMargin: sql<number>`avg(${amazonMarketIntelligence.profitMarginPercent})`,
      totalEstimatedSales: sql<number>`sum(${amazonMarketIntelligence.estimatedSalesPerMonth})`,
      avgPrice: sql<number>`avg(${amazonMarketIntelligence.currentPrice})`,
      bestSalesRank: sql<number>`min(${amazonMarketIntelligence.salesRank})`
    })
    .from(productAsinMapping)
    .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .where(eq(productAsinMapping.productId, productId))
    .groupBy(productAsinMapping.productId);

  return results[0] || null;
}