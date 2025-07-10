/**
 * Amazon Scaling Completion Tracker
 * 
 * Provides real-time completion status and comprehensive progress reporting
 */

import { Client } from 'pg';
import axios from 'axios';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

class CompletionTracker {
  constructor() {
    this.startTime = new Date();
    this.checkInterval = 15000; // Check every 15 seconds
    this.reportInterval = 60000; // Detailed report every minute
    this.completionThresholds = {
      excellent: 95,  // 95% coverage = excellent completion
      good: 80,       // 80% coverage = good completion  
      moderate: 50,   // 50% coverage = moderate progress
      minimal: 10     // 10% coverage = minimal progress
    };
  }

  async initialize() {
    await client.connect();
    console.log('🎯 AMAZON SCALING COMPLETION TRACKER ACTIVE');
    console.log('📊 Monitoring progress every 15 seconds');
    console.log('📋 Detailed reports every minute');
    console.log('🏁 Will notify when scaling reaches completion thresholds');
    console.log('=' * 65);
    
    // Show initial status
    await this.checkProgress();
  }

  async getComprehensiveStats() {
    const query = `
      SELECT 
        COUNT(*) as total_eligible_products,
        COUNT(CASE WHEN pam.product_id IS NOT NULL THEN 1 END) as products_with_asin_mappings,
        COUNT(CASE WHEN ami.asin IS NOT NULL THEN 1 END) as products_with_market_intelligence,
        COUNT(CASE WHEN pam.product_id IS NOT NULL AND ami.asin IS NOT NULL THEN 1 END) as complete_data_chain,
        COUNT(DISTINCT pam.asin) as unique_asins_discovered,
        AVG(CASE WHEN ami.opportunity_score IS NOT NULL THEN ami.opportunity_score END) as avg_opportunity_score,
        COUNT(CASE WHEN ami.opportunity_score >= 70 THEN 1 END) as high_opportunity_products,
        COUNT(CASE WHEN ami.profit_margin_percent >= 50 THEN 1 END) as high_margin_products
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_market_intelligence ami ON pam.asin = ami.asin
      WHERE p.upc IS NOT NULL 
        AND p.manufacturer_part_number IS NOT NULL
        AND p.cost IS NOT NULL 
        AND p.price IS NOT NULL
        AND CAST(p.cost AS NUMERIC) > 0
        AND CAST(p.price AS NUMERIC) > 0
    `;
    
    const result = await client.query(query);
    return result.rows[0];
  }

  calculateCompletionStatus(stats) {
    const coveragePercent = Math.round((stats.products_with_asin_mappings / stats.total_eligible_products) * 100);
    const intelligencePercent = Math.round((stats.products_with_market_intelligence / stats.total_eligible_products) * 100);
    
    let status = 'STARTING';
    let emoji = '🚀';
    
    if (coveragePercent >= this.completionThresholds.excellent) {
      status = 'EXCELLENT COMPLETION';
      emoji = '🎉';
    } else if (coveragePercent >= this.completionThresholds.good) {
      status = 'GOOD COMPLETION';
      emoji = '✅';
    } else if (coveragePercent >= this.completionThresholds.moderate) {
      status = 'MODERATE PROGRESS';
      emoji = '⚡';
    } else if (coveragePercent >= this.completionThresholds.minimal) {
      status = 'ACTIVE PROGRESS';
      emoji = '🔄';
    }
    
    return { status, emoji, coveragePercent, intelligencePercent };
  }

  async checkProgress() {
    try {
      const stats = await this.getComprehensiveStats();
      const completion = this.calculateCompletionStatus(stats);
      const elapsed = Math.floor((new Date() - this.startTime) / 1000);
      
      console.log(`\n[${new Date().toLocaleTimeString()}] ${completion.emoji} ${completion.status}`);
      console.log(`📊 Coverage: ${stats.products_with_asin_mappings}/${stats.total_eligible_products} (${completion.coveragePercent}%)`);
      console.log(`📈 Intelligence: ${stats.products_with_market_intelligence} records (${completion.intelligencePercent}%)`);
      console.log(`🔗 Unique ASINs: ${stats.unique_asins_discovered}`);
      
      if (stats.high_opportunity_products > 0) {
        console.log(`🎯 High Opportunities: ${stats.high_opportunity_products} products (≥70 score)`);
      }
      
      if (stats.high_margin_products > 0) {
        console.log(`💰 High Margins: ${stats.high_margin_products} products (≥50% margin)`);
      }
      
      // Completion notifications
      if (completion.coveragePercent >= this.completionThresholds.excellent) {
        console.log('\n🎉 SCALING COMPLETE! EXCELLENT COVERAGE ACHIEVED!');
        console.log(`✅ ${completion.coveragePercent}% of products now have Amazon marketplace data`);
        console.log('🚀 Enhanced Purchasing AI is fully operational with comprehensive market intelligence');
        return 'COMPLETE';
      } else if (completion.coveragePercent >= this.completionThresholds.good) {
        console.log('\n✅ EXCELLENT PROGRESS! Good completion threshold reached');
        console.log(`📈 ${completion.coveragePercent}% coverage provides strong purchasing intelligence`);
      } else if (completion.coveragePercent >= this.completionThresholds.moderate) {
        console.log('\n⚡ SOLID PROGRESS! Moderate completion achieved');
        console.log(`📊 ${completion.coveragePercent}% coverage building comprehensive marketplace data`);
      }
      
      return completion.status;
      
    } catch (error) {
      console.error('❌ Progress check error:', error.message);
      return 'ERROR';
    }
  }

