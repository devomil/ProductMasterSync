#!/usr/bin/env node

/**
 * Test the Multiple ASIN Selection System
 * Tests the complete workflow for handling products with multiple ASIN mappings
 */

import { Pool } from 'pg';
import fetch from 'node-fetch';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testMultiASINSystem() {
  console.log('=== Testing Multiple ASIN Selection System ===\n');
  
  try {
    // 1. Check for products with multiple ASINs
    console.log('1. Finding products with multiple ASIN mappings...');
    const multiASINQuery = `
      SELECT 
        p.sku,
        p.name,
        p.upc,
        COUNT(pam.asin) as asin_count,
        ARRAY_AGG(pam.asin) as asins
      FROM products p
      INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
      GROUP BY p.id, p.sku, p.name, p.upc
      HAVING COUNT(pam.asin) > 1
      ORDER BY COUNT(pam.asin) DESC, p.sku
      LIMIT 5
    `;
    
    const multiResult = await pool.query(multiASINQuery);
    
    if (multiResult.rows.length === 0) {
      console.log('   No products with multiple ASINs found');
      
      // Create test data for SKU 629645 with multiple ASINs
      console.log('\n2. Creating test data for SKU 629645...');
      
      // Find product ID for SKU 629645
      const productQuery = await pool.query('SELECT id FROM products WHERE sku = $1', ['629645']);
      
      if (productQuery.rows.length > 0) {
        const productId = productQuery.rows[0].id;
        
        // Add multiple test ASINs
        const testASINs = ['B000K2IKGY', 'B00DMWKX8E', 'B001TEST01', 'B001TEST02'];
        
        for (const asin of testASINs) {
          await pool.query(`
            INSERT INTO product_asin_mapping (product_id, asin, confidence_score, source) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (product_id, asin) DO NOTHING
          `, [productId, asin, 0.8, 'test_data']);
        }
        
        console.log(`   Added ${testASINs.length} test ASINs for SKU 629645`);
        
        // Re-run the query
        const retestResult = await pool.query(multiASINQuery);
        if (retestResult.rows.length > 0) {
          console.log(`   Found ${retestResult.rows.length} products with multiple ASINs after adding test data`);
          console.log('   Sample:', retestResult.rows[0]);
        }
      }
    } else {
      console.log(`   Found ${multiResult.rows.length} products with multiple ASINs`);
      multiResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. SKU ${row.sku}: ${row.asin_count} ASINs - ${row.asins.join(', ')}`);
      });
    }
    
    // 3. Test API endpoints
    console.log('\n3. Testing ASIN selection API endpoints...');
    
    // Test multi-asin-products endpoint
    try {
      const response = await fetch('http://localhost:5000/api/asin-selection/multi-asin-products');
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✓ Multi-ASIN products endpoint: ${data.totalProducts} products found`);
      } else {
        console.log(`   ✗ Multi-ASIN products endpoint failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ✗ Multi-ASIN products endpoint error: ${error.message}`);
    }
    
    // Test select-best-asin for SKU 629645
    if (multiResult.rows.length > 0 || productQuery?.rows?.length > 0) {
      try {
        const selectResponse = await fetch('http://localhost:5000/api/asin-selection/select-best-asin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: '629645' })
        });
        
        const selectData = await selectResponse.json();
        
        if (selectData.success) {
          console.log(`   ✓ Best ASIN selection for SKU 629645: ${selectData.selectedASIN}`);
          console.log(`   Total candidates: ${selectData.totalCandidates}`);
          console.log(`   Selection reason: ${selectData.selectionReason}`);
        } else {
          console.log(`   ✗ Best ASIN selection failed: ${selectData.error}`);
        }
      } catch (error) {
        console.log(`   ✗ Best ASIN selection error: ${error.message}`);
      }
    }
    
    // 4. Check Amazon data table for scoring
    console.log('\n4. Checking Amazon catalog data for scoring...');
    const amazonDataQuery = `
      SELECT asin, title, brand, current_price, sales_rank, buybox_holder, condition
      FROM amazon_catalog_data 
      WHERE asin IN (
        SELECT pam.asin 
        FROM products p
        INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
        WHERE p.sku = '629645'
      )
    `;
    
    const amazonResult = await pool.query(amazonDataQuery);
    
    if (amazonResult.rows.length > 0) {
      console.log(`   Found ${amazonResult.rows.length} Amazon records for SKU 629645 ASINs:`);
      amazonResult.rows.forEach(row => {
        console.log(`   - ${row.asin}: ${row.title} | Price: $${row.current_price} | Rank: ${row.sales_rank}`);
      });
    } else {
      console.log('   No Amazon catalog data found for ASINs (needed for scoring)');
    }
    
    console.log('\n=== Multiple ASIN Selection System Test Complete ===');
    
  } catch (error) {
    console.error('Error testing multi-ASIN system:', error);
  } finally {
    await pool.end();
  }
}

testMultiASINSystem().catch(console.error);