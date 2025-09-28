/**
 * Enhanced Purchasing AI Routes
 * Leverages all 2830 products with comprehensive market intelligence
 */

import { Router } from 'express';
import { db } from '../db.js';
import { products, amazonAsins, amazonMarketIntelligence, productAsinMapping } from '../../shared/schema.js';
import { eq, sql, desc, and, isNotNull } from 'drizzle-orm';

const router = Router();

// Enhanced Amazon fee calculation based on real marketplace data
function calculateAmazonFees(price: number, category: string = 'Electronics', weight: number = 1): {
  referralFee: number;
  fulfillmentFee: number;
  storageFee: number;
  totalFees: number;
  netProceeds: number;
  feePercentage: number;
} {
  // Amazon referral fees by category (simplified but realistic)
  const referralRates: { [key: string]: number } = {
    'Electronics': 0.08, // 8%
    'Automotive': 0.12,  // 12%
    'Sports': 0.15,      // 15%
    'Home': 0.15,        // 15%
    'Default': 0.15      // 15% default
  };
  
  const referralRate = referralRates[category] || referralRates['Default'];
  const referralFee = price * referralRate;
  
  // FBA fulfillment fees based on size/weight (simplified)
  let fulfillmentFee = 0;
  if (price <= 10) {
    fulfillmentFee = 2.50 + (weight * 0.50);
  } else if (price <= 300) {
    fulfillmentFee = 3.00 + (weight * 0.60);
  } else {
    fulfillmentFee = 4.00 + (weight * 0.75);
  }
  
  // Monthly storage fee (simplified - $0.75 per cubic foot)
  const storageFee = 0.75;
  
  const totalFees = referralFee + fulfillmentFee + storageFee;
  const netProceeds = price - totalFees;
  const feePercentage = (totalFees / price) * 100;
  
  return {
    referralFee,
    fulfillmentFee,
    storageFee,
    totalFees,
    netProceeds,
    feePercentage
  };
}

// Calculate total internal costs including shipping and handling
function calculateInternalCosts(productCost: number, weight: number = 1): {
  productCost: number;
  shippingCost: number;
  handlingFee: number;
  totalInternalCost: number;
} {
  // Estimated shipping costs based on weight
  const shippingCost = Math.max(2.50, weight * 1.25); // Minimum $2.50
  
  // Handling fee (packaging, processing, etc.)
  const handlingFee = Math.max(1.00, productCost * 0.03); // 3% of cost or $1 minimum
  
  const totalInternalCost = productCost + shippingCost + handlingFee;
  
  return {
    productCost,
    shippingCost,
    handlingFee,
    totalInternalCost
  };
}

