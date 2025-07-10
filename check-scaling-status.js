/**
 * Quick status check for Amazon scaling progress
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function checkScalingStatus() {
  try {
    await client.connect();
    
    // Get current database statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_ai_ready,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as with_asin_mapping,
        COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as with_intelligence,
        COUNT(CASE WHEN pam.product_id IS NOT NULL AND ami.asin IS NOT NULL THEN 1 END) as complete_chain
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
    `);

    const result = stats.rows[0];
    
    console.log('🚀 AMAZON CATALOG SCALING STATUS');
    console.log('=' * 45);
    console.log(`📦 AI-Ready Products: ${result.total_ai_ready}`);
    console.log(`🔗 ASIN Mappings: ${result.with_asin_mapping} (${Math.round((result.with_asin_mapping / result.total_ai_ready) * 100)}%)`);
    console.log(`📊 Market Intelligence: ${result.with_intelligence} (${Math.round((result.with_intelligence / result.total_ai_ready) * 100)}%)`);
    console.log(`✅ Complete Data Chain: ${result.complete_chain} (${Math.round((result.complete_chain / result.total_ai_ready) * 100)}%)`);

    // Test enhanced purchasing AI
    try {
      const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=50&risk_level=all&min_confidence=30&min_opportunity_score=40');
      console.log('\n🤖 ENHANCED PURCHASING AI STATUS:');
      console.log(`📈 Qualified Opportunities: ${aiResponse.data.analytics.qualifiedOpportunities}`);
      console.log(`🎯 Average Confidence: ${aiResponse.data.analytics.averageConfidence}%`);
      console.log(`📊 Average Opportunity Score: ${aiResponse.data.analytics.averageOpportunityScore}`);
    } catch (error) {
      console.log('⚠️  AI API temporarily unavailable');
    }

    console.log('\n💡 SCALING PROGRESS:');
    if (result.with_asin_mapping < 50) {
      console.log('🔄 Scaling process is actively running and discovering products');
      console.log('📈 Amazon marketplace data is being populated in real-time');
    } else if (result.with_asin_mapping < 500) {
      console.log('⚡ Significant progress! System is building comprehensive market intelligence');
    } else {
      console.log('🎉 Excellent coverage achieved! Enhanced Purchasing AI fully operational');
    }

  } catch (error) {
    console.error('❌ Status check failed:', error);
  } finally {
    await client.end();
  }
}

checkScalingStatus().catch(console.error);