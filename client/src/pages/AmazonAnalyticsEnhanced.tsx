import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line,
  ResponsiveContainer 
} from "recharts";
import { ImageComparison } from "@/components/marketplace/ImageComparison";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter,
  RefreshCcw,
  Eye,
  ExternalLink,
  MapPin,
  ChevronDown,
  ChevronUp,
  Package,
  Target,
  DollarSign,
  BarChart3,
  ArrowUpDown,
  RefreshCw,
  Database,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Copy,
  ListTree,
  Play
} from "lucide-react";

interface MultiAsinOpportunity {
  id: number;
  productId: number;
  upc: string;
  manufacturerPartNumber: string;
  discoveredAsins: string[];
  primaryAsin: string;
  secondaryAsins: string[];
  opportunityScore: number;
  strategyType: 'DOMINATE_ALL' | 'SELECTIVE_TARGET' | 'TEST_AND_EXPAND';
  profitAnalysis: {
    estimatedMargin: number;
    competitionLevel: string;
    marketPotential: number;
  };
  supplierRecommendations: {
    recommendedAction: string;
    priorityLevel: string;
  };
  competitiveAnalysis: {
    priceRange: { min: number; max: number };
    avgReviews: number;
    topCompetitors: string[];
  };
  seasonalForecast: {
    peakMonths: string[];
    demandTrend: string;
  };
  updatedAt: string;
}

interface SupplierPerformance {
  id: number;
  supplierId: number;
  asin: string;
  successRate: number;
  avgProfitMargin: number;
  marketDominanceScore: number;
  negotiationOpportunities: {
    volumeDiscount: boolean;
    exclusivity: boolean;
    paymentTerms: boolean;
  };
  performanceTrends: {
    quarterlyGrowth: number;
    marketShare: number;
  };
  lastUpdated: string;
}

interface AIIntelligenceSummary {
  opportunities: {
    total: number;
    highScore: number;
    strategies: Array<{ strategy: string; count: number }>;
  };
  suppliers: {
    totalMappings: number;
    highPerforming: number;
  };
  lastAnalyzed: string;
  aiStatus: string;
}

interface ProductOpportunity {
  sku: string;
  productName: string;
  upc: string;
  category: string;
  supplierName: string;
  asinMatches: AsinMatch[];
  image?: string;
  strategicTags: string[];
  // Image URLs for comparison
  supplierImageUrl?: string;
  masterImageUrl?: string;
}

interface AsinMatch {
  asin: string;
  score: number;
  price: number;
  listPrice?: number;
  sellers: number;
  buyboxHolder: string;
  priceHistory: PriceHistoryPoint[];
  isBuyboxEligible: boolean;
  condition: string;
  amazonTitle?: string;
  amazonBrand?: string;
  salesRank?: number;
  categoryRank?: number;
  estimatedSales?: number;
  // Enhanced UI fields for image comparison
  imageUrl?: string;
  supplierImageUrl?: string;
  canList?: boolean;
  hasListingRestrictions?: boolean;
  restrictionMessages?: string[];
  supplierCost?: number;
  shippingCost?: number;
  amazonFees?: number;
  netProfit?: number;
}

interface PriceHistoryPoint {
  date: string;
  price: number;
}

interface AmazonAnalytics {
  totalProducts: number;
  amazonMappedProducts: number;
  competitiveAnalysisCount: number;
  priceHistoryEntries: number;
  marketIntelligenceRecords: number;
  lastSyncTime: string;
  syncStatus: 'active' | 'pending' | 'error';
}

interface MarketTrend {
  category: string;
  averagePrice: number;
  competitorCount: number;
  salesRank: number;
  trend: 'up' | 'down' | 'stable';
  priceChange: number;
}

