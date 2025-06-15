/**
 * Amazon Selling Partner API Integration
 * 
 * This utility provides functionality to interact with Amazon's SP-API
 * for catalog item lookup and marketplace data retrieval.
 */

import axios from 'axios';
import crypto from 'crypto';
import { createHmac } from 'crypto';

// SP-API configuration using LWA OAuth 2.0
interface SPAPIConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId: string;
  endpoint: string;
}

// Authentication interfaces
interface SPAPIToken {
  access_token: string;
  expires_at: number;
}

interface SPAPICatalogItem {
  asin: string;
  attributes: Record<string, any>;
}

// Current token cache
let tokenCache: SPAPIToken | null = null;

// Remove AWS signature generation - no longer needed with LWA OAuth 2.0

/**
 * Get access token for SP-API
 */
async function getAccessToken(config: SPAPIConfig): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    const expiresIn = response.data.expires_in || 3600;
    tokenCache = {
      access_token: response.data.access_token,
      expires_at: Date.now() + (expiresIn * 1000) - 60000 // Expire 1 minute early for safety
    };

    return tokenCache.access_token;
  } catch (error) {
    console.error('Error getting Amazon SP-API token:', error);
    throw new Error('Failed to authenticate with Amazon SP-API');
  }
}

/**
 * Search catalog items by UPC
 */
export async function searchCatalogItemsByUPC(
  upc: string,
  config: SPAPIConfig
): Promise<SPAPICatalogItem[]> {
  try {
    // Get access token
    const accessToken = await getAccessToken(config);
    
    // Setup API call parameters
    const endpoint = config.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const path = '/catalog/2022-04-01/items';
    const queryParams = {
      marketplaceIds: config.marketplaceId,
      identifiers: upc,
      identifiersType: 'UPC',
      includedData: 'attributes,dimensions,images,productTypes,relationships,salesRanks,summaries'
    };

    // Build query string
    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key as keyof typeof queryParams])}`)
      .join('&');

    // Make API request with LWA OAuth 2.0 authentication
    const response = await axios({
      method: 'GET',
      url: `${endpoint}${path}?${queryString}`,
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    // Extract relevant catalog item details
    if (response.data && response.data.items) {
      return response.data.items.map((item: any) => ({
        asin: item.asin,
        attributes: item.attributes || {}
      }));
    }

    return [];
  } catch (error: any) {
    console.error('Error searching catalog items by UPC:', error);
    if (error.response?.data) {
      console.error('Amazon API error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to search Amazon catalog: ${error.message}`);
  }
}

/**
 * Get detailed catalog item information by ASIN
 */
