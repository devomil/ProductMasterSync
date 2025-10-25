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
      dropshipMinMargin: 15,
      warehouseMinMargin: 25,
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
      .leftJoin(productAsinMapping, and(
        eq(products.id, productAsinMapping.productId),
        eq(productAsinMapping.isActive, true)
      ))
      .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
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

    // Analyze with AI
    const aiResult = await analyzeWithAI(productData, settings, ourCost, shippingCost, buyBoxPrice);

    const marginPercent = ((buyBoxPrice - ourCost - shippingCost) / buyBoxPrice) * 100;

    // Save opportunity to database
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
      dropshipMinMargin: 15,
      warehouseMinMargin: 25,
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

    console.log(`[Analyzer] Found ${productResults.length} products with Amazon data to analyze`);

    const opportunities = [];

    for (const { product, asinMapping, marketData, supplier } of productResults) {
      if (!marketData?.buyBoxPrice || !asinMapping?.asin) continue;

      try {
        const ourCost = parseFloat(product.cost || '0');
        const weight = parseFloat(product.weight || '5');
        const buyBoxPrice = (marketData.buyBoxPrice || 0) / 100; // Convert cents to dollars

        const shippingCost = await calculateShippingCost(supplier?.supplierId || null, ourCost, weight) || 10;

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

        // Use rule-based for bulk to save on AI costs
        const marginPercent = ((buyBoxPrice - ourCost - shippingCost) / buyBoxPrice) * 100;
        const aiResult = ruleBasedRecommendation(marginPercent, productData, settings);

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
          })
          .returning();

        opportunities.push(opportunity);

        if (opportunities.length % 100 === 0) {
          console.log(`[Analyzer] Analyzed ${opportunities.length} products...`);
        }
      } catch (error) {
        console.error(`[Analyzer] Error analyzing product ${product.id}:`, error);
      }
    }

    console.log(`[Analyzer] Bulk analysis complete. Created ${opportunities.length} opportunities`);
    return opportunities;
  } catch (error) {
    console.error('[Analyzer] Bulk analysis error:', error);
    throw error;
  }
}
