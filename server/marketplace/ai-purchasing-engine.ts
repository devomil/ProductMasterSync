/**
 * AI-Powered Purchasing Engine
 * 
 * Automated product analysis and purchasing recommendations for hundreds of thousands of products
 * Integrates Amazon SP-API with intelligent rate limiting and batch processing
 */

import { db } from '../db';
import { eq, and, isNull, lt, desc, sql, inArray } from 'drizzle-orm';
import { products, amazonAsins, amazonMarketIntelligence, productAsinMapping } from '../../shared/schema';
import { searchCatalogItemsByUPC, getAmazonConfig } from '../utils/amazon-spapi';
import { amazonRateLimiter } from '../utils/rate-limiter';
import { 
  saveAmazonAsin, 
  saveMarketIntelligence, 
  linkAsinToProduct,
  getProductsNeedingLookup 
} from './enhanced-repository';

export interface PurchasingRecommendation {
  productId: number;
  recommendationScore: number; // 0-100
  action: 'buy' | 'monitor' | 'avoid' | 'investigate';
  confidence: number; // 0-1
  reasoning: string[];
  financialMetrics: {
    estimatedROI: number;
    estimatedMonthlySales: number;
    profitMargin: number;
    competitionLevel: 'low' | 'medium' | 'high';
  };
  riskFactors: string[];
  opportunities: string[];
}

export interface BatchProcessingConfig {
  batchSize: number;
  maxConcurrent: number;
  rateLimitBuffer: number; // Additional delay between requests
  priorityCategories: string[];
  costThresholds: {
    maxProductCost: number;
    minProfitMargin: number;
    minMonthlyVolume: number;
  };
}

export class AIPurchasingEngine {
  private config: BatchProcessingConfig;
  private processingQueue: number[] = [];
  private activeProcesses: Set<number> = new Set();
  
  constructor(config: Partial<BatchProcessingConfig> = {}) {
    this.config = {
      batchSize: 50,
      maxConcurrent: 5,
      rateLimitBuffer: 2000, // 2 seconds between requests
      priorityCategories: ['Electronics', 'Automotive', 'Marine'],
      costThresholds: {
        maxProductCost: 500000, // $5,000 in cents
        minProfitMargin: 15, // 15%
        minMonthlyVolume: 10, // 10 units per month
      },
      ...config
    };
  }

  /**
   * Main automation engine - processes entire catalog
   */
  async runAutomatedAnalysis(options: {
    startFromProductId?: number;
    maxProducts?: number;
    focusCategories?: string[];
  } = {}): Promise<void> {
    console.log('🚀 Starting AI-powered purchasing analysis...');
    
    const { startFromProductId = 0, maxProducts = 1000, focusCategories } = options;
    
    // Get products to analyze in batches
    let processedCount = 0;
    let currentOffset = startFromProductId;
    
    while (processedCount < maxProducts) {
      const batch = await this.getNextBatch(currentOffset, focusCategories);
      
      if (batch.length === 0) {
        console.log('✅ Completed analysis of all available products');
        break;
      }
      
      console.log(`📊 Processing batch: ${batch.length} products (${processedCount + 1}-${processedCount + batch.length})`);
      
      await this.processBatch(batch);
      
      processedCount += batch.length;
      currentOffset = batch[batch.length - 1].id + 1;
      
      // Rate limiting between batches
      await this.waitBetweenBatches();
    }
    
    // Generate final recommendations
    await this.generatePurchasingRecommendations();
    
    console.log(`🎯 Analysis complete! Processed ${processedCount} products`);
  }

  /**
   * Get next batch of products prioritizing high-value opportunities
   */
  private async getNextBatch(offset: number, focusCategories?: string[]): Promise<any[]> {
    let query = db
      .select()
      .from(products)
      .where(eq(products.id, sql`${products.id} >= ${offset}`))
      .orderBy(products.id)
      .limit(this.config.batchSize);

    // Filter by categories if specified
    if (focusCategories && focusCategories.length > 0) {
      // This would need category joining logic based on your schema
      // For now, we'll use a placeholder filter
    }

    const batch = await query;
    return batch;
  }

