/**
 * Test endpoint for Amazon Product Pricing API
 */

import { Router } from 'express';
import { getPricing, getCompetitivePricing, getItemOffers } from '../utils/amazon-spapi.js';

const router = Router();

/**
 * Test accurate pricing for a single ASIN
 */
router.get('/test-pricing/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    
    console.log(`Testing pricing for ASIN: ${asin}`);
    
    // Get all three types of pricing data
    const [pricing, competitivePricing, itemOffers] = await Promise.all([
      getPricing([asin]),
      getCompetitivePricing([asin]),
      getItemOffers([asin])
    ]);
    
    res.json({
      success: true,
      asin,
      pricing,
      competitivePricing,
      itemOffers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error testing pricing:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

/**
 * Test pricing for multiple ASINs
 */
router.post('/test-pricing-batch', async (req, res) => {
  try {
    const { asins } = req.body;
    
    if (!Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }
    
    console.log(`Testing pricing for ${asins.length} ASINs`);
    
    // Get competitive pricing
    const competitivePricing = await getCompetitivePricing(asins);
    
    // Get item offers
    const itemOffers = await getItemOffers(asins);
    
    res.json({
      success: true,
      asins,
      competitivePricing,
      itemOffers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error testing batch pricing:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

export default router;