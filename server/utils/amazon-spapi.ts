/**
 * Amazon Selling Partner API Integration
 * 
 * This utility provides functionality to interact with Amazon's SP-API
 * for catalog item lookup and marketplace data retrieval.
 */

import axios from 'axios';
import crypto from 'crypto';
import { createHmac } from 'crypto';

// SP-API configuration
interface SPAPIConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessKeyId: string;
  secretKey: string;
  roleArn: string;
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

/**
 * Generates an AWS Signature V4 for API calls
 */
function generateAWSSignature(
  method: string,
  path: string,
  queryParams: Record<string, string>,
  body: string | null,
  accessKey: string,
  secretKey: string,
  region: string = 'us-east-1',
  service: string = 'execute-api'
): Record<string, string> {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);

  // Create canonical request
  const canonicalUri = path;
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const canonicalHeaders = [
    `host:${new URL(path).host}`,
    `x-amz-date:${timestamp}`
  ].join('\n') + '\n';

  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto
    .createHash('sha256')
    .update(body || '')
    .digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  let signingKey = createHmac('sha256', `AWS4${secretKey}`).update(date).digest();
  signingKey = createHmac('sha256', signingKey).update(region).digest();
  signingKey = createHmac('sha256', signingKey).update(service).digest();
  signingKey = createHmac('sha256', signingKey).update('aws4_request').digest();
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  // Create authorization header
  const authorizationHeader = [
    `${algorithm} Credential=${accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  return {
    'Authorization': authorizationHeader,
    'X-Amz-Date': timestamp
  };
}

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
    const method = 'GET';
    const endpoint = config.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const path = '/catalog/2022-04-01/items';
    const queryParams = {
      marketplaceIds: config.marketplaceId,
      identifiers: upc,
      identifierType: 'UPC',
      includedData: 'attributes,dimensions,images,productTypes,relationships,salesRanks,summaries'
    };

    // Generate AWS signature
    const awsHeaders = generateAWSSignature(
      method,
      path,
      queryParams,
      null,
      config.accessKeyId,
      config.secretKey
    );

    // Build query string
    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key as keyof typeof queryParams])}`)
      .join('&');

    // Make API request
    const response = await axios({
      method,
      url: `${endpoint}${path}?${queryString}`,
      headers: {
        'x-amz-access-token': accessToken,
        ...awsHeaders
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
  } catch (error) {
    console.error('Error searching catalog items by UPC:', error);
    throw new Error(`Failed to search Amazon catalog: ${(error as Error).message}`);
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
    const method = 'GET';
    const endpoint = config.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const path = `/catalog/2022-04-01/items/${asin}`;
    const queryParams = {
      marketplaceIds: config.marketplaceId,
      includedData: 'attributes,dimensions,images,productTypes,relationships,salesRanks,summaries'
    };

    // Generate AWS signature
    const awsHeaders = generateAWSSignature(
      method,
      path,
      queryParams,
      null,
      config.accessKeyId,
      config.secretKey
    );

    // Build query string
    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key as keyof typeof queryParams])}`)
      .join('&');

    // Make API request
    const response = await axios({
      method,
      url: `${endpoint}${path}?${queryString}`,
      headers: {
        'x-amz-access-token': accessToken,
        ...awsHeaders
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
    accessKeyId: process.env.AMAZON_SP_API_ACCESS_KEY_ID || '',
    secretKey: process.env.AMAZON_SP_API_SECRET_KEY || '',
    roleArn: process.env.AMAZON_SP_API_ROLE_ARN || '',
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
    config.refreshToken &&
    config.accessKeyId &&
    config.secretKey
  );
}