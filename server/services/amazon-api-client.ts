/**
 * Amazon SP-API Client
 * Direct integration with Amazon's Selling Partner API for authentic pricing data
 */

import { createAWSSignature } from '../utils/aws-signature';

interface AmazonPricingResponse {
  asin: string;
  listPrice?: number;
  landedPrice?: number;
  offerCount: number;
  condition: string;
  isBuyBoxWinner?: boolean;
  fulfillmentChannel: string;
  timestamp: string;
}

interface AmazonCatalogItem {
  asin: string;
  identifiers: Array<{
    identifierType: string;
    identifier: string;
  }>;
  summaries: Array<{
    itemName: string;
    brand?: string;
  }>;
  images?: Array<{
    images: Array<{
      link: string;
    }>;
  }>;
}

export class AmazonAPIClient {
  private readonly baseUrl = 'https://sellingpartnerapi-na.amazon.com';
  private readonly marketplace = 'ATVPDKIKX0DER'; // US marketplace

  /**
   * Get real pricing data from Amazon Product Pricing API
   */
  async getPricingData(asin: string): Promise<AmazonPricingResponse | null> {
    try {
      const endpoint = `/products/pricing/v0/items/${asin}/offers`;
      const params = new URLSearchParams({
        MarketplaceId: this.marketplace,
        ItemCondition: 'New'
      });

      const url = `${this.baseUrl}${endpoint}?${params}`;
      
      const headers = await this.createAuthHeaders();
      const signedHeaders = await createAWSSignature({
        method: 'GET',
        url,
        headers,
        body: null,
        service: 'execute-api',
        region: 'us-east-1'
      });

      console.log(`Fetching Amazon pricing for ASIN: ${asin}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { ...headers, ...signedHeaders }
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.error(`Amazon API access denied for ASIN ${asin}. Check API permissions.`);
          return null;
        }
        console.error(`Amazon pricing API failed for ${asin}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.payload?.offers?.length) {
        console.log(`No pricing offers found for ASIN: ${asin}`);
        return null;
      }

      const offers = data.payload.offers;
      const buyBoxOffer = offers.find((offer: any) => offer.isBuyBoxWinner);
      const bestOffer = buyBoxOffer || offers[0];

      return {
        asin,
        listPrice: bestOffer.listingPrice?.amount ? parseFloat(bestOffer.listingPrice.amount) : undefined,
        landedPrice: bestOffer.shippingPrice?.amount ? 
          parseFloat(bestOffer.listingPrice.amount) + parseFloat(bestOffer.shippingPrice.amount) : undefined,
        offerCount: offers.length,
        condition: bestOffer.itemCondition || 'New',
        isBuyBoxWinner: bestOffer.isBuyBoxWinner || false,
        fulfillmentChannel: bestOffer.fulfillmentChannel || 'MERCHANT',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Failed to fetch Amazon pricing for ${asin}:`, error);
      return null;
    }
  }

  /**
   * Search Amazon catalog by UPC to find correct ASIN
   */
  async searchByUPC(upc: string): Promise<AmazonCatalogItem[]> {
    try {
      const endpoint = '/catalog/2022-04-01/items';
      const params = new URLSearchParams({
        marketplaceIds: this.marketplace,
        identifiers: upc,
        identifiersType: 'UPC',
        includedData: 'identifiers,images,summaries'
      });

      const url = `${this.baseUrl}${endpoint}?${params}`;
      
      const headers = await this.createAuthHeaders();
      const signedHeaders = await createAWSSignature({
        method: 'GET',
        url,
        headers,
        body: null,
        service: 'execute-api',
        region: 'us-east-1'
      });

      console.log(`Searching Amazon catalog for UPC: ${upc}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { ...headers, ...signedHeaders }
      });

      if (!response.ok) {
        console.error(`Amazon catalog search failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data.items || [];

    } catch (error) {
      console.error('Amazon catalog search error:', error);
      return [];
    }
  }

  /**
   * Get competitive pricing data for ASIN
   */
  async getCompetitivePricing(asin: string): Promise<any> {
    try {
      const endpoint = `/products/pricing/v0/items/${asin}`;
      const params = new URLSearchParams({
        MarketplaceId: this.marketplace,
        ItemType: 'Asin'
      });

      const url = `${this.baseUrl}${endpoint}?${params}`;
      
      const headers = await this.createAuthHeaders();
      const signedHeaders = await createAWSSignature({
        method: 'GET',
        url,
        headers,
        body: null,
        service: 'execute-api',
        region: 'us-east-1'
      });

      console.log(`Fetching competitive pricing for ASIN: ${asin}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { ...headers, ...signedHeaders }
      });

      if (!response.ok) {
        console.error(`Amazon competitive pricing failed for ${asin}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data.payload;

    } catch (error) {
      console.error(`Failed to fetch competitive pricing for ${asin}:`, error);
      return null;
    }
  }

  private async createAuthHeaders(): Promise<Record<string, string>> {
    return {
      'host': 'sellingpartnerapi-na.amazon.com',
      'user-agent': 'MDM-PIM-System/1.0 (Language=JavaScript)',
      'x-amz-access-token': process.env.AMAZON_SP_API_ACCESS_TOKEN || '',
      'content-type': 'application/json'
    };
  }
}

export const amazonAPIClient = new AmazonAPIClient();