  async generateDetailedReport() {
    try {
      const stats = await this.getComprehensiveStats();
      const completion = this.calculateCompletionStatus(stats);
      const elapsed = Math.floor((new Date() - this.startTime) / 60);
      
      console.log('\n📋 DETAILED COMPLETION REPORT');
      console.log('=' * 50);
      console.log(`⏱️  Tracking Time: ${elapsed} minutes`);
      console.log(`🎯 Current Status: ${completion.status}`);
      console.log(`📦 Total Eligible: ${stats.total_eligible_products} products`);
      console.log(`🔗 ASIN Mappings: ${stats.products_with_asin_mappings} (${completion.coveragePercent}%)`);
      console.log(`📊 Market Intel: ${stats.products_with_market_intelligence} (${completion.intelligencePercent}%)`);
      console.log(`✅ Complete Chain: ${stats.complete_data_chain}`);
      console.log(`🆔 Unique ASINs: ${stats.unique_asins_discovered}`);
      
      if (stats.avg_opportunity_score) {
        console.log(`📈 Avg Opportunity: ${Math.round(stats.avg_opportunity_score)}/100`);
      }
      
      console.log('\n🎯 COMPLETION THRESHOLDS:');
      console.log(`🎉 Excellent: ${this.completionThresholds.excellent}% (${Math.round(stats.total_eligible_products * this.completionThresholds.excellent / 100)} products)`);
      console.log(`✅ Good: ${this.completionThresholds.good}% (${Math.round(stats.total_eligible_products * this.completionThresholds.good / 100)} products)`);
      console.log(`⚡ Moderate: ${this.completionThresholds.moderate}% (${Math.round(stats.total_eligible_products * this.completionThresholds.moderate / 100)} products)`);
      
      const remaining = stats.total_eligible_products - stats.products_with_asin_mappings;
      if (remaining > 0) {
        console.log(`\n📊 REMAINING: ${remaining} products to process`);
        
        // Estimate completion time based on current rate
        if (elapsed > 5 && stats.products_with_asin_mappings > 10) {
          const rate = stats.products_with_asin_mappings / elapsed; // products per minute
          const estimatedMinutes = Math.round(remaining / rate);
          console.log(`⏱️  Estimated Time to Good Completion: ~${estimatedMinutes} minutes`);
        }
      }
      
      // Test Enhanced Purchasing AI
      try {
        const aiResponse = await axios.get('http://localhost:5000/api/purchasing/enhanced-opportunities?limit=100&risk_level=all&min_confidence=30&min_opportunity_score=40');
        console.log(`\n🤖 AI STATUS: ${aiResponse.data.analytics.qualifiedOpportunities} opportunities (${aiResponse.data.analytics.averageConfidence}% avg confidence)`);
      } catch (error) {
        console.log('\n🤖 AI STATUS: Temporarily unavailable during scaling');
      }
      
      console.log('=' * 50);
      
    } catch (error) {
      console.error('❌ Report generation error:', error.message);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      // Quick check timer
      const quickTimer = setInterval(async () => {
        const status = await this.checkProgress();
        if (status === 'COMPLETE') {
          clearInterval(quickTimer);
          clearInterval(reportTimer);
          console.log('\n🏁 TRACKING COMPLETE - SCALING FINISHED!');
          await client.end();
        }
      }, this.checkInterval);
      
      // Detailed report timer
      const reportTimer = setInterval(async () => {
        await this.generateDetailedReport();
      }, this.reportInterval);
      
      // Stop tracking after 2 hours
      setTimeout(() => {
        clearInterval(quickTimer);
        clearInterval(reportTimer);
        console.log('\n⏰ Tracking session ended - scaling continues in background');
        client.end();
      }, 7200000); // 2 hours
      
    } catch (error) {
      console.error('❌ Completion tracker failed:', error);
      await client.end();
    }
  }
}

// Run the completion tracker
const tracker = new CompletionTracker();
tracker.run().catch(console.error);