/**
 * Cost-Based Amazon Pricing Service
 * Provides realistic marketplace pricing based on actual product costs
 * Uses industry-standard markup calculations for marine equipment
 */

import { db } from '../db';
import { products, amazonAsins, productAsinMapping } from '../../shared/schema';
import { eq, isNotNull, and } from 'drizzle-orm';

interface PricingCalculation {
  asin: string;
  productId: number;
  cost: number;
  marketPrice: number;
  competitivePrice: number;
  listPrice: number;
  profitMargin: number;
  competitivenessScore: number;
}

export class CostBasedPricingService {
  // Realistic marine equipment pricing based on actual Amazon market analysis
  // Example: B000K2IHAI cost $159.66, Amazon price ~$150-200 (not inflated $379)
  private readonly MARINE_MARKUP_MULTIPLIER = 1.6; // 60% markup (realistic market rate)
  private readonly COMPETITIVE_DISCOUNT = 0.92; // 8% below market for competitiveness
  private readonly LIST_PRICE_PREMIUM = 1.15; // 15% above competitive price
  private readonly MIN_MARGIN_PERCENT = 0.20; // 20% minimum margin

  async calculateMarketPricing(asins: string[]): Promise<Map<string, PricingCalculation>> {
    const results = new Map<string, PricingCalculation>();

    for (const asin of asins) {
      try {
        // Get product data with cost information
        const productData = await db
          .select({
            productId: products.id,
            cost: products.cost,
            price: products.price,
            name: products.name,
            categoryId: products.categoryId
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
        const costValue = parseFloat(product.cost || '0');
        
        if (costValue <= 0) {
          console.log(`Invalid cost data for ASIN: ${asin}`);
          continue;
        }

        // Calculate market-based pricing
        const calculation = this.calculatePricingStructure(costValue, asin, product.productId);
        results.set(asin, calculation);

      } catch (error) {
        console.error(`Error calculating pricing for ASIN ${asin}:`, error);
      }
    }

    return results;
  }

  private calculatePricingStructure(cost: number, asin: string, productId: number): PricingCalculation {
    // Base market price using industry standard markup
    const marketPrice = cost * this.MARINE_MARKUP_MULTIPLIER;
    
    // Competitive pricing (slightly below market for competitiveness)
    const competitivePrice = marketPrice * this.COMPETITIVE_DISCOUNT;
    
    // List price (higher reference point)
    const listPrice = marketPrice * this.LIST_PRICE_PREMIUM;
    
    // Calculate profit margin at competitive price
    const profitMargin = (competitivePrice - cost) / competitivePrice;
    
    // Competitiveness score (higher is better for selling)
    const competitivenessScore = this.calculateCompetitivenessScore(cost, competitivePrice, profitMargin);

    return {
      asin,
      productId,
      cost,
      marketPrice,
      competitivePrice,
      listPrice,
      profitMargin,
      competitivenessScore
    };
  }

  private calculateCompetitivenessScore(cost: number, competitivePrice: number, margin: number): number {
    // Score based on margin health and competitive positioning
    let score = 0;
    
    // Margin health (0-40 points)
    if (margin >= 0.5) score += 40; // Excellent margin
    else if (margin >= 0.4) score += 35; // Very good margin  
    else if (margin >= 0.3) score += 30; // Good margin
    else if (margin >= 0.25) score += 20; // Acceptable margin
    else score += 10; // Poor margin
    
    // Price competitiveness (0-35 points)
    const priceRatio = competitivePrice / cost;
    if (priceRatio <= 2.0) score += 35; // Very competitive
    else if (priceRatio <= 2.5) score += 30; // Competitive
    else if (priceRatio <= 3.0) score += 25; // Moderate
    else if (priceRatio <= 3.5) score += 15; // Less competitive
    else score += 5; // Not competitive
    
    // Market positioning (0-25 points)
    if (competitivePrice < 100) score += 25; // Entry level
    else if (competitivePrice < 500) score += 20; // Mid-range
    else if (competitivePrice < 1000) score += 15; // Premium
    else score += 10; // Luxury
    
    return Math.min(100, score);
  }

  async updateAsinPricing(calculations: Map<string, PricingCalculation>): Promise<number> {
    let updated = 0;

    for (const [asin, calc] of calculations) {
      try {
        // Convert to cents for storage
        const lowestPriceCents = Math.round(calc.competitivePrice * 100);
        const listPriceCents = Math.round(calc.listPrice * 100);
        const marketPriceCents = Math.round(calc.marketPrice * 100);

        await db
          .update(amazonAsins)
          .set({
            listPrice: listPriceCents,
            offerCount: 3, // Estimated competitive offers
            lastPriceUpdate: new Date()
          })
          .where(eq(amazonAsins.asin, asin));

        updated++;
        
        console.log(`Updated pricing for ASIN ${asin}: Market $${calc.marketPrice.toFixed(2)}, Competitive $${calc.competitivePrice.toFixed(2)}, Margin ${(calc.profitMargin * 100).toFixed(1)}%`);

      } catch (error) {
        console.error(`Error updating pricing for ASIN ${asin}:`, error);
      }
    }

    return updated;
  }

  async getProductsNeedingPriceUpdates(limit: number = 20): Promise<string[]> {
    // Get ASINs for products that need pricing updates
    const results = await db
      .select({ asin: amazonAsins.asin })
      .from(amazonAsins)
      .innerJoin(productAsinMapping, eq(amazonAsins.asin, productAsinMapping.asin))
      .innerJoin(products, eq(productAsinMapping.productId, products.id))
      .where(
        and(
          isNotNull(products.cost),
          isNotNull(products.upc)
        )
      )
      .limit(limit);

    return results.map(r => r.asin);
  }

  formatPricingResults(calculations: Map<string, PricingCalculation>) {
    const results = [];
    
    for (const [asin, calc] of calculations) {
      results.push({
        asin,
        cost: calc.cost,
        marketPrice: Number(calc.marketPrice.toFixed(2)),
        competitivePrice: Number(calc.competitivePrice.toFixed(2)),
        listPrice: Number(calc.listPrice.toFixed(2)),
        profitMargin: Number((calc.profitMargin * 100).toFixed(1)),
        competitivenessScore: Math.round(calc.competitivenessScore),
        source: 'cost-based'
      });
    }

    return results;
  }
}

export const costBasedPricingService = new CostBasedPricingService();