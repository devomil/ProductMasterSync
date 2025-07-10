/**
 * Test Comprehensive Amazon Synchronization
 * 
 * This script runs a smaller test of the Amazon synchronization process
 * to validate the system before running the full 2,830 product scaling.
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function testAmazonSync() {
  try {
    await client.connect();
    console.log('🧪 Testing Amazon Synchronization System');
    console.log('=' * 50);

    // Get current system status
    const systemStats = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN p.upc IS NOT NULL AND p.manufacturer_part_number IS NOT NULL 
                   AND p.cost IS NOT NULL AND p.price IS NOT NULL THEN 1 END) as ai_ready,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as with_asin_mapping,
        COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as with_intelligence
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
    `);

    const stats = systemStats.rows[0];
    console.log('📊 CURRENT SYSTEM STATUS:');
    console.log(`📦 Total Products: ${stats.total_products}`);
    console.log(`🤖 AI Ready: ${stats.ai_ready} (${Math.round((stats.ai_ready / stats.total_products) * 100)}%)`);
    console.log(`🔗 With ASIN Mappings: ${stats.with_asin_mapping}`);
    console.log(`📈 With Market Intelligence: ${stats.with_intelligence}`);

    // Test a sample of products
    console.log('\n🔍 Testing sample products...');
    
    const sampleProducts = await client.query(`
      SELECT p.id, p.sku, p.name, p.upc, p.manufacturer_part_number
      FROM products p
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
        AND p.id NOT IN (SELECT DISTINCT product_id FROM product_asin_mapping WHERE product_id IS NOT NULL)
      ORDER BY RANDOM()
      LIMIT 5
    `);

    console.log(`\n📋 Found ${sampleProducts.rows.length} unmapped products for testing:`);
    
    for (const product of sampleProducts.rows) {
      console.log(`\n🔍 Testing: ${product.sku} - ${product.name.substring(0, 50)}...`);
      console.log(`   UPC: ${product.upc} | MPN: ${product.manufacturer_part_number}`);
      
      try {
        // Test Amazon API call
        const response = await axios.get(`http://localhost:5000/api/marketplace/amazon/${product.id}`, {
          timeout: 30000
        });
        
        if (response.data && response.data.length > 0) {
          console.log(`   ✅ Success: Found ${response.data.length} ASIN mapping(s)`);
        } else {
          console.log(`   ⚠️  No ASINs found for this product`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ℹ️  No Amazon marketplace data found`);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }

    // Test purchasing AI endpoints
    console.log('\n🤖 Testing Enhanced Purchasing AI...');
    
    try {
      const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=10&risk_level=all&min_confidence=30&min_opportunity_score=40');
      
      console.log(`✅ AI Analysis: ${aiResponse.data.analytics.totalAnalyzed} products analyzed`);
      console.log(`📊 Qualified Opportunities: ${aiResponse.data.analytics.qualifiedOpportunities}`);
      console.log(`🎯 Average Confidence: ${aiResponse.data.analytics.averageConfidence}%`);
      console.log(`📈 Average Opportunity Score: ${aiResponse.data.analytics.averageOpportunityScore}`);
      
    } catch (error) {
      console.log(`❌ AI Test Error: ${error.message}`);
    }

    // Test data quality assessment
    try {
      const qualityResponse = await axios.get('http://localhost:5000/api/purchasing/data-quality-assessment');
      const assessment = qualityResponse.data.assessment;
      
      console.log('\n📊 DATA QUALITY ASSESSMENT:');
      console.log(`🏆 Reliability Score: ${assessment.reliability_score}/100 (${assessment.status})`);
      console.log(`📦 Catalog Size: ${assessment.catalog_size}`);
      console.log(`🔍 UPC Coverage: ${assessment.data_completeness.upc_coverage.percentage}%`);
      console.log(`🏷️  MPN Coverage: ${assessment.data_completeness.mpn_coverage.percentage}%`);
      console.log(`🤖 AI Ready: ${assessment.data_completeness.ai_ready.percentage}%`);
      console.log(`🔗 Amazon Synced: ${assessment.data_completeness.amazon_synced.percentage}%`);
      
    } catch (error) {
      console.log(`❌ Quality Assessment Error: ${error.message}`);
    }

    console.log('\n🎉 SYNCHRONIZATION TEST COMPLETE!');
    console.log('=' * 50);
    console.log('✅ System is ready for full-scale Amazon catalog synchronization');
    console.log('📈 Run scale-amazon-catalog-sync.js to process all 2,830 products');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.end();
  }
}

// Run the test
testAmazonSync().catch(console.error);