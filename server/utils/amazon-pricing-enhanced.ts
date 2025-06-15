/**
 * Enhanced Amazon Pricing Service with Buy Box and Listing Restrictions
 */

import { getBuyBoxPricing, getListingRestrictions } from './amazon-spapi.js';

interface EnhancedPricingData {
  asin: string;
  buyBoxPrice?: number;
  lowestPrice?: number;
  canList?: boolean;
  listingRestrictions?: string[];
  isBuyBoxWinner?: boolean;
  fulfillmentChannel?: string;
  offerCount?: number;
  lastUpdated: Date;
}

/**
 * Get enhanced pricing data including buy box pricing and listing restrictions
 */
export async function getEnhancedPricingData(asins: string[]): Promise<EnhancedPricingData[]> {
  const results: EnhancedPricingData[] = [];
  
  try {
    // Get buy box pricing data
    const buyBoxData = await getBuyBoxPricing(asins);
    
    // Process each ASIN with pricing and restriction data
    for (const asin of asins) {
      const pricingData = buyBoxData.find(data => data.asin === asin);
      
      let listingData = null;
      try {
        listingData = await getListingRestrictions(asin);
      } catch (error) {
        console.error(`Error getting listing restrictions for ${asin}:`, error);
      }
      
      results.push({
        asin,
        buyBoxPrice: pricingData?.buyBoxPrice || null,
        lowestPrice: pricingData?.lowestPrice || null,
        canList: listingData?.canList !== false, // Default to true if no restrictions
        listingRestrictions: listingData?.reasonCodes || [],
        isBuyBoxWinner: pricingData?.isBuyBoxWinner || false,
        fulfillmentChannel: pricingData?.fulfillmentChannel || 'Unknown',
        offerCount: pricingData?.offerCount || 0,
        lastUpdated: new Date()
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error getting enhanced pricing data:', error);
  }
  
  return results;
}

/**
 * Calculate opportunity score based on pricing data
 */
export function calculateOpportunityScore(pricingData: EnhancedPricingData, ourCost: number): number {
  if (!pricingData.buyBoxPrice || !pricingData.canList) {
    return 0;
  }
  
  const potentialProfit = pricingData.buyBoxPrice - ourCost;
  const profitMargin = (potentialProfit / pricingData.buyBoxPrice) * 100;
  
  let score = Math.min(profitMargin * 2, 100); // Base score from profit margin
  
  // Adjust for competition
  if (pricingData.offerCount > 10) {
    score *= 0.8; // High competition
  } else if (pricingData.offerCount < 3) {
    score *= 1.2; // Low competition bonus
  }
  
  // Adjust for fulfillment channel
  if (pricingData.fulfillmentChannel === 'Amazon') {
    score *= 1.1; // FBA bonus
  }
  
  return Math.max(0, Math.min(100, score));
}