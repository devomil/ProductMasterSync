/**
 * Amazon Image and Media Service
 * Handles fetching authentic Amazon product images and listing restrictions
 */

import { amazonAPI } from './amazon-sp-api';
import { db } from '../db';
import { amazonAsins, amazonMarketIntelligence } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface AmazonImageData {
  asin: string;
  primaryImageUrl: string | null;
  additionalImages: string[];
  canList: boolean;
  restrictionMessages: string[];
}

export class AmazonImageService {
  
  /**
   * Fetch authentic Amazon images for ASINs
   */
  async fetchAmazonImages(asins: string[]): Promise<AmazonImageData[]> {
    const results: AmazonImageData[] = [];
    
    for (const asin of asins) {
      try {
        // Get catalog data with images
        const catalogItems = await amazonAPI.searchCatalogItems(asin, 10);
        let imageData: AmazonImageData = {
          asin,
          primaryImageUrl: null,
          additionalImages: [],
          canList: true,
          restrictionMessages: []
        };
        
        if (catalogItems.length > 0) {
          const item = catalogItems[0];
          
          // Extract primary image
          if (item.images && item.images.length > 0) {
            const mainImage = item.images[0].images.find(img => img.variant === 'MAIN');
            if (mainImage) {
              imageData.primaryImageUrl = mainImage.link;
            } else if (item.images[0].images[0]) {
              imageData.primaryImageUrl = item.images[0].images[0].link;
            }
            
            // Extract additional images
            imageData.additionalImages = item.images[0].images
              .filter(img => img.variant !== 'MAIN')
              .map(img => img.link)
              .slice(0, 5); // Limit to 5 additional images
          }
        }
        
        // Get listing restrictions
        try {
          const restrictions = await amazonAPI.getListingRestrictions(asin);
          if (restrictions) {
            imageData.canList = restrictions.canList;
            imageData.restrictionMessages = restrictions.messages;
          }
        } catch (error) {
          console.warn(`Failed to get restrictions for ${asin}:`, error);
          // Continue with default values
        }
        
        results.push(imageData);
        
        // Update database with image and restriction data
        await this.updateAsinImageData(imageData);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to fetch image data for ${asin}:`, error);
        results.push({
          asin,
          primaryImageUrl: null,
          additionalImages: [],
          canList: true,
          restrictionMessages: []
        });
      }
    }
    
    return results;
  }
  
  /**
   * Update ASIN record with image and restriction data
   */
  private async updateAsinImageData(data: AmazonImageData): Promise<void> {
    try {
      await db
        .update(amazonAsins)
        .set({
          primaryImageUrl: data.primaryImageUrl,
          additionalImages: data.additionalImages,
          canList: data.canList,
          hasListingRestrictions: data.restrictionMessages.length > 0,
          restrictionMessages: data.restrictionMessages,
          lastRestrictionsCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(amazonAsins.asin, data.asin));
    } catch (error) {
      console.error(`Failed to update ASIN ${data.asin} with image data:`, error);
    }
  }
  
  /**
   * Get cached image data from database
   */
  async getCachedImageData(asins: string[]): Promise<Record<string, AmazonImageData>> {
    const cached: Record<string, AmazonImageData> = {};
    
    try {
      const results = await db
        .select({
          asin: amazonAsins.asin,
          primaryImageUrl: amazonAsins.primaryImageUrl,
          additionalImages: amazonAsins.additionalImages,
          canList: amazonAsins.canList,
          restrictionMessages: amazonAsins.restrictionMessages
        })
        .from(amazonAsins)
        .where(sql`${amazonAsins.asin} = ANY(${asins})`);
      
      for (const result of results) {
        if (asins.includes(result.asin)) {
          cached[result.asin] = {
            asin: result.asin,
            primaryImageUrl: result.primaryImageUrl,
            additionalImages: Array.isArray(result.additionalImages) ? result.additionalImages : [],
            canList: result.canList !== false,
            restrictionMessages: Array.isArray(result.restrictionMessages) ? result.restrictionMessages : []
          };
        }
      }
    } catch (error) {
      console.error('Failed to get cached image data:', error);
    }
    
    return cached;
  }
  
  /**
   * Calculate enhanced opportunity score with supplier costs
   */
  calculateEnhancedScore(params: {
    amazonPrice: number;
    supplierCost: number;
    shippingCost: number;
    amazonFees: number;
    salesRank: number;
    canList: boolean;
    competitorCount: number;
  }): number {
    const { amazonPrice, supplierCost, shippingCost, amazonFees, salesRank, canList, competitorCount } = params;
    
    // Base profit calculation
    const totalCosts = supplierCost + shippingCost + amazonFees;
    const grossProfit = amazonPrice - totalCosts;
    const profitMargin = amazonPrice > 0 ? (grossProfit / amazonPrice) * 100 : 0;
    
    // Scoring factors
    let score = 50; // Base score
    
    // Profit margin factor (40% weight)
    if (profitMargin > 50) score += 25;
    else if (profitMargin > 30) score += 15;
    else if (profitMargin > 15) score += 10;
    else if (profitMargin < 5) score -= 20;
    
    // Sales rank factor (25% weight)
    if (salesRank > 0) {
      if (salesRank < 10000) score += 15;
      else if (salesRank < 50000) score += 10;
      else if (salesRank < 100000) score += 5;
      else if (salesRank > 500000) score -= 10;
    }
    
    // Listing restrictions (20% weight)
    if (!canList) score -= 30;
    
    // Competition level (15% weight)
    if (competitorCount < 5) score += 10;
    else if (competitorCount < 10) score += 5;
    else if (competitorCount > 20) score -= 5;
    else if (competitorCount > 50) score -= 15;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export const amazonImageService = new AmazonImageService();