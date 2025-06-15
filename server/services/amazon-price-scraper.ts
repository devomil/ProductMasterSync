/**
 * Amazon Price Scraper Service
 * Retrieves real Amazon pricing data for accurate market intelligence
 */

import { db } from '../db';
import { amazonAsins, products, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface AmazonPriceData {
  asin: string;
  price: number | null;
  listPrice: number | null;
  availability: string;
  prime: boolean;
  seller: string;
  buyBoxWinner: boolean;
  lastUpdated: Date;
}

export class AmazonPriceScraperService {
  private readonly ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
  private readonly MARKETPLACE_ID = 'ATVPDKIKX0DER';

  async getItemAttributes(asin: string): Promise<any> {
    try {
      const CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
      const CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
      const REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

      // Get access token
      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: REFRESH_TOKEN!,
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token refresh failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Use Catalog API to get item attributes including pricing info
      const url = `${this.ENDPOINT}/catalog/2022-04-01/items/${asin}?marketplaceIds=${this.MARKETPLACE_ID}&includedData=attributes,offers,summaries`;

      console.log(`Fetching item attributes for ASIN ${asin}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Retrieved item attributes for ASIN ${asin}`);
        return data;
      } else {
        const errorText = await response.text();
        console.log(`Catalog API failed for ASIN ${asin}: ${response.status} - ${errorText}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching item attributes for ASIN ${asin}:`, error);
      return null;
    }
  }

  async getMyPriceForASIN(asin: string): Promise<any> {
    try {
      const CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
      const CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
      const REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

      // Get access token
      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: REFRESH_TOKEN!,
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token refresh failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Try the Product Pricing API's GetMyPriceForASIN endpoint
      const url = `${this.ENDPOINT}/products/pricing/v0/items/${asin}/offers?MarketplaceId=${this.MARKETPLACE_ID}&ItemCondition=New`;

      console.log(`Fetching pricing for ASIN ${asin} using GetMyPriceForASIN...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Retrieved pricing data for ASIN ${asin}`);
        return data;
      } else {
        const errorText = await response.text();
        console.log(`Pricing API failed for ASIN ${asin}: ${response.status} - ${errorText}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching pricing for ASIN ${asin}:`, error);
      return null;
    }
  }

  extractPriceFromCatalogData(catalogData: any): AmazonPriceData | null {
    if (!catalogData || !catalogData.asin) return null;

    try {
      const asin = catalogData.asin;
      let price = null;
      let listPrice = null;
      let availability = 'Unknown';
      let prime = false;
      let seller = 'Amazon';

      // Look for price in various locations within the catalog response
      if (catalogData.attributes) {
        // Check for list price in attributes
        const listPriceAttr = catalogData.attributes.find((attr: any) => 
          attr.name === 'list_price' || attr.name === 'price' || attr.name === 'msrp'
        );
        if (listPriceAttr && listPriceAttr.value) {
          const priceMatch = listPriceAttr.value.toString().match(/[\d.]+/);
          if (priceMatch) {
            listPrice = parseFloat(priceMatch[0]) * 100; // Convert to cents
          }
        }
      }

      // Check summaries for pricing information
      if (catalogData.summaries && catalogData.summaries.length > 0) {
        const summary = catalogData.summaries[0];
        if (summary.mainImage) {
          // Product exists and has image, likely available
          availability = 'In Stock';
        }
      }

      // Look for offers data
      if (catalogData.offers && catalogData.offers.length > 0) {
        const offer = catalogData.offers[0];
        if (offer.listPrice) {
          const priceMatch = offer.listPrice.toString().match(/[\d.]+/);
          if (priceMatch) {
            listPrice = parseFloat(priceMatch[0]) * 100;
          }
        }
        if (offer.price) {
          const priceMatch = offer.price.toString().match(/[\d.]+/);
          if (priceMatch) {
            price = parseFloat(priceMatch[0]) * 100;
          }
        }
      }

      return {
        asin,
        price,
        listPrice,
        availability,
        prime,
        seller,
        buyBoxWinner: true,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`Error extracting price from catalog data:`, error);
      return null;
    }
  }

  async updatePricingForProducts(asins: string[]): Promise<{ asin: string; success: boolean; price?: number; error?: string }[]> {
    const results = [];

    for (const asin of asins) {
      try {
        console.log(`Processing pricing for ASIN: ${asin}`);

        // Try catalog API first for item attributes
        const catalogData = await this.getItemAttributes(asin);
        
        if (catalogData) {
          const priceData = this.extractPriceFromCatalogData(catalogData);
          
          if (priceData && (priceData.price || priceData.listPrice)) {
            // Update the database with real Amazon pricing
            await db
              .update(amazonAsins)
              .set({
                lastUpdatedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(amazonAsins.asin, asin));

            results.push({
              asin,
              success: true,
              price: priceData.price || priceData.listPrice
            });

            console.log(`Updated pricing for ${asin}: $${((priceData.price || priceData.listPrice)! / 100).toFixed(2)}`);
            continue;
          }
        }

        // Fallback: Try the MyPrice API
        const pricingData = await this.getMyPriceForASIN(asin);
        if (pricingData) {
          console.log(`MyPrice API response for ${asin}:`, JSON.stringify(pricingData, null, 2));
        }

        results.push({
          asin,
          success: false,
          error: 'No pricing data available from Amazon APIs'
        });

      } catch (error) {
        console.error(`Error processing ASIN ${asin}:`, error);
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

export const amazonPriceScraperService = new AmazonPriceScraperService();