import { Router } from 'express';
import { db } from '../storage.js';
import { products } from '../../shared/schema.js';
import { sql } from 'drizzle-orm';

const router = Router();

// Get marketplace readiness statistics
router.get('/readiness-stats', async (req, res) => {
  try {
    const readinessStats = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        upcReady: sql<number>`COUNT(CASE WHEN ${products.upc} IS NOT NULL AND ${products.upc} != '' THEN 1 END)`,
        mpnReady: sql<number>`COUNT(CASE WHEN ${products.manufacturerPartNumber} IS NOT NULL AND ${products.manufacturerPartNumber} != '' THEN 1 END)`,
        bothReady: sql<number>`COUNT(CASE WHEN ${products.upc} IS NOT NULL AND ${products.upc} != '' AND ${products.manufacturerPartNumber} IS NOT NULL AND ${products.manufacturerPartNumber} != '' THEN 1 END)`,
        amazonSynced: sql<number>`COUNT(CASE WHEN ${products.lastAmazonSync} IS NOT NULL THEN 1 END)`
      })
      .from(products);

    const stats = readinessStats[0];
    
    res.json({
      success: true,
      stats: {
        total: stats.totalProducts,
        upcReady: stats.upcReady,
        mpnReady: stats.mpnReady,
        bothReady: stats.bothReady,
        amazonSynced: stats.amazonSynced,
        upcReadyPercent: Math.round((stats.upcReady / stats.totalProducts) * 100),
        mpnReadyPercent: Math.round((stats.mpnReady / stats.totalProducts) * 100),
        amazonSyncedPercent: Math.round((stats.amazonSynced / stats.totalProducts) * 100)
      }
    });
  } catch (error) {
    console.error('Error getting readiness stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace readiness statistics'
    });
  }
});

export { router as marketplaceReadinessRouter };