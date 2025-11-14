import express from "express";
import multer from "multer";
import { db } from "../db";
import { 
  purchasingOpportunities, 
  purchasingSettings,
  products,
  productAmazonLookup,
  fileUploads,
  fileAnalysisResults
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { analyzePurchasingOpportunity, analyzeBulkOpportunities, getFeesRateLimiterStatus } from "./analyzer";
import { parseCSVFile, analyzeUploadedFile } from "./file-analyzer";
import schedulerRoutes from "./scheduler/routes";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Mount scheduler routes
router.use("/scheduler", schedulerRoutes);

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

    // Fetch user settings to check if we should filter by listing permission
    const [settings] = await db.select().from(purchasingSettings).limit(1);
    const shouldFilterByListing = settings?.requireCanList ?? true; // Default to true if no settings

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
    
    // Only filter out restricted products if user enabled "Require Listing Permission"
    if (shouldFilterByListing) {
      // Only show: canList = true OR canList is null (needs approval/ungated)
      conditions.push(sql`(${purchasingOpportunities.canList} = true OR ${purchasingOpportunities.canList} IS NULL)`);
    }
    
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
    // Fetch user settings to check if we should filter by listing permission
    const [settings] = await db.select().from(purchasingSettings).limit(1);
    const shouldFilterByListing = settings?.requireCanList ?? true; // Default to true if no settings

    // Build stats query with optional listing filter
    let statsQuery = db
      .select({
        totalAnalyzed: sql<number>`COUNT(*)`,
        totalOpportunities: sql<number>`SUM(CASE WHEN recommendation IN ('dropship', 'warehouse') THEN 1 ELSE 0 END)`,
        avgConfidence: sql<number>`ROUND(AVG(CASE WHEN recommendation IN ('dropship', 'warehouse') THEN confidence ELSE NULL END))`,
        avgOpportunityScore: sql<number>`ROUND(AVG(CASE WHEN recommendation IN ('dropship', 'warehouse') THEN opportunity_score ELSE NULL END))`,
        automationReady: sql<number>`SUM(CASE WHEN automation_ready THEN 1 ELSE 0 END)`,
        dropshipCount: sql<number>`SUM(CASE WHEN recommendation = 'dropship' THEN 1 ELSE 0 END)`,
        warehouseCount: sql<number>`SUM(CASE WHEN recommendation = 'warehouse' THEN 1 ELSE 0 END)`,
      })
      .from(purchasingOpportunities);

    // Only filter by listing permission if enabled
    if (shouldFilterByListing) {
      statsQuery = statsQuery.where(sql`(${purchasingOpportunities.canList} = true OR ${purchasingOpportunities.canList} IS NULL)`) as any;
    }

    const stats = await statsQuery;

    // Convert PostgreSQL aggregate results to numbers
    const result = stats[0] || {};
    res.json({
      totalAnalyzed: Number(result.totalAnalyzed) || 0,
      totalOpportunities: Number(result.totalOpportunities) || 0,
      avgConfidence: Number(result.avgConfidence) || 0,
      avgOpportunityScore: Number(result.avgOpportunityScore) || 0,
      automationReady: Number(result.automationReady) || 0,
      dropshipCount: Number(result.dropshipCount) || 0,
      warehouseCount: Number(result.warehouseCount) || 0,
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
    const { productIds, limit = 1000 } = req.body;

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

// Get rate limiter status (for monitoring during bulk analysis)
router.get("/rate-limit-status", async (req, res) => {
  try {
    const status = getFeesRateLimiterStatus();
    res.json({
      success: true,
      rateLimiter: {
        queueLength: status.queueLength,
        activeRequests: status.activeRequests,
        availableTokens: status.tokenBucket,
        circuitBreakerOpen: status.circuitBreakerOpen,
        failureCount: status.failureCount,
        maxRequestsPerSecond: 0.5,
        status: status.circuitBreakerOpen ? 'CIRCUIT_OPEN' : status.queueLength > 50 ? 'BUSY' : 'HEALTHY'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Purchasing AI] Error fetching rate limiter status:', error);
    res.status(500).json({ error: 'Failed to fetch rate limiter status' });
  }
});

router.post("/upload-analyze", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const products = await parseCSVFile(fileContent);

    if (products.length === 0) {
      return res.status(400).json({ error: 'No valid products found in CSV' });
    }

    const [uploadRecord] = await db.insert(fileUploads).values({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      status: 'pending',
      totalRows: products.length,
      dropshipThreshold: req.body.dropshipThreshold ? parseFloat(req.body.dropshipThreshold) : 12.0,
      warehouseThreshold: req.body.warehouseThreshold ? parseFloat(req.body.warehouseThreshold) : 25.0,
    }).returning();

    const resultRecords = products.map(p => ({
      uploadId: uploadRecord.id,
      asin: p.asin,
      upc: p.upc || null,
      description: p.description || null,
      brand: p.brand || null,
      model: p.model || null,
      color: p.color || null,
      quantity: p.quantity || null,
      supplierPrice: p.supplierPrice || null,
    }));

    await db.insert(fileAnalysisResults).values(resultRecords);

    await db.update(fileUploads)
      .set({ status: 'running' })
      .where(eq(fileUploads.id, uploadRecord.id));

    analyzeUploadedFile(uploadRecord.id).catch(err => {
      console.error(`[File Upload] Background analysis failed for upload ${uploadRecord.id}:`, err);
    });

    res.json({
      success: true,
      uploadId: uploadRecord.id,
      fileName: req.file.originalname,
      totalRows: products.length,
      message: `Started analysis of ${products.length} products`,
    });
  } catch (error) {
    console.error('[File Upload] Error processing upload:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

router.get("/uploads/:uploadId", async (req, res) => {
  try {
    const uploadId = parseInt(req.params.uploadId);
    const [upload] = await db.select().from(fileUploads).where(eq(fileUploads.id, uploadId));

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json(upload);
  } catch (error) {
    console.error('[File Upload] Error fetching upload:', error);
    res.status(500).json({ error: 'Failed to fetch upload' });
  }
});

router.get("/uploads/:uploadId/results", async (req, res) => {
  try {
    const uploadId = parseInt(req.params.uploadId);
    const { opportunitiesOnly } = req.query;

    const conditions = [eq(fileAnalysisResults.uploadId, uploadId)];
    
    if (opportunitiesOnly === 'true') {
      conditions.push(eq(fileAnalysisResults.isOpportunity, true));
    }

    const results = await db.select().from(fileAnalysisResults).where(and(...conditions));
    res.json(results);
  } catch (error) {
    console.error('[File Upload] Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

router.get("/uploads", async (req, res) => {
  try {
    const uploads = await db.select().from(fileUploads).orderBy(desc(fileUploads.createdAt)).limit(20);
    res.json(uploads);
  } catch (error) {
    console.error('[File Upload] Error fetching uploads:', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

export default router;
