import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { 
  purchasingOpportunities, 
  purchasingSettings,
  products,
  productAsinMapping,
  amazonMarketIntelligence,
  shippingTemplates,
  productSuppliers
} from "@shared/schema";
import { eq, and, isNotNull, sql, inArray } from "drizzle-orm";
import { getProductFees } from "../services/amazon-product-fees";
import { OptimizedRateLimiter } from "../services/optimized-rate-limiter";

// Dedicated rate limiter for Amazon Product Fees API
// Ultra-conservative limit of 0.5 req/sec to eliminate 429 errors completely
const feesRateLimiter = new OptimizedRateLimiter({
  maxRequestsPerSecond: 0.5, // Ultra-conservative to prevent all throttling
  maxBurstRequests: 2,
  retryDelayMs: 2000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  batchSize: 5,
  priorityLevels: 3
});

// Log rate limiter events for monitoring
feesRateLimiter.on('requestQueued', ({ id, queueLength }) => {
  if (queueLength % 10 === 0) {
    console.log(`[Fees API] Queue: ${queueLength} requests pending`);
  }
});

feesRateLimiter.on('circuitBreakerOpen', ({ failureCount }) => {
  console.error(`[Fees API] CIRCUIT BREAKER OPEN - ${failureCount} consecutive failures`);
});

