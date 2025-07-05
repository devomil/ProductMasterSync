/**
 * Enhanced Amazon SP-API Service using Official SDK
 * 
 * Implements comprehensive product data fetching with proper authentication,
 * rate limiting, and rich data extraction from Amazon's Catalog Items API
 */

import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2022-04-01';
import { createAsinRecord, saveAmazonMarketData } from './repository';

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
 * Get Amazon SP-API configuration from environment
 */
function getAmazonConfig(): AmazonConfig {
  return {
    clientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
    clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
    refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
    region: 'na',
    marketplaceId: 'ATVPDKIKX0DER' // US marketplace
  };
}

/**
 * Create authenticated SP-API client
 */
function createSpApiClient(): CatalogItemsApiClient {
  const config = getAmazonConfig();
  
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
 * Search Amazon catalog by UPC with comprehensive data
 */
export async function searchCatalogItemsByUPC(upc: string): Promise<any[]> {
  const client = createSpApiClient();
  const config = getAmazonConfig();
  
  try {
    console.log(`Searching Amazon catalog for UPC: ${upc}`);
    
    const response = await client.searchCatalogItems({
      marketplaceIds: [config.marketplaceId],
      identifiers: [upc],
      identifiersType: 'UPC',
      includedData: ['summaries', 'identifiers', 'images', 'classifications', 'salesRanks']
    });

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
    return [];
  }
}

/**
 * Get detailed catalog item data by ASIN
 */
export async function getCatalogItem(asin: string): Promise<any | null> {
  const client = createSpApiClient();
  const config = getAmazonConfig();
  
  try {
    console.log(`Getting detailed data for ASIN: ${asin}`);
    
    const response = await client.getCatalogItem({
      asin,
      marketplaceIds: [config.marketplaceId],
      includedData: ['attributes', 'identifiers', 'images', 'dimensions', 'classifications', 'relationships', 'salesRanks']
    });

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
      additionalImages: item.images?.[0]?.images?.slice(1).map(img => img.link) || [],
      salesRank: item.salesRanks?.[0]?.rank || 0,
      categoryRank: item.salesRanks?.[0]?.rank || 0,
      browseNodes: item.classifications?.map(c => c.classificationType) || [],
      identifiers: item.identifiers || [],
      dimensions: item.dimensions || {},
      relationships: item.relationships || [],
      attributes: item.attributes || {}
    };
    
  } catch (error) {
    console.error(`Error getting catalog item ${asin}:`, error);
    return null;
  }
}

/**
 * Enhanced product sync with comprehensive Amazon data
 */
export async function syncProductWithAmazon(productId: number, upc: string, mpn?: string): Promise<any> {
  try {
    console.log(`Starting Amazon sync for product ${productId} with UPC: ${upc}`);
    
    // Search by UPC first
    const catalogItems = await searchCatalogItemsByUPC(upc);
    
    if (catalogItems.length === 0) {
      console.log(`No Amazon items found for UPC: ${upc}`);
      return { success: false, message: 'No Amazon items found', items: [] };
    }

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
      message: `Found ${processedItems.length} Amazon items`,
      items: processedItems
    };
    
  } catch (error) {
    console.error('Error syncing product with Amazon:', error);
    return { success: false, message: error.message, items: [] };
  }
}

/**
 * Batch sync multiple products with Amazon
 */
export async function batchSyncWithAmazon(products: { id: number, upc: string, mpn?: string }[]): Promise<any> {
  const results = [];
  
  for (const product of products) {
    try {
      const result = await syncProductWithAmazon(product.id, product.upc, product.mpn);
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