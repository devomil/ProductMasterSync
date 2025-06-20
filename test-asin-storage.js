/**
 * Test script to verify ASIN discovery and storage
 * Based on the successful batch processing that discovered ASINs like:
 * B011LO0YJA, B011LO38WU, B011LO0VWU, B011LO3JQK, B011LNZLBM, 
 * B00197T63A, B001449AC0, B00005B8M3, B004TU6QR8, B011LNZAO0, 
 * B00X9O56M6, B07VWXJ9NB
 */

import { Pool } from '@neondatabase/serverless';
import { searchCatalogByUPC, searchCatalogByManufacturerPartNumber, getListingRestrictions } from './server/utils/amazon-spapi.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testASINStorage() {
  console.log('Testing ASIN discovery and storage...');
  
  try {
    const client = await pool.connect();
    
    // Get a few sample products with UPC codes
    const result = await client.query(`
      SELECT id, sku, name, upc, manufacturer_part_number 
      FROM products 
      WHERE upc IS NOT NULL 
      LIMIT 5
    `);
    
    console.log(`Found ${result.rows.length} products to test`);
    
    for (const product of result.rows) {
      console.log(`\nProcessing: ${product.name}`);
      console.log(`UPC: ${product.upc}`);
      
      try {
        // Search by UPC
        const upcResults = await searchCatalogByUPC(product.upc);
        console.log(`UPC search found ${upcResults.length} ASINs`);
        
        for (const asin of upcResults) {
          console.log(`- ASIN: ${asin.asin}`);
          
          // Store the mapping
          await client.query(`
            INSERT INTO upc_asin_mappings (
              upc, asin, marketplace_id, source, discovered_at, is_active
            ) VALUES ($1, $2, 'ATVPDKIKX0DER', 'sp_api', NOW(), true)
            ON CONFLICT (upc, asin, marketplace_id) DO NOTHING
          `, [product.upc, asin.asin]);
          
          console.log(`  Stored mapping: ${product.upc} -> ${asin.asin}`);
        }
        
      } catch (error) {
        console.log(`Error processing ${product.sku}: ${error.message}`);
      }
    }
    
    // Check final count
    const countResult = await client.query('SELECT COUNT(*) as count FROM upc_asin_mappings WHERE is_active = true');
    console.log(`\nTotal ASIN mappings stored: ${countResult.rows[0].count}`);
    
    client.release();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testASINStorage().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});