export default function AmazonAnalyticsEnhanced() {
  const { toast } = useToast();
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [buyboxEligible, setBuyboxEligible] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedProduct, setSelectedProduct] = useState<ProductOpportunity | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showImageComparison, setShowImageComparison] = useState<boolean>(false);

  // Data fetching
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AmazonAnalytics>({
    queryKey: ['/api/marketplace/analytics/overview']
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<MarketTrend[]>({
    queryKey: ['/api/marketplace/analytics/trends']
  });

  const { data: multiAsinData, isLoading: multiAsinDataLoading } = useQuery<{
    opportunities: MultiAsinOpportunity[];
    metadata: { totalCount: number; minScoreFilter: number; generatedAt: string };
  }>({
    queryKey: ['/api/marketplace/analytics/multi-asin-opportunities'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const { data: supplierPerformanceData, isLoading: supplierPerformanceLoading } = useQuery<{
    performance: SupplierPerformance[];
    summary: {
      totalSupplierAsins: number;
      averageSuccessRate: number;
      averageProfitMargin: number;
      lastUpdated: string;
    };
  }>({
    queryKey: ['/api/marketplace/analytics/supplier-performance'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const { data: aiIntelligence, isLoading: aiIntelligenceLoading } = useQuery<AIIntelligenceSummary>({
    queryKey: ['/api/marketplace/analytics/ai-intelligence'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery<{opportunities: ProductOpportunity[]}>({
    queryKey: ['/api/marketplace/analytics/opportunities']
  });

  // Image comparison data query
  const { data: opportunitiesData, isLoading: imageOpportunitiesLoading, error: imageError, refetch } = useQuery<{
    success: boolean;
    opportunities: ProductOpportunity[];
    totalCount: number;
  }>({
    queryKey: ['/api/marketplace/image-opportunities'],
    enabled: showImageComparison,
    refetchOnWindowFocus: false,
  });

  // Safe data handling with null checks
  const safeOpportunities = opportunities?.opportunities || [];
  const safeTrends = trends || [];

  const { data: syncStatus } = useQuery({
    queryKey: ['/api/marketplace/sync/status']
  });

  // Multi-ASIN data queries
  const { data: multiAsinProducts, isLoading: multiAsinLoading } = useQuery({
    queryKey: ['/api/multi-asin-display/products-with-candidates'],
    refetchInterval: 60000, // 1 minute
  });

  console.log('Multi-ASIN products data:', multiAsinProducts);

  const { data: productCandidates } = useQuery({
    queryKey: ['/api/multi-asin-display/product', selectedProduct, 'all-candidates'],
    enabled: !!selectedProduct,
  });

  // Batch processing mutation
  const batchProcessMutation = useMutation({
    mutationFn: async (limit: number = 20) => {
      const response = await fetch('/api/asin-selection/batch-select-best-asins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/multi-asin-display/products-with-candidates'] });
      toast({
        title: "Processing Complete",
        description: "Multi-ASIN batch processing completed successfully"
      });
    }
  });

  // Use only authentic API data - no fallback synthetic data
  const displayAnalytics = analytics;
  const displayTrends = safeTrends;
  const displayOpportunities = safeOpportunities;

  // Enhanced filtering and sorting
  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = displayOpportunities.filter(opportunity => {
      const matchesSearch = searchTerm === "" || 
        opportunity.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.upc.includes(searchTerm) ||
        (opportunity.asinMatches && opportunity.asinMatches.some(asin => asin.asin.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesCategory = selectedCategory === "all" || opportunity.category === selectedCategory;
      const matchesSupplier = selectedSupplier === "all" || opportunity.supplierName === selectedSupplier;
      
      const maxScore = (opportunity.asinMatches && opportunity.asinMatches.length > 0) ? Math.max(...opportunity.asinMatches.map(a => a.score)) : 0;
      const matchesScore = maxScore >= scoreRange[0] && maxScore <= scoreRange[1];
      
      const hasBuyboxEligible = opportunity.asinMatches && opportunity.asinMatches.some(a => a.isBuyboxEligible);
      const matchesBuybox = buyboxEligible === "all" || 
        (buyboxEligible === "eligible" && hasBuyboxEligible) ||
        (buyboxEligible === "not-eligible" && !hasBuyboxEligible);
      
      return matchesSearch && matchesCategory && matchesSupplier && matchesScore && matchesBuybox;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "score":
          aValue = (a.asinMatches && a.asinMatches.length > 0) ? Math.max(...a.asinMatches.map(asin => asin.score)) : 0;
          bValue = (b.asinMatches && b.asinMatches.length > 0) ? Math.max(...b.asinMatches.map(asin => asin.score)) : 0;
          break;
        case "category":
          aValue = a.category;
          bValue = b.category;
          break;
        case "supplier":
          aValue = a.supplierName;
          bValue = b.supplierName;
          break;
        case "price":
          aValue = (a.asinMatches && a.asinMatches.length > 0) ? Math.min(...a.asinMatches.map(asin => asin.price)) : 0;
          bValue = (b.asinMatches && b.asinMatches.length > 0) ? Math.min(...b.asinMatches.map(asin => asin.price)) : 0;
          break;
        case "sellers":
          aValue = (a.asinMatches && a.asinMatches.length > 0) ? Math.min(...a.asinMatches.map(asin => asin.sellers)) : 0;
          bValue = (b.asinMatches && b.asinMatches.length > 0) ? Math.min(...b.asinMatches.map(asin => asin.sellers)) : 0;
          break;
        default:
          aValue = a.productName;
          bValue = b.productName;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      const numA = Number(aValue) || 0;
      const numB = Number(bValue) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return filtered;
  }, [displayOpportunities, searchTerm, selectedCategory, selectedSupplier, scoreRange, buyboxEligible, sortBy, sortOrder]);

  const categories = Array.from(new Set(displayOpportunities.map((o: ProductOpportunity) => o.category).filter(Boolean)));
  const suppliers = Array.from(new Set(displayOpportunities.map((o: ProductOpportunity) => o.supplierName).filter(Boolean)));

  const getStrategyTagColor = (tag: string) => {
    switch (tag) {
      case "Growth ASIN": return "bg-green-100 text-green-800";
      case "Defensive ASIN": return "bg-blue-100 text-blue-800";
      case "Underpriced": return "bg-orange-100 text-orange-800";
      case "Low Competition": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const syncAmazonData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/marketplace/sync/search-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Amazon Sync Completed",
          description: `Searched ${data.results.searched} products, found ${data.results.found} matches, stored ${data.results.stored} ASINs`
        });
        // Refresh data
        window.location.reload();
      } else {
        toast({
          title: "Sync Failed",
          description: data.message || "Failed to sync with Amazon",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to Amazon SP-API",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const mapAsin = async (asin: string, sku: string) => {
    try {
      const response = await fetch('/api/marketplace/map-asin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin, sku })
      });
      
      if (response.ok) {
        toast({
          title: "ASIN Mapped",
          description: `Successfully mapped ASIN ${asin} to SKU ${sku}`
        });
      } else {
        toast({
          title: "Mapping Failed",
          description: "Failed to map ASIN",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to map ASIN",
        variant: "destructive"
      });
    }
  };

  // Display error state when authentic data is not available
  if (!displayAnalytics && !displayOpportunities.length && !displayTrends.length) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Amazon Data Not Available</h2>
          <p className="text-gray-600 mb-6">
            No authentic Amazon marketplace data is currently available. Please ensure your Amazon SP-API credentials are properly configured.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Amazon Marketplace Analytics</h1>
          <p className="text-gray-600 mt-2">Enhanced competitive intelligence and product evaluation</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={syncAmazonData}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {isSyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Syncing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Sync Active
              </>
            )}
          </Button>
          
          <Badge variant={displayAnalytics?.syncStatus === 'active' ? 'default' : 'destructive'}>
            {displayAnalytics?.syncStatus === 'active' ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Live Data
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                No Amazon Data
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics?.totalProducts?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">In database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amazon Mapped</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics?.amazonMappedProducts?.toLocaleString() || '0'}</div>
            <div className="flex items-center space-x-2 mt-1">
              <Progress value={displayAnalytics ? Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100) : 0} className="flex-1" />
              <span className="text-sm font-medium">{displayAnalytics ? Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100) : 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Intelligence</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics?.marketIntelligenceRecords?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">Records analyzed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price History</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics?.priceHistoryEntries?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">Historical data points</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="image-comparison">Image Comparison</TabsTrigger>
          <TabsTrigger value="ai-intelligence">AI Intelligence</TabsTrigger>
          <TabsTrigger value="database">Database Status</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-6">
          {/* Enhanced Search and Filters */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by product name, SKU, UPC, or ASIN..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {showFilters && (
              <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Supplier</label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Suppliers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Suppliers</SelectItem>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ASIN Score Range</label>
                    <div className="px-2">
                      <Slider
                        value={scoreRange}
                        onValueChange={setScoreRange}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{scoreRange[0]}</span>
                        <span>{scoreRange[1]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buybox Eligibility</label>
                    <Select value={buyboxEligible} onValueChange={setBuyboxEligible}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="eligible">Buybox Eligible</SelectItem>
                        <SelectItem value="not-eligible">Not Eligible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            )}

            {/* Sort Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">ASIN Score</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="price">Buybox Price</SelectItem>
                    <SelectItem value="sellers"># of Sellers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center space-x-1"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
              </Button>
              <div className="text-sm text-gray-500">
                {filteredAndSortedOpportunities.length} of {displayOpportunities.length} products
              </div>
            </div>
          </div>

          {/* Enhanced Opportunities Table */}
          <Card>
            <CardHeader>
              <CardTitle>Product Opportunities</CardTitle>
              <CardDescription>Amazon marketplace competitive analysis with ASIN mapping</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredAndSortedOpportunities.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No opportunities found</h3>
                    <p className="text-gray-600">Adjust your filters or start Amazon sync to discover opportunities.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredAndSortedOpportunities.map((opportunity, index) => {
                      // Get the best ASIN match for images
                      const bestAsin = opportunity.asinMatches?.reduce((best: any, current: any) => 
                        (current.score > (best?.score || 0)) ? current : best
                      ) || null;

                      // Debug logging for image data
                      if (index === 0) {
                        console.log('First opportunity data:', {
                          sku: opportunity.sku,
                          supplierImageUrl: opportunity.supplierImageUrl,
                          bestAsin: bestAsin,
                          amazonImageUrl: bestAsin?.imageUrl
                        });
                      }



                      return (
                      <Card key={index} className="border border-gray-200 hover:border-gray-300 transition-colors">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            {/* Image Comparison Section */}
                            <div className="flex-shrink-0">
                              <div className="grid grid-cols-2 gap-2 w-32">
                                {/* Supplier Image */}
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500 text-center">Supplier</p>
                                  <div className="w-14 h-14 relative">
                                    {(opportunity.supplierImageUrl || opportunity.image) ? (
                                      <img 
                                        src={opportunity.supplierImageUrl || opportunity.image} 
                                        alt={opportunity.productName}
                                        className="w-14 h-14 object-contain rounded border bg-gray-50"
                                        onLoad={() => console.log('Supplier image loaded:', opportunity.supplierImageUrl || opportunity.image)}
                                        onError={(e) => {
                                          console.error('Supplier image failed:', opportunity.supplierImageUrl || opportunity.image);
                                          const target = e.currentTarget as HTMLImageElement;
                                          target.style.display = 'none';
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div 
                                      className="w-14 h-14 bg-gray-100 rounded border flex items-center justify-center"
                                      style={{ display: (opportunity.supplierImageUrl || opportunity.image) ? 'none' : 'flex' }}
                                    >
                                      <Package className="w-4 h-4 text-gray-400" />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Amazon Image */}
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500 text-center">Amazon</p>
                                  <div className="w-14 h-14 relative">
                                    {bestAsin?.imageUrl ? (
                                      <img 
                                        src={bestAsin.imageUrl} 
                                        alt={bestAsin.amazonTitle || 'Amazon Product'}
                                        className="w-14 h-14 object-contain rounded border bg-gray-50"
                                        onLoad={() => console.log('Amazon image loaded:', bestAsin.imageUrl)}
                                        onError={(e) => {
                                          console.error('Amazon image failed:', bestAsin.imageUrl);
                                          const target = e.currentTarget as HTMLImageElement;
                                          target.style.display = 'none';
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div 
                                      className="w-14 h-14 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400"
                                      style={{ display: bestAsin?.imageUrl ? 'none' : 'flex' }}
                                    >
                                      No image
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                                    {opportunity.productName}
                                  </h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <span>SKU: {opportunity.sku}</span>
                                    <span>UPC: {opportunity.upc}</span>
                                    <span>Supplier: {opportunity.supplierName}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">{opportunity.category}</Badge>
                                    {opportunity.strategicTags && opportunity.strategicTags.map(tag => (
                                      <Badge key={tag} className={`text-xs ${getStrategyTagColor(tag)}`}>
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedProduct(opportunity)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View Details
                                  </Button>
                                </div>
                              </div>

                              {/* ASIN Matches */}
                              <div className="mt-4 space-y-2">
                                <h4 className="font-medium text-sm text-gray-700">ASIN Matches ({opportunity.asinMatches ? opportunity.asinMatches.length : 0})</h4>
                                <div className="grid gap-2">
                                  {opportunity.asinMatches && opportunity.asinMatches.map((asin, asinIndex) => (
                                    <div key={asinIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
                                      <div className="flex items-center space-x-4">
                                        <div className="space-y-1">
                                          <div className="flex items-center space-x-2">
                                            <span className="font-mono text-sm font-medium">{asin.asin}</span>
                                            <Badge variant={asin.score >= 80 ? 'default' : asin.score >= 60 ? 'secondary' : 'outline'}>
                                              Score: {asin.score}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center space-x-4 text-xs text-gray-600">
                                            <span>Price: ${asin.price}</span>
                                            {asin.listPrice && <span>List: ${asin.listPrice}</span>}
                                            <span>Sellers: {asin.sellers}</span>
                                            <span>Buybox: {asin.buyboxHolder}</span>
                                            {asin.isBuyboxEligible && (
                                              <Badge variant="outline" className="text-green-600 border-green-600">
                                                Eligible
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => mapAsin(asin.asin, opportunity.sku)}
                                        >
                                          <MapPin className="h-3 w-3 mr-1" />
                                          Map ASIN
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open(`https://amazon.com/dp/${asin.asin}`, '_blank')}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          View Listing
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}  
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Market analysis by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averagePrice" fill="#3b82f6" name="Avg Price" />
                    <Bar dataKey="competitorCount" fill="#ef4444" name="Competitors" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Amazon Mapping Progress</CardTitle>
                <CardDescription>Product mapping and coverage analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {displayAnalytics ? Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100) : 0}%
                    </div>
                    <p className="text-sm text-gray-600">Products Mapped to Amazon</p>
                  </div>
                  <Progress 
                    value={displayAnalytics ? Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100) : 0} 
                    className="h-3"
                  />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{displayAnalytics?.amazonMappedProducts?.toLocaleString() || '0'}</div>
                      <div className="text-gray-600">Mapped</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-orange-600">
                        {displayAnalytics ? (displayAnalytics.totalProducts - displayAnalytics.amazonMappedProducts).toLocaleString() : '0'}
                      </div>
                      <div className="text-gray-600">Pending</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Trends by Category</CardTitle>
              <CardDescription>Price movements and competitive landscape analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayTrends.map((trend: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{trend.category}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Avg Price:</span> ${trend.averagePrice ? trend.averagePrice.toFixed(2) : '0.00'}
                        </div>
                        <div>
                          <span className="font-medium">Competitors:</span> {trend.competitorCount}
                        </div>
                        <div>
                          <span className="font-medium">Sales Rank:</span> {trend.salesRank ? trend.salesRank.toLocaleString() : 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Price Change:</span> 
                          <span className={trend.priceChange && trend.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {trend.priceChange !== undefined && trend.priceChange !== null ? 
                              `${trend.priceChange >= 0 ? '+' : ''}${trend.priceChange.toFixed(1)}%` : 
                              'N/A'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {trend.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500" />}
                      {trend.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                      {trend.trend === 'stable' && <div className="w-5 h-5 bg-gray-400 rounded-full" />}
                      <Badge variant={trend.trend === 'up' ? 'default' : trend.trend === 'down' ? 'destructive' : 'secondary'}>
                        {trend.trend}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-ASIN Processing Tab */}
        <TabsContent value="multi-asin" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ListTree className="h-5 w-5" />
                      Multi-ASIN Processing System
                    </CardTitle>
                    <CardDescription>
                      Products with multiple ASIN candidates - select optimal ASINs for best performance
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => batchProcessMutation.mutate(20)}
                    disabled={batchProcessMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {batchProcessMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Process Batch
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {multiAsinLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-gray-100 h-16 rounded"></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(multiAsinProducts?.products || []).map((product: any) => (
                      <div key={product.sku} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{product.product_name}</h3>
                            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                            {product.upc && (
                              <p className="text-sm text-muted-foreground">UPC: {product.upc}</p>
                            )}
                            {product.cost && (
                              <p className="text-sm font-medium">Cost: ${product.cost} | Price: ${product.price}</p>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant={product.asin_candidates.some((a: any) => a.isPrimary) ? "default" : "secondary"}>
                              {product.asin_candidates.length} Candidates
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              {product.asin_candidates.filter((a: any) => a.hasAmazonData).length} with data
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {product.asin_candidates.slice(0, 3).map((candidate: any, idx: number) => (
                            <div key={candidate.asin} className={`border rounded p-3 ${candidate.isPrimary ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant={candidate.isPrimary ? "default" : "outline"} className="text-xs">
                                  {candidate.isPrimary ? 'PRIMARY' : `RANK ${idx + 1}`}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  Score: {candidate.score?.toFixed(0) || 'N/A'}
                                </div>
                              </div>
                              
                              <div className="space-y-1 text-sm">
                                <p className="font-mono text-xs">{candidate.asin}</p>
                                {candidate.amazonTitle && (
                                  <p className="text-muted-foreground line-clamp-2">
                                    {candidate.amazonTitle}
                                  </p>
                                )}
                                {candidate.currentPrice && (
                                  <p className="font-semibold">${candidate.currentPrice}</p>
                                )}
                                {candidate.salesRank && (
                                  <p className="text-xs text-muted-foreground">
                                    Rank: #{candidate.salesRank.toLocaleString()}
                                  </p>
                                )}
                                {candidate.isBuyboxEligible && (
                                  <Badge variant="outline" className="text-xs">
                                    Buybox Eligible
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {product.asin_candidates.length > 3 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedProduct(product.sku)}
                            className="w-full"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View All {product.asin_candidates.length} Candidates
                          </Button>
                        )}
                      </div>
                    ))}
                    
                    {(!multiAsinProducts?.products || multiAsinProducts.products.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No products with multiple ASINs found</p>
                        <p className="text-sm">Import products to see multi-ASIN analysis</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Status */}
            {multiAsinProducts?.products && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {multiAsinProducts.products?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Products Found</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {multiAsinProducts.products?.filter((p: any) => 
                          p.asin_candidates.some((a: any) => a.isPrimary)
                        ).length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {multiAsinProducts.products?.reduce((sum: number, p: any) => 
                          sum + p.asin_candidates.length, 0
                        ) || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Candidates</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {multiAsinProducts.products?.reduce((sum: number, p: any) => 
                          sum + p.asin_candidates.filter((a: any) => a.hasAmazonData).length, 0
                        ) || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">With Amazon Data</div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Processing Progress</span>
                      <span>
                        {multiAsinProducts.products ? 
                          Math.round((multiAsinProducts.products.filter((p: any) => 
                            p.asin_candidates.some((a: any) => a.isPrimary)
                          ).length / multiAsinProducts.products.length) * 100) : 0
                        }%
                      </span>
                    </div>
                    <Progress 
                      value={multiAsinProducts.products ? 
                        (multiAsinProducts.products.filter((p: any) => 
                          p.asin_candidates.some((a: any) => a.isPrimary)
                        ).length / multiAsinProducts.products.length) * 100 : 0
                      } 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Status</CardTitle>
              <CardDescription>Amazon marketplace data synchronization status and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Sync Status</span>
                    <Badge variant={displayAnalytics?.syncStatus === 'active' ? 'default' : 'destructive'}>
                      {displayAnalytics?.syncStatus || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Last Sync</span>
                    <span className="text-sm text-gray-600">
                      {displayAnalytics?.lastSyncTime ? new Date(displayAnalytics.lastSyncTime).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Price History Entries</span>
                    <span className="font-mono">{displayAnalytics?.priceHistoryEntries?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Competitive Analysis</span>
                    <span className="font-mono">{displayAnalytics?.competitiveAnalysisCount?.toLocaleString() || '0'}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Products</span>
                    <span className="font-mono">{displayAnalytics?.totalProducts?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Amazon Mapped</span>
                    <span className="font-mono">{displayAnalytics?.amazonMappedProducts?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Market Intelligence</span>
                    <span className="font-mono">{displayAnalytics?.marketIntelligenceRecords?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Coverage Rate</span>
                    <span className="font-mono">
                      {displayAnalytics && displayAnalytics.totalProducts > 0 
                        ? Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100) 
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image-comparison" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Image Comparison for Listing</h3>
              <p className="text-sm text-gray-600">Compare Amazon authentic images with supplier and master catalog images for accurate product matching</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowImageComparison(!showImageComparison);
                if (!showImageComparison) {
                  // Force refresh of image data
                  refetch();
                }
              }}
              className="flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              {showImageComparison ? 'Hide Images' : 'Show Images'}
            </Button>
          </div>

          <div className="space-y-4">
            {imageOpportunitiesLoading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600 mt-2">Loading image comparison data...</p>
              </div>
            )}
            
            {opportunitiesData?.opportunities?.map((opportunity: ProductOpportunity, index: number) => {
              // Get the best ASIN match for comparison
              const bestAsin = opportunity.asinMatches?.reduce((best: AsinMatch, current: AsinMatch) => 
                (current.score > (best?.score || 0)) ? current : best
              ) || null;

              if (!bestAsin) return null;

              return (
                <ImageComparison
                  key={`${opportunity.sku}-${index}`}
                  amazonImage={bestAsin.imageUrl}
                  amazonTitle={bestAsin.amazonTitle}
                  amazonBrand={bestAsin.amazonBrand}
                  supplierImage={bestAsin.supplierImageUrl || opportunity.supplierImageUrl || opportunity.image}
                  masterCatalogImage={opportunity.masterImageUrl || opportunity.image}
                  productName={opportunity.productName}
                  sku={opportunity.sku}
                  asin={bestAsin.asin}
                  canList={bestAsin.canList !== false}
                  restrictionMessages={bestAsin.restrictionMessages || []}
                  onListingAction={(asin) => {
                    // Future: Handle listing creation
                    console.log('Create listing for ASIN:', asin);
                  }}
                />
              );
            })}
            
            {!imageOpportunitiesLoading && (!opportunitiesData?.opportunities || opportunitiesData.opportunities.length === 0) && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No products with Amazon matches found for image comparison.</p>
                    <p className="text-sm text-gray-500 mt-1">Products need Amazon ASIN mappings to display image comparisons.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-intelligence" className="space-y-6">
          {/* AI Intelligence Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Multi-ASIN Opportunities</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiIntelligence?.opportunities?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {aiIntelligence?.opportunities?.highScore || 0} high-score opportunities
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Supplier Performance</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{supplierPerformanceData?.summary?.totalSupplierAsins || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(supplierPerformanceData?.summary?.averageSuccessRate || 0)}% avg success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Profit Margin</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(supplierPerformanceData?.summary?.averageProfitMargin || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">Across all supplier ASINs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Status</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge variant={aiIntelligence?.aiStatus === 'active' ? 'default' : 'secondary'}>
                    {aiIntelligence?.aiStatus || 'Unknown'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last analyzed: {aiIntelligence?.lastAnalyzed ? new Date(aiIntelligence.lastAnalyzed).toLocaleDateString() : 'Never'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Multi-ASIN Opportunities Table */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-ASIN Opportunities</CardTitle>
              <CardDescription>
                Products with multiple ASIN possibilities and strategic recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {multiAsinLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading multi-ASIN opportunities...
                </div>
              ) : multiAsinData?.opportunities?.length ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Showing {multiAsinData.opportunities.length} opportunities 
                    (Generated: {new Date(multiAsinData.metadata.generatedAt).toLocaleString()})
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>ASINs Found</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Profit Analysis</TableHead>
                        <TableHead>Recommendations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {multiAsinData.opportunities.slice(0, 20).map((opportunity) => (
                        <TableRow key={opportunity.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{opportunity.upc}</div>
                              <div className="text-sm text-gray-600">{opportunity.manufacturerPartNumber}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline">{opportunity.discoveredAsins.length} ASINs</Badge>
                              <div className="text-xs text-gray-600">
                                Primary: {opportunity.primaryAsin}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              opportunity.strategyType === 'DOMINATE_ALL' ? 'default' :
                              opportunity.strategyType === 'SELECTIVE_TARGET' ? 'secondary' : 'outline'
                            }>
                              {opportunity.strategyType.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-lg font-bold">{opportunity.opportunityScore}</div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {opportunity.profitAnalysis.estimatedMargin}% margin
                              </div>
                              <div className="text-xs text-gray-600">
                                {opportunity.profitAnalysis.competitionLevel} competition
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant={
                                opportunity.supplierRecommendations.priorityLevel === 'HIGH' ? 'destructive' :
                                opportunity.supplierRecommendations.priorityLevel === 'MEDIUM' ? 'default' : 'secondary'
                              }>
                                {opportunity.supplierRecommendations.priorityLevel}
                              </Badge>
                              <div className="text-xs text-gray-600">
                                {opportunity.supplierRecommendations.recommendedAction}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Multi-ASIN Opportunities</h3>
                  <p className="text-gray-600">
                    Multi-ASIN opportunity analysis requires authentic Amazon SP-API data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Performance Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier Performance Analytics</CardTitle>
              <CardDescription>
                Performance metrics and negotiation opportunities by supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {supplierPerformanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading supplier performance data...
                </div>
              ) : supplierPerformanceData?.performance?.length ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Last updated: {new Date(supplierPerformanceData.summary.lastUpdated).toLocaleString()}
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>ASIN</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Profit Margin</TableHead>
                        <TableHead>Market Dominance</TableHead>
                        <TableHead>Negotiation Opportunities</TableHead>
                        <TableHead>Growth Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierPerformanceData.performance.slice(0, 15).map((perf) => (
                        <TableRow key={perf.id}>
                          <TableCell>
                            <div className="font-medium">Supplier #{perf.supplierId}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">{perf.asin}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={perf.successRate} className="w-16" />
                              <span className="text-sm font-medium">{Math.round(perf.successRate)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-lg font-bold text-green-600">
                              {Math.round(perf.avgProfitMargin)}%
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={perf.marketDominanceScore} className="w-16" />
                              <span className="text-sm">{Math.round(perf.marketDominanceScore)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {perf.negotiationOpportunities.volumeDiscount && (
                                <Badge variant="outline" className="text-xs">Volume</Badge>
                              )}
                              {perf.negotiationOpportunities.exclusivity && (
                                <Badge variant="outline" className="text-xs">Exclusivity</Badge>
                              )}
                              {perf.negotiationOpportunities.paymentTerms && (
                                <Badge variant="outline" className="text-xs">Payment</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {perf.performanceTrends.quarterlyGrowth > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm font-medium">
                                {Math.round(perf.performanceTrends.quarterlyGrowth)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Supplier Performance Data</h3>
                  <p className="text-gray-600">
                    Supplier performance analytics requires authentic Amazon marketplace data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Distribution Chart */}
          {aiIntelligence?.opportunities?.strategies?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Strategy Distribution</CardTitle>
                <CardDescription>
                  Distribution of recommended strategies across opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aiIntelligence.opportunities.strategies}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="strategy" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>{selectedProduct.productName}</span>
                <Badge variant="outline">{selectedProduct.sku}</Badge>
              </DialogTitle>
              <DialogDescription>
                Detailed Amazon marketplace analysis and ASIN mapping options
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Product Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Product Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">SKU:</span>
                        <span className="font-mono">{selectedProduct.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">UPC:</span>
                        <span className="font-mono">{selectedProduct.upc}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Category:</span>
                        <span>{selectedProduct.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Supplier:</span>
                        <span>{selectedProduct.supplierName}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Strategic Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.strategicTags && selectedProduct.strategicTags.map(tag => (
                        <Badge key={tag} className={getStrategyTagColor(tag)}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedProduct.image && (
                  <div className="flex justify-center">
                    <img 
                      src={selectedProduct.image} 
                      alt={selectedProduct.productName}
                      className="max-w-full h-auto max-h-64 object-contain rounded-lg border"
                    />
                  </div>
                )}
              </div>

              {/* ASIN Details */}
              <div className="space-y-4">
                <h3 className="font-semibold">Amazon ASIN Matches ({selectedProduct.asinMatches ? selectedProduct.asinMatches.length : 0})</h3>
                
                {selectedProduct.asinMatches && selectedProduct.asinMatches.map((asin, index) => (
                  <Card key={index} className="border">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ASIN Info */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-lg font-semibold">{asin.asin}</span>
                            <Badge variant={asin.score >= 80 ? 'default' : asin.score >= 60 ? 'secondary' : 'outline'}>
                              Score: {asin.score}
                            </Badge>
                          </div>

                          {/* Image Comparison Section */}
                          <div className="space-y-3">
                            <h5 className="font-medium text-sm">Image Comparison</h5>
                            <div className="grid grid-cols-2 gap-3">
                              {/* Amazon Image */}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-600">Amazon Image</div>
                                {asin.imageUrl ? (
                                  <div className="relative group">
                                    <img 
                                      src={asin.imageUrl} 
                                      alt={`Amazon ${asin.asin}`}
                                      className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(asin.imageUrl, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded flex items-center justify-center">
                                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-32 bg-gray-100 rounded border flex items-center justify-center">
                                    <span className="text-xs text-gray-500">No Amazon image</span>
                                  </div>
                                )}
                                {asin.amazonTitle && (
                                  <div className="text-xs text-gray-600 line-clamp-2">{asin.amazonTitle}</div>
                                )}
                              </div>

                              {/* Supplier Image */}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-600">Supplier Image</div>
                                {selectedProduct.supplierImageUrl || selectedProduct.image ? (
                                  <div className="relative group">
                                    <img 
                                      src={selectedProduct.supplierImageUrl || selectedProduct.image} 
                                      alt={`Supplier ${selectedProduct.sku}`}
                                      className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(selectedProduct.supplierImageUrl || selectedProduct.image, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded flex items-center justify-center">
                                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-32 bg-gray-100 rounded border flex items-center justify-center">
                                    <span className="text-xs text-gray-500">No supplier image</span>
                                  </div>
                                )}
                                <div className="text-xs text-gray-600 line-clamp-2">{selectedProduct.productName}</div>
                              </div>
                            </div>

                            {/* Listing Restrictions */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Listing Status</span>
                                <div className="flex items-center space-x-1">
                                  {asin.canList !== false ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  )}
                                  <Badge variant={asin.canList !== false ? 'default' : 'destructive'} className="text-xs">
                                    {asin.canList !== false ? 'Can List' : 'Restricted'}
                                  </Badge>
                                </div>
                              </div>
                              {asin.restrictionMessages && asin.restrictionMessages.length > 0 && (
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                  {asin.restrictionMessages.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Current Price:</span>
                              <div className="text-lg font-semibold text-green-600">${asin.price}</div>
                            </div>
                            {asin.listPrice && (
                              <div>
                                <span className="font-medium">List Price:</span>
                                <div className="text-lg font-semibold text-gray-600">${asin.listPrice}</div>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Sellers:</span>
                              <div className="text-lg font-semibold">{asin.sellers}</div>
                            </div>
                            <div>
                              <span className="font-medium">Buybox Holder:</span>
                              <div className="font-semibold">{asin.buyboxHolder}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Badge variant={asin.isBuyboxEligible ? 'default' : 'outline'}>
                              {asin.isBuyboxEligible ? 'Buybox Eligible' : 'Not Eligible'}
                            </Badge>
                            <Badge variant="outline">{asin.condition}</Badge>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => mapAsin(asin.asin, selectedProduct.sku)}
                              className="flex-1"
                            >
                              <MapPin className="h-4 w-4 mr-1" />
                              Map ASIN
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://amazon.com/dp/${asin.asin}`, '_blank')}
                              className="flex-1"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Listing
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(asin.asin);
                                toast({
                                  description: `ASIN ${asin.asin} copied to clipboard`
                                });
                              }}
                              className="flex-1"
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Copy ASIN
                            </Button>
                          </div>
                        </div>

                        {/* Price History Chart */}
                        <div className="space-y-3">
                          <h4 className="font-medium">30-Day Price History</h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={asin.priceHistory}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                              <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                              <Tooltip 
                                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                formatter={(value) => [`$${value}`, 'Price']}
                              />
                              <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}