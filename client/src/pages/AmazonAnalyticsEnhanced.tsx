import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter,
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
  AlertTriangle
} from "lucide-react";

interface ProductOpportunity {
  sku: string;
  productName: string;
  upc: string;
  category: string;
  supplierName: string;
  asinMatches: AsinMatch[];
  image?: string;
  strategicTags: string[];
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

  // Data fetching
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AmazonAnalytics>({
    queryKey: ['/api/marketplace/analytics/overview']
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<MarketTrend[]>({
    queryKey: ['/api/marketplace/analytics/trends']
  });

  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery<{opportunities: ProductOpportunity[]}>({
    queryKey: ['/api/marketplace/analytics/opportunities']
  });

  // Safe data handling with null checks
  const safeOpportunities = opportunities?.opportunities || [];
  const safeTrends = trends || [];

  const { data: syncStatus } = useQuery({
    queryKey: ['/api/marketplace/sync/status']
  });

  // Sample data for enhanced UI demonstration
  const sampleAnalytics: AmazonAnalytics = {
    totalProducts: 1247,
    amazonMappedProducts: 892,
    competitiveAnalysisCount: 756,
    priceHistoryEntries: 12450,
    marketIntelligenceRecords: 8934,
    lastSyncTime: new Date().toISOString(),
    syncStatus: 'active'
  };

  const sampleOpportunities: ProductOpportunity[] = [
    {
      sku: "139229",
      productName: "Philips LED Bulb A19 60W Daylight",
      upc: "791659060018",
      category: "Bulbs",
      supplierName: "CWR",
      image: "https://images-na.ssl-images-amazon.com/images/I/61ZjlKoOpvL._AC_SL1500_.jpg",
      strategicTags: ["Growth ASIN", "Low Competition"],
      asinMatches: [
        {
          asin: "B09XY123AB",
          score: 85,
          price: 27.99,
          listPrice: 32.99,
          sellers: 4,
          buyboxHolder: "Amazon",
          isBuyboxEligible: true,
          condition: "New",
          priceHistory: [
            { date: "2024-06-01", price: 29.99 },
            { date: "2024-06-08", price: 28.99 },
            { date: "2024-06-15", price: 27.99 }
          ]
        },
        {
          asin: "B08ZY456CD",
          score: 72,
          price: 24.99,
          listPrice: 29.99,
          sellers: 8,
          buyboxHolder: "Third Party",
          isBuyboxEligible: false,
          condition: "New",
          priceHistory: [
            { date: "2024-06-01", price: 26.99 },
            { date: "2024-06-08", price: 25.99 },
            { date: "2024-06-15", price: 24.99 }
          ]
        }
      ]
    },
    {
      sku: "248901",
      productName: "Marine Safety Flare Kit Emergency",
      upc: "889542001234",
      category: "Safety Equipment",
      supplierName: "CWR",
      image: "https://images-na.ssl-images-amazon.com/images/I/71ABC123DEF._AC_SL1500_.jpg",
      strategicTags: ["Defensive ASIN", "Underpriced"],
      asinMatches: [
        {
          asin: "B07ABC789EF",
          score: 91,
          price: 89.99,
          listPrice: 109.99,
          sellers: 3,
          buyboxHolder: "Amazon",
          isBuyboxEligible: true,
          condition: "New",
          priceHistory: [
            { date: "2024-06-01", price: 94.99 },
            { date: "2024-06-08", price: 92.99 },
            { date: "2024-06-15", price: 89.99 }
          ]
        }
      ]
    }
  ];

  const sampleTrends: MarketTrend[] = [
    { category: "Bulbs", averagePrice: 24.67, competitorCount: 12, salesRank: 8450, trend: 'up', priceChange: 5.2 },
    { category: "Safety Equipment", averagePrice: 89.34, competitorCount: 8, salesRank: 12300, trend: 'stable', priceChange: 0.8 },
    { category: "Marine Electronics", averagePrice: 567.89, competitorCount: 15, salesRank: 5600, trend: 'down', priceChange: -12.3 }
  ];

  const displayAnalytics = analytics || sampleAnalytics;
  const displayTrends = trends || sampleTrends;
  const displayOpportunities = opportunities?.opportunities || sampleOpportunities;

  // Enhanced filtering and sorting
  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = displayOpportunities.filter(opportunity => {
      const matchesSearch = searchTerm === "" || 
        opportunity.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.upc.includes(searchTerm) ||
        opportunity.asinMatches.some(asin => asin.asin.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === "all" || opportunity.category === selectedCategory;
      const matchesSupplier = selectedSupplier === "all" || opportunity.supplierName === selectedSupplier;
      
      const maxScore = opportunity.asinMatches.length > 0 ? Math.max(...opportunity.asinMatches.map(a => a.score)) : 0;
      const matchesScore = maxScore >= scoreRange[0] && maxScore <= scoreRange[1];
      
      const hasBuyboxEligible = opportunity.asinMatches.some(a => a.isBuyboxEligible);
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
          aValue = a.asinMatches.length > 0 ? Math.max(...a.asinMatches.map(asin => asin.score)) : 0;
          bValue = b.asinMatches.length > 0 ? Math.max(...b.asinMatches.map(asin => asin.score)) : 0;
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
          aValue = a.asinMatches.length > 0 ? Math.min(...a.asinMatches.map(asin => asin.price)) : 0;
          bValue = b.asinMatches.length > 0 ? Math.min(...b.asinMatches.map(asin => asin.price)) : 0;
          break;
        case "sellers":
          aValue = a.asinMatches.length > 0 ? Math.min(...a.asinMatches.map(asin => asin.sellers)) : 0;
          bValue = b.asinMatches.length > 0 ? Math.min(...b.asinMatches.map(asin => asin.sellers)) : 0;
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

  const categories = Array.from(new Set(displayOpportunities.map(o => o.category)));
  const suppliers = Array.from(new Set(displayOpportunities.map(o => o.supplierName)));

  const getStrategyTagColor = (tag: string) => {
    switch (tag) {
      case "Growth ASIN": return "bg-green-100 text-green-800";
      case "Defensive ASIN": return "bg-blue-100 text-blue-800";
      case "Underpriced": return "bg-orange-100 text-orange-800";
      case "Low Competition": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Amazon Marketplace Analytics</h1>
          <p className="text-gray-600 mt-2">Enhanced competitive intelligence and product evaluation</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={displayAnalytics.syncStatus === 'active' ? 'default' : 'destructive'}>
            {displayAnalytics.syncStatus === 'active' ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Sync Active
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sync Error
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
            <div className="text-2xl font-bold">{displayAnalytics.totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">In database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amazon Mapped</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics.amazonMappedProducts.toLocaleString()}</div>
            <div className="flex items-center space-x-2 mt-1">
              <Progress value={Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100)} className="flex-1" />
              <span className="text-sm font-medium">{Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Intelligence</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics.marketIntelligenceRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Records analyzed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price History</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayAnalytics.priceHistoryEntries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Historical data points</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
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
                    {filteredAndSortedOpportunities.map((opportunity, index) => (
                      <Card key={index} className="border border-gray-200 hover:border-gray-300 transition-colors">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            {/* Product Image */}
                            {opportunity.image && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={opportunity.image} 
                                  alt={opportunity.productName}
                                  className="w-16 h-16 object-cover rounded-md border"
                                />
                              </div>
                            )}

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
                                    {opportunity.strategicTags.map(tag => (
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
                                <h4 className="font-medium text-sm text-gray-700">ASIN Matches ({opportunity.asinMatches.length})</h4>
                                <div className="grid gap-2">
                                  {opportunity.asinMatches.map((asin, asinIndex) => (
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
                    ))}
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
                      {Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100)}%
                    </div>
                    <p className="text-sm text-gray-600">Products Mapped to Amazon</p>
                  </div>
                  <Progress 
                    value={Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100)} 
                    className="h-3"
                  />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{displayAnalytics.amazonMappedProducts.toLocaleString()}</div>
                      <div className="text-gray-600">Mapped</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-orange-600">
                        {(displayAnalytics.totalProducts - displayAnalytics.amazonMappedProducts).toLocaleString()}
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
                    <Badge variant={displayAnalytics.syncStatus === 'active' ? 'default' : 'destructive'}>
                      {displayAnalytics.syncStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Last Sync</span>
                    <span className="text-sm text-gray-600">
                      {new Date(displayAnalytics.lastSyncTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Price History Entries</span>
                    <span className="font-mono">{displayAnalytics.priceHistoryEntries.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Competitive Analysis</span>
                    <span className="font-mono">{displayAnalytics.competitiveAnalysisCount.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Products</span>
                    <span className="font-mono">{displayAnalytics.totalProducts.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Amazon Mapped</span>
                    <span className="font-mono">{displayAnalytics.amazonMappedProducts.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Market Intelligence</span>
                    <span className="font-mono">{displayAnalytics.marketIntelligenceRecords.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Coverage Rate</span>
                    <span className="font-mono">
                      {Math.round((displayAnalytics.amazonMappedProducts / displayAnalytics.totalProducts) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                      {selectedProduct.strategicTags.map(tag => (
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
                <h3 className="font-semibold">Amazon ASIN Matches ({selectedProduct.asinMatches.length})</h3>
                
                {selectedProduct.asinMatches.map((asin, index) => (
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