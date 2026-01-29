/**
 * Amazon Selling Partner API Integration Service
 * Handles authentication, rate limiting, and data fetching from Amazon SP-API
 */

import axios from 'axios';
import crypto from 'crypto';
import { URL } from 'url';

interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
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
  images?: {
    marketplaceId: string;
    images: {
      variant: string;
      link: string;
      height?: number;
      width?: number;
    }[];
  }[];
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
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await axios.post<AccessTokenResponse>(
        'https://api.amazon.com/auth/o2/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000); // 1 minute buffer

      return this.accessToken;
    } catch (error: any) {
      console.error('Failed to get Amazon SP-API access token:', error.response?.data || error.message);
      throw new Error('Amazon SP-API authentication failed');
    }
  }



  private async makeRequest<T>(
    method: string,
    path: string,
    params: Record<string, string> = {},
    body: any = null
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    
    // Build the complete URL with query parameters
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    // Simple OAuth-based headers (no AWS signature required)
    const headers: Record<string, string> = {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'User-Agent': 'MDM-PIM-System/1.0 (Language=JavaScript)'
    };
    
    try {
      console.log(`Making Amazon SP-API request: ${method} ${url.toString()}`);
      
      const response = await axios({
        method: method.toUpperCase(),
        url: url.toString(),
        headers,
        data: body || undefined,
        timeout: 30000,
        validateStatus: () => true // Don't throw on HTTP error codes
      });
      
      console.log(`Amazon SP-API response status: ${response.status}`);
      
      if (response.status >= 400) {
        console.error(`Amazon SP-API error ${response.status}:`, response.data);
        throw new Error(`Amazon SP-API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error(`Amazon SP-API request failed: ${method} ${path}`, error.response.data);
        throw new Error(`Amazon SP-API request failed: ${error.response.status}`);
      } else {
        console.error(`Amazon SP-API request failed: ${method} ${path}`, error.message);
        throw new Error(`Amazon SP-API request failed: ${error.message}`);
      }
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
      // Use the correct pricing API endpoint
      const response = await this.makeRequest<any>(
        'GET',
        '/products/pricing/v0/items',
        {
          MarketplaceId: this.config.marketplaceId,
          Asins: asin,
          ItemType: 'Asin'
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
      // Use the correct competitive pricing endpoint
      const response = await this.makeRequest(
        'GET',
        '/products/pricing/v0/items',
        {
          MarketplaceId: this.config.marketplaceId,
          Asins: asin,
          ItemType: 'Asin',
          OfferType: 'BuyBox'
        }
      );
      
      return response;
    } catch (error) {
      console.error('Error getting competitive pricing:', error);
      return null;
    }
  }

  async getListingRestrictions(asin: string): Promise<{
    canList: boolean;
    restrictions: any[];
    reasonCodes: string[];
    messages: string[];
  }> {
    try {
      const response = await this.makeRequest(
        'GET',
        '/listings/2021-08-01/restrictions',
        {
          marketplaceIds: this.config.marketplaceId,
          asin: asin
        }
      );
      
      const restrictions = response?.restrictions || [];
      return {
        canList: restrictions.length === 0,
        restrictions,
        reasonCodes: restrictions.map((r: any) => r.reasonCode).filter(Boolean),
        messages: restrictions.map((r: any) => r.message).filter(Boolean)
      };
    } catch (error) {
      console.error('Error getting listing restrictions:', error);
      return {
        canList: true,
        restrictions: [],
        reasonCodes: [],
        messages: []
      };
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

  async getOrders(daysBack: number = 30): Promise<any[]> {
    try {
      const createdAfter = new Date();
      createdAfter.setDate(createdAfter.getDate() - daysBack);
      
      console.log(`[Amazon Orders] Fetching orders from last ${daysBack} days...`);
      
      const response = await this.makeRequest<any>(
        'GET',
        '/orders/v0/orders',
        {
          MarketplaceIds: this.config.marketplaceId,
          CreatedAfter: createdAfter.toISOString(),
          OrderStatuses: 'Unshipped,PartiallyShipped,Shipped,Pending'
        }
      );
      
      const orders = response?.Orders || [];
      console.log(`[Amazon Orders] Found ${orders.length} orders`);
      
      return orders;
    } catch (error) {
      console.error('[Amazon Orders] Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderItems(orderId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest<any>(
        'GET',
        `/orders/v0/orders/${orderId}/orderItems`,
        {}
      );
      
      return response?.OrderItems || [];
    } catch (error) {
      console.error(`[Amazon Orders] Error fetching items for order ${orderId}:`, error);
      return [];
    }
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }
}

export const amazonAPI = new AmazonSPAPI();