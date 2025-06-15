/**
 * Amazon SP-API Service - OAuth-based authentication
 * Focused module for testing 1-10 products with authentic Amazon data
 */

interface AmazonTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface AmazonPricingOffer {
  listingPrice: { amount: number; currencyCode: string };
  shippingPrice?: { amount: number; currencyCode: string };
  isBuyBoxWinner: boolean;
  itemCondition: string;
  fulfillmentChannel: string;
}

interface AmazonCatalogResult {
  asin: string;
  identifiers?: Array<{
    identifierType: string;
    identifier: string;
  }>;
  summaries?: Array<{
    itemName: string;
    brand?: string;
  }>;
}

export class AmazonSPAPIService {
  private readonly baseUrl = 'https://sellingpartnerapi-na.amazon.com';
  private readonly tokenUrl = 'https://api.amazon.com/auth/o2/token';
  private readonly marketplaceId = 'ATVPDKIKX0DER'; // US marketplace
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Get or refresh access token using OAuth
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Return cached token if still valid
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = process.env.AMAZON_SP_API_CLIENT_ID;
    const clientSecret = process.env.AMAZON_SP_API_CLIENT_SECRET;
    const refreshToken = process.env.AMAZON_SP_API_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Amazon SP-API credentials. Required: CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN');
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const tokenData: AmazonTokenResponse = await response.json();
      
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = now + (tokenData.expires_in * 1000) - 60000; // Refresh 1 min early
      
      console.log('Amazon SP-API token refreshed successfully');
      return this.accessToken;
      
    } catch (error) {
      console.error('Failed to refresh Amazon SP-API token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to SP-API
   */
  private async makeRequest(endpoint: string, params?: URLSearchParams): Promise<any> {
    const token = await this.getAccessToken();
    
    const url = params ? 
      `${this.baseUrl}${endpoint}?${params.toString()}` : 
      `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'User-Agent': 'MDM-PIM-System/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SP-API request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Test API connection with a simple catalog search
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Testing Amazon SP-API connection...');
      
      // Test with a simple catalog request
      const params = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        keywords: 'test',
        pageSize: '1'
      });

      const result = await this.makeRequest('/catalog/2022-04-01/items', params);
      
      return {
        success: true,
        message: 'Amazon SP-API connection successful',
        details: {
          itemsFound: result.items?.length || 0,
          responseTime: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Amazon SP-API connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search catalog by UPC
   */
  async searchByUPC(upc: string): Promise<AmazonCatalogResult[]> {
    try {
      const params = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        identifiers: upc,
        identifiersType: 'UPC',
        includedData: 'identifiers,summaries'
      });

      const result = await this.makeRequest('/catalog/2022-04-01/items', params);
      return result.items || [];
      
    } catch (error) {
      console.error(`Failed to search catalog for UPC ${upc}:`, error);
      return [];
    }
  }

  /**
   * Get competitive pricing for ASIN
   */
  async getPricing(asin: string): Promise<{ success: boolean; price?: number; offers?: AmazonPricingOffer[]; error?: string }> {
    try {
      const params = new URLSearchParams({
        MarketplaceId: this.marketplaceId,
        ItemCondition: 'New'
      });

      const result = await this.makeRequest(`/products/pricing/v0/items/${asin}/offers`, params);
      
      if (!result.payload?.offers?.length) {
        return {
          success: false,
          error: 'No pricing offers found'
        };
      }

      const offers = result.payload.offers;
      const buyBoxOffer = offers.find((offer: AmazonPricingOffer) => offer.isBuyBoxWinner);
      const bestOffer = buyBoxOffer || offers[0];

      return {
        success: true,
        price: parseFloat(bestOffer.listingPrice.amount),
        offers: offers.slice(0, 5) // Return top 5 offers
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown pricing error'
      };
    }
  }

  /**
   * Get product listings restrictions
   */
  async getListingRestrictions(asin: string): Promise<{ success: boolean; canList?: boolean; restrictions?: any; error?: string }> {
    try {
      const params = new URLSearchParams({
        sellerId: 'SELLER_ID_PLACEHOLDER', // This would need actual seller ID
        marketplaceIds: this.marketplaceId,
        asin: asin
      });

      const result = await this.makeRequest('/listings/2021-08-01/restrictions', params);
      
      return {
        success: true,
        canList: !result.restrictions?.length,
        restrictions: result.restrictions || []
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check restrictions'
      };
    }
  }
}

export const amazonSPAPI = new AmazonSPAPIService();