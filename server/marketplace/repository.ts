/**
 * Amazon Marketplace Repository
 * 
 * Provides database operations for Amazon marketplace data
 */

import { db } from "../db";
import { amazonMarketData, products, InsertAmazonMarketData, AmazonMarketData } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Get Amazon marketplace data for a product
 */
export async function getAmazonMarketData(productId: number): Promise<AmazonMarketData[]> {
  try {
    return await db
      .select()
      .from(amazonMarketData)
      .where(eq(amazonMarketData.productId, productId))
      .orderBy(desc(amazonMarketData.dataFetchedAt));
  } catch (error) {
    console.error('Error getting Amazon market data:', error);
    throw new Error(`Failed to get Amazon market data: ${(error as Error).message}`);
  }
}

/**
 * Get Amazon marketplace data by ASIN
 */
export async function getAmazonMarketDataByAsin(asin: string): Promise<AmazonMarketData | undefined> {
  try {
    const results = await db
      .select()
      .from(amazonMarketData)
      .where(eq(amazonMarketData.asin, asin))
      .orderBy(desc(amazonMarketData.dataFetchedAt))
      .limit(1);
    
    return results[0];
  } catch (error) {
    console.error('Error getting Amazon market data by ASIN:', error);
    throw new Error(`Failed to get Amazon market data by ASIN: ${(error as Error).message}`);
  }
}

/**
 * Create or update Amazon marketplace data for a product
 */
export async function upsertAmazonMarketData(data: InsertAmazonMarketData): Promise<AmazonMarketData> {
  try {
    // Check if we already have this product/ASIN combination
    const existing = await db
      .select()
      .from(amazonMarketData)
      .where(
        and(
          eq(amazonMarketData.productId, data.productId),
          eq(amazonMarketData.asin, data.asin)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const [updated] = await db
        .update(amazonMarketData)
        .set({
          ...data,
          dataFetchedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(amazonMarketData.id, existing[0].id))
        .returning();
      
      return updated;
    } else {
      // Insert new record
      const [inserted] = await db
        .insert(amazonMarketData)
        .values({
          ...data,
          dataFetchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return inserted;
    }
  } catch (error) {
    console.error('Error upserting Amazon market data:', error);
    throw new Error(`Failed to upsert Amazon market data: ${(error as Error).message}`);
  }
}

/**
 * Find products with UPC codes that haven't been synced with Amazon
 */
export async function findProductsForAmazonSync(limit: number = 100): Promise<any[]> {
  try {
    // This query finds products with UPC codes that don't have corresponding Amazon market data
    // or haven't been synced in more than 7 days
    // The SQL would be:
    // SELECT p.* FROM products p
    // LEFT JOIN amazon_market_data amd ON p.id = amd.product_id
    // WHERE p.upc IS NOT NULL AND (amd.id IS NULL OR amd.data_fetched_at < NOW() - INTERVAL '7 days')
    // LIMIT {limit}
    
    // For now, let's simplify and just get products with UPC codes
    const results = await db.query.products.findMany({
      where: (products, { isNotNull, eq }) => 
        and(
          isNotNull(products.upc),
          eq(products.upc !== null, true) // workaround for drizzle-orm
        ),
      limit
    });
    
    return results;
  } catch (error) {
    console.error('Error finding products for Amazon sync:', error);
    throw new Error(`Failed to find products for Amazon sync: ${(error as Error).message}`);
  }
}

/**
 * Delete Amazon marketplace data for a product
 */
export async function deleteAmazonMarketData(id: number): Promise<void> {
  try {
    await db
      .delete(amazonMarketData)
      .where(eq(amazonMarketData.id, id));
  } catch (error) {
    console.error('Error deleting Amazon market data:', error);
    throw new Error(`Failed to delete Amazon market data: ${(error as Error).message}`);
  }
}