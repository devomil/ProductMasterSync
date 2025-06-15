import { useState } from "react";
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  ShoppingCart, 
  Eye, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  BarChart3, 
  RefreshCw,
  Target,
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";

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
}

interface PricingOpportunity {
  asin: string;
  productName: string;
  currentPrice: number;
  competitorPrice: number;
  potentialSavings: number;
  opportunityScore: number;
  category: string;
  salesRank: number;
  amazonCommission: number;
  listingRestrictions: string[];
  ourCost: number;
  shippingCost: number;
  profitMargin: number;
  sku: string;
  upc: string;
}

function ListingRestrictionsDisplay({ asin, productCategory }: { asin: string; productCategory?: string }) {
  const { toast } = useToast();
  const { data: restrictionsData, isLoading, error } = useQuery({
    queryKey: [`/api/marketplace/restrictions/${asin}`],
    enabled: !!asin,
    retry: false,
    staleTime: 5 * 60 * 1000
  });

  if (isLoading) {
    return <div className="flex items-center space-x-2">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      <span className="text-sm text-gray-500">Checking restrictions...</span>
    </div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Unable to check restrictions</div>;
  }

  const restrictions = restrictionsData || {};
  const canList = restrictions.canList !== false;
  const isSimulated = restrictions.isSimulated;
  
  if (canList && !isSimulated) {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-sm font-medium">Can List on Amazon</span>
      </div>
    );
  }

  const reasonCodes = restrictions.reasonCodes || [];
  if (reasonCodes.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Listing Restricted</span>
        </div>
        <div className="text-xs text-gray-600">
          Restrictions: {reasonCodes.join(', ')}
        </div>
      </div>
    );
  }

  const messages = restrictions.messages || [];
  if (messages.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-yellow-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Review Required</span>
        </div>
        <div className="text-xs text-gray-600">
          {messages.join(', ')}
        </div>
      </div>
    );
  }

  if (isSimulated) {
    return (
      <div className="flex items-center space-x-2 text-blue-600">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span className="text-sm">Simulated Response</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-gray-500">
      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
      <span className="text-sm">Status Unknown</span>
    </div>
  );
}

