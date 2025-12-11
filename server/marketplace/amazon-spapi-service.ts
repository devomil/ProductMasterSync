/**
 * Enhanced Amazon SP-API Service using Official SDK
 * 
 * Implements comprehensive product data fetching with proper authentication,
 * dynamic rate limiting using x-amzn-RateLimit-Limit headers, and rich data 
 * extraction from Amazon's Catalog Items API v2022-04-01
 * 
 * Rate Limits (per account-application pair):
 * - getCatalogItem: 2 req/sec, burst 2
 * - searchCatalogItems: 2 req/sec, burst 2 (50 req/sec for keyword searches)
 */

import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2022-04-01';
import { createAsinRecord, saveAmazonMarketData } from './repository';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';

/**
 * Dynamic Rate Limiter using Amazon's response headers
 */
class AmazonRateLimiter {
  private static instance: AmazonRateLimiter;
  private operationLimits: Map<string, { limit: number, remaining: number, resetTime: number }> = new Map();
  private lastRequestTime: Map<string, number> = new Map();
  private requestQueue: Map<string, Promise<any>[]> = new Map();

  static getInstance(): AmazonRateLimiter {
    if (!AmazonRateLimiter.instance) {
      AmazonRateLimiter.instance = new AmazonRateLimiter();
    }
    return AmazonRateLimiter.instance;
  }

  /**
   * Update rate limits from Amazon response headers
   */
  updateLimitsFromHeaders(operation: string, headers: any): void {
    const limit = headers['x-amzn-ratelimit-limit'];
    const remaining = headers['x-amzn-ratelimit-remaining'];
    const resetTime = headers['x-amzn-ratelimit-reset'];

    if (limit || remaining || resetTime) {
      console.log(`Rate limit info for ${operation}:`, { limit, remaining, resetTime });
      
      this.operationLimits.set(operation, {
        limit: limit ? parseFloat(limit) : 2, // Default to 2 req/sec
        remaining: remaining ? parseFloat(remaining) : 2,
        resetTime: resetTime ? parseFloat(resetTime) : Date.now() + 1000
      });
    }
  }