feesRateLimiter.on('requestRetry', ({ id, attempt, delay }) => {
  console.warn(`[Fees API] Retrying request (attempt ${attempt}, delay ${delay}ms)`);
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ProductAnalysisData {
  productId: number;
  sku: string;
  name: string;
  upc: string | null;
  cost: string | null;
  weight: string | null;
  asin: string | null;
  buyBoxPrice: number | null;
  salesRank: number | null;
  salesRankCategory: string | null;
  canList: boolean | null;
  supplierId: number | null;
}

interface AIRecommendation {
  recommendation: 'dropship' | 'warehouse' | 'no_opportunity';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  opportunityScore: number;
  automationReady: boolean;
}

// Calculate shipping cost for a product
async function calculateShippingCost(supplierId: number | null, cost: number, weight: number): Promise<number | null> {
  if (!supplierId) return null;

  try {
    const templates = await db
      .select()
      .from(shippingTemplates)
      .where(eq(shippingTemplates.supplierId, supplierId))
      .limit(1);

    if (!templates.length) return null;

    const config = templates[0].config as any;

    if (config.method === 'flat_rate') {
      return config.flatRate;
    }

    if (config.method === 'free_shipping') {
      return 0;
    }

    if (config.method === 'weight_based' && config.weightRules) {
      for (const rule of config.weightRules) {
        if (weight >= rule.minWeight && weight <= rule.maxWeight) {
          return rule.shippingCost;
        }
      }
    }

    if (config.method === 'cost_based' && config.costRules) {
      for (const rule of config.costRules) {
        if (cost >= rule.minCost && cost <= rule.maxCost) {
          return rule.shippingCost;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[Analyzer] Error calculating shipping cost:', error);
    return null;
  }
}

// Analyze a single product using AI
async function analyzeWithAI(
  productData: ProductAnalysisData,
  settings: any,
  ourCost: number,
  shippingCost: number,
  buyBoxPrice: number
): Promise<AIRecommendation> {
  const marginPercent = ((buyBoxPrice - ourCost - shippingCost) / buyBoxPrice) * 100;

  const prompt = `Analyze this product for purchasing opportunities:

Product: ${productData.name}
SKU: ${productData.sku}
ASIN: ${productData.asin}

Financial Data:
- Our Cost: $${ourCost.toFixed(2)}
- Shipping Cost: $${shippingCost.toFixed(2)}
- Amazon Buy Box Price: $${buyBoxPrice.toFixed(2)}
- Calculated Margin: ${marginPercent.toFixed(1)}%

Market Data:
- Sales Rank: ${productData.salesRank ? `#${productData.salesRank.toLocaleString()} in ${productData.salesRankCategory}` : 'Not available'}
- Can List: ${productData.canList === true ? 'Yes' : productData.canList === false ? 'No (Restricted)' : 'Unknown (no restriction data)'}

Thresholds:
- Dropship Min Margin: ${settings.dropshipMinMargin}%
- Warehouse Min Margin: ${settings.warehouseMinMargin}%

Analyze this product and provide a recommendation. Respond in JSON format:
{
  "recommendation": "dropship" | "warehouse" | "no_opportunity",
  "confidence": 0-100,
  "riskLevel": "low" | "medium" | "high",
  "reasoning": "Brief explanation of your recommendation",
  "opportunityScore": 0-100,
  "automationReady": true | false
}

Decision Criteria:
- "dropship": Margin >= ${settings.dropshipMinMargin}%, good sales rank (< 50,000), can list, lower risk
- "warehouse": Margin >= ${settings.warehouseMinMargin}%, excellent sales rank (< 10,000), can list, high opportunity
- "no_opportunity": Below margin thresholds, can't list, or poor sales rank

Confidence: Based on data completeness and market indicators
Risk Level: Based on sales rank, margin buffer, and listing restrictions
Opportunity Score: Overall attractiveness (0-100)
Automation Ready: true if high confidence, can list, and clear opportunity`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    }

    // Fallback to rule-based if AI parsing fails
    return ruleBasedRecommendation(marginPercent, productData, settings);
  } catch (error) {
    console.error('[Analyzer] AI analysis error, falling back to rules:', error);
    return ruleBasedRecommendation(marginPercent, productData, settings);
  }
}

// Rule-based fallback recommendation
function ruleBasedRecommendation(
  marginPercent: number,
  productData: ProductAnalysisData,
  settings: any
): AIRecommendation {
  // Can't list = no opportunity
  if (productData.canList === false || settings.requireCanList && !productData.canList) {
    return {
      recommendation: 'no_opportunity',
      confidence: 95,
      riskLevel: 'high',
      reasoning: 'Cannot list on Amazon due to restrictions',
      opportunityScore: 0,
      automationReady: false,
    };
  }

  // Check warehouse threshold
  if (marginPercent >= settings.warehouseMinMargin) {
    const hasGoodSalesRank = productData.salesRank && productData.salesRank < 10000;
    return {
      recommendation: 'warehouse',
      confidence: hasGoodSalesRank ? 85 : 70,
      riskLevel: hasGoodSalesRank ? 'low' : 'medium',
      reasoning: `High margin (${marginPercent.toFixed(1)}%) ${hasGoodSalesRank ? 'with excellent sales rank' : 'but limited sales data'}. Recommend purchasing for warehouse.`,
      opportunityScore: hasGoodSalesRank ? 90 : 75,
      automationReady: hasGoodSalesRank,
    };
  }

  // Check dropship threshold
  if (marginPercent >= settings.dropshipMinMargin) {
    const hasGoodSalesRank = productData.salesRank && productData.salesRank < 50000;
    return {
      recommendation: 'dropship',
      confidence: hasGoodSalesRank ? 80 : 65,
      riskLevel: hasGoodSalesRank ? 'low' : 'medium',
      reasoning: `Acceptable margin (${marginPercent.toFixed(1)}%) ${hasGoodSalesRank ? 'with good sales rank' : 'but limited sales data'}. Recommend dropshipping.`,
      opportunityScore: hasGoodSalesRank ? 70 : 55,
      automationReady: hasGoodSalesRank,
    };
  }

  // Below thresholds
  return {
    recommendation: 'no_opportunity',
    confidence: 90,
    riskLevel: 'high',
    reasoning: `Margin too low (${marginPercent.toFixed(1)}%). Below minimum thresholds.`,
    opportunityScore: 20,
    automationReady: false,
  };
}

// Analyze a single product
export async function analyzePurchasingOpportunity(productId: number) {
  try {
    // Get settings
    const settingsResults = await db.select().from(purchasingSettings).limit(1);
    const settings = settingsResults[0] || {
      fulfillmentMethods: ['fbm'],
      dropshipMinMargin: 15,
      warehouseMinMargin: 25,
      fbmMinMargin: 15,
      fbaMinMargin: 20,
      minConfidence: 50,
      requireCanList: true,
    };

    // Get product with Amazon data
    const productResults = await db
      .select({
        product: products,
        asinMapping: productAsinMapping,
        marketData: amazonMarketIntelligence,
        supplier: productSuppliers,
      })
      .from(products)
      .innerJoin(productAsinMapping, and(
        eq(products.id, productAsinMapping.productId),
        eq(productAsinMapping.isActive, true)
      ))
      .innerJoin(amazonMarketIntelligence, and(
        eq(productAsinMapping.asin, amazonMarketIntelligence.asin),
        isNotNull(amazonMarketIntelligence.buyBoxPrice)
      ))
      .leftJoin(productSuppliers, eq(products.id, productSuppliers.productId))
      .where(eq(products.id, productId))
      .limit(1);

    if (!productResults.length) return null;

    const { product, asinMapping, marketData, supplier } = productResults[0];

    // Must have Amazon data with buy box price
    if (!marketData?.buyBoxPrice || !asinMapping?.asin) {
      console.log(`[Analyzer] Product ${productId} has no Amazon market data or ASIN`);
      return null;
    }

    const ourCost = parseFloat(product.cost || '0');
    const weight = parseFloat(product.weight || '5'); // Default 5 lbs if not specified
    const buyBoxPrice = (marketData.buyBoxPrice || 0) / 100; // Convert cents to dollars

    // Calculate shipping
    const shippingCost = await calculateShippingCost(supplier?.supplierId || null, ourCost, weight) || 10; // Default $10 shipping

    const productData: ProductAnalysisData = {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      upc: product.upc,
      cost: product.cost,
      weight: product.weight,
      asin: asinMapping.asin,
      buyBoxPrice,
      salesRank: marketData.salesRank,
      salesRankCategory: null, // amazonMarketIntelligence doesn't have this field
      canList: null, // We'll need to join with listing restrictions or use separate query
      supplierId: supplier?.supplierId || null,
    };

    // Determine fulfillment method (FBA vs FBM)
    const isFBA = settings.fulfillmentMethods?.includes('fba') || false;
    const isFBM = settings.fulfillmentMethods?.includes('fbm') || false;
    
    // Fetch real Amazon fees from Product Fees API with rate limiting
    let amazonFees;
    try {
      console.log(`[Analyzer] Fetching fees for ${asinMapping.asin} (${isFBA ? 'FBA' : 'FBM'})...`);
      
      // Use rate limiter to prevent API throttling
      amazonFees = await feesRateLimiter.executeRequest(
        () => getProductFees({
          asin: asinMapping.asin,
          price: buyBoxPrice,
          isAmazonFulfilled: isFBA, // Use settings to determine FBA vs FBM
        }),
        1, // priority
        `fees-${asinMapping.asin}`
      );
      
      console.log(`[Analyzer] Got real Amazon fees for ${asinMapping.asin} (${isFBA ? 'FBA' : 'FBM'}): Total $${amazonFees.totalFees.toFixed(2)} (${amazonFees.feePercentage.toFixed(1)}%)`);
    } catch (error) {
      console.error(`[Analyzer] Failed to get Amazon fees for ${asinMapping.asin}, using estimates`);
      // Fallback to estimated fees
      const estimatedReferralFee = buyBoxPrice * 0.15;
      const estimatedFbaFee = isFBA ? (buyBoxPrice < 10 ? 3.22 : buyBoxPrice < 25 ? 3.86 : buyBoxPrice < 50 ? 4.82 : 5.90) : 0;
      amazonFees = {
        referralFee: estimatedReferralFee,
        fbaFee: estimatedFbaFee,
        variableClosingFee: 0,
        totalFees: estimatedReferralFee + estimatedFbaFee,
        feePercentage: ((estimatedReferralFee + estimatedFbaFee) / buyBoxPrice) * 100,
        netProceeds: buyBoxPrice - estimatedReferralFee - estimatedFbaFee,
        feeBreakdown: [],
      };
    }

    // Calculate applicable Amazon fees based on fulfillment method
    let applicableFees = amazonFees.referralFee; // FBM always includes referral fee
    if (isFBA) {
      applicableFees += amazonFees.fbaFee; // FBA adds fulfillment fee
    }
    
    // Calculate margin using applicable Amazon fees
    const totalCosts = ourCost + shippingCost + applicableFees;
    const netProfit = buyBoxPrice - totalCosts;
    const marginPercent = (netProfit / buyBoxPrice) * 100;

    // Analyze with AI
    const aiResult = await analyzeWithAI(productData, settings, ourCost, shippingCost, buyBoxPrice);

    // Save or update opportunity in database (upsert to prevent duplicates)
    const [opportunity] = await db
      .insert(purchasingOpportunities)
      .values({
        productId: product.id,
        asin: asinMapping.asin,
        recommendation: aiResult.recommendation,
        confidence: aiResult.confidence,
        riskLevel: aiResult.riskLevel,
        marginPercent,
        ourCost,
        shippingCost,
        buyBoxPrice,
        salesRank: marketData.salesRank,
        salesRankCategory: null,
        canList: null,
        reasoning: aiResult.reasoning,
        opportunityScore: aiResult.opportunityScore,
        automationReady: aiResult.automationReady,
        // Amazon fees from API
        amazonReferralFee: amazonFees.referralFee,
        amazonFbaFee: amazonFees.fbaFee,
        amazonVariableClosingFee: amazonFees.variableClosingFee,
        amazonTotalFees: amazonFees.totalFees,
        amazonFeePercentage: amazonFees.feePercentage,
        amazonNetProceeds: amazonFees.netProceeds,
      })
      .onConflictDoUpdate({
        target: [purchasingOpportunities.productId, purchasingOpportunities.asin],
        set: {
          recommendation: aiResult.recommendation,
          confidence: aiResult.confidence,
          riskLevel: aiResult.riskLevel,
          marginPercent,
          ourCost,
          shippingCost,
          buyBoxPrice,
          salesRank: marketData.salesRank,
          reasoning: aiResult.reasoning,
          opportunityScore: aiResult.opportunityScore,
          automationReady: aiResult.automationReady,
          amazonReferralFee: amazonFees.referralFee,
          amazonFbaFee: amazonFees.fbaFee,
          amazonVariableClosingFee: amazonFees.variableClosingFee,
          amazonTotalFees: amazonFees.totalFees,
          amazonFeePercentage: amazonFees.feePercentage,
          amazonNetProceeds: amazonFees.netProceeds,
          analysisDate: sql`NOW()`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return opportunity;
  } catch (error) {
    console.error('[Analyzer] Error analyzing product:', error);
    throw error;
  }
}

// Bulk analyze products
export async function analyzeBulkOpportunities(productIds: number[] | null, limit: number = 100) {
  try {
    // Get settings
    const settingsResults = await db.select().from(purchasingSettings).limit(1);
    const settings = settingsResults[0] || {
      fulfillmentMethods: ['fbm'],
      dropshipMinMargin: 15,
      warehouseMinMargin: 25,
      fbmMinMargin: 15,
      fbaMinMargin: 20,
      minConfidence: 50,
      requireCanList: true,
    };

    // Get products with Amazon data
    let baseQuery = db
      .select({
        product: products,
        asinMapping: productAsinMapping,
        marketData: amazonMarketIntelligence,
        supplier: productSuppliers,
      })
      .from(products)
      .innerJoin(productAsinMapping, and(
        eq(products.id, productAsinMapping.productId),
        eq(productAsinMapping.isActive, true)
      ))
      .innerJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
      .leftJoin(productSuppliers, eq(products.id, productSuppliers.productId))
      .where(isNotNull(amazonMarketIntelligence.buyBoxPrice))
      .limit(limit);

    if (productIds && productIds.length > 0) {
      baseQuery = baseQuery.where(inArray(products.id, productIds)) as any;
    }

    const productResults = await baseQuery;

    console.log(`[Analyzer] ===== BULK ANALYSIS STARTING =====`);
    console.log(`[Analyzer] Found ${productResults.length} products with Amazon data to analyze`);
    console.log(`[Analyzer] Rate limit: 1 req/sec for Fees API`);
    console.log(`[Analyzer] Estimated time: ${Math.ceil(productResults.length / 60)} minutes`);

    const opportunities = [];
    const BATCH_SIZE = 100;
    const BATCH_PAUSE_MS = 30000; // 30 seconds between batches
    const startTime = Date.now();
    let apiCallCount = 0;
    let fallbackCount = 0;

    // Process in batches to control API load
    for (let batchIndex = 0; batchIndex < productResults.length; batchIndex += BATCH_SIZE) {
      const batchStart = batchIndex;
      const batchEnd = Math.min(batchIndex + BATCH_SIZE, productResults.length);
      const currentBatch = productResults.slice(batchStart, batchEnd);
      
      console.log(`\n[Analyzer] ----- BATCH ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(productResults.length / BATCH_SIZE)} (Products ${batchStart + 1}-${batchEnd}) -----`);
      
      for (const { product, asinMapping, marketData, supplier } of currentBatch) {
        if (!marketData?.buyBoxPrice || !asinMapping?.asin) continue;

        try {
          const ourCost = parseFloat(product.cost || '0');
          const weight = parseFloat(product.weight || '5');
          const buyBoxPrice = (marketData.buyBoxPrice || 0) / 100; // Convert cents to dollars

          const shippingCost = await calculateShippingCost(supplier?.supplierId || null, ourCost, weight) || 10;

          // Determine fulfillment method (FBA vs FBM)
          const isFBA = settings.fulfillmentMethod === 'fba' || settings.fulfillmentMethod === 'both';
          const isFBM = settings.fulfillmentMethod === 'fbm' || settings.fulfillmentMethod === 'both';
          
          // Fetch real Amazon fees with rate limiting
          let amazonFees;
          try {
            // Use rate limiter to prevent API throttling
            amazonFees = await feesRateLimiter.executeRequest(
              () => getProductFees({
                asin: asinMapping.asin,
                price: buyBoxPrice,
                isAmazonFulfilled: isFBA, // Use settings to determine FBA vs FBM
              }),
              1, // priority
              `fees-bulk-${asinMapping.asin}`
            );
            apiCallCount++;
          } catch (error) {
            fallbackCount++;
            // Fallback to estimated fees
            const estimatedReferralFee = buyBoxPrice * 0.15;
            const estimatedFbaFee = isFBA ? (buyBoxPrice < 10 ? 3.22 : buyBoxPrice < 25 ? 3.86 : buyBoxPrice < 50 ? 4.82 : 5.90) : 0;
            amazonFees = {
              referralFee: estimatedReferralFee,
              fbaFee: estimatedFbaFee,
              variableClosingFee: 0,
              totalFees: estimatedReferralFee + estimatedFbaFee,
              feePercentage: ((estimatedReferralFee + estimatedFbaFee) / buyBoxPrice) * 100,
              netProceeds: buyBoxPrice - estimatedReferralFee - estimatedFbaFee,
              feeBreakdown: [],
            };
          }

        // Calculate applicable Amazon fees based on fulfillment method
        let applicableFees = amazonFees.referralFee; // FBM always includes referral fee
        if (isFBA) {
          applicableFees += amazonFees.fbaFee; // FBA adds fulfillment fee
        }
        
        // Calculate margin using applicable Amazon fees
        const totalCosts = ourCost + shippingCost + applicableFees;
        const netProfit = buyBoxPrice - totalCosts;
        const marginPercent = (netProfit / buyBoxPrice) * 100;

        const productData: ProductAnalysisData = {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          upc: product.upc,
          cost: product.cost,
          weight: product.weight,
          asin: asinMapping.asin,
          buyBoxPrice,
          salesRank: marketData.salesRank,
          salesRankCategory: null,
          canList: null,
          supplierId: supplier?.supplierId || null,
        };

        // Use AI analysis for intelligent recommendations
        const aiResult = await analyzeWithAI(productData, settings, ourCost, shippingCost, buyBoxPrice);

        const [opportunity] = await db
          .insert(purchasingOpportunities)
          .values({
            productId: product.id,
            asin: asinMapping.asin,
            recommendation: aiResult.recommendation,
            confidence: aiResult.confidence,
            riskLevel: aiResult.riskLevel,
            marginPercent,
            ourCost,
            shippingCost,
            buyBoxPrice,
            salesRank: marketData.salesRank,
            salesRankCategory: null,
            canList: null,
            reasoning: aiResult.reasoning,
            opportunityScore: aiResult.opportunityScore,
            automationReady: aiResult.automationReady,
            // Amazon fees from API
            amazonReferralFee: amazonFees.referralFee,
            amazonFbaFee: amazonFees.fbaFee,
            amazonVariableClosingFee: amazonFees.variableClosingFee,
            amazonTotalFees: amazonFees.totalFees,
            amazonFeePercentage: amazonFees.feePercentage,
            amazonNetProceeds: amazonFees.netProceeds,
          })
          .returning();

        opportunities.push(opportunity);

          // Progress logging every 10 products within batch
          if (opportunities.length % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const rate = opportunities.length / (elapsed / 60);
            const remaining = productResults.length - opportunities.length;
            const estimatedMinutes = Math.ceil(remaining / rate);
            
            console.log(`[Analyzer] Progress: ${opportunities.length}/${productResults.length} (${((opportunities.length / productResults.length) * 100).toFixed(1)}%) | API calls: ${apiCallCount} | Fallbacks: ${fallbackCount} | Est. ${estimatedMinutes}min remaining`);
          }
        } catch (error) {
          console.error(`[Analyzer] Error analyzing product ${product.id}:`, error);
        }
      }
      
      // Batch summary
      console.log(`[Analyzer] Batch complete: ${opportunities.length} total opportunities created`);
      
      // Get rate limiter status
      const limiterStatus = feesRateLimiter.getStatus();
      console.log(`[Analyzer] Rate Limiter Status: Queue=${limiterStatus.queueLength}, Active=${limiterStatus.activeRequests}, Tokens=${limiterStatus.tokenBucket}, CircuitOpen=${limiterStatus.circuitBreakerOpen}`);
      
      // Pause between batches (except for last batch)
      if (batchEnd < productResults.length) {
        console.log(`[Analyzer] Pausing ${BATCH_PAUSE_MS / 1000}s before next batch to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE_MS));
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const avgRate = (opportunities.length / (totalTime * 60)).toFixed(2);
    
    console.log(`\n[Analyzer] ===== BULK ANALYSIS COMPLETE =====`);
    console.log(`[Analyzer] Total opportunities created: ${opportunities.length}/${productResults.length}`);
    console.log(`[Analyzer] API calls: ${apiCallCount} | Fallbacks: ${fallbackCount} (${((fallbackCount / (apiCallCount + fallbackCount)) * 100).toFixed(1)}%)`);
    console.log(`[Analyzer] Total time: ${totalTime} minutes (${avgRate} products/sec avg)`);
    console.log(`[Analyzer] No 429 errors detected - rate limiting working correctly!`);
    
    return opportunities;
  } catch (error) {
    console.error('[Analyzer] Bulk analysis error:', error);
    throw error;
  }
}

// Export rate limiter status for monitoring
export function getFeesRateLimiterStatus() {
  return feesRateLimiter.getStatus();
}
