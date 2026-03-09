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
  createAsinRecord,
  createSyncJob,
  updateSyncJobProgress,
  markSyncJobComplete
} from './repository';
import { amazonRateLimiter } from '../utils/rate-limiter';
import { searchCatalogItemsByUPC, searchCatalogItemsByMPN } from './amazon-spapi-service';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';
import { InsertAmazonSyncLog } from '@shared/schema';

/**
 * Retry helper with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error (429)
      const is429Error = lastError.message.includes('429') || lastError.message.toLowerCase().includes('throttl');
      
      if (attempt < maxRetries && is429Error) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed with 429. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not a 429 error or we're out of retries, throw
      throw lastError;
    }
  }
  
  throw lastError!;
}

/**
 * Fetch Amazon marketplace data for a product by UPC and/or MPN (multi-strategy)
 * @param productId 
 * @param upc - UPC code (optional)
 * @param mpn - Manufacturer part number (optional) 
 * @param brand - Brand name for better MPN search accuracy (optional)
 */
export async function fetchAmazonDataByUpc(productId: number, upc: string, mpn?: string, brand?: string) {
  const startTime = Date.now();
  const config = await getAmazonConfigFromDb();
  let syncLog: any = {
    product_id: productId,
    upc: upc,
    batch_id: generateBatchId(),
    sync_status: 'success',
    asins_found: 0,
    sync_duration_ms: 0
  };
  
  try {
    await updateProductAmazonSyncStatus(productId, 'processing');
    
    let catalogItems: any[] = [];
    let matchMethod = 'upc_match';
    
    if (upc) {
      catalogItems = await searchCatalogItemsByUPC(upc);
    }
    
    if (catalogItems.length === 0 && mpn) {
      await new Promise(resolve => setTimeout(resolve, 500));
      catalogItems = await searchCatalogItemsByMPN(mpn, brand);
      if (catalogItems.length > 0) {
        matchMethod = 'mpn_match';
      }
    }
    
    if (!catalogItems.length) {
      const endTime = Date.now();
      syncLog = {
        ...syncLog,
        result: 'not_found',
        syncCompletedAt: new Date(),
        responseTimeMs: endTime - startTime,
      };
      
      await updateProductAmazonSyncStatus(productId, 'error');
      return [];
    }
    
    // Map and save each catalog item to our marketplace data schema
    const savedItems = [];
    for (const item of catalogItems) {
      // First, ensure the ASIN exists in the amazon_asins table
      await createAsinRecord({
        asin: item.asin,
        title: item.title || '',
        brand: item.brand || '',
        manufacturer: item.manufacturer || '',
        upc: upc || '',
        partNumber: item.partNumber || '',
        model: item.model || '',
        category: item.category || '',
        subcategory: item.subcategory || '',
        imageUrl: item.imageUrl || '',
        productType: item.productType || ''
      });

      // Initialize market data with catalog data
      const marketData: any = {
        asin: item.asin || '',
        currentPrice: item.price ? Math.round(parseFloat(item.price) * 100) : null,
        listPrice: item.listPrice ? Math.round(parseFloat(item.listPrice) * 100) : null,
        salesRank: item.salesRank || null,
        categoryRank: item.categoryRank || null,
        inStock: item.inStock !== false,
        fulfillmentMethod: item.fulfillmentMethod || 'FBA',
        isPrime: item.isPrime || false,
        profitMarginPercent: null,
        opportunityScore: Math.floor(Math.random() * 100) + 1,
        competitionLevel: 'medium',
        estimatedSalesPerMonth: null
      };

      // Fetch additional market intelligence data with rate limiting and retry logic
      try {
        const { amazonPricingRateLimiter, amazonFeesRateLimiter, amazonListingsRestrictionsRateLimiter } = await import('../utils/rate-limiter');
        const { getCompetitivePricing } = await import('../utils/amazon-spapi');
        const { getProductFees } = await import('../services/amazon-product-fees');
        const { amazonListingsRestrictionsService } = await import('./amazon-listings-restrictions');
        
        // 1. Get competitive pricing (buy box price) with rate limiting on every attempt
        const pricingData = await retryWithBackoff(
          async () => {
            await amazonPricingRateLimiter.waitAndConsume();
            return await getCompetitivePricing([item.asin]);
          },
          3, // max retries
          1000 // initial delay
        );
        
        if (pricingData && pricingData.length > 0 && pricingData[0].Product?.CompetitivePricing?.CompetitivePrices) {
          const buyBoxPrice = pricingData[0].Product.CompetitivePricing.CompetitivePrices[0]?.Price?.LandedPrice?.Amount;
          if (buyBoxPrice) {
            marketData.buyBoxPrice = Math.round(parseFloat(buyBoxPrice) * 100);
            marketData.currentPrice = marketData.buyBoxPrice;
          }
        }

        // 2. Get Amazon fees (referral + FBA fees) with rate limiting on every attempt
        if (marketData.currentPrice || marketData.buyBoxPrice) {
          const priceForFees = (marketData.buyBoxPrice || marketData.currentPrice) / 100;
          
          const feesData = await retryWithBackoff(
            async () => {
              await amazonFeesRateLimiter.waitAndConsume();
              return await getProductFees({
                asin: item.asin,
                price: priceForFees,
                isAmazonFulfilled: true
              });
            },
            3,
            1000
          );
          
          if (feesData) {
            marketData.referralFee = Math.round(feesData.referralFee * 100);
            marketData.fbaFee = Math.round(feesData.fbaFee * 100);
            marketData.variableClosingFee = Math.round(feesData.variableClosingFee * 100);
            marketData.totalFees = Math.round(feesData.totalFees * 100);
            marketData.lastFeeCheck = new Date();
          }
        }

        // 3. Get listing restrictions with rate limiting on every attempt
        const restrictionsData = await retryWithBackoff(
          async () => {
            await amazonListingsRestrictionsRateLimiter.waitAndConsume();
            return await amazonListingsRestrictionsService.getListingsRestrictions(
              item.asin,
              config.sellerId || '',
              [config.marketplaceId],
              'new_new'
            );
          },
          3,
          1000
        );
        
        if (restrictionsData) {
          const listingStatus = amazonListingsRestrictionsService.isListingAllowed(restrictionsData.restrictions, 'new_new');
          marketData.canList = listingStatus.allowed;
          marketData.listingRestrictions = restrictionsData.restrictions;
        }
      } catch (enrichmentError) {
        console.log(`[Sync] Warning: Could not fetch complete market intelligence for ${item.asin}:`, (enrichmentError as Error).message);
        // Continue with partial data - we'll save what we have
      }
      
      const savedData = await saveAmazonMarketData(marketData);
      
      const { createProductAsinMapping } = await import('./repository');
      await createProductAsinMapping({
        productId: productId,
        asin: item.asin,
        mappingSource: 'api_search',
        matchMethod: matchMethod,
        matchConfidence: matchMethod === 'upc_match' ? 95 : 90,
        isActive: true,
        isVerified: false,
        isDirectCompetitor: true,
        isSimilarProduct: false,
        opportunityScore: marketData.opportunityScore,
        confidenceScore: 0.85,
        source: 'sp_api'
      });
      
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
    await createSyncLog(syncLog);
    
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
    await createSyncLog(syncLog);
    
    throw error;
  }
}

/**
 * Get Amazon marketplace data for a product
 * @param productId 
 */
export async function getAmazonDataForProduct(productId: number) {
  const { getAmazonDataForProduct: getExistingData } = await import('./repository');
  const { db } = await import('../db');
  const { products } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  
  // First check if we have existing mappings
  const existingMappings = await getExistingData(productId);
  
  // If we have existing mappings, return them
  if (existingMappings && existingMappings.length > 0) {
    return existingMappings;
  }
  
  // If no mappings exist, get the product details and perform live search
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
    
  if (!product) {
    throw new Error(`Product with ID ${productId} not found`);
  }
  
  // Only perform live search if product has UPC or MPN
  if (!product.upc && !product.manufacturerPartNumber) {
    return []; // No UPC or MPN available for search
  }
  
  console.log(`🔍 No existing ASIN mappings found for product ${productId} (${product.sku})`);
  console.log(`📋 Product details: UPC=${product.upc}, MPN=${product.manufacturerPartNumber}`);
  
  // Try to fetch live data using UPC first, then MPN
  let liveResults = [];
  
  if (product.upc) {
    console.log(`🔎 Searching Amazon by UPC: ${product.upc}`);
    try {
      liveResults = await fetchAmazonDataByUpc(productId, product.upc);
    } catch (error) {
      console.error(`Error searching by UPC: ${error}`);
    }
  }
  
  // If no results from UPC and we have MPN, try searching by MPN
  if (liveResults.length === 0 && product.manufacturerPartNumber) {
    console.log(`🔎 Searching Amazon by MPN: ${product.manufacturerPartNumber}`);
    try {
      // Note: We'll use UPC search for now, but in a full implementation
      // you'd want to add MPN-specific search functionality
      liveResults = await fetchAmazonDataByUpc(productId, product.manufacturerPartNumber);
    } catch (error) {
      console.error(`Error searching by MPN: ${error}`);
    }
  }
  
  // Return live results or empty array
  return liveResults.length > 0 ? await getExistingData(productId) : [];
}

/**
 * Run a batch sync job to fetch Amazon data for multiple products
 * @param limit Maximum number of products to sync
 * @param force Force re-sync even if products were recently synced
 * @param supplierId Optional supplier ID to filter products
 */
export async function batchSyncAmazonData(limit: number = 10, force: boolean = false, supplierId?: number) {
  // Generate batch ID for grouping these sync operations
  const batchId = generateBatchId();
  
  // Get products that need syncing (with optional supplier filter)
  const products = await getProductsForAmazonSync(limit, force, supplierId);
  
  // Create sync job record
  await createSyncJob(batchId, products.length);
  
  const results = {
    batchId,
    processed: 0,
    successful: 0,
    failed: 0,
    notFound: 0,
    asinMatchesFound: 0,
    productIds: [] as number[],
  };
  
  // Handle case where no products need syncing
  if (products.length === 0) {
    console.log('ℹ️ No products need syncing');
    await markSyncJobComplete(batchId, 'completed');
    return results;
  }
  
  console.log(`🚀 Starting batch sync for ${products.length} products (2 req/sec rate limit)`);
  
  let rateLimitAborted = false;
  
  try {
    // Process each product sequentially (to respect rate limits)
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      results.processed++;
      results.productIds.push(product.id);
      
      const hasUpc = product.upc && product.upc.trim() !== '';
      const hasMpn = product.manufacturerPartNumber && product.manufacturerPartNumber.trim() !== '';
      console.log(`[${i + 1}/${products.length}] Syncing product ${product.id} (UPC: ${product.upc || '-'}, MPN: ${product.manufacturerPartNumber || '-'})...`);
      
      try {
        if (!hasUpc && !hasMpn) {
          console.log(`  ⚠️ Skipped - No UPC or MPN`);
          continue;
        }
        
        const asinData = await fetchAmazonDataByUpc(
          product.id, 
          product.upc || '', 
          product.manufacturerPartNumber || undefined,
          product.manufacturerName || undefined
        );
        
        if (asinData && asinData.length > 0) {
          results.successful++;
          results.asinMatchesFound += asinData.length;
          console.log(`  ✅ Success - Found ${asinData.length} ASIN(s)`);
        } else {
          results.notFound++;
          console.log(`  ℹ️ No ASINs found`);
        }
      } catch (error) {
        console.error(`  ❌ Failed: ${(error as Error).message}`);
        results.failed++;
        
        // If we hit rate limits despite the limiter, stop processing
        if ((error as Error).message.includes('429') || (error as Error).message.includes('QuotaExceeded')) {
          console.log('⚠️ Rate limit error despite rate limiter - stopping batch');
          rateLimitAborted = true;
          break;
        }
      }
      
      // Update job progress every 10 products or on last product
      if (i % 10 === 0 || i === products.length - 1) {
        await updateSyncJobProgress(batchId, {
          processedCount: results.processed,
          successCount: results.successful,
          failedCount: results.failed,
          notFoundCount: results.notFound,
          asinMatchesFound: results.asinMatchesFound,
        });
      }
    }
    
    console.log(`✅ Batch sync complete: ${results.successful} successful, ${results.failed} failed, ${results.notFound} not found`);
    
    // Mark job based on outcome
    if (rateLimitAborted) {
      console.log('⚠️ Batch aborted due to rate limiting');
      await markSyncJobComplete(batchId, 'failed', 'Rate limit exceeded - batch aborted');
    } else {
      await markSyncJobComplete(batchId, 'completed');
    }
  } catch (error) {
    console.error(`❌ Batch sync failed: ${(error as Error).message}`);
    await markSyncJobComplete(batchId, 'failed', (error as Error).message);
    throw error;
  }
  
  // Event Hook: Trigger Purchasing AI analysis for successfully synced products
  if (results.successful > 0 && results.productIds.length > 0) {
    try {
      const { purchasingAIScheduler } = await import('../purchasing/scheduler/job-scheduler');
      
      const jobId = await purchasingAIScheduler.createJob({
        name: `Auto-Analysis: Amazon Sync Completion (${results.successful} products)`,
        priority: 'medium',
        scheduleType: 'event_triggered',
        productIds: results.productIds,
        onlyStale: false, // Analyze all newly synced products
      });
      
      console.log(`🔗 Event Hook: Created purchasing analysis job ${jobId} for ${results.successful} products`);
    } catch (error) {
      console.error('⚠️ Failed to trigger purchasing analysis:', error);
      // Don't fail the sync if analysis trigger fails
    }
  }
  
  return results;
}