function ProductCard({ productGroup, onViewDetails }: { 
  productGroup: any; 
  onViewDetails: (opportunity: any) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bestScore = Math.max(...productGroup.asins.map((a: any) => a.opportunityScore));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-lg">{productGroup.productName}</h3>
              <Badge variant="outline">{productGroup.category}</Badge>
              <Badge 
                variant={bestScore >= 90 ? 'default' : bestScore >= 70 ? 'secondary' : 'outline'}
              >
                Score: {bestScore}
              </Badge>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
              <div>
                <span className="font-medium">ASIN:</span> {productGroup.asins.length} Found
              </div>
              <div>
                <span className="font-medium">MPN:</span> {productGroup.sku.split('-')[1] || 'N/A'}
              </div>
              <div>
                <span className="font-medium">SKU:</span> {productGroup.sku}
              </div>
              <div>
                <span className="font-medium">UPC:</span> {productGroup.upc || 'Retrieved from Amazon'}
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Hide ASINs</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show {productGroup.asins.length} ASINs</span>
                  </>
                )}
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-4 border-t pt-4">
                {productGroup.asins.map((opportunity: any, asinIndex: number) => (
                  <div key={asinIndex} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{opportunity.productName}</h4>
                        <Badge variant="outline">{opportunity.category}</Badge>
                        <Badge 
                          variant={opportunity.opportunityScore >= 90 ? 'default' : opportunity.opportunityScore >= 70 ? 'secondary' : 'outline'}
                        >
                          Score: {opportunity.opportunityScore}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                      <div>ASIN: {opportunity.asin}</div>
                      <div>SKU: {opportunity.sku}</div>
                      <div>MPN: {opportunity.manufacturerPartNumber || 'From ASIN data'}</div>
                      <div>UPC: {opportunity.upc || 'Retrieved from Amazon'}</div>
                      <div>Sales Rank: #{opportunity.salesRank?.toLocaleString()}</div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Buy Box Price</p>
                        <p className="text-lg font-bold text-blue-600">
                          ${opportunity.amazon_buy_box_price ? parseFloat(opportunity.amazon_buy_box_price).toFixed(2) : parseFloat(opportunity.currentPrice).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Lowest Price</p>
                        <p className="text-lg font-bold text-orange-600">
                          ${opportunity.amazon_lowest_price ? parseFloat(opportunity.amazon_lowest_price).toFixed(2) : (parseFloat(opportunity.currentPrice) * 0.9).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Our Cost</p>
                        <p className="text-lg font-bold text-gray-700">${parseFloat(opportunity.ourCost || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Profit Margin</p>
                        <p className="text-lg font-bold text-green-600">{parseFloat(opportunity.profitMargin || 0).toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Offer Count</p>
                        <p className="text-sm text-gray-700">{opportunity.amazon_offer_count || 0} sellers</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fulfillment</p>
                        <p className="text-sm text-gray-700">{opportunity.amazon_fulfillment_channel || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Net Profit</p>
                        <p className="text-sm font-bold text-blue-600">${parseFloat(opportunity.netProfit || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Listing Restrictions */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Listing Status</p>
                      {opportunity.listing_restrictions && Object.keys(opportunity.listing_restrictions).length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <Badge variant="destructive">Restricted</Badge>
                          </div>
                          {Object.entries(opportunity.listing_restrictions).map(([type, message]: [string, any], idx: number) => (
                            <p key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              <strong>{type}:</strong> {message}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <Badge variant="secondary" className="bg-green-100 text-green-700">Can List</Badge>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Shipping Cost</p>
                        <p className="text-sm text-gray-700">${parseFloat(opportunity.shippingCost || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Amazon Commission</p>
                        <p className="text-sm text-gray-700">{parseFloat(opportunity.amazonCommission || 0).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Net Profit</p>
                        <p className="text-sm font-bold text-blue-600">${parseFloat(opportunity.netProfit || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {opportunity.listingRestrictions && opportunity.listingRestrictions.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">Listing Restrictions</p>
                        <div className="flex flex-wrap gap-1">
                          {opportunity.listingRestrictions.map((restriction: string, idx: number) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {restriction}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onViewDetails(opportunity)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => window.open(`https://amazon.com/dp/${opportunity.asin}`, '_blank')}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        View on Amazon
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AmazonAnalytics() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState<PricingOpportunity | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Fetch analytics overview
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/marketplace/analytics/overview']
  });

  // Fetch market trends
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/marketplace/analytics/trends']
  });

  // Fetch opportunities
  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['/api/marketplace/analytics/opportunities']
  });

  // Fetch sync status
  const { data: syncStatus } = useQuery({
    queryKey: ['/api/marketplace/sync/status']
  });

  const sampleAnalytics: AmazonAnalytics = {
    totalProducts: 53,
    amazonMappedProducts: 12,
    competitiveAnalysisCount: 45,
    priceHistoryEntries: 1250,
    marketIntelligenceRecords: 850,
    lastSyncTime: new Date().toISOString(),
    syncStatus: 'active'
  };

  const displayAnalytics = analytics || sampleAnalytics;
  const displayOpportunities = opportunities?.opportunities || [];

  // Filter opportunities based on search and category
  const filteredOpportunities = displayOpportunities.filter((opportunity: any) => {
    const matchesSearch = searchTerm === "" || 
      opportunity.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opportunity.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opportunity.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || opportunity.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(displayOpportunities.map((o: any) => o.category))];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Amazon Marketplace Analytics</h1>
          <p className="text-gray-600 mt-2">Competitive intelligence and pricing opportunities</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="px-3 py-1">
            {displayAnalytics.amazonMappedProducts} Products Mapped
          </Badge>
          <Badge variant={displayAnalytics.syncStatus === 'active' ? 'default' : 'secondary'}>
            Sync {displayAnalytics.syncStatus}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="database">Database Status</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-6">
          {/* Search and Filter Controls */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by product name, ASIN, or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Opportunities List */}
          {opportunitiesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading opportunities...</p>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <Target className="w-12 h-12 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">No opportunities found</h3>
                <p className="text-gray-600 max-w-md">
                  Start Amazon sync to discover pricing opportunities and competitive insights.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/marketplace/sync/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ limit: 10 })
                      });
                      const result = await response.json();
                      if (result.success) {
                        toast({
                          title: "Sync Started",
                          description: "Amazon marketplace sync initiated successfully"
                        });
                      } else {
                        toast({
                          title: "Sync Failed", 
                          description: result.message || "Amazon SP-API credentials may be missing",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      toast({
                        title: "Sync Error",
                        description: "Failed to start Amazon sync",
                        variant: "destructive"
                      });
                    }
                  }}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Start Amazon Sync (10 Products)
                </Button>
                {syncStatus && !syncStatus.amazonConfigured && (
                  <div className="text-sm text-red-600 flex items-center justify-center mt-2">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Amazon SP-API credentials required for sync
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const groupedOpportunities = filteredOpportunities.reduce((acc: any, opportunity: any) => {
                  const key = opportunity.productName + '_' + opportunity.sku;
                  if (!acc[key]) {
                    acc[key] = {
                      productName: opportunity.productName,
                      sku: opportunity.sku,
                      upc: opportunity.upc,
                      category: opportunity.category,
                      asins: []
                    };
                  }
                  acc[key].asins.push(opportunity);
                  return acc;
                }, {});

                return Object.values(groupedOpportunities).map((productGroup: any, index: number) => (
                  <ProductCard key={index} productGroup={productGroup} onViewDetails={setSelectedOpportunity} />
                ));
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold">{displayAnalytics.totalProducts}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Amazon Mapped</p>
                    <p className="text-2xl font-bold">{displayAnalytics.amazonMappedProducts}</p>
                  </div>
                  <Target className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Competitive Analysis</p>
                    <p className="text-2xl font-bold">{displayAnalytics.competitiveAnalysisCount}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Market Intelligence</p>
                    <p className="text-2xl font-bold">{displayAnalytics.marketIntelligenceRecords}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Trends Analysis</CardTitle>
              <CardDescription>
                Category performance and pricing trends across Amazon marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averagePrice" fill="#3b82f6" name="Average Price" />
                    <Bar dataKey="competitorCount" fill="#ef4444" name="Competitors" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Status</CardTitle>
              <CardDescription>
                Amazon marketplace data synchronization status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Last Sync</span>
                  <span className="font-mono text-sm">
                    {new Date(displayAnalytics.lastSyncTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sync Status</span>
                  <Badge variant={displayAnalytics.syncStatus === 'active' ? 'default' : 'secondary'}>
                    {displayAnalytics.syncStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Price History Entries</span>
                  <span>{displayAnalytics.priceHistoryEntries.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}