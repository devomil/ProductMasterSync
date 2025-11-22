/**
 * Walmart Marketplace API Integration
 * 
 * This utility provides functionality to interact with Walmart Marketplace API
 * for product catalog lookup, taxonomy retrieval, and marketplace data.
 */

import axios from 'axios';

// Walmart API configuration using OAuth 2.0
interface WalmartAPIConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string; // Base URL for Walmart API
  serviceName: string; // WM_SVC.NAME header value
  sellerId?: string; // Optional Seller ID
}

// Authentication interfaces
interface WalmartToken {
  access_token: string;
  token_type: string;
  expires_at: number; // Unix timestamp when token expires
}

interface WalmartItemResponse {
  walmartItemId: string;
  sku?: string;
  upc?: string;
  gtin?: string;
  brand?: string;
  title: string;
  description?: string;
  keyFeatures?: string[];
  imageUrls?: string[];
  categoryPath?: string[];
  variants?: any[];
  price?: {
    amount: number;
    currency: string;
  };
  listPrice?: {
    amount: number;
    currency: string;
  };
  availabilityStatus?: string;
  lifecycleStatus?: string;
  publishedStatus?: string;
  sellerName?: string;
  sellerMarketplace?: boolean;
  averageRating?: number;
  totalReviews?: number;
  createdDate?: string;
  lastUpdatedDate?: string;
  attributes?: Record<string, any>;
}

// Current token cache
let tokenCache: WalmartToken | null = null;

/**
 * Get Walmart API configuration from environment variables
 */
export async function getWalmartConfig(): Promise<WalmartAPIConfig> {
  const clientId = process.env.WALMART_CLIENT_ID;
  const clientSecret = process.env.WALMART_CLIENT_SECRET;
  const sellerId = process.env.WALMART_SELLER_ID;
  
  if (!clientId || !clientSecret) {
    throw new Error('Walmart API credentials not configured. Please set WALMART_CLIENT_ID and WALMART_CLIENT_SECRET environment variables.');
  }
  
  console.log('[Walmart Config] Using credentials:', {
    hasClientId: !!clientId,
    clientIdLength: clientId?.length,
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length,
    hasSellerId: !!sellerId,
    apiUrl: 'https://marketplace.walmartapis.com/v3'
  });
  
  return {
    clientId,
    clientSecret,
    apiUrl: 'https://marketplace.walmartapis.com/v3',
    serviceName: 'Walmart Marketplace',
    sellerId
  };
}

/**
 * Get access token for Walmart API using OAuth 2.0
 */
async function getAccessToken(config: WalmartAPIConfig): Promise<string> {
  // Check if we have a valid cached token (expires in 15 minutes)
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  try {
    console.log('[Walmart API] Requesting new access token...');
    
    // Encode credentials for Basic Authentication
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    
    const headers: any = {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'WM_SVC.NAME': config.serviceName,
      'WM_QOS.CORRELATION_ID': generateCorrelationId()
    };
    
    // Add Consumer Channel Type if Seller ID is provided
    if (config.sellerId) {
      headers['WM_CONSUMER.ID'] = config.sellerId;
    }
    
    console.log('[Walmart API] Token request headers (masked):', {
      hasAuth: !!headers.Authorization,
      serviceName: headers['WM_SVC.NAME'],
      hasConsumerId: !!headers['WM_CONSUMER.ID']
    });
    
    const response = await axios.post(
      `${config.apiUrl}/token`,
      'grant_type=client_credentials',
      {
        headers
      }
    );

    const expiresIn = response.data.expires_in || 900; // Default 15 minutes
    tokenCache = {
      access_token: response.data.access_token,
      token_type: response.data.token_type || 'Bearer',
      expires_at: Date.now() + (expiresIn * 1000) - 60000 // Expire 1 minute early for safety
    };

    console.log('[Walmart API] ✅ Access token obtained successfully');
    return tokenCache.access_token;
  } catch (error: any) {
    console.error('[Walmart API] Error getting access token:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: `${config.apiUrl}/token`
    });
    
    if (error.response?.data) {
      const errorMsg = error.response.data.error_description || error.response.data.error || 'Authentication failed';
      throw new Error(`Walmart API: ${errorMsg}`);
    }
    throw new Error('Failed to authenticate with Walmart API');
  }
}

/**
 * Generate a unique correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Search Walmart Global Catalog by UPC/GTIN
 * Uses the /items/walmart/search endpoint to search Walmart.com's entire catalog
 */
