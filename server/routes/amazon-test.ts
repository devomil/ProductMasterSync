/**
 * Amazon SP-API Test Routes
 * Testing various Amazon marketplace endpoints with proper authentication
 */

import { Router } from 'express';
import { createAWSSignature } from '../utils/aws-signature';

const router = Router();

/**
 * Test Amazon SP-API Featured Offer Expected Price endpoint
 */
router.post('/featured-offer-price', async (req, res) => {
  try {
    const { asin } = req.body;
    
    if (!asin) {
      return res.status(400).json({ error: 'ASIN is required' });
    }

    console.log(`Testing Featured Offer Expected Price for ASIN: ${asin}`);

    // Get access token
    const CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
    const CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN!,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create AWS signature
    const awsSigner = createAWSSignature();
    const url = 'https://sellingpartnerapi-na.amazon.com/batches/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice';
    
    const requestBody = JSON.stringify({
      requests: [{
        method: 'GET',
        asin: asin,
        marketplaceId: 'ATVPDKIKX0DER'
      }]
    });

    // Create signed headers
    const signedHeaders = awsSigner.signRequest('POST', url, {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-amz-access-token': accessToken
    }, requestBody);

    console.log('Making Featured Offer Expected Price request with AWS signature...');

    const response = await fetch(url, {
      method: 'POST',
      headers: signedHeaders,
      body: requestBody
    });

    const responseText = await response.text();
    console.log(`Featured Offer Response: ${response.status} - ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    res.json({
      success: response.ok,
      status: response.status,
      asin,
      endpoint: 'featuredOfferExpectedPrice',
      data: responseData,
      hasData: response.ok && responseData?.responses?.length > 0
    });

  } catch (error) {
    console.error('Featured Offer test error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

/**
 * Test Amazon SP-API Competitive Summary with AWS signature
 */
router.post('/competitive-summary', async (req, res) => {
  try {
    const { asin } = req.body;
    
    if (!asin) {
      return res.status(400).json({ error: 'ASIN is required' });
    }

    console.log(`Testing Competitive Summary for ASIN: ${asin}`);

    // Get access token (same as above)
    const CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
    const CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN!,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Test different competitive summary endpoints
    const endpoints = [
      'https://sellingpartnerapi-na.amazon.com/batches/products/pricing/2022-05-01/competitiveSummary',
      'https://sellingpartnerapi-na.amazon.com/products/pricing/2022-05-01/competitiveSummary'
    ];

    const results = [];

    for (const url of endpoints) {
      try {
        const awsSigner = createAWSSignature();
        
        const requestBody = JSON.stringify({
          requests: [{
            asin: asin,
            marketplaceId: 'ATVPDKIKX0DER',
            method: 'GET'
          }]
        });

        const signedHeaders = awsSigner.signRequest('POST', url, {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-amz-access-token': accessToken
        }, requestBody);

        console.log(`Testing endpoint: ${url}`);

        const response = await fetch(url, {
          method: 'POST',
          headers: signedHeaders,
          body: requestBody
        });

        const responseText = await response.text();
        console.log(`Response ${response.status}: ${responseText.substring(0, 500)}`);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = responseText;
        }

        results.push({
          endpoint: url,
          status: response.status,
          success: response.ok,
          data: responseData
        });

      } catch (error) {
        results.push({
          endpoint: url,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    res.json({
      asin,
      results,
      summary: `Tested ${results.length} competitive summary endpoints`
    });

  } catch (error) {
    console.error('Competitive Summary test error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

export default router;