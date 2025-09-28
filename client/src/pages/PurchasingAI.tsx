import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, Database, Target, ShoppingCart, Brain, Activity } from 'lucide-react';

interface DataQualityAssessment {
  catalog_size: number;
  data_completeness: {
    upc_coverage: { count: number; percentage: number };
    mpn_coverage: { count: number; percentage: number };
    both_identifiers: { count: number; percentage: number };
    pricing_complete: { count: number; percentage: number };
    amazon_synced: { count: number; percentage: number };
    ai_ready: { count: number; percentage: number };
  };
  reliability_score: number;
  status: string;
  message: string;
  recommendations: Array<{
    priority: string;
    area: string;
    issue: string;
    action: string;
  }>;
}

interface PurchasingOpportunity {
  productId: number;
  sku: string;
  productName: string;
  upc: string;
  manufacturerPartNumber: string;
  asin: string;
  
  // Enhanced cost breakdown
  internalCosts: {
    productCost: number;
    shippingCost: number;
    handlingFee: number;
    totalInternalCost: number;
  };
  
  // Amazon fee breakdown
  amazonFees: {
    referralFee: number;
    fulfillmentFee: number;
    storageFee: number;
    totalFees: number;
    feePercentage: number;
  };
  
  // Pricing data
  internalPrice: number;
  amazonCurrentPrice: number;
  amazonListPrice: number;
  amazonNetProceeds: number;
  
  // Enhanced profit analysis
  internalProfitMargin: number;
  amazonProfitMargin: number;
  amazonNetProfit: number;
  amazonROI: number;
  
  // Decision support
  opportunityScore: number;
  matchConfidence: number;
  competitionLevel: string;
  riskLevel: string;
  recommendedAction: string;
  automationFlags: string[];
  
  dataCompleteness: {
    hasUPC: boolean;
    hasMPN: boolean;
    hasPricing: boolean;
    hasAmazonData: boolean;
    amazonSynced: boolean;
  };
}

interface OpportunityAnalytics {
  totalAnalyzed: number;
  qualifiedOpportunities: number;
  averageConfidence: number;
  averageOpportunityScore: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  automationReady: number;
}