export async function getCatalogItem(
  asin: string,
  config: SPAPIConfig
): Promise<any> {
  try {
    // Get access token
    const accessToken = await getAccessToken(config);
    
    // Setup API call parameters
    const endpoint = config.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const path = `/catalog/2022-04-01/items/${asin}`;
    const queryParams = {
      marketplaceIds: config.marketplaceId,
      includedData: 'attributes,dimensions,images,productTypes,relationships,salesRanks,summaries'
    };

    // Build query string
    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key as keyof typeof queryParams])}`)
      .join('&');

    // Make API request with LWA OAuth 2.0 authentication
    const response = await axios({
      method: 'GET',
      url: `${endpoint}${path}?${queryString}`,
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error getting catalog item details:', error);
    throw new Error(`Failed to get Amazon catalog item: ${(error as Error).message}`);
  }
}

/**
 * Extract and normalize data from Amazon catalog item response
 */
export function extractMarketData(item: any): any {
  if (!item) {
    return null;
  }

  // Extract basic info
  const result: any = {
    asin: item.asin || '',
    title: '',
    brand: '',
    category: '',
    salesRank: null,
    priceEstimate: null,
    restrictionsFlag: false,
    parentAsin: null,
    variationCount: 0,
    imageUrl: '',
    fulfillmentOptions: []
  };

  // Get title and brand
  if (item.attributes) {
    if (item.attributes.item_name) {
      result.title = Array.isArray(item.attributes.item_name) 
        ? item.attributes.item_name[0].value 
        : item.attributes.item_name.value;
    }
    
    if (item.attributes.brand) {
      result.brand = Array.isArray(item.attributes.brand) 
        ? item.attributes.brand[0].value 
        : item.attributes.brand.value;
    }
  }

  // Get category from product type or browse nodes
  if (item.productTypes && item.productTypes.length > 0) {
    result.category = item.productTypes[0].productType;
  } else if (item.attributes && item.attributes.browse_classification) {
    const browseClass = Array.isArray(item.attributes.browse_classification) 
      ? item.attributes.browse_classification[0] 
      : item.attributes.browse_classification;
    
    if (browseClass && browseClass.value) {
      result.category = browseClass.value;
    }
  }

  // Get sales rank
  if (item.salesRanks && item.salesRanks.length > 0 && item.salesRanks[0].ranks) {
    const firstRank = item.salesRanks[0].ranks[0];
    if (firstRank && firstRank.rank) {
      result.salesRank = firstRank.rank;
    }
  }

  // Get parent ASIN for variations
  if (item.relationships) {
    const parentRelation = item.relationships.find((rel: any) => rel.type === 'VARIATION_PARENT');
    if (parentRelation && parentRelation.identifiers) {
      result.parentAsin = parentRelation.identifiers.marketplaceASIN?.asin || null;
    }
  }

  // Get image URL
  if (item.images && item.images.length > 0 && item.images[0].images) {
    const mainImage = item.images[0].images.find((img: any) => img.variant === 'MAIN');
    if (mainImage && mainImage.link) {
      result.imageUrl = mainImage.link;
    } else if (item.images[0].images[0] && item.images[0].images[0].link) {
      result.imageUrl = item.images[0].images[0].link;
    }
  }

  // Determine fulfillment options (simple inference)
  if (item.attributes) {
    if (item.attributes.fulfillment_availability) {
      result.fulfillmentOptions.push('FBA');
    }
    if (item.attributes.merchant_shipping) {
      result.fulfillmentOptions.push('FBM');
    }
  }

  return result;
}

/**
 * Load Amazon SP-API configuration from environment variables
 */
export function getAmazonConfig(): SPAPIConfig {
  return {
    clientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
    clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
    refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
    marketplaceId: process.env.AMAZON_SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER', // Default US marketplace
    endpoint: process.env.AMAZON_SP_API_ENDPOINT || 'https://sellingpartnerapi-na.amazon.com'
  };
}

/**
 * Check if Amazon SP-API configuration is valid
 */
export function validateAmazonConfig(config: SPAPIConfig): boolean {
  return !!(
    config.clientId &&
    config.clientSecret &&
    config.refreshToken
  );
}

/**
 * Get pricing information including buy box pricing using SP-API Product Pricing API
 */
export async function getPricing(asins: string[]): Promise<any[]> {
  const config = getAmazonConfig();
  const accessToken = await getAccessToken(config);
  const results = [];
  const batchSize = 20;

  for (let i = 0; i < asins.length; i += batchSize) {
    const batch = asins.slice(i, i + batchSize);
    
    try {
      const response = await axios.get(`${config.endpoint}/products/pricing/v0/pricing`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        },
        params: {
          MarketplaceId: config.marketplaceId,
          Asins: batch.join(','),
          ItemType: 'Asin'
        }
      });

      if (response.data && response.data.payload) {
        results.push(...response.data.payload);
      }
    } catch (error) {
      console.error(`Error fetching pricing for batch:`, error);
      // Log the full error response for debugging
      if (error.response) {
        console.error('Pricing API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url
        });
      }
    }
    
    // Rate limiting
    if (i + batchSize < asins.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get competitive pricing information for ASINs using SP-API Product Pricing API
 */
export async function getCompetitivePricing(asins: string[]): Promise<any[]> {
  const config = getAmazonConfig();
  const accessToken = await getAccessToken(config);
  const results = [];
  const batchSize = 20;

  for (let i = 0; i < asins.length; i += batchSize) {
    const batch = asins.slice(i, i + batchSize);
    
    try {
      const response = await axios.get(`${config.endpoint}/products/pricing/v0/competitivePrice`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        },
        params: {
          MarketplaceId: config.marketplaceId,
          Asins: batch.join(','),
          ItemType: 'Asin'
        }
      });

      if (response.data && response.data.payload) {
        results.push(...response.data.payload);
      }
    } catch (error: any) {
      console.error(`Error fetching competitive pricing for batch:`, error);
      // Log the full error response for debugging
      if (error.response) {
        console.error('Competitive Pricing API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url
        });
      }
    }
    
    // Rate limiting
    if (i + batchSize < asins.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get item offers (lowest priced offers) for ASINs using SP-API
 */
export async function getItemOffers(asins: string[]): Promise<any[]> {
  const config = getAmazonConfig();
  
  if (!validateAmazonConfig(config)) {
    throw new Error('Amazon SP-API configuration is invalid');
  }

  const accessToken = await getAccessToken(config);
  const results = [];

  // Process each ASIN individually for item offers
  for (const asin of asins) {
    try {
      const response = await axios.get(`${config.endpoint}/products/pricing/v0/items/${asin}/offers`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        },
        params: {
          MarketplaceId: config.marketplaceId,
          ItemCondition: 'New',
          CustomerType: 'Consumer'
        }
      });

      if (response.data && response.data.payload) {
        results.push({
          asin,
          offers: response.data.payload
        });
      }
    } catch (error) {
      console.error(`Error fetching item offers for ASIN ${asin}:`, error);
      // Continue with next ASIN even if one fails
    }
  }

  return results;
}

/**
 * Search for products by manufacturer number using SP-API Catalog Items API
 */
export async function searchByManufacturerNumber(manufacturerNumber: string): Promise<any[]> {
  const config = getAmazonConfig();
  
  if (!validateAmazonConfig(config)) {
    throw new Error('Amazon SP-API configuration is invalid');
  }

  const accessToken = await getAccessToken(config);
  
  try {
    // Search using manufacturer number as keyword
    const response = await axios.get(`${config.endpoint}/catalog/2022-04-01/items`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        marketplaceIds: config.marketplaceId,
        keywords: manufacturerNumber,
        includedData: 'attributes,identifiers,images,productTypes,salesRanks,summaries',
        pageSize: 20
      }
    });

    if (response.data && response.data.items) {
      return response.data.items;
    }
  } catch (error) {
    console.error(`Error searching by manufacturer number ${manufacturerNumber}:`, error);
  }

  return [];
}

/**
 * Enhanced product search that combines UPC and manufacturer number searches
 */
export async function searchProductMultipleWays(upc: string, manufacturerNumber?: string): Promise<any[]> {
  const results = [];
  
  // Search by UPC first
  if (upc) {
    try {
      const config = getAmazonConfig();
      const upcResults = await searchCatalogItemsByUPC(upc, config);
      results.push(...upcResults);
    } catch (error) {
      console.error(`Error searching by UPC ${upc}:`, error);
    }
  }
  
  // Search by manufacturer number if provided
  if (manufacturerNumber) {
    try {
      const mfgResults = await searchByManufacturerNumber(manufacturerNumber);
      results.push(...mfgResults);
    } catch (error) {
      console.error(`Error searching by manufacturer number ${manufacturerNumber}:`, error);
    }
  }
  
  // Remove duplicates based on ASIN
  const uniqueResults = results.filter((item, index, self) => 
    index === self.findIndex(t => t.asin === item.asin)
  );
  
  return uniqueResults;
}

/**
 * Get listing restrictions for an ASIN
 */
export async function getListingRestrictions(asin: string, marketplaceId: string = 'ATVPDKIKX0DER'): Promise<{
  restrictions: Array<{
    reasonCode: string;
    message: string;
  }>;
}> {
  const config = getAmazonConfig();
  const accessToken = await getAccessToken(config);

  try {
    const response = await axios.get(`${config.endpoint}/listings/2021-08-01/restrictions`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      },
      params: {
        asin: asin,
        marketplaceIds: marketplaceId,
        conditionType: 'new_new'
      }
    });

    return {
      restrictions: response.data?.restrictions || []
    };
  } catch (error: any) {
    console.error(`Error fetching listing restrictions for ASIN ${asin}:`, error);
    
    // Return empty restrictions on error to avoid blocking batch processing
    return {
      restrictions: []
    };
  }
}