  /**
   * Wait if necessary to respect rate limits
   */
  async waitForRateLimit(operation: string): Promise<void> {
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(operation) || 0;
    const timeSinceLastRequest = now - lastRequest;
    
    // Get current limits for this operation
    const limits = this.operationLimits.get(operation);
    
    if (limits && limits.remaining <= 0 && now < limits.resetTime) {
      const waitTime = limits.resetTime - now;
      console.log(`Rate limit reached for ${operation}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else if (timeSinceLastRequest < 500) {
      // Minimum 500ms between requests to be safe
      const waitTime = 500 - timeSinceLastRequest;
      console.log(`Throttling ${operation}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime.set(operation, Date.now());
  }
}

const rateLimiter = AmazonRateLimiter.getInstance();

/**
 * Amazon SP-API Configuration
 */
interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: string;
  marketplaceId: string;
}

/**
 * Get Amazon SP-API configuration from database first, then environment fallback
 */
async function getAmazonConfig(): Promise<AmazonConfig> {
  const dbConfig = await getAmazonConfigFromDb();
  return {
    clientId: dbConfig.clientId,
    clientSecret: dbConfig.clientSecret,
    refreshToken: dbConfig.refreshToken,
    region: 'na',
    marketplaceId: dbConfig.marketplaceId || 'ATVPDKIKX0DER' // US marketplace
  };
}

/**
 * Create authenticated SP-API client
 */
async function createSpApiClient(): Promise<CatalogItemsApiClient> {
  const config = await getAmazonConfig();
  
  const auth = new SellingPartnerApiAuth({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: config.refreshToken
  });

  return new CatalogItemsApiClient({ 
    auth, 
    region: config.region,
    rateLimiting: { retry: true }
  });
}

/**
 * Search Amazon catalog by UPC with comprehensive data and rate limiting
 */
export async function searchCatalogItemsByUPC(upc: string): Promise<any[]> {
  const client = await createSpApiClient();
  const config = await getAmazonConfig();
  
  try {
    console.log(`Searching Amazon catalog for UPC: ${upc}`);
    
    // Apply rate limiting before making request
    await rateLimiter.waitForRateLimit('searchCatalogItems');
    
    const response = await client.searchCatalogItems({
      marketplaceIds: [config.marketplaceId],
      identifiers: [upc],
      identifiersType: 'UPC',
      includedData: ['summaries', 'identifiers', 'images', 'classifications', 'salesRanks']
    });

    // Update rate limits from response headers if available
    if (response.headers) {
      rateLimiter.updateLimitsFromHeaders('searchCatalogItems', response.headers);
    }

    const items = response.items || [];
    console.log(`Found ${items.length} items for UPC ${upc}`);
    
    return items.map(item => ({
      asin: item.asin,
      title: item.summaries?.[0]?.itemName || '',
      brand: item.summaries?.[0]?.brand || '',
      manufacturer: item.summaries?.[0]?.manufacturer || '',
      upc: upc,
      category: item.classifications?.[0]?.productGroup || '',
      subcategory: item.classifications?.[0]?.productType || '',
      imageUrl: item.images?.[0]?.images?.[0]?.link || '',
      primaryImageUrl: item.images?.[0]?.images?.[0]?.link || '',
      salesRank: item.salesRanks?.[0]?.rank || 0,
      categoryRank: item.salesRanks?.[0]?.rank || 0,
      browseNodes: item.classifications?.map(c => c.classificationType) || [],
      identifiers: item.identifiers || [],
      dimensions: item.dimensions || {},
      relationships: item.relationships || []
    }));
    
  } catch (error) {
    console.error('Error searching Amazon catalog:', error);
    if (error.response?.status === 429) {
      console.log('Rate limit exceeded, implementing backoff');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return [];
  }
}

/**
 * Search Amazon catalog by MPN (Manufacturer Part Number) using keyword search
 * The SP-API allows searching by keywords which can include MPN
 */
export async function searchCatalogItemsByMPN(mpn: string, brand?: string): Promise<any[]> {
  const client = await createSpApiClient();
  const config = await getAmazonConfig();
  
  try {
    // Build search keywords: combine MPN with brand for better accuracy
    const keywords = brand ? `${brand} ${mpn}` : mpn;
    console.log(`Searching Amazon catalog by MPN: ${mpn} (keywords: ${keywords})`);
    
    // Apply rate limiting before making request
    await rateLimiter.waitForRateLimit('searchCatalogItems');
    
    const response = await client.searchCatalogItems({
      marketplaceIds: [config.marketplaceId],
      keywords: keywords,
      includedData: ['summaries', 'identifiers', 'images', 'classifications', 'salesRanks']
    });

    // Update rate limits from response headers if available
    if (response.headers) {
      rateLimiter.updateLimitsFromHeaders('searchCatalogItems', response.headers);
    }

    const items = response.items || [];
    console.log(`Found ${items.length} items for MPN ${mpn}`);
    
    // Filter results to find items that match the MPN more precisely
    const filteredItems = items.filter(item => {
      // Check if any identifier matches the MPN
      const identifiers = item.identifiers || [];
      for (const marketplaceId of identifiers) {
        for (const identifier of marketplaceId.identifiers || []) {
          if (identifier.identifierType === 'MODEL_NUMBER' && 
              identifier.identifier?.toLowerCase() === mpn.toLowerCase()) {
            return true;
          }
        }
      }
      // Also check if the title contains the MPN (common pattern)
      const title = item.summaries?.[0]?.itemName || '';
      if (title.toLowerCase().includes(mpn.toLowerCase())) {
        return true;
      }
      return false;
    });
    
    console.log(`Filtered to ${filteredItems.length} items matching MPN ${mpn}`);
    
    return filteredItems.map(item => ({
      asin: item.asin,
      title: item.summaries?.[0]?.itemName || '',
      brand: item.summaries?.[0]?.brand || '',
      manufacturer: item.summaries?.[0]?.manufacturer || '',
      mpn: mpn,
      matchMethod: 'mpn',
      category: item.classifications?.[0]?.productGroup || '',
      subcategory: item.classifications?.[0]?.productType || '',
      imageUrl: item.images?.[0]?.images?.[0]?.link || '',
      primaryImageUrl: item.images?.[0]?.images?.[0]?.link || '',
      salesRank: item.salesRanks?.[0]?.rank || 0,
      categoryRank: item.salesRanks?.[0]?.rank || 0,
      browseNodes: item.classifications?.map(c => c.classificationType) || [],
      identifiers: item.identifiers || [],
      dimensions: item.dimensions || {},
      relationships: item.relationships || []
    }));
    
  } catch (error: any) {
    console.error('Error searching Amazon catalog by MPN:', error);
    if (error.response?.status === 429) {
      console.log('Rate limit exceeded, implementing backoff');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return [];
  }
}

/**
 * Search Amazon catalog with fallback: UPC first, then MPN if no results
 */
export async function searchCatalogItemsWithFallback(
  upc?: string, 
  mpn?: string, 
  brand?: string
): Promise<{ items: any[], matchMethod: 'upc' | 'mpn' | 'none' }> {
  // Try UPC first if available
  if (upc) {
    const upcResults = await searchCatalogItemsByUPC(upc);
    if (upcResults.length > 0) {
      return { 
        items: upcResults.map(item => ({ ...item, matchMethod: 'upc' })), 
        matchMethod: 'upc' 
      };
    }
    console.log(`No results for UPC ${upc}, trying MPN fallback`);
  }
  
  // Fall back to MPN if available
  if (mpn) {
    const mpnResults = await searchCatalogItemsByMPN(mpn, brand);
    if (mpnResults.length > 0) {
      return { items: mpnResults, matchMethod: 'mpn' };
    }
  }
  
  return { items: [], matchMethod: 'none' };
}

/**
 * Get detailed catalog item data by ASIN with rate limiting
 */
export async function getCatalogItem(asin: string): Promise<any | null> {
  const client = await createSpApiClient();
  const config = await getAmazonConfig();
  
  try {
    console.log(`Getting detailed data for ASIN: ${asin}`);
    
    // Apply rate limiting before making request
    await rateLimiter.waitForRateLimit('getCatalogItem');
    
    const response = await client.getCatalogItem({
      asin,
      marketplaceIds: [config.marketplaceId],
      includedData: ['attributes', 'identifiers', 'images', 'dimensions', 'classifications', 'relationships', 'salesRanks']
    });

    // Update rate limits from response headers if available
    if (response.headers) {
      rateLimiter.updateLimitsFromHeaders('getCatalogItem', response.headers);
    }

    const item = response;
    if (!item) return null;

    return {
      asin: item.asin,
      title: item.summaries?.[0]?.itemName || '',
      brand: item.summaries?.[0]?.brand || '',
      manufacturer: item.summaries?.[0]?.manufacturer || '',
      category: item.classifications?.[0]?.productGroup || '',
      subcategory: item.classifications?.[0]?.productType || '',
      imageUrl: item.images?.[0]?.images?.[0]?.link || '',
      primaryImageUrl: item.images?.[0]?.images?.[0]?.link || '',
      additionalImages: item.images?.[0]?.images?.slice(1).map((img: any) => img.link) || [],
      salesRank: item.salesRanks?.[0]?.rank || 0,
      categoryRank: item.salesRanks?.[0]?.rank || 0,
      browseNodes: item.classifications?.map((c: any) => c.classificationType) || [],
      identifiers: item.identifiers || [],
      dimensions: item.dimensions || {},
      relationships: item.relationships || [],
      attributes: item.attributes || {}
    };
    
  } catch (error: any) {
    console.error(`Error getting catalog item ${asin}:`, error);
    if (error.response?.status === 429) {
      console.log('Rate limit exceeded for getCatalogItem, implementing backoff');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return null;
  }
}

/**
 * Enhanced product sync with comprehensive Amazon data
 * Supports both UPC and MPN-based lookups with automatic fallback
 */
export async function syncProductWithAmazon(
  productId: number, 
  upc?: string, 
  mpn?: string, 
  brand?: string
): Promise<any> {
  try {
    console.log(`Starting Amazon sync for product ${productId} with UPC: ${upc || 'none'}, MPN: ${mpn || 'none'}`);
    
    // Use fallback search: UPC first, then MPN
    const { items: catalogItems, matchMethod } = await searchCatalogItemsWithFallback(upc, mpn, brand);
    
    if (catalogItems.length === 0) {
      console.log(`No Amazon items found for product ${productId}`);
      return { success: false, message: 'No Amazon items found', items: [], matchMethod: 'none' };
    }
    
    console.log(`Found ${catalogItems.length} items via ${matchMethod} search`);

    // Process each found item
    const processedItems = [];
    for (const item of catalogItems) {
      // Get additional detailed data
      const detailedItem = await getCatalogItem(item.asin);
      const finalItem = { ...item, ...detailedItem };
      
      // Store ASIN record in database
      await createAsinRecord({
        asin: finalItem.asin,
        title: finalItem.title,
        brand: finalItem.brand,
        manufacturer: finalItem.manufacturer,
        upc: upc,
        category: finalItem.category,
        subcategory: finalItem.subcategory,
        imageUrl: finalItem.imageUrl,
        primaryImageUrl: finalItem.primaryImageUrl,
        additionalImages: finalItem.additionalImages,
        salesRank: finalItem.salesRank,
        categoryRank: finalItem.categoryRank,
        browseNodes: finalItem.browseNodes,
        identifiers: finalItem.identifiers,
        dimensions: finalItem.dimensions,
        relationships: finalItem.relationships,
        attributes: finalItem.attributes
      });

      processedItems.push(finalItem);
    }

    return {
      success: true,
      message: `Found ${processedItems.length} Amazon items via ${matchMethod}`,
      items: processedItems,
      matchMethod
    };
    
  } catch (error: any) {
    console.error('Error syncing product with Amazon:', error);
    return { success: false, message: error.message, items: [], matchMethod: 'none' };
  }
}

/**
 * Batch sync multiple products with Amazon
 * Supports UPC, MPN, and brand for matching
 */
export async function batchSyncWithAmazon(products: { id: number, upc?: string, mpn?: string, brand?: string }[]): Promise<any> {
  const results = [];
  
  for (const product of products) {
    try {
      const result = await syncProductWithAmazon(product.id, product.upc, product.mpn, product.brand);
      results.push({ productId: product.id, ...result });
      
      // Rate limiting - wait 200ms between requests (5 req/sec limit)
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error syncing product ${product.id}:`, error);
      results.push({ 
        productId: product.id, 
        success: false, 
        message: error.message 
      });
    }
  }
  
  return {
    totalProcessed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}