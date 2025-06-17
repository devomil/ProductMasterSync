/**
 * Amazon Selling Partner API Integration Service
 * Handles authentication, rate limiting, and data fetching from Amazon SP-API
 */

import axios from 'axios';
import crypto from 'crypto';

interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  marketplaceId: string;
}

interface AccessTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface CatalogItem {
  asin: string;
  identifiers: {
    marketplaceASIN: {
      marketplaceId: string;
      ASIN: string;
    };
  }[];
  summaries: {
    marketplaceId: string;
    brandName?: string;
    itemName?: string;
    manufacturer?: string;
    partNumber?: string;
  }[];
  attributes: {
    list_price?: {
      currency: string;
      amount: number;
    }[];
  };
}

interface ProductPricing {
  asin: string;
  status: string;
  product: {
    identifiers: {
      marketplaceASIN: {
        marketplaceId: string;
        ASIN: string;
      };
    };
    offers: {
      buyingPrice: {
        listingPrice: {
          amount: number;
          currencyCode: string;
        };
        landedPrice: {
          amount: number;
          currencyCode: string;
        };
      };
      regularPrice: {
        amount: number;
        currencyCode: string;
      };
      fulfillmentChannel: string;
      itemCondition: string;
      itemSubCondition: string;
      sellerSKU: string;
    }[];
  };
}

export class AmazonSPAPI {
  private config: AmazonConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;
  
  constructor() {
    this.config = {
      clientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
      clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
      refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
      accessKeyId: process.env.AMAZON_SP_API_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AMAZON_SP_API_SECRET_KEY || '',
      region: 'us-east-1',
      marketplaceId: 'ATVPDKIKX0DER' // US marketplace
    };
    
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
    
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      console.warn('Amazon SP-API credentials not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<AccessTokenResponse>(
        'https://api.amazon.com/auth/o2/token',
        {
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000); // 1 minute buffer

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon SP-API access token:', error);
      throw new Error('Amazon SP-API authentication failed');
    }
  }

  private createSignature(
    method: string,
    path: string,
    queryString: string,
    headers: Record<string, string>,
    body: string
  ): string {
    const algorithm = 'AWS4-HMAC-SHA256';
    const service = 'execute-api';
    const region = this.config.region;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const datetime = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    // Create canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');
    
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');
    
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    
    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // Create string to sign
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      datetime,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    
    return `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private async makeRequest<T>(
    method: string,
    path: string,
    params: Record<string, string> = {},
    body: any = null
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = new URL(path, this.baseUrl);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'x-amz-date': new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z',
      'Content-Type': 'application/json',
      'User-Agent': 'MDM-PIM-System/1.0'
    };
    
    const bodyString = body ? JSON.stringify(body) : '';
    const signature = this.createSignature(
      method,
      url.pathname,
      url.search.slice(1),
      headers,
      bodyString
    );
    
    headers['Authorization'] = signature;
    
    try {
      const response = await axios({
        method,
        url: url.toString(),
        headers,
        data: body,
        timeout: 30000
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`Amazon SP-API request failed: ${method} ${path}`, error.response?.data || error.message);
      throw new Error(`Amazon SP-API request failed: ${error.response?.status || error.message}`);
    }
  }

  async searchCatalogItems(query: string, limit: number = 10): Promise<CatalogItem[]> {
    try {
      const response = await this.makeRequest<{ items: CatalogItem[] }>(
        'GET',
        '/catalog/2022-04-01/items',
        {
          marketplaceIds: this.config.marketplaceId,
          keywords: query,
          pageSize: limit.toString(),
          includedData: 'identifiers,summaries,attributes'
        }
      );
      
      return response.items || [];
    } catch (error) {
      console.error('Error searching catalog items:', error);
      return [];
    }
  }

  async searchByUPC(upc: string): Promise<CatalogItem[]> {
    try {
      const response = await this.makeRequest<{ items: CatalogItem[] }>(
        'GET',
        '/catalog/2022-04-01/items',
        {
          marketplaceIds: this.config.marketplaceId,
          identifiers: upc,
          identifiersType: 'UPC',
          includedData: 'identifiers,summaries,attributes'
        }
      );
      
      return response.items || [];
    } catch (error) {
      console.error('Error searching by UPC:', error);
      return [];
    }
  }

  async searchByPartNumber(partNumber: string): Promise<CatalogItem[]> {
    try {
      const response = await this.makeRequest<{ items: CatalogItem[] }>(
        'GET',
        '/catalog/2022-04-01/items',
        {
          marketplaceIds: this.config.marketplaceId,
          keywords: partNumber,
          pageSize: '20',
          includedData: 'identifiers,summaries,attributes'
        }
      );
      
      return response.items || [];
    } catch (error) {
      console.error('Error searching by part number:', error);
      return [];
    }
  }

  async getProductPricing(asin: string): Promise<ProductPricing | null> {
    try {
      const response = await this.makeRequest<ProductPricing>(
        'GET',
        '/products/pricing/v0/price',
        {
          MarketplaceId: this.config.marketplaceId,
          Asins: asin
        }
      );
      
      return response;
    } catch (error) {
      console.error('Error getting product pricing:', error);
      return null;
    }
  }

  async getCompetitivePricing(asin: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        'GET',
        '/products/pricing/v0/competitivePrice',
        {
          MarketplaceId: this.config.marketplaceId,
          Asins: asin
        }
      );
      
      return response;
    } catch (error) {
      console.error('Error getting competitive pricing:', error);
      return null;
    }
  }

  async getListingRestrictions(asin: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        'GET',
        '/listings/2021-08-01/restrictions',
        {
          marketplaceIds: this.config.marketplaceId,
          asin: asin
        }
      );
      
      return response;
    } catch (error) {
      console.error('Error getting listing restrictions:', error);
      return null;
    }
  }

  async batchSearchProducts(queries: Array<{upc?: string; partNumber?: string; keywords?: string}>): Promise<Array<{query: any; results: CatalogItem[]}>> {
    const results = [];
    
    // Process in batches to respect rate limits
    for (const query of queries) {
      try {
        let items: CatalogItem[] = [];
        
        if (query.upc) {
          items = await this.searchByUPC(query.upc);
        } else if (query.partNumber) {
          items = await this.searchByPartNumber(query.partNumber);
        } else if (query.keywords) {
          items = await this.searchCatalogItems(query.keywords);
        }
        
        results.push({ query, results: items });
        
        // Rate limiting: Amazon SP-API allows 5 requests per second
        await new Promise(resolve => setTimeout(resolve, 250));
        
      } catch (error) {
        console.error('Error in batch search:', error);
        results.push({ query, results: [] });
      }
    }
    
    return results;
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }
}

export const amazonAPI = new AmazonSPAPI();