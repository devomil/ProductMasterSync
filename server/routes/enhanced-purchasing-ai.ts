/**
 * Enhanced Purchasing AI Routes
 * Leverages all 2830 products with comprehensive market intelligence
 */

import { Router } from 'express';
import { db } from '../db.js';
import { products, amazonAsins, amazonMarketIntelligence, productAsinMapping } from '../../shared/schema.js';
import { eq, sql, desc, and, isNotNull } from 'drizzle-orm';

const router = Router();

// Enhanced purchasing opportunities with full catalog analysis
router.get('/enhanced-opportunities', async (req, res) => {
  try {
    const { 
      limit = 50, 
      category, 
      risk_level = 'medium',
      min_opportunity_score = 20,
      min_confidence = 50 
    } = req.query;

    console.log('🔍 Analyzing enhanced purchasing opportunities...');

    // Get products with complete data for AI analysis
    const enhancedQuery = db
      .select({
        productId: products.id,
        sku: products.sku,
        name: products.name,
        upc: products.upc,
        usin: products.usin,
        manufacturerPartNumber: products.manufacturerPartNumber,
        cost: products.cost,
        price: products.price,
        category: products.categoryId,
        lastAmazonSync: products.lastAmazonSync,
        asin: amazonMarketIntelligence.asin,
        opportunityScore: amazonMarketIntelligence.opportunityScore,
        competitionLevel: amazonMarketIntelligence.competitionLevel,
        profitMarginPercent: amazonMarketIntelligence.profitMarginPercent,
        currentPrice: amazonMarketIntelligence.currentPrice,
        listPrice: amazonMarketIntelligence.listPrice,
        inStock: amazonMarketIntelligence.inStock,
        fulfillmentMethod: amazonMarketIntelligence.fulfillmentMethod
      })
      .from(products)
      .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
      .innerJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
      .where(
        and(
          isNotNull(products.upc),
          isNotNull(products.manufacturerPartNumber),
          isNotNull(products.cost),
          isNotNull(products.price),
          isNotNull(amazonMarketIntelligence.opportunityScore)
        )
      )
      .orderBy(desc(amazonMarketIntelligence.opportunityScore))
      .limit(Number(limit));

    const opportunities = await enhancedQuery;

    // Enhanced AI analysis for each opportunity
    const enrichedOpportunities = opportunities.map(product => {
      const cost = parseFloat(product.cost || '0');
      const price = parseFloat(product.price || '0');
      const currentPrice = parseFloat(product.currentPrice || '0');
      
      // Calculate profit margins
      const internalProfitMargin = price > 0 && cost > 0 ? ((price - cost) / cost * 100) : 0;
      const amazonProfitMargin = currentPrice > 0 && cost > 0 ? ((currentPrice - cost) / cost * 100) : 0;
      
      // Enhanced opportunity scoring
      let enhancedOpportunityScore = product.opportunityScore || 0;
      
      // UPC + MPN confidence bonus
      const hasCompleteIdentifiers = (product.upc || product.usin) && product.manufacturerPartNumber;
      const identifierConfidence = hasCompleteIdentifiers ? 85 : 40;
      
      // Pricing intelligence bonus
      let pricingConfidence = 0;
      if (currentPrice > 0 && price > 0) {
        const priceGap = ((currentPrice - price) / price * 100);
        if (priceGap > 20) pricingConfidence = 90;
        else if (priceGap > 10) pricingConfidence = 70;
        else if (priceGap > 0) pricingConfidence = 50;
        else pricingConfidence = 30;
      }
      
      // Amazon sync confidence
      const syncConfidence = product.lastAmazonSync ? 80 : 20;
      
      // Overall match confidence
      const matchConfidence = Math.round(
        (identifierConfidence * 0.4) + 
        (pricingConfidence * 0.3) + 
        (syncConfidence * 0.3)
      );
      
      // Risk assessment
      let riskLevel = 'medium';
      if (matchConfidence >= 80 && internalProfitMargin > 30) riskLevel = 'low';
      else if (matchConfidence < 60 || internalProfitMargin < 10) riskLevel = 'high';
      
      // Enhanced recommendation flags
      const automationFlags = [];
      if (matchConfidence >= 85) automationFlags.push('HIGH_CONFIDENCE_MATCH');
      if (amazonProfitMargin > 50) automationFlags.push('HIGH_PROFIT_OPPORTUNITY');
      if (product.inStock && product.fulfillmentMethod === 'FBA') automationFlags.push('FBA_READY');
      if (enhancedOpportunityScore > 80) automationFlags.push('PRIORITY_OPPORTUNITY');
      
      return {
        productId: product.productId,
        sku: product.sku,
        productName: product.name,
        upc: product.upc || product.usin,
        manufacturerPartNumber: product.manufacturerPartNumber,
        asin: product.asin,
        
        // Pricing intelligence
        internalCost: cost,
        internalPrice: price,
        amazonCurrentPrice: currentPrice,
        amazonListPrice: parseFloat(product.listPrice || '0'),
        
        // Profit analysis
        internalProfitMargin: Math.round(internalProfitMargin * 100) / 100,
        amazonProfitMargin: Math.round(amazonProfitMargin * 100) / 100,
        profitMarginPercent: product.profitMarginPercent,
        
        // Opportunity scoring
        opportunityScore: enhancedOpportunityScore,
        matchConfidence,
        competitionLevel: product.competitionLevel || 'unknown',
        riskLevel,
        
        // Market intelligence
        inStock: product.inStock,
        fulfillmentMethod: product.fulfillmentMethod,
        lastAmazonSync: product.lastAmazonSync,
        
        // AI recommendations
        automationFlags,
        recommendedAction: matchConfidence >= 80 ? 'PROCEED' : matchConfidence >= 60 ? 'REVIEW' : 'INVESTIGATE',
        
        // Data quality indicators
        dataCompleteness: {
          hasUPC: !!(product.upc || product.usin),
          hasMPN: !!product.manufacturerPartNumber,
          hasPricing: !!(cost > 0 && price > 0),
          hasAmazonData: !!product.asin,
          amazonSynced: !!product.lastAmazonSync
        }
      };
    });

    // Filter by confidence and opportunity score
    const filteredOpportunities = enrichedOpportunities.filter(opp => 
      opp.matchConfidence >= Number(min_confidence) &&
      opp.opportunityScore >= Number(min_opportunity_score) &&
      (risk_level === 'all' || opp.riskLevel === risk_level)
    );

    // Analytics summary
    const analytics = {
      totalAnalyzed: opportunities.length,
      qualifiedOpportunities: filteredOpportunities.length,
      averageConfidence: Math.round(
        filteredOpportunities.reduce((sum, opp) => sum + opp.matchConfidence, 0) / 
        Math.max(filteredOpportunities.length, 1)
      ),
      averageOpportunityScore: Math.round(
        filteredOpportunities.reduce((sum, opp) => sum + opp.opportunityScore, 0) / 
        Math.max(filteredOpportunities.length, 1)
      ),
      riskDistribution: {
        low: filteredOpportunities.filter(opp => opp.riskLevel === 'low').length,
        medium: filteredOpportunities.filter(opp => opp.riskLevel === 'medium').length,
        high: filteredOpportunities.filter(opp => opp.riskLevel === 'high').length
      },
      automationReady: filteredOpportunities.filter(opp => 
        opp.automationFlags.includes('HIGH_CONFIDENCE_MATCH')
      ).length
    };

    res.json({
      success: true,
      opportunities: filteredOpportunities,
      analytics,
      query: {
        limit: Number(limit),
        category,
        risk_level,
        min_opportunity_score: Number(min_opportunity_score),
        min_confidence: Number(min_confidence)
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error in enhanced purchasing opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze enhanced purchasing opportunities'
    });
  }
});

// Data quality assessment across all products
router.get('/data-quality-assessment', async (req, res) => {
  try {
    console.log('📊 Running comprehensive data quality assessment...');

    const qualityQuery = await db.select({
      totalProducts: sql`COUNT(*)`,
      withUPC: sql`COUNT(CASE WHEN ${products.upc} IS NOT NULL AND ${products.upc} != '' THEN 1 END)`,
      withMPN: sql`COUNT(CASE WHEN ${products.manufacturerPartNumber} IS NOT NULL AND ${products.manufacturerPartNumber} != '' THEN 1 END)`,
      withBothIdentifiers: sql`COUNT(CASE WHEN (${products.upc} IS NOT NULL AND ${products.upc} != '') AND (${products.manufacturerPartNumber} IS NOT NULL AND ${products.manufacturerPartNumber} != '') THEN 1 END)`,
      withPricing: sql`COUNT(CASE WHEN CAST(${products.cost} AS NUMERIC) > 0 AND CAST(${products.price} AS NUMERIC) > 0 THEN 1 END)`,
      amazonSynced: sql`COUNT(CASE WHEN ${products.lastAmazonSync} IS NOT NULL THEN 1 END)`,
      completeForAI: sql`COUNT(CASE WHEN (${products.upc} IS NOT NULL AND ${products.upc} != '') AND (${products.manufacturerPartNumber} IS NOT NULL AND ${products.manufacturerPartNumber} != '') AND CAST(${products.cost} AS NUMERIC) > 0 AND CAST(${products.price} AS NUMERIC) > 0 THEN 1 END)`
    }).from(products);

    const quality = qualityQuery[0];
    const total = Number(quality.totalProducts);

    const assessment = {
      catalog_size: total,
      data_completeness: {
        upc_coverage: {
          count: Number(quality.withUPC),
          percentage: Math.round((Number(quality.withUPC) / total) * 100)
        },
        mpn_coverage: {
          count: Number(quality.withMPN),
          percentage: Math.round((Number(quality.withMPN) / total) * 100)
        },
        both_identifiers: {
          count: Number(quality.withBothIdentifiers),
          percentage: Math.round((Number(quality.withBothIdentifiers) / total) * 100)
        },
        pricing_complete: {
          count: Number(quality.withPricing),
          percentage: Math.round((Number(quality.withPricing) / total) * 100)
        },
        amazon_synced: {
          count: Number(quality.amazonSynced),
          percentage: Math.round((Number(quality.amazonSynced) / total) * 100)
        },
        ai_ready: {
          count: Number(quality.completeForAI),
          percentage: Math.round((Number(quality.completeForAI) / total) * 100)
        }
      },
      reliability_score: Math.round(
        (Number(quality.withBothIdentifiers) / total * 40) +
        (Number(quality.withPricing) / total * 30) +
        (Number(quality.amazonSynced) / total * 30)
      ),
      recommendations: []
    };

    // Generate improvement recommendations
    if (assessment.data_completeness.amazon_synced.percentage < 60) {
      assessment.recommendations.push({
        priority: 'high',
        area: 'Amazon Sync Coverage',
        issue: `Only ${assessment.data_completeness.amazon_synced.percentage}% of products synced with Amazon`,
        action: 'Run bulk Amazon sync to increase marketplace coverage'
      });
    }

    if (assessment.data_completeness.upc_coverage.percentage < 95) {
      assessment.recommendations.push({
        priority: 'medium',
        area: 'UPC Coverage',
        issue: `${100 - assessment.data_completeness.upc_coverage.percentage}% of products missing UPC codes`,
        action: 'Review supplier data feeds to ensure UPC field mapping'
      });
    }

    if (assessment.reliability_score >= 80) {
      assessment.status = 'EXCELLENT';
      assessment.message = 'System ready for reliable purchasing insights across full catalog';
    } else if (assessment.reliability_score >= 60) {
      assessment.status = 'GOOD';
      assessment.message = 'System provides reliable insights with some data gaps';
    } else {
      assessment.status = 'NEEDS_IMPROVEMENT';
      assessment.message = 'Significant data quality issues affecting AI reliability';
    }

    res.json({
      success: true,
      assessment,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error in data quality assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess data quality'
    });
  }
});

export { router as enhancedPurchasingAIRouter };