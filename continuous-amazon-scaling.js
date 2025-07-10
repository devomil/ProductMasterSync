/**
 * Continuous Amazon Scaling Process
 * 
 * Runs continuously to scale Amazon marketplace synchronization
 * across all 2,837 AI-ready products in the catalog
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const CONTINUOUS_CONFIG = {
  batchSize: 10,  // Process 10 products at a time
  delayBetweenRequests: 2000, // 2 second delay
  reportEvery: 20, // Report every 20 products
  maxRuns: 200 // Process up to 2,000 products in this session
};

class ContinuousAmazonScaler {
  constructor() {
    this.totalProcessed = 0;
    this.sessionSuccessful = 0;
    this.sessionFailed = 0;
    this.startTime = new Date();
    this.lastReportTime = new Date();
  }

  async initialize() {
    await client.connect();
    console.log('🔄 CONTINUOUS AMAZON SCALING ACTIVE');
    console.log(`📊 Processing up to ${CONTINUOUS_CONFIG.maxRuns} products`);
    console.log(`⚙️  Batch size: ${CONTINUOUS_CONFIG.batchSize} | Delay: ${CONTINUOUS_CONFIG.delayBetweenRequests/1000}s`);
    console.log('🎯 Target: Cross-reference all products with Amazon marketplace');
    console.log('=' * 60);
  }

  async getNextProducts() {
    const query = `
      SELECT p.id, p.sku, p.name, p.upc, p.manufacturer_part_number
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
        AND pam.product_id IS NULL
      ORDER BY p.id
      LIMIT $1
    `;
    
    const result = await client.query(query, [CONTINUOUS_CONFIG.batchSize]);
    return result.rows;
  }

  async processProduct(product) {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/marketplace/amazon/${product.id}`,
        { timeout: 25000 }
      );

      if (response.data && response.data.length > 0) {
        console.log(`✅ ${product.sku}: Found ${response.data.length} ASIN(s)`);
        this.sessionSuccessful++;
        return true;
      } else {
        console.log(`⚪ ${product.sku}: No Amazon match`);
        this.sessionFailed++;
        return false;
      }
    } catch (error) {
      if (error.response?.status === 404 || error.message.includes('No ASINs found')) {
        console.log(`⚪ ${product.sku}: No Amazon data`);
      } else {
        console.log(`❌ ${product.sku}: ${error.message.substring(0, 30)}...`);
      }
      this.sessionFailed++;
      return false;
    }
  }

  async processBatch(products) {
    for (const product of products) {
      await this.processProduct(product);
      this.totalProcessed++;
      
      await new Promise(resolve => setTimeout(resolve, CONTINUOUS_CONFIG.delayBetweenRequests));
    }
  }

  async reportProgress() {
    const elapsed = (new Date() - this.startTime) / 1000;
    const rate = this.totalProcessed / elapsed;
    
    // Get current system status
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_eligible,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as with_mappings,
        COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as with_intelligence
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
    `);

    const result = stats.rows[0];
    const coverage = Math.round((result.with_mappings / result.total_eligible) * 100);
    
    console.log(`\n📊 [${new Date().toLocaleTimeString()}] SCALING PROGRESS:`);
    console.log(`⏱️  Session: ${Math.floor(elapsed/60)}m ${Math.floor(elapsed%60)}s | Rate: ${rate.toFixed(1)}/sec`);
    console.log(`📦 Processed: ${this.totalProcessed} | Success: ${this.sessionSuccessful} | Failed: ${this.sessionFailed}`);
    console.log(`🔗 Total Mappings: ${result.with_mappings}/${result.total_eligible} (${coverage}%)`);
    console.log(`📈 Market Intelligence: ${result.with_intelligence} records`);
    
    // Test purchasing AI if we have significant mappings
    if (result.with_mappings >= 10) {
      try {
        const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=50&risk_level=all&min_confidence=30&min_opportunity_score=40');
        console.log(`🤖 AI Opportunities: ${aiResponse.data.analytics.qualifiedOpportunities} (Avg: ${aiResponse.data.analytics.averageConfidence}% confidence)`);
      } catch (error) {
        // AI endpoint might be busy, skip this check
      }
    }
    
    console.log('─'.repeat(50));
  }

  async run() {
    try {
      await this.initialize();

      for (let run = 0; run < CONTINUOUS_CONFIG.maxRuns; run++) {
        const products = await this.getNextProducts();
        
        if (products.length === 0) {
          console.log('\n🎉 ALL PRODUCTS PROCESSED! Scaling complete.');
          break;
        }

        console.log(`\nBatch ${run + 1}: Processing ${products.length} products...`);
        await this.processBatch(products);

        // Report progress periodically
        if (this.totalProcessed % CONTINUOUS_CONFIG.reportEvery === 0) {
          await this.reportProgress();
        }
      }

      // Final comprehensive report
      await this.reportProgress();
      
      console.log('\n🚀 CONTINUOUS SCALING SESSION COMPLETE!');
      console.log('💡 Amazon marketplace intelligence is now significantly enhanced.');
      console.log('🔄 Run this script again to continue scaling if needed.');

    } catch (error) {
      console.error('❌ Continuous scaling error:', error);
    } finally {
      await client.end();
    }
  }
}

// Run continuous scaler
const scaler = new ContinuousAmazonScaler();
scaler.run().catch(console.error);