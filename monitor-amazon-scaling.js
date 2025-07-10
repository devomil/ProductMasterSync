/**
 * Monitor Amazon Scaling Progress
 * 
 * Real-time monitoring of the Amazon catalog scaling process
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function monitorScalingProgress() {
  try {
    await client.connect();
    console.log('📊 Amazon Scaling Progress Monitor');
    console.log('=' * 50);

    // Monitor every 30 seconds
    const interval = setInterval(async () => {
      try {
        // Get current statistics
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
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`\n[${timestamp}] 📈 SCALING PROGRESS:`);
        console.log(`🔗 ASIN Mappings: ${result.with_asin_mapping}/${result.total_ai_ready} (${Math.round((result.with_asin_mapping / result.total_ai_ready) * 100)}%)`);
        console.log(`📊 Market Intelligence: ${result.with_intelligence}/${result.total_ai_ready} (${Math.round((result.with_intelligence / result.total_ai_ready) * 100)}%)`);
        console.log(`✅ Complete Chain: ${result.complete_chain}/${result.total_ai_ready} (${Math.round((result.complete_chain / result.total_ai_ready) * 100)}%)`);

        // Test purchasing AI with current data
        try {
          const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=50&risk_level=all&min_confidence=30&min_opportunity_score=40');
          console.log(`🤖 Qualified Opportunities: ${aiResponse.data.analytics.qualifiedOpportunities} (Avg Confidence: ${aiResponse.data.analytics.averageConfidence}%)`);
        } catch (error) {
          console.log(`⚠️  AI API temporarily unavailable`);
        }

        // Stop monitoring when we reach significant coverage
        if (result.with_asin_mapping >= 100) {
          console.log('\n🎉 Significant progress achieved! Scaling continues in background...');
          clearInterval(interval);
          await client.end();
        }

      } catch (error) {
        console.error('Monitor error:', error.message);
      }
    }, 30000);

    // Stop monitoring after 20 minutes
    setTimeout(() => {
      clearInterval(interval);
      console.log('\n⏰ Monitoring session complete. Scaling continues...');
      client.end();
    }, 1200000);

  } catch (error) {
    console.error('❌ Monitor failed:', error);
    await client.end();
  }
}

monitorScalingProgress().catch(console.error);