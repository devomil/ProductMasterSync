/**
 * Amazon Catalog and Pricing Integration Service
 * Combines SP-API Catalog data with intelligent cost-based pricing
 */

import { db } from '../db';
import { products, amazonAsins, productAsinMapping } from '../../shared/schema';
import { eq, isNotNull, and } from 'drizzle-orm';
import { amazonPricingServiceV2022 } from './amazon-pricing-v2022';

interface CatalogPricingResult {
  asin: string;
  productId: number;
  catalogData?: any;
  pricingData: {
    listPrice: number;
    competitivePrice: number;
    profitMargin: number;
    source: 'SP-API' | 'cost-based';
  };
  marketAnalysis: {
    competitivenessScore: number;
    recommendedAction: string;
    profitabilityTier: string;
  };
}

export class AmazonCatalogPricingService {
  private readonly CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
  private readonly REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;
  private readonly ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
  private readonly MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace

  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('Refreshing Amazon SP-API access token...');
    
    const tokenUrl = 'https://api.amazon.com/auth/o2/token';
    const response = await fetch(tokenUrl, {
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
    
    console.log('Amazon SP-API access token refreshed successfully');
    return this.accessToken;
  }

  async getCatalogItemData(asin: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      
      const url = `${this.ENDPOINT}/catalog/2022-04-01/items/${asin}?marketplaceIds=${this.MARKETPLACE_ID}&includedData=summaries,attributes,images`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': token,
        },
      });

      if (response.ok) {
        const catalogData = await response.json();
        console.log(`Retrieved catalog data for ASIN ${asin}`);
        return catalogData;
      } else {
        console.log(`Catalog API failed for ASIN ${asin}: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching catalog data for ASIN ${asin}:`, error);
      return null;
    }
  }

  async calculateCostBasedPricing(productId: number, cost: number): Promise<any> {
    // Marine equipment industry standard calculations
    const MARINE_MARKUP = 2.5;
    const COMPETITIVE_FACTOR = 0.95;
    const LIST_PRICE_FACTOR = 1.2;

    const marketPrice = cost * MARINE_MARKUP;
    const competitivePrice = marketPrice * COMPETITIVE_FACTOR;
    const listPrice = marketPrice * LIST_PRICE_FACTOR;
    const profitMargin = (competitivePrice - cost) / competitivePrice;

    // Calculate competitiveness score
    let score = 0;
    if (profitMargin >= 0.5) score += 40;
    else if (profitMargin >= 0.4) score += 35;
    else if (profitMargin >= 0.3) score += 30;
    else if (profitMargin >= 0.25) score += 20;
    else score += 10;

    const priceRatio = competitivePrice / cost;
    if (priceRatio <= 2.0) score += 35;
    else if (priceRatio <= 2.5) score += 30;
    else if (priceRatio <= 3.0) score += 25;
    else score += 15;

    if (competitivePrice < 100) score += 25;
    else if (competitivePrice < 500) score += 20;
    else if (competitivePrice < 1000) score += 15;
    else score += 10;

    const competitivenessScore = Math.min(100, score);

    let recommendedAction = 'Monitor';
    let profitabilityTier = 'Standard';

    if (profitMargin >= 0.4 && competitivenessScore >= 70) {
      recommendedAction = 'Increase inventory';
      profitabilityTier = 'High';
    } else if (profitMargin >= 0.3 && competitivenessScore >= 60) {
      recommendedAction = 'Optimize pricing';
      profitabilityTier = 'Good';
    } else if (profitMargin < 0.25) {
      recommendedAction = 'Review costs';
      profitabilityTier = 'Low';
    }

    return {
      listPrice: Math.round(listPrice * 100), // Convert to cents
      competitivePrice: Math.round(competitivePrice * 100),
      profitMargin,
      competitivenessScore,
      recommendedAction,
      profitabilityTier,
      source: 'cost-based'
    };
  }

  async processProductPricing(asins: string[]): Promise<CatalogPricingResult[]> {
    const results: CatalogPricingResult[] = [];

    for (const asin of asins) {
      try {
        // Get product data
        const productData = await db
          .select({
            productId: products.id,
            cost: products.cost,
            price: products.price,
            name: products.name,
            upc: products.upc
          })
          .from(products)
          .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
          .where(eq(productAsinMapping.asin, asin))
          .limit(1);

        if (productData.length === 0) {
          console.log(`No product data found for ASIN: ${asin}`);
          continue;
        }

        const product = productData[0];
        const cost = parseFloat(product.cost || '0');

        if (cost <= 0) {
          console.log(`Invalid cost data for ASIN: ${asin}`);
          continue;
        }

        // Try to get SP-API pricing first
        let pricingData;
        try {
          const spApiPricing = await amazonPricingServiceV2022.getCompetitiveSummaryBatch([asin]);
          if (spApiPricing.size > 0) {
            const competitiveSummary = spApiPricing.get(asin);
            if (competitiveSummary) {
              const extractedPricing = amazonPricingServiceV2022.extractPricingData(competitiveSummary);
              pricingData = {
                listPrice: extractedPricing.listPrice,
                competitivePrice: extractedPricing.lowestPrice || extractedPricing.buyBoxPrice,
                profitMargin: extractedPricing.listPrice ? (extractedPricing.listPrice - cost * 100) / extractedPricing.listPrice : 0,
                source: 'SP-API' as const
              };
            }
          }
        } catch (error) {
          console.log(`SP-API pricing unavailable for ${asin}, using cost-based calculation`);
        }

        // Fall back to cost-based pricing if SP-API fails
        if (!pricingData) {
          const costBasedData = await this.calculateCostBasedPricing(product.productId, cost);
          pricingData = {
            listPrice: costBasedData.listPrice,
            competitivePrice: costBasedData.competitivePrice,
            profitMargin: costBasedData.profitMargin,
            source: costBasedData.source
          };
        }

        // Get catalog data for additional insights
        const catalogData = await this.getCatalogItemData(asin);

        // Calculate market analysis
        const marketAnalysis = await this.calculateCostBasedPricing(product.productId, cost);

        results.push({
          asin,
          productId: product.productId,
          catalogData,
          pricingData,
          marketAnalysis: {
            competitivenessScore: marketAnalysis.competitivenessScore,
            recommendedAction: marketAnalysis.recommendedAction,
            profitabilityTier: marketAnalysis.profitabilityTier
          }
        });

        console.log(`Processed pricing for ASIN ${asin}: $${(pricingData.competitivePrice / 100).toFixed(2)} (${pricingData.source})`);

      } catch (error) {
        console.error(`Error processing ASIN ${asin}:`, error);
      }
    }

    return results;
  }

  async updateDatabasePricing(results: CatalogPricingResult[]): Promise<number> {
    let updated = 0;

    for (const result of results) {
      try {
        await db
          .update(amazonAsins)
          .set({
            listPrice: result.pricingData.listPrice,
            offerCount: 3, // Estimated
            lastPriceUpdate: new Date()
          })
          .where(eq(amazonAsins.asin, result.asin));

        updated++;
      } catch (error) {
        console.error(`Error updating database for ASIN ${result.asin}:`, error);
      }
    }

    return updated;
  }

  formatResults(results: CatalogPricingResult[]) {
    return results.map(result => ({
      asin: result.asin,
      productId: result.productId,
      listPrice: (result.pricingData.listPrice / 100).toFixed(2),
      competitivePrice: (result.pricingData.competitivePrice / 100).toFixed(2),
      profitMargin: (result.pricingData.profitMargin * 100).toFixed(1) + '%',
      competitivenessScore: result.marketAnalysis.competitivenessScore,
      recommendedAction: result.marketAnalysis.recommendedAction,
      profitabilityTier: result.marketAnalysis.profitabilityTier,
      source: result.pricingData.source,
      hasCatalogData: !!result.catalogData
    }));
  }
}

export const amazonCatalogPricingService = new AmazonCatalogPricingService();