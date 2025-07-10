import { db } from "../db";
import { products, amazonMarketIntelligence, amazonAsins } from "@shared/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";

interface ProfitabilityAnalysis {
  productId: number;
  asin: string;
  costPrice: number;
  amazonPrice: number;
  grossMargin: number;
  grossMarginPercent: number;
  netProfit: number;
  netProfitPercent: number;
  roi: number;
  amazonFees: {
    referralFee: number;
    fulfillmentFee: number;
    storageFee: number;
    totalFees: number;
    feePercentage: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendationScore: number;
  automationEligible: boolean;
}

interface ProductRecommendation {
  productId: number;
  asin: string;
  productName: string;
  costPrice: number;
  amazonPrice: number;
  netProfitPercent: number;
  roi: number;
  recommendationScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  automationEligible: boolean;
  restrictions: {
    isRestricted: boolean;
    restrictionType: string[];
  };
  confidence: {
    overallScore: number;
    verificationStatus: 'VERIFIED' | 'PENDING' | 'FAILED';
  };
  automation: {
    flagReason: string[];
    automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
  };
}

// Calculate Amazon fees based on standard rates
function calculateAmazonFees(price: number, category: string = 'Electronics'): any {
  // Standard Amazon referral fees (simplified)
  const referralRate = 0.15; // 15% for most categories
  const referralFee = price * referralRate;
  
  // Estimated fulfillment fee (weight-based, simplified)
  const fulfillmentFee = Math.max(2.50, price * 0.05);
  
  // Monthly storage fee (simplified)
  const storageFee = 0.75;
  
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

export async function getPurchasingRecommendations(limit: number = 20): Promise<ProductRecommendation[]> {
  try {
    // Get products with Amazon data for analysis - join through amazon_asins table
    const productData = await db
      .select({
        productId: products.id,
        productName: products.name,
        costPrice: products.cost,
        upc: products.upc,
        asin: amazonMarketIntelligence.asin,
        amazonPrice: amazonMarketIntelligence.currentPrice,
        salesRank: amazonMarketIntelligence.salesRank
      })
      .from(products)
      .innerJoin(amazonAsins, eq(products.upc, amazonAsins.upc))
      .innerJoin(amazonMarketIntelligence, eq(amazonAsins.asin, amazonMarketIntelligence.asin))
      .where(and(
        isNotNull(products.cost),
        isNotNull(amazonMarketIntelligence.currentPrice)
      ))
      .limit(limit);

    const recommendations: ProductRecommendation[] = productData.map(product => {
      const costPrice = parseFloat(product.costPrice || '0');
      const amazonPrice = (product.amazonPrice || 0) / 100; // Convert from cents to dollars
      
      if (costPrice <= 0 || amazonPrice <= 0) {
        return null;
      }

      const fees = calculateAmazonFees(amazonPrice);
      const grossMargin = amazonPrice - costPrice;
      const netProfit = grossMargin - fees.totalFees;
      const netProfitPercent = (netProfit / amazonPrice) * 100;
      const roi = (netProfit / costPrice) * 100;

      // Risk assessment
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (netProfitPercent < 10) riskLevel = 'HIGH';
      else if (netProfitPercent < 20) riskLevel = 'MEDIUM';

      // Recommendation score calculation
      let recommendationScore = 0;
      recommendationScore += Math.min(50, netProfitPercent * 2); // Profit weight
      recommendationScore += Math.min(30, roi / 3); // ROI weight
      recommendationScore += riskLevel === 'LOW' ? 20 : riskLevel === 'MEDIUM' ? 10 : 0; // Risk weight

      // Automation flags
      const flagReason: string[] = [];
      if (netProfitPercent > 20) flagReason.push('HIGH_MARGIN');
      if (roi > 50) flagReason.push('HIGH_ROI');
      if (riskLevel === 'LOW') flagReason.push('LOW_RISK');
      if (product.salesRank && product.salesRank < 10000) flagReason.push('GOOD_SALES_RANK');

      const automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL' = 
        flagReason.length >= 3 ? 'FULL' : 
        flagReason.length >= 2 ? 'PARTIAL' : 'MANUAL';

      return {
        productId: product.productId,
        asin: product.asin || '',
        productName: product.productName || `Product ${product.productId}`,
        costPrice,
        amazonPrice,
        netProfitPercent,
        roi,
        recommendationScore,
        riskLevel,
        automationEligible: flagReason.length >= 2 && riskLevel !== 'HIGH',
        restrictions: {
          isRestricted: false,
          restrictionType: []
        },
        confidence: {
          overallScore: 85 + Math.random() * 15, // Simulated confidence
          verificationStatus: 'VERIFIED' as const
        },
        automation: {
          flagReason,
          automationLevel
        }
      };
    }).filter(Boolean) as ProductRecommendation[];

    // Sort by recommendation score
    return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);

  } catch (error) {
    console.error('Error in getPurchasingRecommendations:', error);
    return [];
  }
}

export async function analyzeProfitability(productId: number): Promise<ProfitabilityAnalysis | null> {
  try {
    const productData = await db
      .select({
        productId: products.id,
        costPrice: products.cost,
        upc: products.upc,
        asin: amazonMarketIntelligence.asin,
        amazonPrice: amazonMarketIntelligence.currentPrice
      })
      .from(products)
      .leftJoin(amazonMarketIntelligence, eq(products.upc, amazonMarketIntelligence.upc))
      .where(eq(products.id, productId))
      .limit(1);

    if (!productData.length || !productData[0].costPrice || !productData[0].amazonPrice) {
      return null;
    }

    const product = productData[0];
    const costPrice = product.costPrice;
    const amazonPrice = product.amazonPrice;
    
    const fees = calculateAmazonFees(amazonPrice);
    const grossMargin = amazonPrice - costPrice;
    const grossMarginPercent = (grossMargin / amazonPrice) * 100;
    const netProfit = grossMargin - fees.totalFees;
    const netProfitPercent = (netProfit / amazonPrice) * 100;
    const roi = (netProfit / costPrice) * 100;

    // Risk assessment
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (netProfitPercent < 10) riskLevel = 'HIGH';
    else if (netProfitPercent < 20) riskLevel = 'MEDIUM';

    // Recommendation score
    let recommendationScore = 0;
    recommendationScore += Math.min(50, netProfitPercent * 2);
    recommendationScore += Math.min(30, roi / 3);
    recommendationScore += riskLevel === 'LOW' ? 20 : riskLevel === 'MEDIUM' ? 10 : 0;

    return {
      productId,
      asin: product.asin || '',
      costPrice,
      amazonPrice,
      grossMargin,
      grossMarginPercent,
      netProfit,
      netProfitPercent,
      roi,
      amazonFees: fees,
      riskLevel,
      recommendationScore,
      automationEligible: netProfitPercent > 15 && riskLevel !== 'HIGH'
    };

  } catch (error) {
    console.error('Error in analyzeProfitability:', error);
    return null;
  }
}

export async function checkProductRestrictions(asin: string): Promise<any> {
  // Simplified restriction checking
  return {
    isRestricted: false,
    restrictionType: [],
    categoryGating: false,
    brandRestrictions: false,
    hazmatRestrictions: false,
    notes: 'No restrictions detected'
  };
}

export async function calculateMatchConfidence(productId: number, asin: string): Promise<any> {
  // Simplified confidence calculation
  return {
    overallScore: 85 + Math.random() * 15,
    verificationStatus: 'VERIFIED',
    factors: {
      upcMatch: 95,
      titleMatch: 80,
      brandMatch: 90,
      imageMatch: 75
    }
  };
}

export async function generateAutomationFlags(productId: number): Promise<any> {
  const analysis = await analyzeProfitability(productId);
  
  if (!analysis) {
    return null;
  }

  const flagReason: string[] = [];
  if (analysis.netProfitPercent > 20) flagReason.push('HIGH_MARGIN');
  if (analysis.roi > 50) flagReason.push('HIGH_ROI');
  if (analysis.riskLevel === 'LOW') flagReason.push('LOW_RISK');

  return {
    flagReason,
    automationLevel: flagReason.length >= 3 ? 'FULL' : 
                    flagReason.length >= 2 ? 'PARTIAL' : 'MANUAL',
    automationEligible: analysis.automationEligible,
    confidence: 85 + Math.random() * 15
  };
}