// Amazon Scaling Progress Endpoint
router.get('/amazon-scaling-progress', async (req, res) => {
  try {
    console.log('🔍 Amazon scaling progress endpoint called');
    
    // Simplified approach using individual queries
    const eligibleProducts = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(products)
    .where(
      and(
        isNotNull(products.upc),
        isNotNull(products.manufacturerPartNumber),
        isNotNull(products.cost),
        isNotNull(products.price),
        sql`CAST(${products.cost} AS NUMERIC) > 0`,
        sql`CAST(${products.price} AS NUMERIC) > 0`
      )
    );

    const mappedProducts = await db.select({
      count: sql<number>`COUNT(DISTINCT ${productAsinMapping.productId})`
    }).from(productAsinMapping)
    .innerJoin(products, eq(products.id, productAsinMapping.productId))
    .where(
      and(
        isNotNull(products.upc),
        isNotNull(products.manufacturerPartNumber),
        isNotNull(products.cost),
        isNotNull(products.price),
        sql`CAST(${products.cost} AS NUMERIC) > 0`,
        sql`CAST(${products.price} AS NUMERIC) > 0`
      )
    );

    const intelligenceRecords = await db.select({
      count: sql<number>`COUNT(DISTINCT ${productAsinMapping.productId})`
    }).from(productAsinMapping)
    .innerJoin(products, eq(products.id, productAsinMapping.productId))
    .innerJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .where(
      and(
        isNotNull(products.upc),
        isNotNull(products.manufacturerPartNumber),
        isNotNull(products.cost),
        isNotNull(products.price),
        sql`CAST(${products.cost} AS NUMERIC) > 0`,
        sql`CAST(${products.price} AS NUMERIC) > 0`
      )
    );

    const uniqueAsins = await db.select({
      count: sql<number>`COUNT(DISTINCT ${productAsinMapping.asin})`
    }).from(productAsinMapping)
    .innerJoin(products, eq(products.id, productAsinMapping.productId))
    .where(
      and(
        isNotNull(products.upc),
        isNotNull(products.manufacturerPartNumber),
        isNotNull(products.cost),
        isNotNull(products.price),
        sql`CAST(${products.cost} AS NUMERIC) > 0`,
        sql`CAST(${products.price} AS NUMERIC) > 0`
      )
    );

    const avgOpportunity = await db.select({
      avg: sql<number>`AVG(${amazonMarketIntelligence.opportunityScore})`
    }).from(amazonMarketIntelligence)
    .innerJoin(productAsinMapping, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .innerJoin(products, eq(products.id, productAsinMapping.productId))
    .where(
      and(
        isNotNull(products.upc),
        isNotNull(products.manufacturerPartNumber),
        isNotNull(products.cost),
        isNotNull(products.price),
        sql`CAST(${products.cost} AS NUMERIC) > 0`,
        sql`CAST(${products.price} AS NUMERIC) > 0`,
        isNotNull(amazonMarketIntelligence.opportunityScore)
      )
    );
    
    const totalEligible = eligibleProducts[0]?.count || 0;
    const mappedCount = mappedProducts[0]?.count || 0;
    const intelligenceCount = intelligenceRecords[0]?.count || 0;
    const uniqueAsinCount = uniqueAsins[0]?.count || 0;
    const avgOpportunityScore = avgOpportunity[0]?.avg || null;
    
    const coveragePercent = totalEligible > 0 ? Math.round((mappedCount / totalEligible) * 100) : 0;
    const intelligencePercent = totalEligible > 0 ? Math.round((intelligenceCount / totalEligible) * 100) : 0;
    
    // Determine completion status
    let status = 'STARTING';
    let statusColor = 'gray';
    let isComplete = false;
    
    if (coveragePercent >= 95) {
      status = 'EXCELLENT COMPLETION';
      statusColor = 'green';
      isComplete = true;
    } else if (coveragePercent >= 80) {
      status = 'GOOD COMPLETION';
      statusColor = 'green';
      isComplete = true;
    } else if (coveragePercent >= 50) {
      status = 'MODERATE PROGRESS';
      statusColor = 'blue';
    } else if (coveragePercent >= 10) {
      status = 'ACTIVE PROGRESS';
      statusColor = 'blue';
    }

    res.json({
      success: true,
      scaling: {
        status,
        statusColor,
        isComplete,
        coveragePercent,
        intelligencePercent,
        totalEligible,
        mappedProducts: mappedCount,
        intelligenceRecords: intelligenceCount,
        completeChain: intelligenceCount, // Same as intelligence records for now
        uniqueAsins: uniqueAsinCount,
        avgOpportunityScore: avgOpportunityScore ? Math.round(avgOpportunityScore) : null,
        highOpportunityProducts: 0, // Simplified for now
        highMarginProducts: 0, // Simplified for now
        remaining: totalEligible - mappedCount,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Amazon scaling progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling progress',
      details: error.message
    });
  }
});

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
    console.log('Query parameters:', { limit, category, risk_level, min_opportunity_score, min_confidence });

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
    console.log(`Found ${opportunities.length} raw opportunities from database`);

    // Enhanced AI analysis for each opportunity
    const enrichedOpportunities = opportunities.map(product => {
      const productCost = parseFloat(product.cost || '0');
      const internalPrice = parseFloat(product.price || '0');
      const amazonPrice = (parseFloat(product.currentPrice || '0')) / 100; // Convert from cents to dollars
      const productWeight = 1; // Default weight in pounds (could be enhanced with actual weight data)
      
      if (productCost <= 0 || amazonPrice <= 0) {
        return null; // Skip products with invalid pricing
      }
      
      // Calculate internal costs (including shipping and handling)
      const internalCosts = calculateInternalCosts(productCost, productWeight);
      
      // Calculate Amazon fees
      const amazonFees = calculateAmazonFees(amazonPrice, 'Electronics', productWeight);
      
      // Calculate profit margins with all costs included
      const internalProfitMargin = internalPrice > 0 ? ((internalPrice - internalCosts.totalInternalCost) / internalCosts.totalInternalCost * 100) : 0;
      const amazonNetProfit = amazonFees.netProceeds - internalCosts.totalInternalCost;
      const amazonProfitMargin = internalCosts.totalInternalCost > 0 ? (amazonNetProfit / internalCosts.totalInternalCost * 100) : 0;
      const amazonROI = internalCosts.totalInternalCost > 0 ? (amazonNetProfit / internalCosts.totalInternalCost * 100) : 0;
      
      // Enhanced opportunity scoring
      let enhancedOpportunityScore = product.opportunityScore || 0;
      
      // UPC + MPN confidence bonus
      const hasCompleteIdentifiers = (product.upc || product.usin) && product.manufacturerPartNumber;
      const identifierConfidence = hasCompleteIdentifiers ? 85 : 40;
      
      // Pricing intelligence bonus
      let pricingConfidence = 0;
      if (amazonPrice > 0 && internalPrice > 0) {
        const priceGap = ((amazonPrice - internalPrice) / internalPrice * 100);
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
      
      // Risk assessment with comprehensive factors
      let riskLevel = 'medium';
      if (matchConfidence >= 80 && amazonProfitMargin > 30 && amazonFees.feePercentage < 25) riskLevel = 'low';
      else if (matchConfidence < 60 || amazonProfitMargin < 10 || amazonFees.feePercentage > 35) riskLevel = 'high';
      
      // Enhanced recommendation flags
      const automationFlags = [];
      if (matchConfidence >= 85) automationFlags.push('HIGH_CONFIDENCE_MATCH');
      if (amazonProfitMargin > 50) automationFlags.push('HIGH_PROFIT_OPPORTUNITY');
      if (amazonNetProfit > 10) automationFlags.push('PROFITABLE_OPPORTUNITY');
      if (product.inStock && product.fulfillmentMethod === 'FBA') automationFlags.push('FBA_READY');
      if (enhancedOpportunityScore > 80) automationFlags.push('PRIORITY_OPPORTUNITY');
      if (amazonFees.feePercentage < 20) automationFlags.push('LOW_FEES');
      
      return {
        productId: product.productId,
        sku: product.sku,
        productName: product.name,
        upc: product.upc || product.usin,
        manufacturerPartNumber: product.manufacturerPartNumber,
        asin: product.asin,
        
        // Internal cost breakdown
        internalCosts: {
          productCost: internalCosts.productCost,
          shippingCost: internalCosts.shippingCost,
          handlingFee: internalCosts.handlingFee,
          totalInternalCost: internalCosts.totalInternalCost
        },
        
        // Amazon fee breakdown
        amazonFees: {
          referralFee: amazonFees.referralFee,
          fulfillmentFee: amazonFees.fulfillmentFee,
          storageFee: amazonFees.storageFee,
          totalFees: amazonFees.totalFees,
          feePercentage: amazonFees.feePercentage
        },
        
        // Pricing intelligence
        internalPrice: internalPrice,
        amazonCurrentPrice: amazonPrice,
        amazonListPrice: parseFloat(product.listPrice || '0') / 100,
        amazonNetProceeds: amazonFees.netProceeds,
        
        // Profit analysis
        internalProfitMargin: Math.round(internalProfitMargin * 100) / 100,
        amazonProfitMargin: Math.round(amazonProfitMargin * 100) / 100,
        amazonNetProfit: Math.round(amazonNetProfit * 100) / 100,
        amazonROI: Math.round(amazonROI * 100) / 100,
        
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
          hasPricing: !!(productCost > 0 && internalPrice > 0),
          hasAmazonData: !!product.asin,
          amazonSynced: !!product.lastAmazonSync
        }
      };
    }).filter(opportunity => opportunity !== null); // Filter out null opportunities

    console.log(`After processing, ${enrichedOpportunities.length} valid opportunities`);

    // Apply more realistic filtering - lower thresholds for better discovery
    const filteredOpportunities = enrichedOpportunities.filter(opp => 
      opp && // Ensure not null
      opp.matchConfidence >= Math.max(Number(min_confidence), 40) && // Lower minimum confidence
      opp.opportunityScore >= Math.max(Number(min_opportunity_score), 50) && // Lower opportunity threshold
      (risk_level === 'all' || opp.riskLevel === risk_level)
    );

    console.log(`After filtering, ${filteredOpportunities.length} qualified opportunities`);
    console.log('Filter criteria:', {
      minConfidence: Math.max(Number(min_confidence), 40),
      minOpportunityScore: Math.max(Number(min_opportunity_score), 50),
      riskLevel: risk_level
    });

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