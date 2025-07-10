/**
 * Quick Completion Check
 * 
 * Fast status check to see current Amazon scaling progress
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function quickCompletionCheck() {
  try {
    await client.connect();
    
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_eligible,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as with_mappings,
        COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as with_intelligence,
        COUNT(DISTINCT pam.asin) as unique_asins,
        AVG(CASE WHEN ami.opportunity_score IS NOT NULL THEN ami.opportunity_score END) as avg_opportunity
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
    `);

    const result = stats.rows[0];
    const coveragePercent = Math.round((result.with_mappings / result.total_eligible) * 100);
    const intelligencePercent = Math.round((result.with_intelligence / result.total_eligible) * 100);
    
    let status = '🚀 STARTING';
    if (coveragePercent >= 95) status = '🎉 EXCELLENT COMPLETION';
    else if (coveragePercent >= 80) status = '✅ GOOD COMPLETION'; 
    else if (coveragePercent >= 50) status = '⚡ MODERATE PROGRESS';
    else if (coveragePercent >= 10) status = '🔄 ACTIVE PROGRESS';
    
    console.log(`${status}`);
    console.log(`📊 Amazon Coverage: ${result.with_mappings}/${result.total_eligible} (${coveragePercent}%)`);
    console.log(`📈 Market Intelligence: ${result.with_intelligence} (${intelligencePercent}%)`);
    console.log(`🆔 Unique ASINs Discovered: ${result.unique_asins}`);
    
    if (result.avg_opportunity) {
      console.log(`🎯 Average Opportunity Score: ${Math.round(result.avg_opportunity)}/100`);
    }
    
    if (coveragePercent >= 95) {
      console.log('\n🎉 SCALING COMPLETE! Your catalog is fully synchronized with Amazon marketplace data.');
    } else if (coveragePercent >= 80) {
      console.log('\n✅ Excellent progress! Most products now have comprehensive marketplace intelligence.');
    } else {
      console.log(`\n📈 Scaling in progress... ${result.total_eligible - result.with_mappings} products remaining.`);
    }

  } catch (error) {
    console.error('❌ Quick check failed:', error);
  } finally {
    await client.end();
  }
}

quickCompletionCheck().catch(console.error);