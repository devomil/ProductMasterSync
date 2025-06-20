/**
 * Refresh Amazon pricing data with accurate current market prices
 */

import { Pool } from 'pg';

const ACCESS_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const SP_API_BASE_URL = 'https://sellingpartnerapi-na.amazon.com';

async function getAccessToken() {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_SP_API_REFRESH_TOKEN,
      client_id: process.env.AMAZON_SP_API_CLIENT_ID,
      client_secret: process.env.AMAZON_SP_API_CLIENT_SECRET
    })
  });

  const data = await response.json();
  return data.access_token;
}

async function getProductPricing(asin, accessToken) {
  try {
    const response = await fetch(`${SP_API_BASE_URL}/products/pricing/v0/items/${asin}/offers`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken
      }
    });

    if (!response.ok) {
      console.log(`Pricing API failed for ${asin}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.payload && data.payload.offers && data.payload.offers.length > 0) {
      const offers = data.payload.offers;
      const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner);
      const lowestOffer = offers.reduce((min, offer) => 
        offer.ListingPrice.Amount < min.ListingPrice.Amount ? offer : min
      );

      return {
        buyBoxPrice: buyBoxOffer ? Math.round(buyBoxOffer.ListingPrice.Amount * 100) : null,
        lowestPrice: Math.round(lowestOffer.ListingPrice.Amount * 100),
        offerCount: offers.length,
        hasAmazonOffer: offers.some(offer => offer.IsFulfilledByAmazon)
      };
    }
  } catch (error) {
    console.log(`Error fetching pricing for ${asin}:`, error.message);
  }
  
  return null;
}

async function refreshPricingData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Getting access token...');
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      console.error('Failed to get access token');
      return;
    }

    console.log('Fetching ASINs with stale pricing...');
    const result = await client.query(`
      SELECT DISTINCT ami.asin, p.name as product_name
      FROM amazon_market_intelligence ami
      JOIN amazon_asins aa ON ami.asin = aa.asin
      JOIN product_asin_mapping pam ON aa.asin = pam.asin  
      JOIN products p ON pam.product_id = p.id
      WHERE ami.current_price IS NOT NULL
      ORDER BY ami.asin
      LIMIT 10
    `);

    console.log(`Found ${result.rows.length} ASINs to refresh`);

    for (const row of result.rows) {
      console.log(`\nRefreshing pricing for ${row.asin} (${row.product_name})`);
      
      const pricingData = await getProductPricing(row.asin, accessToken);
      
      if (pricingData) {
        await client.query(`
          UPDATE amazon_market_intelligence 
          SET 
            current_price = $1,
            deal_price = $2,
            updated_at = NOW()
          WHERE asin = $3
        `, [
          pricingData.buyBoxPrice || pricingData.lowestPrice,
          pricingData.lowestPrice,
          row.asin
        ]);

        console.log(`✓ Updated ${row.asin}:`);
        console.log(`  Buy Box: $${(pricingData.buyBoxPrice || pricingData.lowestPrice) / 100}`);
        console.log(`  Lowest: $${pricingData.lowestPrice / 100}`);
        console.log(`  Offers: ${pricingData.offerCount}`);
      } else {
        console.log(`✗ No pricing data available for ${row.asin}`);
      }

      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n=== Pricing refresh completed ===');

  } catch (error) {
    console.error('Error refreshing pricing data:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

refreshPricingData().catch(console.error);