/**
 * AI-Powered Purchasing Intelligence System
 * 
 * Analyzes products for profitability, restrictions, and automation readiness
 * Provides comprehensive buying recommendations with risk assessment
 */

import { db } from '../db';
import { products, amazonAsins, amazonMarketIntelligence, productAsinMapping, categories } from '../../shared/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

export interface ProfitabilityAnalysis {
  productId: number;
  asin: string;
  costPrice: number;
  amazonPrice: number;
  grossMargin: number;
  grossMarginPercent: number;
  netProfit: number;
  netProfitPercent: number;
  roi: number;
  amazonFees: AmazonFees;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendationScore: number;
  automationEligible: boolean;
}

export interface AmazonFees {
  referralFee: number;
  fulfillmentFee: number;
  storageFee: number;
  totalFees: number;
  feePercentage: number;
}

export interface ProductRestriction {
  asin: string;
  isRestricted: boolean;
  restrictionType: string[];
  gatedCategories: string[];
  brandRestrictions: boolean;
  approvalRequired: boolean;
  lastChecked: Date;
}

export interface MatchConfidence {
  productId: number;
  asin: string;
  overallScore: number;
  upcMatch: boolean;
  titleSimilarity: number;
  brandMatch: boolean;
  attributeMatch: number;
  imageMatch: boolean;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'FAILED';
}

export interface AutomationFlag {
  productId: number;
  asin: string;
  flagReason: string[];
  profitabilityScore: number;
  confidenceScore: number;
  restrictionStatus: string;
  automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
  lastUpdated: Date;
}

/**
 * Calculate Amazon fees based on product category and price
 */
function calculateAmazonFees(price: number, weight: number = 1, category: string = 'General'): AmazonFees {
  // Referral fee calculation (category-based)
  const referralRates: Record<string, number> = {
    'Electronics': 0.08,
    'Automotive': 0.12,
    'Sports': 0.15,
    'Tools': 0.15,
    'General': 0.15
  };
  
  const referralRate = referralRates[category] || 0.15;
  const referralFee = price * referralRate;
  
  // FBA fulfillment fee calculation (weight-based)
  let fulfillmentFee = 0;
  if (weight <= 1) {
    fulfillmentFee = price < 10 ? 3.22 : 3.99;
  } else if (weight <= 2) {
    fulfillmentFee = 4.99;
  } else {
    fulfillmentFee = 4.99 + ((weight - 2) * 0.50);
  }
  
  // Monthly storage fee (estimated)
  const storageFee = Math.max(0.87, weight * 0.87);
  
  const totalFees = referralFee + fulfillmentFee + storageFee;
  const feePercentage = (totalFees / price) * 100;
  
  return {
    referralFee,
    fulfillmentFee,
    storageFee,
    totalFees,
    feePercentage
  };
}

/**
 * Analyze product profitability with comprehensive metrics
 */
