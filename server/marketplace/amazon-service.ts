/**
 * Amazon Marketplace Service
 * 
 * Implements the core functionality for syncing product data with Amazon SP-API
 */

import {
  saveAmazonMarketData,
  getProductsForAmazonSync,
  updateProductAmazonSyncStatus,
  createSyncLog,
  generateBatchId,
  createAsinRecord
} from './repository';
import { amazonRateLimiter } from '../utils/rate-limiter';
import { searchCatalogItemsByUPC, getAmazonConfig } from '../utils/amazon-spapi';
import { InsertAmazonSyncLog } from '@shared/schema';

/**
 * Fetch Amazon marketplace data for a product by UPC
 * @param productId 
 * @param upc 
 */
export async function fetchAmazonDataByUpc(productId: number, upc: string) {
  const startTime = Date.now();
  const config = getAmazonConfig();
  let syncLog: any = {
    product_id: productId,
    upc: upc,
    batch_id: generateBatchId(),
    sync_status: 'success',
    asins_found: 0,
    sync_duration_ms: 0
  };
  
  try {
    // First update product status to indicate it's processing
    await updateProductAmazonSyncStatus(productId, 'processing');
    
    // Wait for token to be available (respects rate limits)
    await amazonRateLimiter.waitAndConsume();
    
    // Fetch catalog items from Amazon by UPC
    const catalogItems = await searchCatalogItemsByUPC(upc, config);
    
    if (!catalogItems.length) {
      // No items found
      const endTime = Date.now();
      syncLog = {
        ...syncLog,
        result: 'not_found',
        syncCompletedAt: new Date(),
        responseTimeMs: endTime - startTime,
      };
      
      // await createSyncLog(syncLog);
      await updateProductAmazonSyncStatus(productId, 'error');
      return [];
    }
    
    // Map and save each catalog item to our marketplace data schema
    const savedItems = [];
    for (const item of catalogItems) {
      // First, ensure the ASIN exists in the amazon_asins table
      try {
        await db.insert(amazonAsins).values({
          asin: item.asin,
          title: item.title || '',
          brand: item.brand || '',
          manufacturer: item.manufacturer || '',
          upc: upc || '',
          partNumber: item.partNumber || '',
          model: item.model || '',
          category: item.category || '',
          subcategory: item.subcategory || '',
          mainImageUrl: item.imageUrl || '',
          productType: item.productType || '',
          marketplace: 'US'
        }).onConflictDoNothing();
      } catch (asinError) {
        console.log(`ASIN ${item.asin} already exists or error inserting:`, asinError);
      }

      const marketData = {
        asin: item.asin || '',
        currentPrice: item.price ? Math.round(parseFloat(item.price) * 100) : null, // Convert to cents
        listPrice: item.listPrice ? Math.round(parseFloat(item.listPrice) * 100) : null,
        salesRank: item.salesRank || null,
        categoryRank: item.categoryRank || null,
        inStock: item.inStock !== false,
        fulfillmentMethod: item.fulfillmentMethod || 'FBA',
        isPrime: item.isPrime || false,
        profitMarginPercent: null, // Will be calculated
        opportunityScore: Math.floor(Math.random() * 100) + 1, // Placeholder scoring
        competitionLevel: 'medium',
        estimatedSalesPerMonth: null
      };
      
      const savedData = await saveAmazonMarketData(marketData);
      savedItems.push(savedData);
    }
    
    // Update sync status to success
    await updateProductAmazonSyncStatus(productId, 'success');
    
    // Create success sync log
    const endTime = Date.now();
    syncLog = {
      ...syncLog,
      sync_status: 'success',
      asins_found: catalogItems.length,
      sync_duration_ms: endTime - startTime
    };
    // await createSyncLog(syncLog);
    
    return savedItems;
  } catch (error) {
    const endTime = Date.now();
    
    // Determine if it's a rate limiting error
    const errorMessage = (error as Error).message;
    const isRateLimited = errorMessage.includes('rate') && errorMessage.includes('limit');
    
    // Update product status
    await updateProductAmazonSyncStatus(productId, 'error');
    
    // Create error sync log
    syncLog = {
      ...syncLog,
      result: isRateLimited ? 'rate_limited' : 'error',
      syncCompletedAt: new Date(),
      responseTimeMs: endTime - startTime,
      errorMessage: errorMessage.substring(0, 255) // Trim to fit in DB column
    };
    // await createSyncLog(syncLog);
    
    throw error;
  }
}

/**
 * Get Amazon marketplace data for a product
 * @param productId 
 */
export async function getAmazonDataForProduct(productId: number) {
  // Import as a named import to avoid recursive call
  return await import('./repository').then(repo => repo.getAmazonDataForProduct(productId));
}

/**
 * Run a batch sync job to fetch Amazon data for multiple products
 * @param limit 
 */
export async function batchSyncAmazonData(limit: number = 10) {
  // Generate batch ID for grouping these sync operations
  const batchId = generateBatchId();
  
  // Get products that need syncing
  const products = await getProductsForAmazonSync(limit);
  
  const results = {
    batchId,
    processed: 0,
    successful: 0,
    failed: 0,
    productIds: [] as number[],
  };
  
  // Process each product sequentially (to respect rate limits)
  for (const product of products) {
    results.processed++;
    results.productIds.push(product.id);
    
    try {
      if (!product.upc) {
        // Skip products without UPC
        continue;
      }
      
      // Perform the sync
      await fetchAmazonDataByUpc(product.id, product.upc);
      results.successful++;
    } catch (error) {
      console.error(`Error syncing product ${product.id}:`, error);
      results.failed++;
      
      // If we hit rate limits, stop processing more
      if ((error as Error).message.includes('rate') && (error as Error).message.includes('limit')) {
        console.log('Rate limit reached, stopping batch processing');
        break;
      }
    }
  }
  
  return results;
}