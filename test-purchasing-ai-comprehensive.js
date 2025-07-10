/**
 * Comprehensive Purchasing AI Data Quality Analysis
 * Tests all 2830 products for purchasing insight reliability
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function analyzePurchasingAIQuality() {
  console.log('🔍 Starting Comprehensive Purchasing AI Quality Analysis...\n');
  
  try {
    // Get marketplace readiness statistics
    console.log('📊 Fetching marketplace readiness statistics...');
    const readinessResponse = await axios.get(`${BASE_URL}/api/marketplace/readiness-stats`);
    const stats = readinessResponse.data.stats;
    
    console.log('Marketplace Readiness Statistics:');
    console.log(`  Total Products: ${stats.total}`);
    console.log(`  UPC Ready: ${stats.upcReady} (${stats.upcReadyPercent}%)`);
    console.log(`  MPN Ready: ${stats.mpnReady} (${stats.mpnReadyPercent}%)`);
    console.log(`  Both UPC & MPN: ${stats.bothReady}`);
    console.log(`  Amazon Synced: ${stats.amazonSynced} (${stats.amazonSyncedPercent}%)\n`);

    // Test purchasing recommendations endpoint with larger sample
    console.log('🧠 Testing purchasing AI recommendations...');
    const aiResponse = await axios.get(`${BASE_URL}/api/purchasing/recommendations`, {
      params: {
        limit: 100,
        risk_level: 'low'
      }
    });
    
    const recommendations = aiResponse.data;
    console.log(`Found ${recommendations.length} purchasing recommendations\n`);
    
    // Analyze recommendation quality
    const analysisResults = {
      total_recommendations: recommendations.length,
      with_asins: recommendations.filter(r => r.asin).length,
      with_pricing: recommendations.filter(r => r.currentPrice && r.listPrice).length,
      with_opportunity_scores: recommendations.filter(r => r.opportunityScore).length,
      with_profit_margins: recommendations.filter(r => r.profitMarginPercent).length,
      high_confidence: recommendations.filter(r => r.matchConfidence >= 80).length,
      medium_confidence: recommendations.filter(r => r.matchConfidence >= 60 && r.matchConfidence < 80).length,
      low_confidence: recommendations.filter(r => r.matchConfidence < 60).length
    };
    
    console.log('📈 Purchasing AI Quality Analysis:');
    console.log(`  Total Recommendations: ${analysisResults.total_recommendations}`);
    console.log(`  With ASINs: ${analysisResults.with_asins} (${((analysisResults.with_asins / analysisResults.total_recommendations) * 100).toFixed(1)}%)`);
    console.log(`  With Pricing Data: ${analysisResults.with_pricing} (${((analysisResults.with_pricing / analysisResults.total_recommendations) * 100).toFixed(1)}%)`);
    console.log(`  With Opportunity Scores: ${analysisResults.with_opportunity_scores} (${((analysisResults.with_opportunity_scores / analysisResults.total_recommendations) * 100).toFixed(1)}%)`);
    console.log(`  With Profit Margins: ${analysisResults.with_profit_margins} (${((analysisResults.with_profit_margins / analysisResults.total_recommendations) * 100).toFixed(1)}%)`);
    console.log(`  High Confidence (80%+): ${analysisResults.high_confidence}`);
    console.log(`  Medium Confidence (60-79%): ${analysisResults.medium_confidence}`);
    console.log(`  Low Confidence (<60%): ${analysisResults.low_confidence}\n`);
    
    // Sample top recommendations
    console.log('🏆 Top 5 Purchasing Opportunities:');
    const topRecommendations = recommendations
      .filter(r => r.opportunityScore && r.asin)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5);
      
    topRecommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.productName || rec.sku}`);
      console.log(`     ASIN: ${rec.asin}`);
      console.log(`     Opportunity Score: ${rec.opportunityScore}`);
      console.log(`     Match Confidence: ${rec.matchConfidence}%`);
      console.log(`     Profit Margin: ${rec.profitMarginPercent || 'N/A'}%`);
      console.log(`     Competition: ${rec.competitionLevel || 'N/A'}\n`);
    });
    
    // Test data coverage across all products
    console.log('🔬 Testing Data Coverage Across Full Catalog...');
    const productsResponse = await axios.get(`${BASE_URL}/api/products`, {
      params: { limit: 2830 }
    });
    
    const allProducts = productsResponse.data;
    const dataQuality = {
      total_products: allProducts.length,
      with_upc: allProducts.filter(p => p.upc || p.usin).length,
      with_mpn: allProducts.filter(p => p.manufacturerPartNumber).length,
      with_both_identifiers: allProducts.filter(p => (p.upc || p.usin) && p.manufacturerPartNumber).length,
      with_pricing: allProducts.filter(p => p.cost && p.price).length,
      amazon_synced: allProducts.filter(p => p.lastAmazonSync).length,
      ready_for_ai: allProducts.filter(p => 
        (p.upc || p.usin) && 
        p.manufacturerPartNumber && 
        p.cost && 
        p.price
      ).length
    };
    
    console.log('📋 Full Catalog Data Quality:');
    console.log(`  Total Products: ${dataQuality.total_products}`);
    console.log(`  With UPC: ${dataQuality.with_upc} (${((dataQuality.with_upc / dataQuality.total_products) * 100).toFixed(1)}%)`);
    console.log(`  With MPN: ${dataQuality.with_mpn} (${((dataQuality.with_mpn / dataQuality.total_products) * 100).toFixed(1)}%)`);
    console.log(`  With Both Identifiers: ${dataQuality.with_both_identifiers} (${((dataQuality.with_both_identifiers / dataQuality.total_products) * 100).toFixed(1)}%)`);
    console.log(`  With Complete Pricing: ${dataQuality.with_pricing} (${((dataQuality.with_pricing / dataQuality.total_products) * 100).toFixed(1)}%)`);
    console.log(`  Amazon Synced: ${dataQuality.amazon_synced} (${((dataQuality.amazon_synced / dataQuality.total_products) * 100).toFixed(1)}%)`);
    console.log(`  Ready for AI Analysis: ${dataQuality.ready_for_ai} (${((dataQuality.ready_for_ai / dataQuality.total_products) * 100).toFixed(1)}%)\n`);
    
    // Calculate overall system health score
    const healthScore = Math.round(
      (dataQuality.with_both_identifiers / dataQuality.total_products * 30) +
      (dataQuality.with_pricing / dataQuality.total_products * 25) +
      (dataQuality.amazon_synced / dataQuality.total_products * 25) +
      (analysisResults.with_opportunity_scores / Math.max(analysisResults.total_recommendations, 1) * 20)
    );
    
    console.log(`🎯 Overall Purchasing AI Health Score: ${healthScore}/100`);
    
    if (healthScore >= 80) {
      console.log('✅ EXCELLENT: System is ready for reliable purchasing insights across all products');
    } else if (healthScore >= 60) {
      console.log('⚠️  GOOD: System provides reliable insights with some data gaps');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: Significant data quality issues affecting AI reliability');
    }
    
    return {
      readiness_stats: stats,
      ai_analysis: analysisResults,
      data_quality: dataQuality,
      health_score: healthScore,
      top_recommendations: topRecommendations
    };
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the analysis
analyzePurchasingAIQuality().then(results => {
  if (results) {
    console.log('\n📁 Analysis complete! Results saved to memory for system optimization.');
  }
}).catch(err => {
  console.error('Analysis failed:', err);
});