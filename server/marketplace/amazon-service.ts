/**
 * Amazon Marketplace Service
 * 
 * Provides services for Amazon marketplace data retrieval and management
 */

import { 
  searchCatalogItemsByUPC, 
  getCatalogItem, 
  extractMarketData, 
  getAmazonConfig,
  validateAmazonConfig
} from '../utils/amazon-spapi';
import { 
  getAmazonMarketData, 
  getAmazonMarketDataByAsin,
  upsertAmazonMarketData,
  findProductsForAmazonSync
} from './repository';
import { InsertAmazonMarketData, AmazonMarketData } from '@shared/schema';

/**
 * Fetch Amazon marketplace data for a product by UPC
 */
export async function fetchAmazonDataByUpc(productId: number, upc: string): Promise<AmazonMarketData[]> {
  try {
    // Get Amazon SP-API configuration
    const config = getAmazonConfig();
    
    // Validate configuration
    if (!validateAmazonConfig(config)) {
      throw new Error('Amazon SP-API configuration is not valid or missing required credentials');
    }

    // Search Amazon catalog by UPC
    const catalogItems = await searchCatalogItemsByUPC(upc, config);
    if (!catalogItems || catalogItems.length === 0) {
      return [];
    }

    // Process each matching ASIN
    const results: AmazonMarketData[] = [];
    for (const item of catalogItems) {
      // Get detailed catalog item information
      const detailedItem = await getCatalogItem(item.asin, config);
      
      // Extract and normalize market data
      const marketData = extractMarketData(detailedItem);
      if (!marketData) {
        continue;
      }

      // Prepare data for database
      const insertData: InsertAmazonMarketData = {
        productId,
        asin: marketData.asin,
        title: marketData.title,
        category: marketData.category,
        brand: marketData.brand,
        priceEstimate: marketData.priceEstimate,
        salesRank: marketData.salesRank,
        restrictionsFlag: marketData.restrictionsFlag,
        parentAsin: marketData.parentAsin,
        variationCount: marketData.variationCount,
        marketplaceId: config.marketplaceId,
        imageUrl: marketData.imageUrl,
        fulfillmentOptions: marketData.fulfillmentOptions,
        additionalData: {} // Any additional data can be stored here
      };

      // Save to database
      const savedData = await upsertAmazonMarketData(insertData);
      results.push(savedData);
    }

    return results;
  } catch (error) {
    console.error('Error fetching Amazon data by UPC:', error);
    throw new Error(`Failed to fetch Amazon data: ${(error as Error).message}`);
  }
}

/**
 * Get Amazon marketplace data for a product
 */
export async function getAmazonDataForProduct(productId: number): Promise<AmazonMarketData[]> {
  try {
    return await getAmazonMarketData(productId);
  } catch (error) {
    console.error('Error getting Amazon data for product:', error);
    throw new Error(`Failed to get Amazon data: ${(error as Error).message}`);
  }
}

/**
 * Run a batch sync job to fetch Amazon data for products with UPC codes
 */
export async function batchSyncAmazonData(limit: number = 10): Promise<{ 
  processed: number, 
  successful: number,
  failed: number,
  errors: Record<string, string>
}> {
  try {
    // Find products that need Amazon data
    const products = await findProductsForAmazonSync(limit);
    if (!products || products.length === 0) {
      return { processed: 0, successful: 0, failed: 0, errors: {} };
    }

    // Prepare result counters
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: {} as Record<string, string>
    };

    // Process each product
    for (const product of products) {
      if (!product.upc) {
        continue;
      }

      result.processed++;

      try {
        // Fetch and save Amazon data
        const amazonData = await fetchAmazonDataByUpc(product.id, product.upc);
        
        if (amazonData && amazonData.length > 0) {
          result.successful++;
        } else {
          result.failed++;
          result.errors[product.sku] = 'No Amazon data found for UPC';
        }
      } catch (error) {
        result.failed++;
        result.errors[product.sku] = (error as Error).message;
      }
    }

    return result;
  } catch (error) {
    console.error('Error in batch sync of Amazon data:', error);
    throw new Error(`Failed to batch sync Amazon data: ${(error as Error).message}`);
  }
}