export async function searchWalmartCatalogByUPC(
  upc: string
): Promise<WalmartItemResponse[]> {
  try {
    const config = await getWalmartConfig();
    const accessToken = await getAccessToken(config);
    
    console.log(`[Walmart API] Searching Walmart global catalog for UPC: ${upc}`);
    
    // Use the correct endpoint for searching Walmart's global catalog
    // Reference: https://developer.walmart.com/documentation/search-for-items-in-walmart-catalog/
    const response = await axios.get(`${config.apiUrl}/items/walmart/search`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': accessToken,
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId(),
        'Accept': 'application/json'
      },
      params: {
        upc: upc
      }
    });

    // Response format from Walmart global catalog search
    if (response.data && response.data.items && response.data.items.length > 0) {
      console.log(`[Walmart API] ✅ Found ${response.data.items.length} items for UPC ${upc}`);
      return response.data.items;
    }

    console.log(`[Walmart API] No items found for UPC ${upc} in Walmart global catalog`);
    return [];
  } catch (error: any) {
    console.error(`[Walmart API] Error searching Walmart catalog by UPC:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      throw new Error('Walmart API rate limit exceeded. Please try again later.');
    }
    
    // If no items found, return empty array instead of throwing
    if (error.response?.status === 404) {
      console.log(`[Walmart API] UPC ${upc} not found in Walmart catalog (404)`);
      return [];
    }
    
    throw new Error(`Failed to search Walmart catalog: ${error.message}`);
  }
}

/**
 * Get Walmart item by item ID
 */
export async function getWalmartItem(itemId: string): Promise<WalmartItemResponse | null> {
  try {
    const config = await getWalmartConfig();
    const accessToken = await getAccessToken(config);
    
    console.log(`[Walmart API] Fetching item: ${itemId}`);
    
    const response = await axios.get(`${config.apiUrl}/items/${itemId}`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': accessToken,
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId(),
        'Accept': 'application/json'
      }
    });

    if (response.data) {
      console.log(`[Walmart API] ✅ Item fetched: ${itemId}`);
      return response.data;
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`[Walmart API] Item not found: ${itemId}`);
      return null;
    }
    
    console.error(`[Walmart API] Error fetching item:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch Walmart item: ${error.message}`);
  }
}

/**
 * Get Walmart taxonomy (category hierarchy)
 */
export async function getWalmartTaxonomy(version: string = '5.0', feedType?: string): Promise<any> {
  try {
    const config = await getWalmartConfig();
    const accessToken = await getAccessToken(config);
    
    console.log(`[Walmart API] Fetching taxonomy (version: ${version})`);
    
    const params: any = { version };
    if (feedType) {
      params.feedType = feedType;
    }
    
    const response = await axios.get(`${config.apiUrl}/items/taxonomy`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': accessToken,
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId(),
        'Accept': 'application/json'
      },
      params
    });

    if (response.data) {
      console.log(`[Walmart API] ✅ Taxonomy fetched successfully`);
      return response.data;
    }

    return null;
  } catch (error: any) {
    console.error(`[Walmart API] Error fetching taxonomy:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch Walmart taxonomy: ${error.message}`);
  }
}

/**
 * Get bulk items by UPCs (batch processing)
 */
export async function getBulkWalmartItemsByUPC(
  upcs: string[],
  batchSize: number = 20
): Promise<WalmartItemResponse[]> {
  const results: WalmartItemResponse[] = [];
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < upcs.length; i += batchSize) {
    const batch = upcs.slice(i, i + batchSize);
    
    console.log(`[Walmart API] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} UPCs)`);
    
    for (const upc of batch) {
      try {
        const items = await searchWalmartCatalogByUPC(upc);
        results.push(...items);
        
        // Rate limiting: wait 200ms between requests (max 5 requests/second)
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`[Walmart API] Error processing UPC ${upc}:`, error);
        // Continue with next UPC even if one fails
      }
    }
  }
  
  return results;
}

/**
 * Search Walmart by SKU
 */
export async function searchWalmartBySKU(sku: string): Promise<WalmartItemResponse[]> {
  try {
    const config = await getWalmartConfig();
    const accessToken = await getAccessToken(config);
    
    console.log(`[Walmart API] Searching by SKU: ${sku}`);
    
    const response = await axios.get(`${config.apiUrl}/items`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': accessToken,
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId(),
        'Accept': 'application/json'
      },
      params: {
        sku: sku
      }
    });

    if (response.data && response.data.items) {
      console.log(`[Walmart API] Found ${response.data.items.length} items for SKU ${sku}`);
      return response.data.items;
    }

    return [];
  } catch (error: any) {
    console.error(`[Walmart API] Error searching by SKU:`, error.response?.data || error.message);
    throw new Error(`Failed to search by SKU: ${error.message}`);
  }
}
