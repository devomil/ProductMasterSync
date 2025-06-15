/**
 * Real Amazon Pricing Test Routes
 * Get actual Amazon pricing data for ASIN verification
 */

import { Router } from 'express';
import { amazonPriceScraperService } from '../services/amazon-price-scraper';

const router = Router();

/**
 * Test real Amazon pricing for specific ASIN
 */
router.post('/test-real-pricing', async (req, res) => {
  try {
    const { asin } = req.body;
    
    if (!asin) {
      return res.status(400).json({ error: 'ASIN is required' });
    }

    console.log(`Testing real Amazon pricing for ASIN: ${asin}`);

    // Get catalog data with pricing information
    const catalogData = await amazonPriceScraperService.getItemAttributes(asin);
    
    if (!catalogData) {
      return res.json({
        success: false,
        asin,
        error: 'No catalog data available',
        message: 'Could not retrieve Amazon catalog data for this ASIN'
      });
    }

    // Extract pricing information
    const priceData = amazonPriceScraperService.extractPriceFromCatalogData(catalogData);
    
    // Also try the MyPrice API
    const myPriceData = await amazonPriceScraperService.getMyPriceForASIN(asin);

    res.json({
      success: true,
      asin,
      catalogData: {
        raw: catalogData,
        extracted: priceData
      },
      myPriceData,
      realPrice: priceData?.price ? (priceData.price / 100).toFixed(2) : null,
      listPrice: priceData?.listPrice ? (priceData.listPrice / 100).toFixed(2) : null,
      availability: priceData?.availability || 'Unknown',
      message: 'Retrieved Amazon pricing data successfully'
    });

  } catch (error) {
    console.error('Real pricing test error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

/**
 * Update pricing for multiple ASINs with real Amazon data
 */
router.post('/update-real-pricing', async (req, res) => {
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
        message: 'No ASINs found to update'
      });
    }

    console.log(`Updating real Amazon pricing for ${targetAsins.length} ASINs`);

    // Update pricing with real Amazon data
    const results = await amazonPriceScraperService.updatePricingForProducts(targetAsins);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Updated ${successful} ASINs with real Amazon pricing data`,
      totalProcessed: results.length,
      successful,
      failed,
      results: results.map(r => ({
        asin: r.asin,
        success: r.success,
        price: r.price ? `$${(r.price / 100).toFixed(2)}` : null,
        error: r.error
      }))
    });

  } catch (error) {
    console.error('Update real pricing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

export default router;