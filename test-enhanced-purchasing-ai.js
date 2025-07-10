/**
 * Test Enhanced Purchasing AI System
 * Validates purchasing insights across all 2830 products
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testEnhancedPurchasingAI() {
  console.log('🚀 Testing Enhanced Purchasing AI System...\n');

  try {
    // Test 1: Data Quality Assessment
    console.log('📊 Running comprehensive data quality assessment...');
    const qualityResponse = await axios.get(`${BASE_URL}/api/purchasing/data-quality-assessment`);
    
    if (!qualityResponse.data.success) {
      throw new Error('Data quality assessment failed');
    }
    
    const assessment = qualityResponse.data.assessment;
    
    console.log(`Catalog Size: ${assessment.catalog_size} products`);
    console.log(`Data Completeness:`);
    console.log(`  UPC Coverage: ${assessment.data_completeness.upc_coverage.count} (${assessment.data_completeness.upc_coverage.percentage}%)`);
    console.log(`  MPN Coverage: ${assessment.data_completeness.mpn_coverage.count} (${assessment.data_completeness.mpn_coverage.percentage}%)`);
    console.log(`  Both Identifiers: ${assessment.data_completeness.both_identifiers.count} (${assessment.data_completeness.both_identifiers.percentage}%)`);
    console.log(`  Pricing Complete: ${assessment.data_completeness.pricing_complete.count} (${assessment.data_completeness.pricing_complete.percentage}%)`);
    console.log(`  Amazon Synced: ${assessment.data_completeness.amazon_synced.count} (${assessment.data_completeness.amazon_synced.percentage}%)`);
    console.log(`  AI Ready: ${assessment.data_completeness.ai_ready.count} (${assessment.data_completeness.ai_ready.percentage}%)`);
    console.log(`\nReliability Score: ${assessment.reliability_score}/100 - ${assessment.status}`);
    console.log(`${assessment.message}\n`);

    if (assessment.recommendations.length > 0) {
      console.log('💡 Improvement Recommendations:');
      assessment.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.area}: ${rec.issue}`);
        console.log(`     Action: ${rec.action}`);
      });
      console.log('');
    }

    // Test 2: Enhanced Purchasing Opportunities (Low Risk)
    console.log('🎯 Testing enhanced purchasing opportunities (Low Risk)...');
    const lowRiskResponse = await axios.get(`${BASE_URL}/api/purchasing/enhanced-opportunities`, {
      params: {
        limit: 25,
        risk_level: 'low',
        min_confidence: 70,
        min_opportunity_score: 50
      }
    });

    const lowRiskData = lowRiskResponse.data;
    console.log(`Found ${lowRiskData.opportunities.length} low-risk opportunities`);
    console.log(`Analytics: Avg Confidence ${lowRiskData.analytics.averageConfidence}%, Avg Opportunity Score ${lowRiskData.analytics.averageOpportunityScore}`);
    console.log(`Risk Distribution: Low ${lowRiskData.analytics.riskDistribution.low}, Medium ${lowRiskData.analytics.riskDistribution.medium}, High ${lowRiskData.analytics.riskDistribution.high}`);
    console.log(`Automation Ready: ${lowRiskData.analytics.automationReady} products\n`);

    // Test 3: Enhanced Purchasing Opportunities (All Risk Levels)
    console.log('📈 Testing all purchasing opportunities...');
    const allOpportunitiesResponse = await axios.get(`${BASE_URL}/api/purchasing/enhanced-opportunities`, {
      params: {
        limit: 100,
        risk_level: 'all',
        min_confidence: 50,
        min_opportunity_score: 20
      }
    });

    const allOpportunities = allOpportunitiesResponse.data;
    console.log(`Found ${allOpportunities.opportunities.length} total opportunities`);
    console.log(`Analytics: Avg Confidence ${allOpportunities.analytics.averageConfidence}%, Avg Opportunity Score ${allOpportunities.analytics.averageOpportunityScore}`);
    console.log(`Automation Ready: ${allOpportunities.analytics.automationReady} products\n`);

    // Display top 10 opportunities with detailed analysis
    console.log('🏆 Top 10 Enhanced Purchasing Opportunities:');
    const topOpportunities = allOpportunities.opportunities
      .filter(opp => opp.asin && opp.matchConfidence >= 60)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 10);

    topOpportunities.forEach((opp, index) => {
      console.log(`\n${index + 1}. ${opp.productName || opp.sku}`);
      console.log(`   ASIN: ${opp.asin}`);
      console.log(`   UPC: ${opp.upc || 'N/A'} | MPN: ${opp.manufacturerPartNumber || 'N/A'}`);
      console.log(`   Opportunity Score: ${opp.opportunityScore} | Match Confidence: ${opp.matchConfidence}%`);
      console.log(`   Risk Level: ${opp.riskLevel.toUpperCase()} | Competition: ${opp.competitionLevel}`);
      console.log(`   Internal: $${opp.internalCost} cost → $${opp.internalPrice} price (${opp.internalProfitMargin}% margin)`);
      console.log(`   Amazon: $${opp.amazonCurrentPrice || 'N/A'} current | ${opp.amazonProfitMargin}% potential margin`);
      console.log(`   Recommendation: ${opp.recommendedAction}`);
      console.log(`   Automation Flags: ${opp.automationFlags.join(', ') || 'None'}`);
      console.log(`   Data Complete: UPC:${opp.dataCompleteness.hasUPC}, MPN:${opp.dataCompleteness.hasMPN}, Pricing:${opp.dataCompleteness.hasPricing}, Amazon:${opp.dataCompleteness.hasAmazonData}`);
    });

    // Test 4: System Performance Summary
    console.log('\n\n📋 Enhanced Purchasing AI System Summary:');
    console.log(`✅ Total Products Analyzed: ${assessment.catalog_size}`);
    console.log(`✅ Products Ready for AI: ${assessment.data_completeness.ai_ready.count} (${assessment.data_completeness.ai_ready.percentage}%)`);
    console.log(`✅ Purchasing Opportunities Found: ${allOpportunities.opportunities.length}`);
    console.log(`✅ High-Confidence Recommendations: ${allOpportunities.opportunities.filter(o => o.matchConfidence >= 80).length}`);
    console.log(`✅ Automation-Ready Products: ${allOpportunities.analytics.automationReady}`);
    console.log(`✅ System Reliability Score: ${assessment.reliability_score}/100`);

    // Success metrics
    const successMetrics = {
      total_catalog_size: assessment.catalog_size,
      ai_ready_products: assessment.data_completeness.ai_ready.count,
      ai_ready_percentage: assessment.data_completeness.ai_ready.percentage,
      opportunities_found: allOpportunities.opportunities.length,
      high_confidence_opportunities: allOpportunities.opportunities.filter(o => o.matchConfidence >= 80).length,
      automation_ready: allOpportunities.analytics.automationReady,
      reliability_score: assessment.reliability_score,
      system_status: assessment.status
    };

    console.log('\n🎉 Enhanced Purchasing AI Test Complete!');
    
    if (successMetrics.reliability_score >= 80) {
      console.log('🌟 EXCELLENT: System provides reliable purchasing insights across all 2830 products');
    } else if (successMetrics.reliability_score >= 60) {
      console.log('✅ GOOD: System provides solid purchasing insights with room for improvement');
    } else {
      console.log('⚠️  NEEDS WORK: System requires data quality improvements for optimal insights');
    }

    return successMetrics;

  } catch (error) {
    console.error('❌ Enhanced Purchasing AI test failed:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    return null;
  }
}

// Run the test
testEnhancedPurchasingAI().then(metrics => {
  if (metrics) {
    console.log('\n📊 Test completed successfully! System metrics captured.');
  }
}).catch(err => {
  console.error('Test execution failed:', err);
});