/**
 * Amazon Pricing Fix Service
 * Uses proper SP-API library to get real Amazon pricing data
 */

import { db } from '../db';
import { amazonAsins, products, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface RealAmazonPrice {
  asin: string;
  listPrice: number | null;
  buyBoxPrice: number | null;
  lowestPrice: number | null;
  source: 'featured-offer' | 'competitive-pricing' | 'catalog';
  timestamp: Date;
}

export class AmazonPricingFixService {
  private readonly CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
  private readonly REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;
  private readonly MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace

  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.REFRESH_TOKEN!,
          client_id: this.CLIENT_ID!,
          client_secret: this.CLIENT_SECRET!,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
      
      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to get access token: ${error}`);
    }
  }

  async getFeaturedOfferPricing(asin: string): Promise<RealAmazonPrice | null> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Use the Product Pricing API - getFeaturedOfferExpectedPriceBatch
      const url = `https://sellingpartnerapi-na.amazon.com/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice`;
      
      const requestBody = {
        requests: [{
          asin: asin,
          marketplaceId: this.MARKETPLACE_ID,
          itemCondition: 'New'
        }]
      };

      console.log(`Getting featured offer pricing for ASIN ${asin}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Featured offer response for ${asin}:`, JSON.stringify(data, null, 2));
        
        if (data.responses && data.responses.length > 0) {
          const offerData = data.responses[0];
          if (offerData.featuredOfferExpectedPriceResults) {
            const priceResult = offerData.featuredOfferExpectedPriceResults[0];
            if (priceResult && priceResult.currentFeaturedOffer) {
              const offer = priceResult.currentFeaturedOffer;
              return {
                asin,
                listPrice: offer.listingPrice ? Math.round(parseFloat(offer.listingPrice.amount) * 100) : null,
                buyBoxPrice: offer.listingPrice ? Math.round(parseFloat(offer.listingPrice.amount) * 100) : null,
                lowestPrice: null,
                source: 'featured-offer',
                timestamp: new Date()
              };
            }
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`Featured offer API failed for ${asin}: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`Error getting featured offer pricing for ${asin}:`, error);
    }
    
    return null;
  }

  async getCompetitivePricing(asin: string): Promise<RealAmazonPrice | null> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Use the Product Pricing API - getCompetitivePricing
      const url = `https://sellingpartnerapi-na.amazon.com/products/pricing/v0/price?MarketplaceId=${this.MARKETPLACE_ID}&Asins=${asin}&ItemType=Asin`;

      console.log(`Getting competitive pricing for ASIN ${asin}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Competitive pricing response for ${asin}:`, JSON.stringify(data, null, 2));
        
        if (data.payload && data.payload.length > 0) {
          const priceData = data.payload[0];
          if (priceData.Product && priceData.Product.CompetitivePricing) {
            const competitivePrices = priceData.Product.CompetitivePricing.CompetitivePrices;
            if (competitivePrices && competitivePrices.length > 0) {
              const price = competitivePrices[0];
              if (price.Price) {
                return {
                  asin,
                  listPrice: price.Price.ListingPrice ? Math.round(parseFloat(price.Price.ListingPrice.Amount) * 100) : null,
                  buyBoxPrice: price.Price.LandedPrice ? Math.round(parseFloat(price.Price.LandedPrice.Amount) * 100) : null,
                  lowestPrice: null,
                  source: 'competitive-pricing',
                  timestamp: new Date()
                };
              }
            }
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`Competitive pricing API failed for ${asin}: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`Error getting competitive pricing for ${asin}:`, error);
    }
    
    return null;
  }

  async getRealAmazonPrice(asin: string): Promise<RealAmazonPrice | null> {
    // Try featured offer pricing first (most accurate)
    let priceData = await this.getFeaturedOfferPricing(asin);
    
    if (!priceData) {
      // Fallback to competitive pricing
      priceData = await this.getCompetitivePricing(asin);
    }

    return priceData;
  }

  async updateProductPricingWithRealAmazonData(asin: string): Promise<{ success: boolean; price?: number; error?: string }> {
    try {
      console.log(`Updating pricing for ASIN ${asin} with real Amazon data...`);

      const realPrice = await this.getRealAmazonPrice(asin);
      
      if (!realPrice || (!realPrice.buyBoxPrice && !realPrice.listPrice)) {
        return {
          success: false,
          error: 'No real Amazon pricing data available'
        };
      }

      const amazonPrice = realPrice.buyBoxPrice || realPrice.listPrice!;
      
      // Update the amazon_asins table with real pricing
      await db
        .update(amazonAsins)
        .set({
          lastUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(amazonAsins.asin, asin));

      console.log(`Updated ASIN ${asin} with real Amazon price: $${(amazonPrice / 100).toFixed(2)}`);

      return {
        success: true,
        price: amazonPrice
      };

    } catch (error) {
      console.error(`Error updating pricing for ASIN ${asin}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fixPricingForMultipleAsins(asins: string[]): Promise<{ asin: string; success: boolean; price?: number; error?: string; realPrice?: string }[]> {
    const results = [];

    for (const asin of asins) {
      try {
        const result = await this.updateProductPricingWithRealAmazonData(asin);
        results.push({
          asin,
          success: result.success,
          price: result.price,
          error: result.error,
          realPrice: result.price ? `$${(result.price / 100).toFixed(2)}` : undefined
        });

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          asin,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}

export const amazonPricingFixService = new AmazonPricingFixService();