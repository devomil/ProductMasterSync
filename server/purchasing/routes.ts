import express from "express";
import { db } from "../db";
import { 
  purchasingOpportunities, 
  purchasingSettings,
  products,
  productAmazonLookup 
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { analyzePurchasingOpportunity, analyzeBulkOpportunities } from "./analyzer";

const router = express.Router();

// Get all purchasing opportunities with filters
router.get("/opportunities", async (req, res) => {
  try {
    const { 
      riskLevel, 
      minConfidence, 
      recommendation,
      limit = 100,
      offset = 0 
    } = req.query;

    let query = db
      .select({
        opportunity: purchasingOpportunities,
        product: products,
      })
      .from(purchasingOpportunities)
      .leftJoin(products, eq(purchasingOpportunities.productId, products.id))
      .orderBy(desc(purchasingOpportunities.opportunityScore))
      .limit(Number(limit))
      .offset(Number(offset));

    // Apply filters
    const conditions = [];
    
    // Always filter out restricted products (canList = false means we can't list on Amazon)
    // Only show: canList = true OR canList is null (needs approval/ungated)
    conditions.push(sql`(${purchasingOpportunities.canList} = true OR ${purchasingOpportunities.canList} IS NULL)`);
    
    if (riskLevel && riskLevel !== 'all') {
      conditions.push(eq(purchasingOpportunities.riskLevel, riskLevel as any));
    }
    if (minConfidence) {
      conditions.push(gte(purchasingOpportunities.confidence, Number(minConfidence)));
    }
    if (recommendation && recommendation !== 'all') {
      conditions.push(eq(purchasingOpportunities.recommendation, recommendation as any));
    }

    // Apply WHERE clause
    query = query.where(and(...conditions)) as any;

    const opportunities = await query;

    res.json(opportunities.map(row => ({
      ...row.opportunity,
      product: row.product
    })));
  } catch (error) {
    console.error('[Purchasing AI] Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// Get purchasing statistics
router.get("/stats", async (req, res) => {
  try {
    // Only count non-restricted products (same filter as opportunities)
    const stats = await db
      .select({
        totalOpportunities: sql<number>`COUNT(*)`,
        avgConfidence: sql<number>`ROUND(AVG(confidence))`,
        avgOpportunityScore: sql<number>`ROUND(AVG(opportunity_score))`,
        automationReady: sql<number>`SUM(CASE WHEN automation_ready THEN 1 ELSE 0 END)`,
        dropshipCount: sql<number>`SUM(CASE WHEN recommendation = 'dropship' THEN 1 ELSE 0 END)`,
        warehouseCount: sql<number>`SUM(CASE WHEN recommendation = 'warehouse' THEN 1 ELSE 0 END)`,
      })
      .from(purchasingOpportunities)
      .where(sql`(${purchasingOpportunities.canList} = true OR ${purchasingOpportunities.canList} IS NULL)`);

    res.json(stats[0] || {
      totalOpportunities: 0,
      avgConfidence: 0,
      avgOpportunityScore: 0,
      automationReady: 0,
      dropshipCount: 0,
      warehouseCount: 0,
    });
  } catch (error) {
    console.error('[Purchasing AI] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get purchasing settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await db.select().from(purchasingSettings).limit(1);
    
    if (settings.length === 0) {
      // Return default settings
      res.json({
        id: 1,
        fulfillmentMethods: ['fbm'],
        dropshipMinMargin: 15,
        warehouseMinMargin: 25,
        fbmMinMargin: 15,
        fbaMinMargin: 20,
        minConfidence: 50,
        riskLevelFilter: 'all',
        maxSalesRank: null,
        requireCanList: true,
      });
    } else {
      res.json(settings[0]);
    }
  } catch (error) {
    console.error('[Purchasing AI] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update purchasing settings
router.put("/settings", async (req, res) => {
  try {
    const {
      fulfillmentMethods,
      dropshipMinMargin,
      warehouseMinMargin,
      fbmMinMargin,
      fbaMinMargin,
      minConfidence,
      riskLevelFilter,
      maxSalesRank,
      requireCanList,
    } = req.body;

    const existing = await db.select().from(purchasingSettings).limit(1);
    
    if (existing.length === 0) {
      const [newSettings] = await db.insert(purchasingSettings).values({
        fulfillmentMethods,
        dropshipMinMargin,
        warehouseMinMargin,
        fbmMinMargin,
        fbaMinMargin,
        minConfidence,
        riskLevelFilter,
        maxSalesRank,
        requireCanList,
      }).returning();
      res.json(newSettings);
    } else {
      const [updated] = await db
        .update(purchasingSettings)
        .set({
          fulfillmentMethods,
          dropshipMinMargin,
          warehouseMinMargin,
          fbmMinMargin,
          fbaMinMargin,
          minConfidence,
          riskLevelFilter,
          maxSalesRank,
          requireCanList,
          updatedAt: new Date(),
        })
        .where(eq(purchasingSettings.id, existing[0].id))
        .returning();
      res.json(updated);
    }
  } catch (error) {
    console.error('[Purchasing AI] Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Analyze single product
router.post("/analyze/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    const opportunity = await analyzePurchasingOpportunity(productId);
    
    if (!opportunity) {
      return res.status(404).json({ error: 'Product not found or no Amazon data available' });
    }

    res.json(opportunity);
  } catch (error) {
    console.error('[Purchasing AI] Error analyzing product:', error);
    res.status(500).json({ error: 'Failed to analyze product' });
  }
});

// Bulk analyze products
router.post("/analyze-bulk", async (req, res) => {
  try {
    const { productIds, limit = 100 } = req.body;

    console.log(`[Purchasing AI] Starting bulk analysis for ${productIds?.length || 'all'} products...`);
    
    const opportunities = await analyzeBulkOpportunities(productIds, limit);
    
    console.log(`[Purchasing AI] Analysis complete. Found ${opportunities.length} opportunities`);

    res.json({
      success: true,
      analyzed: opportunities.length,
      opportunities,
    });
  } catch (error) {
    console.error('[Purchasing AI] Error in bulk analysis:', error);
    res.status(500).json({ error: 'Failed to analyze products' });
  }
});

// Refresh/re-analyze opportunities
router.post("/refresh", async (req, res) => {
  try {
    // Delete all existing opportunities
    await db.delete(purchasingOpportunities);
    
    console.log('[Purchasing AI] Deleted all existing opportunities. Starting fresh analysis...');
    
    // Run bulk analysis on all products with Amazon data
    const opportunities = await analyzeBulkOpportunities(null, 5000);
    
    res.json({
      success: true,
      message: `Analysis complete. Found ${opportunities.length} opportunities`,
      count: opportunities.length,
    });
  } catch (error) {
    console.error('[Purchasing AI] Error refreshing opportunities:', error);
    res.status(500).json({ error: 'Failed to refresh opportunities' });
  }
});

export default router;
