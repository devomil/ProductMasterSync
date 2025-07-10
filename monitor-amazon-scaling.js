/**
 * Amazon Scaling Monitor
 * 
 * Real-time progress monitoring with completion notifications
 */

import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function monitorScaling() {
  try {
    await client.connect();
    console.log('🔍 Amazon Scaling Monitor Active');
    console.log('📈 Real-time progress tracking every 30 seconds');
    console.log('🏁 Will notify when completion thresholds are reached');
    console.log('=' * 60);

    const monitor = setInterval(async () => {
      try {
        const stats = await client.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as mapped,
            COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as intelligence,
            COUNT(DISTINCT pam.asin) as unique_asins
          FROM products p
          LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
          LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
          WHERE p.upc IS NOT NULL 
            AND p.manufacturer_part_number IS NOT NULL
            AND p.cost IS NOT NULL 
            AND p.price IS NOT NULL
        `);

        const result = stats.rows[0];
        const coverage = Math.round((result.mapped / result.total) * 100);
        const remaining = result.total - result.mapped;

        let status = '🚀 SCALING';
        if (coverage >= 95) status = '🎉 EXCELLENT COMPLETION';
        else if (coverage >= 80) status = '✅ GOOD COMPLETION';
        else if (coverage >= 50) status = '⚡ MODERATE PROGRESS';

        console.log(`[${new Date().toLocaleTimeString()}] ${status}`);
        console.log(`📊 Progress: ${result.mapped}/${result.total} (${coverage}%)`);
        console.log(`📈 Intelligence: ${result.intelligence} records`);
        console.log(`🆔 Unique ASINs: ${result.unique_asins}`);
        console.log(`📦 Remaining: ${remaining} products`);

        if (coverage >= 95) {
          console.log('\n🎉 SCALING COMPLETE! Excellent coverage achieved!');
          console.log('✅ Your Amazon catalog scaling has reached 95%+ coverage');
          console.log('🚀 Enhanced Purchasing AI is fully operational');
          clearInterval(monitor);
          await client.end();
          return;
        } else if (coverage >= 80) {
          console.log('\n✅ Good completion reached! 80%+ coverage achieved');
        }

        console.log('-' * 50);

      } catch (error) {
        console.error('❌ Monitor error:', error.message);
      }
    }, 30000); // Every 30 seconds

    // Stop monitoring after 3 hours
    setTimeout(() => {
      clearInterval(monitor);
      console.log('\n⏰ Monitor session ended - scaling continues in background');
      client.end();
    }, 10800000); // 3 hours

  } catch (error) {
    console.error('❌ Failed to start monitor:', error);
    await client.end();
  }
}

monitorScaling().catch(console.error);