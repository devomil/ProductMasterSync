import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, TrendingUp, Database, Target, ShoppingCart, Brain, Activity, ExternalLink, Package, ArrowUpDown, ArrowUp, ArrowDown, Settings, HelpCircle, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Sortable Table Header Component
function SortableHeader({ column, currentColumn, direction, onClick, children, className = '' }: { 
  column: string; 
  currentColumn: string; 
  direction: 'asc' | 'desc'; 
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = currentColumn === column;
  return (
    <TableHead className={className}>
      <button
        onClick={onClick}
        className="flex items-center space-x-1 hover:text-blue-600 transition-colors font-medium"
        data-testid={`sort-${column}`}
      >
        <span>{children}</span>
        {isActive ? (
          direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

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
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
        loading="lazy"
      />
    );
  }
  
  // Fallback to placeholder icon
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Package className="h-5 w-5 text-gray-400" />
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
  automationReady: boolean;
  
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
  const { toast } = useToast();
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [selectedRecommendation, setSelectedRecommendation] = useState<string>('all');
  const [selectedListingStatus, setSelectedListingStatus] = useState<string>('all');
  const [minMargin, setMinMargin] = useState<number>(0);
  const [maxMargin, setMaxMargin] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortColumn, setSortColumn] = useState<string>('marginPercent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewDensity, setViewDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const productsPerPage = 100;
  
  // Sorting function
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Fetch purchasing opportunities (fetch all, no server-side pagination)
  const { data: rawOpportunities = [], isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery<any[]>({
    queryKey: ['/api/purchasing/opportunities', { riskLevel: selectedRisk, minConfidence, limit: 10000, offset: 0 }],
  });

  // Fetch purchasing stats
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/purchasing/stats'],
  });

  // Bulk analysis mutation
  const bulkAnalysisMutation = useMutation({
    mutationFn: async (limit: number) => {
      const response = await apiRequest('POST', '/api/purchasing/analyze-bulk', { limit });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Analysis Complete!",
        description: `Analyzed ${data.analyzed} products successfully.`,
      });
      // Refresh the opportunities data
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/stats'] });
      refetchOpportunities();
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze products. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRunAnalysis = async () => {
    if (bulkAnalysisMutation.isPending) return;
    
    const confirmed = window.confirm(
      "This will analyze all products in your catalog for purchasing opportunities.\n\n" +
      "⏱️ Time: ~3-5 minutes for 100 products\n" +
      "📊 Rate: 0.5 requests/second for 100% API success\n\n" +
      "Continue?"
    );
    
    if (confirmed) {
      toast({
        title: "Analysis Starting...",
        description: "This may take a few minutes. You can continue using the app.",
      });
      bulkAnalysisMutation.mutate(100);
    }
  };

  // Filter and sort opportunities client-side
  const filteredOpportunities = rawOpportunities.filter(opp => {
    // Filter by recommendation
    if (selectedRecommendation !== 'all' && opp.recommendation !== selectedRecommendation) {
      return false;
    }
    
    // Filter by listing status
    if (selectedListingStatus === 'approved' && opp.canList !== true) {
      return false;
    }
    if (selectedListingStatus === 'needs_approval' && opp.canList === true) {
      return false;
    }
    
    // Filter by margin range
    const margin = opp.marginPercent || 0;
    if (margin < minMargin || margin > maxMargin) {
      return false;
    }
    
    return true;
  });
  
  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    let aVal, bVal;
    
    switch(sortColumn) {
      case 'product':
        aVal = a.product?.name || '';
        bVal = b.product?.name || '';
        break;
      case 'ourCost':
        aVal = a.ourCost || 0;
        bVal = b.ourCost || 0;
        break;
      case 'shippingCost':
        aVal = a.shippingCost || 0;
        bVal = b.shippingCost || 0;
        break;
      case 'buyBoxPrice':
        aVal = a.buyBoxPrice || 0;
        bVal = b.buyBoxPrice || 0;
        break;
      case 'marginPercent':
        aVal = a.marginPercent || 0;
        bVal = b.marginPercent || 0;
        break;
      case 'confidence':
        aVal = a.confidence || 0;
        bVal = b.confidence || 0;
        break;
      case 'salesRank':
        aVal = a.salesRank || 999999;
        bVal = b.salesRank || 999999;
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    } else {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });
  
  // Apply client-side pagination
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const opportunities = sortedOpportunities.slice(startIndex, endIndex);

  const totalOpps = stats?.totalOpportunities || 0;
  const filteredCount = filteredOpportunities.length;
  const analytics = {
    totalAnalyzed: opportunities.length,
    qualifiedOpportunities: totalOpps,
    averageConfidence: stats?.avgConfidence || 0,
    averageOpportunityScore: stats?.avgOpportunityScore || 0,
    riskDistribution: {
      low: 0,
      medium: 0,
      high: 0,
    },
    automationReady: stats?.automationReady || 0,
  };
  const pagination = {
    currentPage,
    totalPages: Math.ceil(filteredCount / productsPerPage),
    totalCount: filteredCount,
    limit: productsPerPage,
    hasNextPage: currentPage < Math.ceil(filteredCount / productsPerPage),
    hasPreviousPage: currentPage > 1
  };
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRisk, minConfidence, selectedRecommendation, selectedListingStatus, minMargin, maxMargin]);

  const handleRefresh = () => {
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

  if (opportunitiesLoading || statsLoading) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Loading Purchasing AI Analysis...</h3>
        <p className="mt-2 text-gray-500">Analyzing products for purchasing insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enhanced Purchasing AI</h1>
                <p className="text-gray-600">AI-powered purchasing recommendations for profitable opportunities</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/ai-setup">
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-ai-setup"
                >
                  <Settings className="h-4 w-4" />
                  AI Setup
                </Button>
              </Link>
              <Button 
                onClick={handleRunAnalysis}
                disabled={bulkAnalysisMutation.isPending}
                size="sm"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-run-analysis"
              >
                {bulkAnalysisMutation.isPending ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Analysis
                  </>
                )}
              </Button>
              <Link href="/purchasing-ai/analysis-progress">
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-view-progress"
                >
                  <Activity className="h-4 w-4" />
                  View Progress
                </Button>
              </Link>
              <Button 
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                data-testid="button-refresh"
              >
                Refresh Data
              </Button>
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
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Profitable Opportunities</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOpps.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.totalAnalyzed ? `${totalOpps} of ${stats.totalAnalyzed} analyzed products` : 'Dropship + Warehouse'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Warehouse Purchases</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.warehouseCount || 0}</div>
                  <p className="text-xs text-muted-foreground">High-margin opportunities</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dropship Items</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.dropshipCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Good margin opportunities</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.avgConfidence || 0}%</div>
                  <p className="text-xs text-muted-foreground">AI confidence score</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Opportunity Filters</CardTitle>
                <CardDescription>Configure purchasing opportunity analysis parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Recommendation Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recommendation</label>
                    <Select 
                      value={selectedRecommendation} 
                      onValueChange={setSelectedRecommendation}
                      data-testid="recommendation-select"
                    >
                      <SelectTrigger data-testid="recommendation-trigger">
                        <SelectValue placeholder="Select recommendation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Recommendations</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="dropship">Dropship</SelectItem>
                        <SelectItem value="no_opportunity">No Opportunity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Listing Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Listing Status</label>
                    <Select 
                      value={selectedListingStatus} 
                      onValueChange={setSelectedListingStatus}
                      data-testid="listing-status-select"
                    >
                      <SelectTrigger data-testid="listing-status-trigger">
                        <SelectValue placeholder="Select listing status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="approved">✓ Approved</SelectItem>
                        <SelectItem value="needs_approval">⚠ Needs Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Risk Level Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Risk Level</label>
                    <Select 
                      value={selectedRisk} 
                      onValueChange={setSelectedRisk}
                      data-testid="risk-level-select"
                    >
                      <SelectTrigger data-testid="risk-level-trigger">
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

                  {/* Min Confidence Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Confidence</label>
                    <Select 
                      value={minConfidence.toString()} 
                      onValueChange={(value) => setMinConfidence(Number(value))}
                      data-testid="min-confidence-select"
                    >
                      <SelectTrigger data-testid="min-confidence-trigger">
                        <SelectValue placeholder="Select confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Margin Range Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Margin %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={minMargin}
                      onChange={(e) => setMinMargin(Number(e.target.value))}
                      data-testid="min-margin-input"
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Margin %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={maxMargin}
                      onChange={(e) => setMaxMargin(Number(e.target.value))}
                      data-testid="max-margin-input"
                      placeholder="100"
                    />
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

            {/* Product Catalog Table */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Purchasing Opportunities</CardTitle>
                    <CardDescription>
                      {opportunitiesLoading ? 'Loading opportunities...' : 
                        `Showing ${pagination.totalCount > 0 ? ((pagination.currentPage - 1) * pagination.limit + 1) : 0}-${Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of ${pagination.totalCount} qualified opportunities`
                      }
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Only Listable Products
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {opportunities.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No opportunities found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting your filters or running Amazon bulk sync to discover more opportunities.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHeader 
                            column="product" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('product')}
                            className="w-[300px]"
                          >
                            Product
                          </SortableHeader>
                          <SortableHeader 
                            column="ourCost" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('ourCost')}
                            className="text-right"
                          >
                            Our Cost
                          </SortableHeader>
                          <SortableHeader 
                            column="shippingCost" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('shippingCost')}
                            className="text-right"
                          >
                            Shipping
                          </SortableHeader>
                          <TableHead className="text-right">Referral Fee</TableHead>
                          <TableHead className="text-right">FBA Fee</TableHead>
                          <SortableHeader 
                            column="buyBoxPrice" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('buyBoxPrice')}
                            className="text-right"
                          >
                            Buy Box
                          </SortableHeader>
                          <SortableHeader 
                            column="marginPercent" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('marginPercent')}
                            className="text-right"
                          >
                            Margin %
                          </SortableHeader>
                          <TableHead>Recommendation</TableHead>
                          <SortableHeader 
                            column="confidence" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('confidence')}
                            className="text-center"
                          >
                            Confidence
                          </SortableHeader>
                          <TableHead className="text-center">Listing Status</TableHead>
                          <TableHead className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span>Risk</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-sm">
                                      Risk assessment based on sales velocity, competition, and market conditions. 
                                      <strong className="block mt-1">Low:</strong> Proven demand, good sales rank
                                      <strong className="block mt-1">Medium:</strong> Moderate competition or limited data
                                      <strong className="block mt-1">High:</strong> Uncertain demand or high competition
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableHead>
                          <SortableHeader 
                            column="salesRank" 
                            currentColumn={sortColumn} 
                            direction={sortDirection}
                            onClick={() => handleSort('salesRank')}
                            className="text-right"
                          >
                            Sales Rank
                          </SortableHeader>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opportunities.map((opp, index) => (
                          <TableRow 
                            key={`${opp.productId}-${index}`}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              console.log('View product details:', opp.productId);
                            }}
                            data-testid={`opportunity-row-${opp.productId}`}
                          >
                            {/* Product Name & SKU */}
                            <TableCell>
                              <div className="max-w-xs">
                                <p className="font-medium text-sm line-clamp-1">
                                  {opp.product?.name || 'Unknown Product'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  SKU: {opp.product?.sku || 'N/A'}
                                  {opp.asin && <span className="ml-2">ASIN: {opp.asin}</span>}
                                </p>
                              </div>
                            </TableCell>
                            
                            {/* Our Cost */}
                            <TableCell className="text-right font-medium">
                              ${opp.ourCost?.toFixed(2) || 'N/A'}
                            </TableCell>
                            
                            {/* Shipping Cost */}
                            <TableCell className="text-right">
                              ${opp.shippingCost?.toFixed(2) || 'N/A'}
                            </TableCell>
                            
                            {/* Referral Fee */}
                            <TableCell className="text-right">
                              {opp.amazonReferralFee != null ? (
                                <div className="font-medium text-orange-600">
                                  ${opp.amazonReferralFee.toFixed(2)}
                                </div>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </TableCell>
                            
                            {/* FBA Fee */}
                            <TableCell className="text-right">
                              {opp.amazonFbaFee != null && opp.amazonFbaFee > 0 ? (
                                <div className="font-medium text-purple-600">
                                  ${opp.amazonFbaFee.toFixed(2)}
                                </div>
                              ) : opp.amazonFbaFee === 0 ? (
                                <span className="text-gray-500">FBM</span>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </TableCell>
                            
                            {/* Buy Box Price */}
                            <TableCell className="text-right font-medium text-blue-600">
                              ${opp.buyBoxPrice?.toFixed(2) || 'N/A'}
                            </TableCell>
                            
                            {/* Margin % */}
                            <TableCell className="text-right">
                              <Badge 
                                className={
                                  (opp.marginPercent || 0) >= 25 ? 'bg-green-600 text-white' :
                                  (opp.marginPercent || 0) >= 15 ? 'bg-yellow-600 text-white' :
                                  'bg-red-600 text-white'
                                }
                              >
                                {opp.marginPercent ? `${opp.marginPercent.toFixed(1)}%` : 'N/A'}
                              </Badge>
                            </TableCell>
                            
                            {/* Recommendation */}
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={
                                  opp.recommendation === 'warehouse' ? 'border-green-500 text-green-700 bg-green-50' :
                                  opp.recommendation === 'dropship' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                  'border-gray-500 text-gray-700'
                                }
                              >
                                {opp.recommendation || 'N/A'}
                              </Badge>
                            </TableCell>
                            
                            {/* Confidence */}
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <div className={`w-2 h-2 rounded-full ${(opp.confidence || 0) >= 70 ? 'bg-green-500' : (opp.confidence || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                <span className="text-sm">{opp.confidence || 0}%</span>
                              </div>
                            </TableCell>
                            
                            {/* Listing Status */}
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline"
                                className={
                                  opp.canList === true 
                                    ? 'border-green-500 text-green-700 bg-green-50' 
                                    : 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                }
                              >
                                {opp.canList === true ? '✓ Approved' : '⚠ Needs Approval'}
                              </Badge>
                            </TableCell>
                            
                            {/* Risk Level */}
                            <TableCell className="text-center">
                              <Badge className={getRiskBadgeColor(opp.riskLevel)}>
                                {opp.riskLevel?.charAt(0).toUpperCase() + (opp.riskLevel?.slice(1) || '')}
                              </Badge>
                            </TableCell>
                            
                            {/* Sales Rank */}
                            <TableCell className="text-right text-sm">
                              {opp.salesRank ? opp.salesRank.toLocaleString() : 'N/A'}
                            </TableCell>
                            
                            {/* Action Button */}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (opp.asin) {
                                    window.open(`https://www.amazon.com/dp/${opp.asin}`, '_blank');
                                  }
                                }}
                                disabled={!opp.asin}
                                data-testid={`view-amazon-${opp.productId}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}