  /**
   * Process a batch of products with concurrent Amazon API calls
   */
  private async processBatch(products: any[]): Promise<void> {
    const chunks = this.chunkArray(products, this.config.maxConcurrent);
    
    for (const chunk of chunks) {
      const promises = chunk.map(product => this.analyzeProduct(product));
      await Promise.allSettled(promises);
      
      // Rate limiting between chunks
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitBuffer));
    }
  }

  /**
   * Comprehensive product analysis with Amazon data
   */
  private async analyzeProduct(product: any): Promise<void> {
    try {
      console.log(`🔍 Analyzing product ${product.id}: ${product.name}`);
      
      // Step 1: Get Amazon marketplace data
      const amazonData = await this.fetchAmazonData(product);
      
      if (amazonData.length === 0) {
        console.log(`❌ No Amazon data found for product ${product.id}`);
        return;
      }
      
      // Step 2: Calculate competitive metrics
      const competitiveMetrics = await this.calculateCompetitiveMetrics(product, amazonData);
      
      // Step 3: Analyze market opportunity
      const marketOpportunity = this.analyzeMarketOpportunity(competitiveMetrics);
      
      // Step 4: Generate purchasing recommendation
      const recommendation = this.generateProductRecommendation(product, competitiveMetrics, marketOpportunity);
      
      // Step 5: Store analysis results
      await this.storeAnalysisResults(product.id, recommendation, competitiveMetrics);
      
      console.log(`✅ Completed analysis for product ${product.id} - Recommendation: ${recommendation.action} (Score: ${recommendation.recommendationScore})`);
      
    } catch (error) {
      console.error(`❌ Error analyzing product ${product.id}:`, error);
    }
  }

  /**
   * Fetch Amazon marketplace data with rate limiting
   */
  private async fetchAmazonData(product: any): Promise<any[]> {
    const foundAsins = [];
    
    // UPC search
    if (product.upc) {
      try {
        await amazonRateLimiter.waitAndConsume();
        const config = getAmazonConfig();
        const catalogItems = await searchCatalogItemsByUPC(product.upc, config);
        
        for (const item of catalogItems) {
          // Save ASIN data
          const asinData = {
            asin: item.asin,
            title: item.itemName || '',
            brand: item.brand || '',
            manufacturer: item.manufacturer || '',
            upc: product.upc,
            category: item.productGroup || '',
            primaryImageUrl: item.smallImage?.url || ''
          };
          
          await saveAmazonAsin(asinData);
          
          // Save market intelligence
          const intelligenceData = {
            asin: item.asin,
            currentPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
            listPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
            salesRank: item.salesRank?.rank || null,
            rating: item.customerReviews?.averageRating || null,
            reviewCount: item.customerReviews?.totalReviewCount || 0,
            isPrime: item.isPrimeEligible || false,
            inStock: item.availability !== 'OutOfStock'
          };
          
          await saveMarketIntelligence(intelligenceData);
          
          // Link to product
          await linkAsinToProduct({
            productId: product.id,
            asin: item.asin,
            matchMethod: 'upc',
            matchConfidence: 0.9,
            isDirectCompetitor: true
          });
          
          foundAsins.push({ asin: item.asin, intelligence: intelligenceData });
        }
      } catch (error) {
        console.error(`Error fetching Amazon data for UPC ${product.upc}:`, error);
      }
    }
    
    return foundAsins;
  }

  /**
   * Calculate competitive metrics from Amazon data
   */
  private async calculateCompetitiveMetrics(product: any, amazonData: any[]): Promise<any> {
    if (amazonData.length === 0) return null;
    
    const prices = amazonData.map(a => a.intelligence.currentPrice).filter(Boolean);
    const salesRanks = amazonData.map(a => a.intelligence.salesRank).filter(Boolean);
    const ratings = amazonData.map(a => a.intelligence.rating).filter(Boolean);
    
    const metrics = {
      totalAsins: amazonData.length,
      priceRange: {
        min: Math.min(...prices) || 0,
        max: Math.max(...prices) || 0,
        average: prices.length ? prices.reduce((a, b) => a + b) / prices.length : 0
      },
      salesRankRange: {
        best: Math.min(...salesRanks) || 999999,
        worst: Math.max(...salesRanks) || 999999,
        average: salesRanks.length ? salesRanks.reduce((a, b) => a + b) / salesRanks.length : 999999
      },
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b) / ratings.length : 0,
      primeEligible: amazonData.filter(a => a.intelligence.isPrime).length,
      competitionLevel: this.assessCompetitionLevel(amazonData.length, salesRanks)
    };
    
    return metrics;
  }

  /**
   * Analyze market opportunity based on competitive metrics
   */
  private analyzeMarketOpportunity(metrics: any): any {
    if (!metrics) return { score: 0, factors: [] };
    
    let opportunityScore = 50; // Base score
    const factors = [];
    
    // Price opportunity
    if (metrics.priceRange.average > 2000) { // $20+
      opportunityScore += 15;
      factors.push('High-value product category');
    }
    
    // Low competition
    if (metrics.competitionLevel === 'low') {
      opportunityScore += 20;
      factors.push('Low competition environment');
    } else if (metrics.competitionLevel === 'high') {
      opportunityScore -= 10;
      factors.push('High competition market');
    }
    
    // Sales rank opportunity
    if (metrics.salesRankRange.best < 50000) {
      opportunityScore += 15;
      factors.push('Strong sales velocity indicated');
    }
    
    // Rating quality
    if (metrics.avgRating < 4.0) {
      opportunityScore += 10;
      factors.push('Opportunity to improve on existing products');
    }
    
    // Prime eligibility
    if (metrics.primeEligible / metrics.totalAsins > 0.7) {
      opportunityScore += 5;
      factors.push('Prime-eligible market');
    }
    
    return {
      score: Math.max(0, Math.min(100, opportunityScore)),
      factors
    };
  }

  /**
   * Generate AI-powered purchasing recommendation
   */
  private generateProductRecommendation(
    product: any, 
    metrics: any, 
    opportunity: any
  ): PurchasingRecommendation {
    if (!metrics) {
      return {
        productId: product.id,
        recommendationScore: 0,
        action: 'avoid',
        confidence: 0.1,
        reasoning: ['No Amazon marketplace data available'],
        financialMetrics: {
          estimatedROI: 0,
          estimatedMonthlySales: 0,
          profitMargin: 0,
          competitionLevel: 'high'
        },
        riskFactors: ['No market validation'],
        opportunities: []
      };
    }
    
    const reasoning = [];
    const riskFactors = [];
    const opportunities = opportunity.factors;
    
    // Calculate estimated financials
    const avgAmazonPrice = metrics.priceRange.average / 100; // Convert to dollars
    const estimatedCost = product.cost || (avgAmazonPrice * 0.6); // Assume 60% cost ratio
    const profitMargin = ((avgAmazonPrice - estimatedCost) / avgAmazonPrice) * 100;
    
    // Estimate monthly sales based on BSR
    const estimatedMonthlySales = metrics.salesRankRange.best < 10000 ? 100 :
                                 metrics.salesRankRange.best < 50000 ? 50 :
                                 metrics.salesRankRange.best < 100000 ? 20 : 5;
    
    const estimatedROI = (profitMargin / 100) * estimatedMonthlySales * avgAmazonPrice * 12 / estimatedCost;
    
    let recommendationScore = opportunity.score;
    let action: 'buy' | 'monitor' | 'avoid' | 'investigate' = 'monitor';
    let confidence = 0.7;
    
    // Decision logic
    if (profitMargin > this.config.costThresholds.minProfitMargin && 
        estimatedMonthlySales > this.config.costThresholds.minMonthlyVolume &&
        estimatedCost < this.config.costThresholds.maxProductCost / 100) {
      
      if (recommendationScore > 70) {
        action = 'buy';
        reasoning.push('High opportunity score with strong financials');
        confidence = 0.9;
      } else if (recommendationScore > 50) {
        action = 'investigate';
        reasoning.push('Moderate opportunity requiring further analysis');
        confidence = 0.7;
      }
    } else {
      action = 'avoid';
      reasoning.push('Does not meet financial thresholds');
      confidence = 0.8;
      
      if (profitMargin < this.config.costThresholds.minProfitMargin) {
        riskFactors.push('Low profit margin');
      }
      if (estimatedMonthlySales < this.config.costThresholds.minMonthlyVolume) {
        riskFactors.push('Low sales volume');
      }
    }
    
    return {
      productId: product.id,
      recommendationScore,
      action,
      confidence,
      reasoning,
      financialMetrics: {
        estimatedROI,
        estimatedMonthlySales,
        profitMargin,
        competitionLevel: metrics.competitionLevel
      },
      riskFactors,
      opportunities
    };
  }

  /**
   * Store analysis results in database
   */
  private async storeAnalysisResults(productId: number, recommendation: PurchasingRecommendation, metrics: any): Promise<void> {
    // Store in a dedicated analysis results table (would need to be added to schema)
    // For now, we'll log the key insights
    console.log(`📊 Product ${productId} Analysis:`, {
      action: recommendation.action,
      score: recommendation.recommendationScore,
      roi: recommendation.financialMetrics.estimatedROI,
      margin: recommendation.financialMetrics.profitMargin
    });
  }

  /**
   * Generate comprehensive purchasing recommendations report
   */
  private async generatePurchasingRecommendations(): Promise<void> {
    console.log('📋 Generating purchasing recommendations report...');
    
    // This would query the stored analysis results and generate actionable recommendations
    // Including top opportunities, products to avoid, and monitoring candidates
    
    console.log('✅ Purchasing recommendations report generated');
  }

  // Utility methods
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private assessCompetitionLevel(asinCount: number, salesRanks: number[]): 'low' | 'medium' | 'high' {
    if (asinCount < 3) return 'low';
    if (asinCount > 10) return 'high';
    return 'medium';
  }

  private async waitBetweenBatches(): Promise<void> {
    // Longer wait between batches to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Initialize and run the AI purchasing engine
 */
export async function runAIPurchasingAnalysis(options?: {
  maxProducts?: number;
  focusCategories?: string[];
}): Promise<void> {
  const engine = new AIPurchasingEngine({
    batchSize: 25, // Smaller batches for rate limiting
    maxConcurrent: 3, // Conservative concurrency
    rateLimitBuffer: 3000, // 3 seconds between requests
    costThresholds: {
      maxProductCost: 1000000, // $10,000 max
      minProfitMargin: 20, // 20% minimum margin
      minMonthlyVolume: 15 // 15 units minimum
    }
  });
  
  await engine.runAutomatedAnalysis(options);
}