import { useState } from 'react';
import { WalmartBatchSync } from '@/components/marketplace/WalmartBatchSync';
import { WalmartScheduler } from '@/components/marketplace/WalmartScheduler';
import { WalmartSyncStats } from '@/components/marketplace/WalmartSyncStats';
import { WalmartSyncProgress } from '@/components/marketplace/WalmartSyncProgress';
import { WalmartSyncJobHistory } from '@/components/marketplace/WalmartSyncJobHistory';
import { useRecentWalmartSyncLogs } from '@/hooks/useWalmartMarketData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Download, ExternalLink, HelpCircle, RefreshCw, Settings, Upload, Check as CheckIcon, TrendingUp, DollarSign, BarChart3, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';

// Helper function to remove EDC prefix from SKU
const removeEdcPrefix = (sku: string): string => {
  if (!sku) return '';
  return sku.replace(/^EDC/i, '');
};

export default function WalmartIntegration() {
  const { data: products, isLoading: isProductsLoading } = useQuery<{ products: any[]; pagination: { totalItems: number } }>({
    queryKey: ['/api/products?limit=100'],
  });

  // Products with Walmart mappings for UPC Coverage display
  const { data: productsWithMappings, isLoading: isProductsWithMappingsLoading, refetch: refetchProductsWithMappings } = useQuery<{
    products: Array<{
      id: number;
      sku: string;
      name: string;
      upc: string;
      walmartItemId: string | null;
      mappingSource: string | null;
      lastSync: string | null;
      walmartItemName: string | null;
      walmartPrice: number | null;
    }>;
    totalWithUpc: number;
    totalMapped: number;
  }>({
    queryKey: ['/api/marketplace/walmart/products-with-mappings?limit=20'],
  });

  const { data: configStatus } = useQuery<{ configValid: boolean; missingEnvVars: string[] }>({
    queryKey: ['/api/marketplace/walmart/config-status'],
  });

  const { data: walmartStats, isLoading: isWalmartStatsLoading } = useQuery<{ 
    walmartMatches: number;
    productsWithUpc: number;
    totalProducts: number;
    upcCoverage: number;
  }>({
    queryKey: ['/api/marketplace/walmart/statistics'],
  });

  const { data: syncLogs, isLoading: isSyncLogsLoading } = useRecentWalmartSyncLogs(25);

  const queryClient = useQueryClient();

  // Pricing Insights Query
  const { data: pricingDashboard, isLoading: isPricingDashboardLoading, refetch: refetchPricingDashboard } = useQuery<{
    stats: {
      totalItems: number;
      inDemandCount: number;
      priceCompetitiveCount: number;
      highTrafficCount: number;
      mediumTrafficCount: number;
      lowTrafficCount: number;
      totalGmv30: number;
      totalPotentialGmvLift: number;
      avgPriceCompetitiveScore: number;
      lastSyncAt: string | null;
    };
    topOpportunities: Array<{
      sku: string;
      itemName: string;
      currentPrice: number;
      buyBoxTotalPrice: number;
      inDemand: boolean;
      traffic: string;
      gmv30: number;
      potentialGmvLift: number;
      priceCompetitiveScore: number;
    }>;
  }>({
    queryKey: ['/api/marketplace/walmart/pricing-insights/dashboard'],
  });

  // Sync Pricing Insights Mutation
  const syncPricingInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/walmart/pricing-insights/sync', { maxPages: 50 });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/walmart/pricing-insights/dashboard'] });
      console.log('[Pricing Insights] Sync completed:', data);
    },
    onError: (error: any) => {
      console.error('[Pricing Insights] Sync failed:', error);
    }
  });

  const [activeTab, setActiveTab] = useState('overview');

  // Get metrics from statistics endpoint
  const totalProducts = walmartStats?.totalProducts || 0;
  const productsWithWalmartMappings = walmartStats?.walmartMatches || 0;
  const productsWithUpc = walmartStats?.productsWithUpc || 0;
  const upcCoverage = walmartStats?.upcCoverage || 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Walmart Marketplace Integration</h1>
          <p className="text-muted-foreground">
            Connect your product catalog with Walmart's Marketplace API
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={() => setActiveTab('sync')}
          data-testid="button-settings"
        >
          <Settings className="mr-2 h-4 w-4" />
          API Settings
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing-insights">Pricing Insights</TabsTrigger>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Products
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-products">
                  {isWalmartStatsLoading ? "Loading..." : totalProducts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products in your catalog
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Walmart Matches
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-walmart-matches">
                  {isWalmartStatsLoading ? "..." : productsWithWalmartMappings}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products matched with Walmart
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Data Coverage
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-upc-coverage">
                  {isWalmartStatsLoading ? "..." : `${upcCoverage}%`}
                </div>
                <p className="text-xs text-muted-foreground">
                  UPC coverage in catalog
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Complete these steps to set up Walmart Marketplace integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Enable Walmart Integration</h3>
                      <p className="text-sm text-muted-foreground">
                        Integration module is active and ready to use.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      configStatus?.configValid 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {configStatus?.configValid ? (
                        <CheckIcon className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">Configure Walmart API Credentials</h3>
                      <p className="text-sm text-muted-foreground">
                        {configStatus?.configValid 
                          ? 'Walmart API credentials are configured and ready.'
                          : 'Set up your Walmart Marketplace API credentials.'}
                      </p>
                      {!configStatus?.configValid && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-blue-600" onClick={() => setActiveTab('sync')}>
                          Configure Now →
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Run Initial Data Sync</h3>
                      <p className="text-sm text-muted-foreground">
                        Sync your products with Walmart catalog data.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Schedule Regular Updates</h3>
                      <p className="text-sm text-muted-foreground">
                        Set up automatic sync schedule for marketplace data.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
                <CardDescription>
                  Helpful resources for working with Walmart Marketplace API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Walmart Marketplace API Documentation</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Official documentation for the Walmart Marketplace API.
                      </p>
                      <a 
                        href="https://developer.walmart.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 flex items-center"
                      >
                        View Documentation <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <Upload className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Create UPC Batch Import</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Import UPC codes for your products in bulk.
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600"
                      >
                        Create Import
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <Download className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Export Walmart Data</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Export all Walmart marketplace data to CSV.
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600"
                      >
                        Export Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Pricing Insights Tab */}
        <TabsContent value="pricing-insights" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Walmart Pricing Intelligence</h2>
              <p className="text-sm text-muted-foreground">
                Competitive pricing data, demand signals, and market opportunities from Walmart
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetchPricingDashboard()}
                disabled={isPricingDashboardLoading}
                data-testid="button-refresh-pricing"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isPricingDashboardLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => syncPricingInsightsMutation.mutate()}
                disabled={syncPricingInsightsMutation.isPending}
                data-testid="button-sync-pricing"
              >
                {syncPricingInsightsMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Sync Pricing Data
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pricing-total">
                  {isPricingDashboardLoading ? '...' : (pricingDashboard?.stats?.totalItems || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Items with pricing insights
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Demand</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-in-demand">
                  {isPricingDashboardLoading ? '...' : (pricingDashboard?.stats?.inDemandCount || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  High demand products
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price Competitive</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-price-competitive">
                  {isPricingDashboardLoading ? '...' : (pricingDashboard?.stats?.priceCompetitiveCount || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Competitively priced items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">30-Day GMV</CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="text-gmv30">
                  ${isPricingDashboardLoading ? '...' : ((pricingDashboard?.stats?.totalGmv30 || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total gross merchandise value
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Traffic Distribution and Competitiveness */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Traffic Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-600 font-medium">High Traffic</span>
                    <span>{pricingDashboard?.stats?.highTrafficCount || 0}</span>
                  </div>
                  <Progress 
                    value={pricingDashboard?.stats?.totalItems ? 
                      (pricingDashboard.stats.highTrafficCount / pricingDashboard.stats.totalItems) * 100 : 0} 
                    className="h-2 bg-green-100"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-yellow-600 font-medium">Medium Traffic</span>
                    <span>{pricingDashboard?.stats?.mediumTrafficCount || 0}</span>
                  </div>
                  <Progress 
                    value={pricingDashboard?.stats?.totalItems ? 
                      (pricingDashboard.stats.mediumTrafficCount / pricingDashboard.stats.totalItems) * 100 : 0} 
                    className="h-2 bg-yellow-100"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 font-medium">Low Traffic</span>
                    <span>{pricingDashboard?.stats?.lowTrafficCount || 0}</span>
                  </div>
                  <Progress 
                    value={pricingDashboard?.stats?.totalItems ? 
                      (pricingDashboard.stats.lowTrafficCount / pricingDashboard.stats.totalItems) * 100 : 0} 
                    className="h-2 bg-gray-100"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Price Competitiveness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {pricingDashboard?.stats?.avgPriceCompetitiveScore?.toFixed(1) || '0'}
                    </div>
                    <p className="text-sm text-muted-foreground">Average Score (0-100)</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Potential GMV Lift: <span className="font-medium text-green-600">
                      ${((pricingDashboard?.stats?.totalPotentialGmvLift || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
                {pricingDashboard?.stats?.lastSyncAt && (
                  <div className="text-center text-xs text-muted-foreground">
                    Last synced: {new Date(pricingDashboard.stats.lastSyncAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Opportunities Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Demand Opportunities</CardTitle>
              <CardDescription>
                High-demand products with strong market potential
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Buy Box</TableHead>
                    <TableHead>Demand</TableHead>
                    <TableHead>Traffic</TableHead>
                    <TableHead className="text-right">30-Day GMV</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPricingDashboardLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading pricing insights...
                      </TableCell>
                    </TableRow>
                  ) : pricingDashboard?.topOpportunities && pricingDashboard.topOpportunities.length > 0 ? (
                    pricingDashboard.topOpportunities.map((item, index) => (
                      <TableRow key={item.sku || index}>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.itemName || '-'}</TableCell>
                        <TableCell className="text-right">
                          ${((item.currentPrice || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${((item.buyBoxTotalPrice || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.inDemand ? (
                            <Badge variant="default" className="bg-green-500">In Demand</Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.traffic === 'High' ? 'default' : item.traffic === 'Medium' ? 'secondary' : 'outline'}
                            className={item.traffic === 'High' ? 'bg-green-500' : ''}
                          >
                            {item.traffic || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${((item.gmv30 || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <div 
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                (item.priceCompetitiveScore || 0) >= 70 ? 'bg-green-500' :
                                (item.priceCompetitiveScore || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            >
                              {item.priceCompetitiveScore || 0}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">
                        No pricing insights available. Click "Sync Pricing Data" to fetch data from Walmart.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sync" className="space-y-4">
          <WalmartSyncProgress />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WalmartBatchSync />
            <WalmartScheduler />
            
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>UPC Coverage</CardTitle>
                  <CardDescription>
                    Products with UPC codes and their Walmart mappings
                    {productsWithMappings && (
                      <span className="ml-2 text-sm">
                        ({productsWithMappings.totalMapped} of {productsWithMappings.totalWithUpc} mapped)
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchProductsWithMappings()}
                  data-testid="button-refresh-upc-coverage"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EDC</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>UPC</TableHead>
                      <TableHead>Walmart Item ID</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isProductsWithMappingsLoading && productsWithMappings?.products ? (
                      productsWithMappings.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{removeEdcPrefix(product.sku)}</TableCell>
                          <TableCell className="max-w-xs truncate">{product.name}</TableCell>
                          <TableCell className="font-mono text-xs">{product.upc || '-'}</TableCell>
                          <TableCell>
                            {product.walmartItemId ? (
                              <span 
                                className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
                              >
                                {product.walmartItemId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {product.lastSync ? new Date(product.lastSync).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" disabled={!product.upc} data-testid={`button-sync-${product.id}`}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sync
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          {isProductsWithMappingsLoading ? 'Loading products...' : 'No products with UPC codes found.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          <WalmartSyncStats />
          
          <WalmartSyncJobHistory />
          
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>
                Recent Walmart data sync operations (last 25)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead>Walmart Item ID</TableHead>
                    <TableHead>Response Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isSyncLogsLoading && syncLogs && syncLogs.length > 0 ? (
                    syncLogs.map((log: any) => (
                      <TableRow key={log.id} data-testid={`row-sync-log-${log.id}`}>
                        <TableCell className="text-sm">
                          {new Date(log.syncStartedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{log.productName || 'Unknown'}</span>
                            {log.productSku && (
                              <span className="text-xs text-muted-foreground">
                                {removeEdcPrefix(log.productSku)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.result === 'success' ? 'default' :
                              log.result === 'not_found' ? 'secondary' :
                              log.result === 'rate_limited' ? 'outline' :
                              'destructive'
                            }
                            data-testid={`badge-status-${log.result}`}
                          >
                            {log.result?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.upc || '-'}
                        </TableCell>
                        <TableCell>
                          {log.walmartItemId ? (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              {log.walmartItemId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : isSyncLogsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading sync history...
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                        No sync history available yet. Run a batch sync to populate this data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Check component for rendering the checkmark in the getting started section
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