export default function PurchasingAI() {
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data Quality Assessment Query
  const { data: qualityData, isLoading: qualityLoading } = useQuery({
    queryKey: ['/api/purchasing/data-quality-assessment', refreshKey],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Enhanced Purchasing Opportunities Query
  const { data: opportunitiesData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['/api/purchasing/enhanced-opportunities', selectedRisk, minConfidence, refreshKey],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: () => 
      fetch(`/api/purchasing/enhanced-opportunities?limit=100&risk_level=${selectedRisk}&min_confidence=${minConfidence}&min_opportunity_score=20`)
        .then(res => res.json())
  });

  const assessment: DataQualityAssessment | undefined = qualityData?.assessment;
  const opportunities: PurchasingOpportunity[] = opportunitiesData?.opportunities || [];
  const analytics: OpportunityAnalytics | undefined = opportunitiesData?.analytics;

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return 'bg-green-100 text-green-800 border-green-200';
      case 'GOOD': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (qualityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Loading Purchasing AI Analysis...</h3>
            <p className="mt-2 text-gray-500">Analyzing all 2830 products for purchasing insights</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enhanced Purchasing AI</h1>
                <p className="text-gray-600">Intelligent purchasing insights across all {assessment?.catalog_size || 2830} products</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={() => setRefreshKey(prev => prev + 1)}
                variant="outline"
                size="sm"
              >
                Refresh Data
              </Button>
              {assessment && (
                <Badge className={getStatusColor(assessment.status)}>
                  {assessment.reliability_score}/100 - {assessment.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">System Overview</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Data Quality Overview */}
            {assessment && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assessment.catalog_size.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Complete catalog size</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">AI Ready</CardTitle>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assessment.data_completeness.ai_ready.count.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{assessment.data_completeness.ai_ready.percentage}% ready for AI analysis</p>
                    <Progress value={assessment.data_completeness.ai_ready.percentage} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">UPC & MPN Coverage</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assessment.data_completeness.both_identifiers.count.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{assessment.data_completeness.both_identifiers.percentage}% with complete identifiers</p>
                    <Progress value={assessment.data_completeness.both_identifiers.percentage} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Amazon Synced</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assessment.data_completeness.amazon_synced.count.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{assessment.data_completeness.amazon_synced.percentage}% synced with Amazon</p>
                    <Progress value={assessment.data_completeness.amazon_synced.percentage} className="mt-2" />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* System Message */}
            {assessment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>System Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(assessment.status)}`}>
                      Reliability Score: {assessment.reliability_score}/100 - {assessment.status}
                    </div>
                    <p className="text-gray-700">{assessment.message}</p>
                    
                    {assessment.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Improvement Recommendations:</h4>
                        {assessment.recommendations.map((rec, index) => (
                          <div key={index} className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {rec.priority.toUpperCase()}
                                  </Badge>
                                  <span className="font-medium text-sm">{rec.area}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{rec.issue}</p>
                                <p className="text-sm text-blue-600 mt-1">Action: {rec.action}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Opportunity Filters</CardTitle>
                <CardDescription>Configure purchasing opportunity analysis parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Risk Level:</label>
                    <select 
                      value={selectedRisk} 
                      onChange={(e) => setSelectedRisk(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value="all">All Risk Levels</option>
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Min Confidence:</label>
                    <select 
                      value={minConfidence} 
                      onChange={(e) => setMinConfidence(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value="30">30%</option>
                      <option value="50">50%</option>
                      <option value="70">70%</option>
                      <option value="80">80%</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analytics Summary */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{analytics.qualifiedOpportunities}</div>
                    <p className="text-xs text-muted-foreground">Qualified Opportunities</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{analytics.averageConfidence}%</div>
                    <p className="text-xs text-muted-foreground">Average Confidence</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{analytics.averageOpportunityScore}</div>
                    <p className="text-xs text-muted-foreground">Avg Opportunity Score</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{analytics.automationReady}</div>
                    <p className="text-xs text-muted-foreground">Automation Ready</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Opportunities List */}
            <Card>
              <CardHeader>
                <CardTitle>Purchasing Opportunities</CardTitle>
                <CardDescription>
                  {opportunitiesLoading ? 'Loading opportunities...' : `${opportunities.length} opportunities found`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {opportunities.length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No opportunities found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting your filters or running Amazon bulk sync to increase opportunities.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {opportunities.slice(0, 10).map((opp, index) => (
                      <div key={`${opp.productId}-${index}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium text-gray-900">{opp.productName || opp.sku}</h4>
                              <Badge className={getRiskBadgeColor(opp.riskLevel)}>
                                {opp.riskLevel.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {opp.matchConfidence}% confidence
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                              {/* Product Information */}
                              <div>
                                <h5 className="font-medium text-gray-700 mb-1">Product Info</h5>
                                <p><span className="font-medium">UPC:</span> {opp.upc || 'N/A'}</p>
                                <p><span className="font-medium">MPN:</span> {opp.manufacturerPartNumber || 'N/A'}</p>
                                <p><span className="font-medium">ASIN:</span> {opp.asin || 'N/A'}</p>
                              </div>
                              
                              {/* Cost Analysis */}
                              <div>
                                <h5 className="font-medium text-gray-700 mb-1">Cost Breakdown</h5>
                                <p><span className="font-medium">Product:</span> ${opp.internalCosts?.productCost?.toFixed(2) || 'N/A'}</p>
                                <p><span className="font-medium">Shipping:</span> ${opp.internalCosts?.shippingCost?.toFixed(2) || 'N/A'}</p>
                                <p><span className="font-medium">Handling:</span> ${opp.internalCosts?.handlingFee?.toFixed(2) || 'N/A'}</p>
                                <p className="font-semibold border-t pt-1"><span className="font-medium">Total Cost:</span> ${opp.internalCosts?.totalInternalCost?.toFixed(2) || 'N/A'}</p>
                              </div>
                              
                              {/* Amazon Analysis */}
                              <div>
                                <h5 className="font-medium text-gray-700 mb-1">Amazon Analysis</h5>
                                <p><span className="font-medium">Amazon Price:</span> ${opp.amazonCurrentPrice?.toFixed(2) || 'N/A'}</p>
                                <p><span className="font-medium">Amazon Fees:</span> ${opp.amazonFees?.totalFees?.toFixed(2) || 'N/A'} ({opp.amazonFees?.feePercentage?.toFixed(1) || 'N/A'}%)</p>
                                <p><span className="font-medium">Net Proceeds:</span> ${opp.amazonNetProceeds?.toFixed(2) || 'N/A'}</p>
                                <p className="font-semibold text-green-600"><span className="font-medium">Net Profit:</span> ${opp.amazonNetProfit?.toFixed(2) || 'N/A'} ({opp.amazonProfitMargin?.toFixed(1) || 'N/A'}%)</p>
                              </div>
                            </div>
                            
                            {/* Action Summary */}
                            <div className="mt-3 pt-2 border-t border-gray-100">
                              <div className="flex items-center justify-between text-sm">
                                <span><span className="font-medium">ROI:</span> {opp.amazonROI?.toFixed(1) || 'N/A'}%</span>
                                <span><span className="font-medium">Action:</span> 
                                  <Badge className={opp.recommendedAction === 'PROCEED' ? 'bg-green-100 text-green-800 ml-1' : 
                                                  opp.recommendedAction === 'REVIEW' ? 'bg-yellow-100 text-yellow-800 ml-1' : 
                                                  'bg-red-100 text-red-800 ml-1'}>
                                    {opp.recommendedAction}
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            {opp.automationFlags.length > 0 && (
                              <div className="mt-2">
                                <div className="flex flex-wrap gap-1">
                                  {opp.automationFlags.map((flag, flagIndex) => (
                                    <Badge key={flagIndex} variant="secondary" className="text-xs">
                                      {flag.replace(/_/g, ' ')}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{opp.opportunityScore}</div>
                            <p className="text-xs text-gray-500">Opportunity Score</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Analytics</CardTitle>
                <CardDescription>Comprehensive analysis of purchasing AI performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-blue-500" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Analytics Dashboard</h3>
                  <p className="mt-2 text-gray-500">Advanced analytics coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
                <CardDescription>Intelligent purchasing recommendations and market analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900">UPC & Product Matching</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Confidence scores are calculated using UPC exact match (60%), product title similarity (20%), and brand verification (20%).
                    </p>
                  </div>
                  
                  {assessment && assessment.reliability_score >= 80 && (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-900">System Ready</h4>
                      <p className="text-sm text-green-700 mt-1">
                        With {assessment.data_completeness.ai_ready.percentage}% of products ready for AI analysis and {assessment.reliability_score}/100 reliability score, 
                        the system provides excellent purchasing insights across all {assessment.catalog_size} products.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}