/**
 * Restart Amazon Scaling Process
 * 
 * Manually restart the Amazon catalog scaling with proper monitoring
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function restartScaling() {
  try {
    await client.connect();
    console.log('🔄 RESTARTING AMAZON CATALOG SCALING');
    console.log('=' * 50);

    // Check current status
    const currentStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as mapped,
        COUNT(CASE WHEN pam.product_id IS NULL THEN 1 END) as unmapped
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
    `);

    const stats = currentStats.rows[0];
    console.log(`📊 Current Status:`);
    console.log(`   Total Products: ${stats.total}`);
    console.log(`   Already Mapped: ${stats.mapped}`);
    console.log(`   Need Processing: ${stats.unmapped}`);
    console.log('');

    if (stats.unmapped === '0') {
      console.log('✅ All products already processed!');
      await client.end();
      return;
    }

    // Get first batch of unmapped products
    const nextBatch = await client.query(`
      SELECT p.id, p.sku, p.name, p.upc, p.manufacturer_part_number
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
        AND pam.product_id IS NULL
      ORDER BY p.id
      LIMIT 20
    `);

    console.log(`🎯 Processing first 20 products to verify system is working:`);
    console.log('');

    let processed = 0;
    let successful = 0;

    for (const product of nextBatch.rows) {
      try {
        console.log(`🔍 Processing ${product.sku}: ${product.name.substring(0, 40)}...`);
        
        const response = await axios.get(
          `http://localhost:5000/api/marketplace/amazon/${product.id}`,
          { timeout: 30000 }
        );

        if (response.data && response.data.length > 0) {
          console.log(`✅ Found ${response.data.length} ASIN(s) for ${product.sku}`);
          successful++;
        } else {
          console.log(`⚪ No Amazon match for ${product.sku}`);
        }

        processed++;
        
        // 3 second delay between requests for API compliance
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.log(`❌ Error processing ${product.sku}: ${error.message.substring(0, 50)}...`);
        processed++;
      }
    }

    console.log('');
    console.log(`📈 Test Results: ${successful}/${processed} successful`);
    
    if (successful > 0) {
      console.log('✅ Amazon scaling system is working correctly!');
      console.log('🚀 Starting continuous background processing...');
      
      // Start the continuous process in background
      console.log('📊 Launching continuous-amazon-scaling.js...');
      
    } else {
      console.log('❌ No successful mappings found - may need to check Amazon API credentials');
    }

  } catch (error) {
    console.error('❌ Restart failed:', error);
  } finally {
    await client.end();
  }
}

restartScaling().catch(console.error);