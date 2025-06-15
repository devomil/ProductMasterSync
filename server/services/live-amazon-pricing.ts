/**
 * Live Amazon Pricing Service
 * Fetches real-time pricing data from Amazon SP-API
 */

import axios from 'axios';

interface AmazonOffer {
  ListingPrice: {
    Amount: number;
    CurrencyCode: string;
  };
  IsBuyBoxWinner: boolean;
  IsFulfilledByAmazon: boolean;
  SellerId: string;
}

interface PricingResponse {
  payload: {
    ASIN: string;
    status: string;
    offers: AmazonOffer[];
  };
}

interface LivePricingData {
  asin: string;
  buyBoxPrice: number | null;
  lowestPrice: number | null;
  offerCount: number;
  hasAmazonOffer: boolean;
  priceRange: {
    min: number;
    max: number;
  } | null;
  lastUpdated: Date;
}

class LiveAmazonPricingService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  private readonly CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
  private readonly REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;
  private readonly ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
  private readonly MARKETPLACE_ID = 'ATVPDKIKX0DER';

  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        refresh_token: this.REFRESH_TOKEN
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.accessToken = response.data.access_token;
      // Tokens typically last 1 hour, refresh 5 minutes early
      this.tokenExpiry = new Date(Date.now() + (55 * 60 * 1000));
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon access token:', error);
      throw new Error('Unable to authenticate with Amazon SP-API');
    }
  }

  async getLivePricing(asin: string): Promise<LivePricingData> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get<PricingResponse>(
        `${this.ENDPOINT}/products/pricing/v0/items/${asin}/offers`,
        {
          headers: {
            'x-amz-access-token': accessToken,
            'x-amz-date': new Date().toISOString(),
            'Content-Type': 'application/json'
          },
          params: {
            MarketplaceId: this.MARKETPLACE_ID,
            ItemCondition: 'New'
          }
        }
      );

      const offers = response.data.payload.offers || [];
      
      if (offers.length === 0) {
        return {
          asin,
          buyBoxPrice: null,
          lowestPrice: null,
          offerCount: 0,
          hasAmazonOffer: false,
          priceRange: null,
          lastUpdated: new Date()
        };
      }

      // Find buy box winner
      const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner);
      const buyBoxPrice = buyBoxOffer?.ListingPrice.Amount || null;

      // Find lowest price
      const prices = offers.map(offer => offer.ListingPrice.Amount);
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);

      // Check for Amazon as seller (FBA)
      const hasAmazonOffer = offers.some(offer => offer.IsFulfilledByAmazon);

      return {
        asin,
        buyBoxPrice,
        lowestPrice,
        offerCount: offers.length,
        hasAmazonOffer,
        priceRange: {
          min: lowestPrice,
          max: highestPrice
        },
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error(`Failed to fetch live pricing for ASIN ${asin}:`, error);
      
      // Return null data instead of throwing to allow fallback to database
      return {
        asin,
        buyBoxPrice: null,
        lowestPrice: null,
        offerCount: 0,
        hasAmazonOffer: false,
        priceRange: null,
        lastUpdated: new Date()
      };
    }
  }

  async getBatchPricing(asins: string[]): Promise<Map<string, LivePricingData>> {
    const results = new Map<string, LivePricingData>();
    
    // Process in batches to respect rate limits
    const batchSize = 5;
    const delay = 200; // 200ms between requests
    
    for (let i = 0; i < asins.length; i += batchSize) {
      const batch = asins.slice(i, i + batchSize);
      
      const promises = batch.map(async (asin) => {
        const pricing = await this.getLivePricing(asin);
        results.set(asin, pricing);
      });
      
      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < asins.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
}

export const liveAmazonPricingService = new LiveAmazonPricingService();
export type { LivePricingData };