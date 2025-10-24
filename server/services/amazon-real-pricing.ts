/**
 * Amazon Real Pricing Service
 * Fetches authentic pricing data directly from Amazon SP-API
 * Uses OAuth 2.0 LWA tokens only (no AWS Signature V4 needed as of Oct 2023)
 */

interface AmazonPricingData {
  asin: string;
  buyBoxPrice?: number;
  listPrice?: number;
  offerCount?: number;
  condition: string;
  fulfillmentChannel: string;
  timestamp: string;
}

interface CatalogSearchResult {
  asin: string;
  title: string;
  upc?: string;
  partNumber?: string;
  brand?: string;
  imageUrl?: string;
}

export class AmazonRealPricingService {
  private readonly marketplace = 'ATVPDKIKX0DER'; // US marketplace
  private readonly baseUrl = 'https://sellingpartnerapi-na.amazon.com';
  
  private readonly CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
  private readonly REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  /**
   * Get OAuth 2.0 LWA access token
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('Refreshing Amazon SP-API access token...');
      
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.REFRESH_TOKEN!,
          client_id: this.CLIENT_ID!,
          client_secret: this.CLIENT_SECRET!
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Token request failed: ${response.status} - ${errorText}`);
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

      console.log('Amazon SP-API access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Search Amazon catalog by UPC to find correct ASIN
   */
  async searchCatalogByUPC(upc: string): Promise<CatalogSearchResult[]> {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = '/catalog/2022-04-01/items';
      const params = new URLSearchParams({
        marketplaceIds: this.marketplace,
        identifiers: upc,
        identifiersType: 'UPC',
        includedData: 'identifiers,images,productTypes,summaries,attributes'
      });

      const url = `${this.baseUrl}${endpoint}?${params}`;

      console.log(`Searching Amazon catalog for UPC: ${upc}`);

      // Catalog API uses OAuth 2.0 only (no AWS Signature V4 needed)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Amazon catalog search failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return [];
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log(`No Amazon catalog items found for UPC: ${upc}`);
        return [];
      }

      const results: CatalogSearchResult[] = data.items.map((item: any) => ({
        asin: item.asin,
        title: item.summaries?.[0]?.itemName || 'Unknown Product',
        upc: item.identifiers?.find((id: any) => id.identifierType === 'UPC')?.identifier,
        partNumber: item.identifiers?.find((id: any) => id.identifierType === 'PART_NUMBER')?.identifier,
        brand: item.summaries?.[0]?.brand,
        imageUrl: item.images?.[0]?.images?.[0]?.link
      }));

      console.log(`Found ${results.length} catalog items for UPC ${upc}:`, results.map(r => r.asin));
      return results;

    } catch (error) {
      console.error('Amazon catalog search error:', error);
      return [];
    }
  }

  /**
   * Get real Amazon pricing for specific ASINs
   */
  async getRealPricing(asins: string[]): Promise<Map<string, AmazonPricingData>> {
    const results = new Map<string, AmazonPricingData>();

    for (const asin of asins) {
      try {
        const pricing = await this.fetchPricingForAsin(asin);
        if (pricing) {
          results.set(asin, pricing);
        }
      } catch (error) {
        console.error(`Failed to fetch pricing for ${asin}:`, error);
      }
    }

    return results;
  }

  private async fetchPricingForAsin(asin: string): Promise<AmazonPricingData | null> {
    try {
      const accessToken = await this.getAccessToken();
      const endpoint = `/products/pricing/v0/items/${asin}/offers`;
      const params = new URLSearchParams({
        MarketplaceId: this.marketplace,
        ItemCondition: 'New'
      });

      const url = `${this.baseUrl}${endpoint}?${params}`;

      console.log(`Fetching real Amazon pricing for ASIN: ${asin}`);

      // Product Pricing API requires AWS Signature V4 + LWA token
      const { createAWSSignature } = await import('../utils/aws-signature');
      
      const headers: Record<string, string> = {
        'host': 'sellingpartnerapi-na.amazon.com',
        'x-amz-access-token': accessToken,
        'content-type': 'application/json'
      };

      const awsSignedHeaders = await createAWSSignature({
        method: 'GET',
        url,
        headers,
        body: null,
        service: 'execute-api',
        region: 'us-east-1'
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: { ...headers, ...awsSignedHeaders }
      });

      if (!response.ok) {
        console.error(`Amazon pricing API failed for ${asin}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.payload || !data.payload.offers) {
        console.log(`No pricing data available for ${asin}`);
        return null;
      }

      const offers = data.payload.offers;
      let buyBoxPrice: number | undefined;
      let listPrice: number | undefined;

      // Find buy box price
      const buyBoxOffer = offers.find((offer: any) => offer.isBuyBoxWinner);
      if (buyBoxOffer?.listingPrice?.amount) {
        buyBoxPrice = parseFloat(buyBoxOffer.listingPrice.amount);
      }

      // Get list price from any offer
      if (offers.length > 0 && offers[0].listingPrice?.amount) {
        listPrice = parseFloat(offers[0].listingPrice.amount);
      }

      const pricingData: AmazonPricingData = {
        asin,
        buyBoxPrice,
        listPrice,
        offerCount: offers.length,
        condition: 'New',
        fulfillmentChannel: buyBoxOffer?.fulfillmentChannel || 'MERCHANT',
        timestamp: new Date().toISOString()
      };

      console.log(`Real Amazon pricing for ${asin}: Buy Box $${buyBoxPrice}, List $${listPrice}`);
      return pricingData;

    } catch (error) {
      console.error(`Amazon pricing fetch error for ${asin}:`, error);
      return null;
    }
  }

  /**
   * Verify and fix UPC to ASIN mapping
   */
  async verifyUPCMapping(upc: string, currentAsin: string): Promise<{
    isCorrect: boolean;
    correctAsin?: string;
    searchResults: CatalogSearchResult[];
  }> {
    console.log(`Verifying UPC ${upc} mapping to ASIN ${currentAsin}`);

    const searchResults = await this.searchCatalogByUPC(upc);
    
    if (searchResults.length === 0) {
      return { isCorrect: false, searchResults: [] };
    }

    // Check if current ASIN is in the search results
    const isCorrect = searchResults.some(result => result.asin === currentAsin);
    
    // If incorrect, suggest the first valid result
    const correctAsin = !isCorrect && searchResults.length > 0 ? searchResults[0].asin : undefined;

    return {
      isCorrect,
      correctAsin,
      searchResults
    };
  }
}

export const amazonRealPricingService = new AmazonRealPricingService();