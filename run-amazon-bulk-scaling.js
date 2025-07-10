/**
 * Run Amazon Bulk Scaling Process
 * 
 * Efficiently scales Amazon marketplace synchronization across all catalog products
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const SCALING_CONFIG = {
  batchSize: 25,  // Smaller batches for better processing
  delayBetweenRequests: 1500, // 1.5 second delay between requests
  maxConcurrent: 3, // Process 3 products concurrently
  reportInterval: 10 // Report progress every 10 products
};

class BulkAmazonScaler {
  constructor() {
    this.processed = 0;
    this.successful = 0;
    this.failed = 0;
    this.startTime = new Date();
  }

  async initialize() {
    await client.connect();
    console.log('🚀 Starting Bulk Amazon Scaling Process');
    console.log(`📊 Target: Scale all AI-ready products with Amazon marketplace intelligence`);
    console.log(`⚙️  Batch size: ${SCALING_CONFIG.batchSize} | Concurrent: ${SCALING_CONFIG.maxConcurrent}`);
    console.log('=' * 70);
  }

  async getNextBatch() {
    // Get products that need Amazon marketplace data
    const query = `
      SELECT DISTINCT p.id, p.sku, p.name, p.upc, p.manufacturer_part_number
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
        AND pam.product_id IS NULL  -- Only products without ASIN mappings
      ORDER BY p.id
      LIMIT $1
    `;
    
    const result = await client.query(query, [SCALING_CONFIG.batchSize]);
    return result.rows;
  }

  async processProduct(product) {
    try {
      console.log(`🔍 Processing: ${product.sku} (UPC: ${product.upc || 'N/A'})`);
      
      // Call Amazon marketplace API
      const response = await axios.get(
        `http://localhost:5000/api/marketplace/amazon/${product.id}`,
        { timeout: 30000 }
      );

      if (response.data && response.data.length > 0) {
        console.log(`✅ Found ${response.data.length} ASIN(s) for ${product.sku}`);
        this.successful++;
        return true;
      } else {
        console.log(`⚠️  No ASINs found for ${product.sku}`);
        this.failed++;
        return false;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`ℹ️  No Amazon data found for ${product.sku}`);
      } else {
        console.log(`❌ Error processing ${product.sku}: ${error.message}`);
      }
      this.failed++;
      return false;
    }
  }

  async processBatch(products) {
    console.log(`\n🔄 Processing batch of ${products.length} products...`);
    
    // Process products with controlled concurrency
    const promises = products.map(async (product, index) => {
      // Stagger requests
      await new Promise(resolve => setTimeout(resolve, index * 500));
      return this.processProduct(product);
    });

    await Promise.all(promises);
    this.processed += products.length;

    // Add delay between batches
    await new Promise(resolve => setTimeout(resolve, SCALING_CONFIG.delayBetweenRequests));
  }

  async reportProgress() {
    const elapsed = (new Date() - this.startTime) / 1000;
    const rate = this.processed / elapsed;
    
    // Get current database stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_eligible,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as with_mappings
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
    `);

    const result = stats.rows[0];
    
    console.log('\n📊 PROGRESS REPORT');
    console.log('=' * 40);
    console.log(`⏱️  Elapsed: ${Math.floor(elapsed/60)}m ${Math.floor(elapsed%60)}s`);
    console.log(`📦 Processed: ${this.processed} products`);
    console.log(`✅ Successful: ${this.successful}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⚡ Rate: ${rate.toFixed(2)} products/sec`);
    console.log(`🔗 Total Mappings: ${result.with_mappings}/${result.total_eligible} (${Math.round((result.with_mappings / result.total_eligible) * 100)}%)`);
    console.log('=' * 40);
  }

  async run() {
    try {
      await this.initialize();

      while (true) {
        const batch = await this.getNextBatch();
        
        if (batch.length === 0) {
          console.log('\n🎉 All eligible products processed!');
          break;
        }

        await this.processBatch(batch);

        // Report progress periodically
        if (this.processed % SCALING_CONFIG.reportInterval === 0) {
          await this.reportProgress();
        }
      }

      // Final report
      await this.reportProgress();
      
      // Test enhanced purchasing AI
      console.log('\n🤖 Testing Enhanced Purchasing AI...');
      try {
        const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=50&risk_level=all&min_confidence=30&min_opportunity_score=40');
        console.log(`✅ Qualified Opportunities: ${aiResponse.data.analytics.qualifiedOpportunities}`);
        console.log(`🎯 Average Confidence: ${aiResponse.data.analytics.averageConfidence}%`);
        console.log(`📈 Average Opportunity Score: ${aiResponse.data.analytics.averageOpportunityScore}`);
      } catch (error) {
        console.log(`⚠️  AI test temporarily unavailable: ${error.message}`);
      }

      console.log('\n🚀 Amazon Bulk Scaling Complete!');

    } catch (error) {
      console.error('❌ Scaling failed:', error);
    } finally {
      await client.end();
    }
  }
}

// Run the bulk scaler
const scaler = new BulkAmazonScaler();
scaler.run().catch(console.error);