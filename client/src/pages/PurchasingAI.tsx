import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, TrendingUp, Database, Target, ShoppingCart, Brain, Activity, ExternalLink } from 'lucide-react';

// Amazon Product Image Component with fallbacks
function ProductImage({ asin, productName, alt }: { asin?: string; productName?: string; alt: string }) {
  const [imageError, setImageError] = useState(false);
  
  // Try to construct Amazon image URL from ASIN
  const amazonImageUrl = asin && !imageError ? 
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX300_.jpg` : 
    null;
  
  if (amazonImageUrl && !imageError) {
    return (
      <img 
        src={amazonImageUrl}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        onError={() => setImageError(true)}
        loading="lazy"
      />
    );
  }
  
  // Fallback to placeholder
  return (
    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <ShoppingCart className="h-12 w-12 mx-auto mb-2" />
        <p className="text-xs text-gray-500 max-w-20 line-clamp-2">{productName || 'Product'}</p>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const productsPerPage = 100;

  // Data Quality Assessment Query
  const { data: qualityData, isLoading: qualityLoading, refetch: refetchQuality } = useQuery({
    queryKey: ['/api/purchasing/data-quality-assessment'],
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Enhanced Purchasing Opportunities Query with Server-Side Pagination
  const { data: opportunitiesData, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['/api/purchasing/enhanced-opportunities', selectedRisk, minConfidence, currentPage, productsPerPage],
    refetchInterval: 60000, // Refresh every 60 seconds
    queryFn: () => 
      fetch(`/api/purchasing/enhanced-opportunities?limit=${productsPerPage}&page=${currentPage}&risk_level=${selectedRisk}&min_confidence=${minConfidence}&min_opportunity_score=20`)
        .then(res => res.json())
  });

  const assessment: DataQualityAssessment | undefined = qualityData?.assessment;
  const opportunities: PurchasingOpportunity[] = opportunitiesData?.opportunities || [];
  const analytics: OpportunityAnalytics | undefined = opportunitiesData?.analytics;
  const pagination = opportunitiesData?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: productsPerPage,
    hasNextPage: false,
    hasPreviousPage: false
  };
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRisk, minConfidence]);

  const handleRefresh = () => {
    refetchQuality();
    refetchOpportunities();
  };

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
                onClick={handleRefresh}
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                    <Select 
                      value={selectedRisk} 
                      onValueChange={setSelectedRisk}
                      data-testid="risk-level-select"
                    >
                      <SelectTrigger className="w-[180px]" data-testid="risk-level-trigger">
                        <SelectValue placeholder="Select risk level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="risk-level-all">All Risk Levels</SelectItem>
                        <SelectItem value="low" data-testid="risk-level-low">Low Risk</SelectItem>
                        <SelectItem value="medium" data-testid="risk-level-medium">Medium Risk</SelectItem>
                        <SelectItem value="high" data-testid="risk-level-high">High Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Min Confidence:</label>
                    <Select 
                      value={minConfidence.toString()} 
                      onValueChange={(value) => setMinConfidence(Number(value))}
                      data-testid="min-confidence-select"
                    >
                      <SelectTrigger className="w-[120px]" data-testid="min-confidence-trigger">
                        <SelectValue placeholder="Select confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30" data-testid="min-confidence-30">30%</SelectItem>
                        <SelectItem value="50" data-testid="min-confidence-50">50%</SelectItem>
                        <SelectItem value="70" data-testid="min-confidence-70">70%</SelectItem>
                        <SelectItem value="80" data-testid="min-confidence-80">80%</SelectItem>
                      </SelectContent>
                    </Select>
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

            {/* Product Catalog Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Product Catalog</CardTitle>
                <CardDescription>
                  {opportunitiesLoading ? 'Loading products...' : 
                    `Showing ${pagination.totalCount > 0 ? ((pagination.currentPage - 1) * pagination.limit + 1) : 0}-${Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of ${pagination.totalCount} products with purchasing opportunities`
                  }
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {opportunities.map((opp, index) => (
                      <button 
                        key={`${opp.productId}-${index}`} 
                        className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 overflow-hidden group cursor-pointer text-left w-full"
                        onClick={() => {
                          // Navigate to product detail page - will implement routing
                          console.log('Navigate to product detail for:', opp.productId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            console.log('Navigate to product detail for:', opp.productId);
                          }
                        }}
                        aria-label={`View details for ${opp.productName || opp.sku} - ${opp.amazonROI ? `${opp.amazonROI.toFixed(0)}% ROI` : 'No ROI data'} - ${opp.riskLevel} risk`}
                        data-testid={`product-card-${opp.productId}`}
                      >
                        <div className="aspect-square bg-gray-100 relative overflow-hidden">
                          {/* Amazon product image or fallback */}
                          <ProductImage 
                            asin={opp.asin} 
                            productName={opp.productName} 
                            alt={opp.productName || opp.sku} 
                          />
                          {/* ROI Badge Overlay */}
                          {opp.amazonROI && opp.amazonROI > 0 && (
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-green-600 text-white">
                                {opp.amazonROI.toFixed(0)}% ROI
                              </Badge>
                            </div>
                          )}
                          {/* Risk Level Badge */}
                          <div className="absolute top-2 left-2">
                            <Badge className={getRiskBadgeColor(opp.riskLevel)}>
                              {opp.riskLevel.charAt(0).toUpperCase() + opp.riskLevel.slice(1)}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-4 space-y-3">
                          {/* Product Title */}
                          <div>
                            <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {opp.productName || opp.sku}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">SKU: {opp.sku}</p>
                          </div>
                          
                          {/* Key Metrics */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <div className="font-semibold text-gray-900">
                                ${opp.amazonCurrentPrice?.toFixed(2) || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600">Amazon Price</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="font-semibold text-green-700">
                                ${opp.amazonNetProfit?.toFixed(2) || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600">Net Profit</div>
                            </div>
                          </div>
                          
                          {/* Confidence and Score */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="text-gray-600">{opp.matchConfidence}% match</span>
                            </div>
                            <div className="font-medium text-blue-600">
                              Score: {opp.opportunityScore}
                            </div>
                          </div>
                          
                          {/* Action Indicator */}
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant="outline" 
                              className={opp.recommendedAction === 'PROCEED' ? 'border-green-500 text-green-700' : 
                                        opp.recommendedAction === 'REVIEW' ? 'border-yellow-500 text-yellow-700' : 
                                        'border-red-500 text-red-700'}
                            >
                              {opp.recommendedAction}
                            </Badge>
                            {opp.automationFlags.length > 0 && (
                              <div className="flex items-center">
                                <Brain className="h-3 w-3 text-blue-500" />
                                <span className="text-xs text-blue-600 ml-1">Auto Ready</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="flex items-center text-sm text-gray-600">
                      Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} products total)
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!pagination.hasPreviousPage || opportunitiesLoading}
                        data-testid="pagination-prev"
                      >
                        Previous
                      </Button>
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={pagination.currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            disabled={opportunitiesLoading}
                            data-testid={`pagination-${page}`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                      {pagination.totalPages > 5 && (
                        <>
                          <span className="text-gray-400">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(pagination.totalPages)}
                            disabled={opportunitiesLoading}
                            data-testid={`pagination-${pagination.totalPages}`}
                          >
                            {pagination.totalPages}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                        disabled={!pagination.hasNextPage || opportunitiesLoading}
                        data-testid="pagination-next"
                      >
                        Next
                      </Button>
                    </div>
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