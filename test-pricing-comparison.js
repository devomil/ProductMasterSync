import { Pool } from 'pg';

async function comparePricing() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  
  try {
    // Get stored pricing data
    console.log('=== STORED DATABASE PRICING ===');
    const storedData = await client.query(`
      SELECT 
        p.name as product_name,
        aa.asin,
        ami.current_price as stored_current_price_cents,
        ami.current_price / 100.0 as stored_current_price_dollars,
        ami.list_price as stored_list_price_cents,
        ami.list_price / 100.0 as stored_list_price_dollars,
        ami.updated_at
      FROM products p
      JOIN product_asin_mapping pam ON p.id = pam.product_id
      JOIN amazon_asins aa ON pam.asin = aa.asin
      LEFT JOIN amazon_market_intelligence ami ON aa.asin = ami.asin
      WHERE ami.current_price IS NOT NULL
      LIMIT 3
    `);
    
    storedData.rows.forEach(row => {
      console.log(`\nProduct: ${row.product_name}`);
      console.log(`ASIN: ${row.asin}`);
      console.log(`Stored Current Price: $${row.stored_current_price_dollars} (${row.stored_current_price_cents} cents)`);
      console.log(`Stored List Price: $${row.stored_list_price_dollars || 'N/A'} (${row.stored_list_price_cents || 'N/A'} cents)`);
      console.log(`Last Updated: ${row.updated_at}`);
    });

    // Test live pricing for one ASIN
    console.log('\n=== TESTING LIVE AMAZON PRICING ===');
    const testAsin = 'B011LO0YJA';
    
    try {
      const response = await fetch('http://localhost:5000/api/marketplace/amazon/test-upc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upc: '791659192832' })
      });
      
      const liveData = await response.json();
      console.log('\nLive Amazon API Response Summary:');
      console.log(`Success: ${liveData.success}`);
      console.log(`ASINs Found: ${liveData.totalAsinsFound}`);
      console.log(`Sample ASIN: ${liveData.sampleAsin}`);
      
      if (liveData.catalogItems && liveData.catalogItems.length > 0) {
        const item = liveData.catalogItems[0];
        console.log(`\nCatalog Item Details:`);
        console.log(`ASIN: ${item.asin}`);
        if (item.attributes.brand) {
          console.log(`Brand: ${item.attributes.brand[0]?.value}`);
        }
      }
      
    } catch (error) {
      console.error('Error fetching live pricing:', error.message);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

comparePricing().catch(console.error);