export async function analyzeProfitability(productId: number): Promise<ProfitabilityAnalysis | null> {
  // Get product with Amazon data
  const productData = await db
    .select({
      productId: products.id,
      productName: products.name,
      costPrice: products.cost,
      weight: products.weight,
      categoryName: categories.name,
      asin: productAsinMapping.asin,
      amazonPrice: amazonMarketIntelligence.currentPrice,
      salesRank: amazonMarketIntelligence.salesRank,
      isRestricted: amazonAsins.hasListingRestrictions
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
    .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
    .where(eq(products.id, productId))
    .limit(1);

  if (!productData.length || !productData[0].amazonPrice || !productData[0].costPrice) {
    return null;
  }

  const data = productData[0];
  const costPrice = data.costPrice;
  const amazonPrice = data.amazonPrice / 100; // Convert cents to dollars
  const weight = data.weight || 1;
  const category = data.categoryName || 'General';

  // Calculate Amazon fees
  const amazonFees = calculateAmazonFees(amazonPrice, weight, category);
  
  // Calculate profitability metrics
  const grossMargin = amazonPrice - costPrice;
  const grossMarginPercent = (grossMargin / amazonPrice) * 100;
  const netProfit = grossMargin - amazonFees.totalFees;
  const netProfitPercent = (netProfit / amazonPrice) * 100;
  const roi = (netProfit / costPrice) * 100;

  // Risk assessment
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (data.salesRank && data.salesRank < 10000 && netProfitPercent > 20) {
    riskLevel = 'LOW';
  } else if (data.salesRank && data.salesRank > 100000 || netProfitPercent < 10) {
    riskLevel = 'HIGH';
  }

  // Recommendation scoring (0-100)
  let recommendationScore = 50;
  if (netProfitPercent > 25) recommendationScore += 20;
  if (netProfitPercent > 15) recommendationScore += 10;
  if (roi > 50) recommendationScore += 15;
  if (data.salesRank && data.salesRank < 20000) recommendationScore += 15;
  if (!data.isRestricted) recommendationScore += 10;
  if (amazonFees.feePercentage < 20) recommendationScore += 10;

  // Automation eligibility
  const automationEligible = 
    netProfitPercent > 15 && 
    roi > 30 && 
    !data.isRestricted && 
    recommendationScore > 75;

  return {
    productId,
    asin: data.asin || '',
    costPrice,
    amazonPrice,
    grossMargin,
    grossMarginPercent,
    netProfit,
    netProfitPercent,
    roi,
    amazonFees,
    riskLevel,
    recommendationScore,
    automationEligible
  };
}

/**
 * Check product restrictions and compliance
 */
export async function checkProductRestrictions(asin: string): Promise<ProductRestriction> {
  // Get restriction data from database
  const asinData = await db
    .select({
      hasListingRestrictions: amazonAsins.hasListingRestrictions,
      restrictionReasonCodes: amazonAsins.restrictionReasonCodes,
      restrictionMessages: amazonAsins.restrictionMessages,
      requiresApproval: amazonAsins.requiresApproval,
      isRestrictedBrand: amazonAsins.isRestrictedBrand,
      lastRestrictionsCheck: amazonAsins.lastRestrictionsCheck
    })
    .from(amazonAsins)
    .where(eq(amazonAsins.asin, asin))
    .limit(1);

  if (!asinData.length) {
    return {
      asin,
      isRestricted: false,
      restrictionType: [],
      gatedCategories: [],
      brandRestrictions: false,
      approvalRequired: false,
      lastChecked: new Date()
    };
  }

  const data = asinData[0];
  const restrictionTypes = [];
  
  if (data.hasListingRestrictions) restrictionTypes.push('LISTING_RESTRICTED');
  if (data.isRestrictedBrand) restrictionTypes.push('BRAND_RESTRICTED');
  if (data.requiresApproval) restrictionTypes.push('APPROVAL_REQUIRED');

  return {
    asin,
    isRestricted: data.hasListingRestrictions || false,
    restrictionType: restrictionTypes,
    gatedCategories: [], // Would be populated from restriction codes
    brandRestrictions: data.isRestrictedBrand || false,
    approvalRequired: data.requiresApproval || false,
    lastChecked: data.lastRestrictionsCheck || new Date()
  };
}

/**
 * Calculate match confidence score
 */
export async function calculateMatchConfidence(productId: number, asin: string): Promise<MatchConfidence> {
  // Get product and ASIN data for comparison
  const matchData = await db
    .select({
      productUpc: products.upc,
      productName: products.name,
      productBrand: products.manufacturerName,
      asinUpc: amazonAsins.upc,
      asinTitle: amazonAsins.title,
      asinBrand: amazonAsins.brand,
      matchMethod: productAsinMapping.matchMethod,
      matchConfidence: productAsinMapping.matchConfidence,
      isVerified: productAsinMapping.isVerified
    })
    .from(products)
    .leftJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
    .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
    .where(and(eq(products.id, productId), eq(productAsinMapping.asin, asin)))
    .limit(1);

  if (!matchData.length) {
    return {
      productId,
      asin,
      overallScore: 0,
      upcMatch: false,
      titleSimilarity: 0,
      brandMatch: false,
      attributeMatch: 0,
      imageMatch: false,
      verificationStatus: 'FAILED'
    };
  }

  const data = matchData[0];
  
  // UPC match (highest confidence)
  const upcMatch = data.productUpc === data.asinUpc;
  
  // Title similarity (basic text comparison)
  const titleSimilarity = calculateTextSimilarity(
    data.productName || '', 
    data.asinTitle || ''
  );
  
  // Brand match
  const brandMatch = data.productBrand?.toLowerCase() === data.asinBrand?.toLowerCase();
  
  // Calculate overall score
  let overallScore = 0;
  if (upcMatch) overallScore += 40;
  overallScore += titleSimilarity * 30;
  if (brandMatch) overallScore += 20;
  overallScore += (data.matchConfidence || 0) * 0.1;

  const verificationStatus = data.isVerified ? 'VERIFIED' : 
    overallScore > 80 ? 'PENDING' : 'FAILED';

  return {
    productId,
    asin,
    overallScore: Math.min(100, overallScore),
    upcMatch,
    titleSimilarity,
    brandMatch,
    attributeMatch: data.matchConfidence || 0,
    imageMatch: false, // Would require image comparison
    verificationStatus
  };
}

/**
 * Generate automation flags for products
 */
export async function generateAutomationFlags(productId: number): Promise<AutomationFlag | null> {
  const profitability = await analyzeProfitability(productId);
  if (!profitability) return null;

  const restrictions = await checkProductRestrictions(profitability.asin);
  const confidence = await calculateMatchConfidence(productId, profitability.asin);

  const flagReasons = [];
  
  if (profitability.netProfitPercent > 20) flagReasons.push('HIGH_PROFIT_MARGIN');
  if (profitability.roi > 50) flagReasons.push('HIGH_ROI');
  if (confidence.overallScore > 90) flagReasons.push('HIGH_CONFIDENCE_MATCH');
  if (!restrictions.isRestricted) flagReasons.push('UNRESTRICTED');
  if (profitability.riskLevel === 'LOW') flagReasons.push('LOW_RISK');

  let automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL' = 'MANUAL';
  if (flagReasons.length >= 4 && profitability.recommendationScore > 85) {
    automationLevel = 'FULL';
  } else if (flagReasons.length >= 2 && profitability.recommendationScore > 70) {
    automationLevel = 'PARTIAL';
  }

  return {
    productId,
    asin: profitability.asin,
    flagReason: flagReasons,
    profitabilityScore: profitability.recommendationScore,
    confidenceScore: confidence.overallScore,
    restrictionStatus: restrictions.isRestricted ? 'RESTRICTED' : 'CLEAR',
    automationLevel,
    lastUpdated: new Date()
  };
}

/**
 * Get comprehensive purchasing recommendations
 */
export async function getPurchasingRecommendations(limit: number = 20) {
  // Get products with Amazon mappings
  const products = await db
    .select({
      productId: productAsinMapping.productId,
      asin: productAsinMapping.asin
    })
    .from(productAsinMapping)
    .limit(limit);

  const recommendations = [];
  
  for (const product of products) {
    const profitability = await analyzeProfitability(product.productId);
    if (!profitability) continue;

    const restrictions = await checkProductRestrictions(product.asin);
    const confidence = await calculateMatchConfidence(product.productId, product.asin);
    const automation = await generateAutomationFlags(product.productId);

    recommendations.push({
      ...profitability,
      restrictions,
      confidence,
      automation
    });
  }

  // Sort by recommendation score
  return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
}

/**
 * Simple text similarity calculation
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
}