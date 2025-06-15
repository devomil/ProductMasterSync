/**
 * Test live Amazon pricing data to fix pricing accuracy issues
 */

import axios from 'axios';
import crypto from 'crypto';

// Amazon SP-API configuration
const CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;

const ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
const MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace

async function getAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error.response?.data || error.message);
    throw error;
  }
}

async function testPricingAPI() {
  try {
    console.log('Getting access token...');
    const accessToken = await getAccessToken();
    console.log('Access token obtained successfully');

    // Test ASINs from the database that showed incorrect pricing
    const testASINs = ['B00005B8M3', 'B001449AC0', 'B00197T63A'];
    
    for (const asin of testASINs) {
      console.log(`\nTesting pricing for ASIN: ${asin}`);
      
      try {
        // Get competitive pricing
        const pricingResponse = await axios.get(
          `${ENDPOINT}/products/pricing/v0/items/${asin}/offers`,
          {
            headers: {
              'x-amz-access-token': accessToken,
              'x-amz-date': new Date().toISOString(),
              'Content-Type': 'application/json'
            },
            params: {
              MarketplaceId: MARKETPLACE_ID,
              ItemCondition: 'New'
            }
          }
        );
        
        console.log(`Pricing data for ${asin}:`, JSON.stringify(pricingResponse.data, null, 2));
        
        // Get listing restrictions
        const restrictionsResponse = await axios.get(
          `${ENDPOINT}/listings/2021-08-01/restrictions`,
          {
            headers: {
              'x-amz-access-token': accessToken,
              'x-amz-date': new Date().toISOString(),
              'Content-Type': 'application/json'
            },
            params: {
              asin: asin,
              sellerId: 'YOUR_SELLER_ID', // You'll need to provide this
              marketplaceIds: MARKETPLACE_ID
            }
          }
        );
        
        console.log(`Restrictions for ${asin}:`, JSON.stringify(restrictionsResponse.data, null, 2));
        
      } catch (apiError) {
        console.error(`Error fetching data for ${asin}:`, apiError.response?.status, apiError.response?.data || apiError.message);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPricingAPI();