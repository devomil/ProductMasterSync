/**
 * Amazon SP-API Test Routes
 * For testing authentication and API connectivity
 */

import { Router, Request, Response } from 'express';
import { amazonPricingServiceV2022 } from '../services/amazon-pricing-v2022';

const router = Router();

/**
 * POST /test/amazon/auth
 * Test Amazon SP-API authentication
 */
router.post('/amazon/auth', async (req: Request, res: Response) => {
  try {
    console.log('Testing Amazon SP-API authentication...');
    
    const token = await amazonPricingServiceV2022.getAccessToken();
    
    res.json({
      success: true,
      message: 'Amazon SP-API authentication successful',
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'No token'
    });

  } catch (error) {
    console.error('Amazon SP-API authentication failed:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /test/amazon/pricing-single
 * Test pricing for a single ASIN
 */
router.post('/amazon/pricing-single', async (req: Request, res: Response) => {
  try {
    const { asin } = req.body;
    
    if (!asin) {
      return res.status(400).json({ error: 'ASIN is required' });
    }

    console.log(`Testing pricing API for ASIN: ${asin}`);
    
    const pricingData = await amazonPricingServiceV2022.getCompetitiveSummaryBatch([asin]);
    
    res.json({
      success: true,
      asin,
      hasPricingData: pricingData.has(asin),
      pricingData: pricingData.get(asin) || null,
      resultCount: pricingData.size
    });

  } catch (error) {
    console.error('Single ASIN pricing test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Pricing test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;