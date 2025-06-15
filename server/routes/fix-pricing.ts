/**
 * Fix Pricing Routes
 * Test and fix pricing for specific ASINs using real Amazon data
 */

import { Router } from 'express';
import { amazonPricingFixService } from '../services/amazon-pricing-fix';

const router = Router();

/**
 * Test real Amazon pricing for ASIN B000K2IHAI specifically
 */
router.post('/test-b000k2ihai', async (req, res) => {
  try {
    const asin = 'B000K2IHAI';
    
    console.log(`Testing real Amazon pricing for ASIN: ${asin}`);

    const result = await amazonPricingFixService.updateProductPricingWithRealAmazonData(asin);
    
    res.json({
      success: result.success,
      asin,
      realPrice: result.price ? `$${(result.price / 100).toFixed(2)}` : null,
      priceInCents: result.price,
      error: result.error,
      message: result.success 
        ? `Successfully retrieved real Amazon pricing: ${result.price ? `$${(result.price / 100).toFixed(2)}` : 'N/A'}`
        : `Failed to get real Amazon pricing: ${result.error}`,
      comparisonNote: result.success 
        ? `This replaces the incorrect $379 cost-based calculation with real Amazon marketplace data`
        : 'Cost-based calculation was producing $379 which doesn\'t match the actual Amazon listing (~$150-200)'
    });

  } catch (error) {
    console.error('ASIN B000K2IHAI pricing test error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      asin: 'B000K2IHAI',
      message: 'Failed to test real Amazon pricing'
    });
  }
});

/**
 * Fix pricing for multiple ASINs
 */
router.post('/fix-multiple', async (req, res) => {
  try {
    const { asins, limit = 5 } = req.body;
    
    let targetAsins = asins;
    if (!targetAsins) {
      // Get ASINs from database if not provided
      const { db } = await import('../db');
      const { amazonAsins } = await import('../../shared/schema');
      
      const dbAsins = await db
        .select({ asin: amazonAsins.asin })
        .from(amazonAsins)
        .limit(limit);
        
      targetAsins = dbAsins.map(row => row.asin);
    }

    if (targetAsins.length === 0) {
      return res.json({
        success: false,
        message: 'No ASINs found to fix'
      });
    }

    console.log(`Fixing pricing for ${targetAsins.length} ASINs with real Amazon data`);

    const results = await amazonPricingFixService.fixPricingForMultipleAsins(targetAsins);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Fixed pricing for ${successful} ASINs with real Amazon data`,
      totalProcessed: results.length,
      successful,
      failed,
      results: results.map(r => ({
        asin: r.asin,
        success: r.success,
        realPrice: r.realPrice,
        error: r.error
      }))
    });

  } catch (error) {
    console.error('Fix multiple pricing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

export default router;