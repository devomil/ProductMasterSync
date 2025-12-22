import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Package, 
  DollarSign, 
  RefreshCw,
  Filter,
  ExternalLink,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Download
} from 'lucide-react';
import { SiAmazon, SiWalmart } from 'react-icons/si';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MarketplaceListing {
  id: number;
  marketplace: string;
  listingId: string;
  marketplaceSku: string;
  productId: number | null;
  upc: string | null;
  gtin: string | null;
  title: string;
  brand: string | null;
  status: string;
  lifecycleStatus: string | null;
  publishedStatus: string | null;
  quantity: number;
  priceInCents: number | null;
  referralFeeInCents: number | null;
  productType: string | null;
  category: string | null;
  categoryPath: string[] | null;
  contractCategory: string | null;
  fulfillmentMethod: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Pricing insights fields
  buyBoxPriceInCents: number | null;
  buyBoxBasePriceInCents: number | null;
  buyBoxTotalPriceInCents: number | null;
  competitorPriceInCents: number | null;
  priceCompetitive: boolean | null;
  priceCompetitiveScore: number | null;
  inDemand: boolean | null;
  trafficLevel: string | null;
  gmv30InCents: number | null;
  pricingInsightsFetchedAt: string | null;
}

interface ListingsResponse {
  listings: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ListingsStats;
}

interface SyncJob {
  id: number;
  marketplace: string;
  jobType: string;
  status: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  triggeredBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ListingsStats {
  totalListings: number;
  activeListings: number;
  zeroQuantityListings: number;
  withProductMatch: number;
}

function SortableHeader({ 
  column, 
  currentColumn, 
  direction, 
  onClick, 
  children, 
  className = '' 
}: { 
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
          direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

function getStatusBadge(status: string, publishedStatus?: string | null) {
  const statusLower = status?.toLowerCase() || '';
  const publishedLower = publishedStatus?.toLowerCase() || '';
  
  switch (statusLower) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800" data-testid="status-badge-active"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
    case 'inactive':
      return <Badge className="bg-gray-100 text-gray-800" data-testid="status-badge-inactive"><XCircle className="h-3 w-3 mr-1" /> Inactive</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800" data-testid="status-badge-pending"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case 'retired':
      return <Badge className="bg-red-100 text-red-800" data-testid="status-badge-retired"><AlertCircle className="h-3 w-3 mr-1" /> Retired</Badge>;
    case 'unpublished':
      return <Badge className="bg-orange-100 text-orange-800" data-testid="status-badge-unpublished"><AlertCircle className="h-3 w-3 mr-1" /> Unpublished</Badge>;
    case 'suppressed':
      return <Badge className="bg-red-100 text-red-800" data-testid="status-badge-suppressed"><XCircle className="h-3 w-3 mr-1" /> Suppressed</Badge>;
    case 'published':
      return <Badge className="bg-blue-100 text-blue-800" data-testid="status-badge-published"><CheckCircle className="h-3 w-3 mr-1" /> Published</Badge>;
    default:
      // Check publishedStatus as fallback
      if (publishedLower === 'published') {
        return <Badge className="bg-blue-100 text-blue-800" data-testid="status-badge-published"><CheckCircle className="h-3 w-3 mr-1" /> Published</Badge>;
      }
      if (publishedLower === 'unpublished') {
        return <Badge className="bg-orange-100 text-orange-800" data-testid="status-badge-unpublished"><AlertCircle className="h-3 w-3 mr-1" /> Unpublished</Badge>;
      }
      return <Badge className="bg-gray-100 text-gray-600" data-testid="status-badge-unknown">{status || 'Unknown'}</Badge>;
  }
}

function formatCurrency(cents: number | null): string {
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercent(referralCents: number | null, priceCents: number | null): string {
  if (referralCents === null || priceCents === null || priceCents === 0) return '-';
  return `${((referralCents / priceCents) * 100).toFixed(1)}%`;
}

function getTrafficBadge(trafficLevel: string | null) {
  if (!trafficLevel) return <span className="text-muted-foreground text-xs">-</span>;
  
  const level = trafficLevel.toLowerCase();
  if (level === 'high') {
    return <Badge className="bg-green-100 text-green-800 text-xs">High</Badge>;
  } else if (level === 'medium') {
    return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Medium</Badge>;
  } else if (level === 'low') {
    return <Badge className="bg-gray-100 text-gray-600 text-xs">Low</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{trafficLevel}</Badge>;
}

function getPriceCompetitiveBadge(priceCompetitive: boolean | null, score: number | null) {
  if (priceCompetitive === null) return <span className="text-muted-foreground text-xs">-</span>;
  
  if (priceCompetitive) {
    return (
      <div className="flex items-center gap-1">
        <Badge className="bg-green-100 text-green-800 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Competitive
        </Badge>
        {score !== null && <span className="text-xs text-muted-foreground">({score.toFixed(0)})</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Badge className="bg-red-100 text-red-800 text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Not Competitive
      </Badge>
      {score !== null && <span className="text-xs text-muted-foreground">({score.toFixed(0)})</span>}
    </div>
  );
}

function getDemandBadge(inDemand: boolean | null) {
  if (inDemand === null) return <span className="text-muted-foreground text-xs">-</span>;
  
  if (inDemand) {
    return (
      <Badge className="bg-green-100 text-green-800 text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />
        In Demand
      </Badge>
    );
  }
  return <span className="text-muted-foreground text-xs">-</span>;
}

export default function ActiveListings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'walmart' | 'amazon'>('walmart');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const listingsPerPage = 50;

  // Reset to page 1 when filters change
  const handleMarketplaceChange = (value: 'all' | 'walmart' | 'amazon') => {
    setSelectedMarketplace(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const { data: listingsData, isLoading: isLoadingListings } = useQuery<ListingsResponse>({
    queryKey: ['/api/marketplace/listings', { 
      marketplace: selectedMarketplace === 'all' ? undefined : selectedMarketplace,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
      page: currentPage,
      limit: listingsPerPage 
    }],
  });

  const statsData = listingsData?.stats;
  const isLoadingStats = isLoadingListings;

  const { data: syncJobs } = useQuery<SyncJob[]>({
    queryKey: ['/api/marketplace/listings/sync-jobs', { marketplace: selectedMarketplace === 'all' ? undefined : selectedMarketplace }],
    refetchInterval: 5000,
  });

  const syncMutation = useMutation({
    mutationFn: async (marketplace: string) => {
      const response = await apiRequest('POST', `/api/marketplace/${marketplace}/listings/sync`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Sync Started',
        description: `Sync job #${data.jobId} has been started. Progress will update automatically.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/listings/sync-jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to start sync job',
        variant: 'destructive',
      });
    },
  });

  const pricingInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/walmart/pricing-insights/sync', { maxPages: 100 });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.fetched === 0) {
        toast({
          title: 'No Pricing Insights Available',
          description: 'Walmart API returned 0 items. You may need to enable Pricing Insights in Walmart Seller Center.',
        });
      } else {
        toast({
          title: 'Pricing Insights Synced',
          description: `Fetched ${data.fetched} items: ${data.updated} updated, ${data.inserted} new.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/listings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Pricing Insights Sync Failed',
        description: error.message || 'Failed to fetch pricing insights from Walmart',
        variant: 'destructive',
      });
    },
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const filteredListings = useMemo(() => {
    if (!listingsData?.listings) return [];
    
    // Search is done server-side now, just handle client-side sorting
    let filtered = [...listingsData.listings].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof MarketplaceListing];
      let bVal: any = b[sortColumn as keyof MarketplaceListing];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [listingsData?.listings, sortColumn, sortDirection]);

  const runningJob = syncJobs?.find(j => j.status === 'running');
  const recentJobs = syncJobs?.slice(0, 5) || [];

  const handleStartSync = () => {
    if (selectedMarketplace === 'all') {
      toast({
        title: 'Select a Marketplace',
        description: 'Please select a specific marketplace to sync (Walmart or Amazon).',
        variant: 'destructive',
      });
      return;
    }
    syncMutation.mutate(selectedMarketplace);
  };

  const handleDownloadCSV = () => {
    // Build query params with current filters
    const params = new URLSearchParams();
    if (selectedMarketplace !== 'all') {
      params.set('marketplace', selectedMarketplace);
    }
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    
    // Open download in new window/tab
    const url = `/api/marketplace/listings/export?${params.toString()}`;
    window.open(url, '_blank');
    
    toast({
      title: 'Download Started',
      description: 'Your CSV file is being prepared and will download shortly.',
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Active Listings</h1>
          <p className="text-muted-foreground">
            Manage and validate your marketplace listings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCSV}
            disabled={isLoadingListings || !listingsData?.listings?.length}
            data-testid="button-download-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          {selectedMarketplace === 'walmart' && (
            <Button
              variant="outline"
              onClick={() => pricingInsightsMutation.mutate()}
              disabled={pricingInsightsMutation.isPending}
              data-testid="button-sync-pricing-insights"
            >
              {pricingInsightsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sync Pricing Insights
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleStartSync}
            disabled={syncMutation.isPending || !!runningJob || selectedMarketplace === 'all'}
            data-testid="button-sync"
          >
            {syncMutation.isPending || runningJob ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Listings
              </>
            )}
          </Button>
        </div>
      </div>

      {runningJob && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="font-medium text-blue-900">Sync in Progress</span>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                {runningJob.processedItems} / {runningJob.totalItems || '?'} items
              </Badge>
            </div>
            <Progress 
              value={runningJob.totalItems > 0 ? (runningJob.processedItems / runningJob.totalItems) * 100 : 0} 
              className="h-2"
            />
            <div className="flex justify-between mt-2 text-sm text-blue-700">
              <span>Success: {runningJob.successItems}</span>
              <span>Errors: {runningJob.failedItems}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total">
              {isLoadingStats ? '-' : (statsData?.totalListings ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" /> Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active">
              {isLoadingStats ? '-' : (statsData?.activeListings ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-gray-500" /> Zero Qty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600" data-testid="stat-zero-qty">
              {isLoadingStats ? '-' : (statsData?.zeroQuantityListings ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4 text-blue-600" /> Matched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-matched">
              {isLoadingStats ? '-' : (statsData?.withProductMatch ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Marketplace Listings
              </CardTitle>
              <CardDescription>
                View and manage your listings across marketplaces
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedMarketplace} onValueChange={(v) => handleMarketplaceChange(v as any)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                All Marketplaces
              </TabsTrigger>
              <TabsTrigger value="walmart" data-testid="tab-walmart" className="flex items-center gap-2">
                <SiWalmart className="h-4 w-4" />
                Walmart
              </TabsTrigger>
              <TabsTrigger value="amazon" data-testid="tab-amazon" className="flex items-center gap-2">
                <SiAmazon className="h-4 w-4" />
                Amazon
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by title, SKU, UPC, or product type..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="unpublished">Unpublished</SelectItem>
                <SelectItem value="in_stock">In Stock (Qty &gt; 0)</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock (Qty = 0)</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortableHeader
                    column="title"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('title')}
                  >
                    Product
                  </SortableHeader>
                  <SortableHeader
                    column="marketplaceSku"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('marketplaceSku')}
                    className="w-32"
                  >
                    SKU
                  </SortableHeader>
                  <TableHead className="w-24">Marketplace</TableHead>
                  <SortableHeader
                    column="status"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('status')}
                    className="w-28"
                  >
                    Status
                  </SortableHeader>
                  <SortableHeader
                    column="quantity"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('quantity')}
                    className="w-20 text-right"
                  >
                    Qty
                  </SortableHeader>
                  <SortableHeader
                    column="priceInCents"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('priceInCents')}
                    className="w-24 text-right"
                  >
                    Price
                  </SortableHeader>
                  <TableHead className="w-24 text-right">Referral Fee</TableHead>
                  <SortableHeader
                    column="productType"
                    currentColumn={sortColumn}
                    direction={sortDirection}
                    onClick={() => handleSort('productType')}
                    className="w-40"
                  >
                    Product Type
                  </SortableHeader>
                  <TableHead className="w-32">Contract Category</TableHead>
                  <TableHead className="w-24 text-right">Buy Box</TableHead>
                  <TableHead className="w-24 text-right">Competitor</TableHead>
                  <TableHead className="w-28">Price Status</TableHead>
                  <TableHead className="w-24">Demand</TableHead>
                  <TableHead className="w-20">Traffic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingListings ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Loading listings...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredListings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">
                        {searchQuery || statusFilter !== 'all' 
                          ? 'No listings match your filters' 
                          : 'No listings synced yet. Click "Sync Listings" to import from marketplace.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredListings.map((listing) => (
                    <TableRow key={listing.id} data-testid={`listing-row-${listing.id}`}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium truncate" title={listing.title}>
                            {listing.title}
                          </p>
                          {listing.upc && (
                            <p className="text-xs text-muted-foreground">UPC: {listing.upc}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {listing.marketplaceSku}
                      </TableCell>
                      <TableCell>
                        {listing.marketplace === 'walmart' ? (
                          <Badge variant="outline" className="bg-blue-50">
                            <SiWalmart className="h-3 w-3 mr-1 text-blue-600" />
                            Walmart
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50">
                            <SiAmazon className="h-3 w-3 mr-1 text-orange-600" />
                            Amazon
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(listing.status, listing.publishedStatus)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {listing.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(listing.priceInCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono">
                          {formatCurrency(listing.referralFeeInCents)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercent(listing.referralFeeInCents, listing.priceInCents)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {listing.productType ? (
                          <Badge variant="secondary" className="font-normal text-xs">
                            {listing.productType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {listing.contractCategory ? (
                          <span className="text-sm">{listing.contractCategory}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(listing.buyBoxTotalPriceInCents || listing.buyBoxBasePriceInCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(listing.competitorPriceInCents)}
                      </TableCell>
                      <TableCell>
                        {getPriceCompetitiveBadge(listing.priceCompetitive, listing.priceCompetitiveScore)}
                      </TableCell>
                      <TableCell>
                        {getDemandBadge(listing.inDemand)}
                      </TableCell>
                      <TableCell>
                        {getTrafficBadge(listing.trafficLevel)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {listingsData && listingsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * listingsPerPage) + 1} to {Math.min(currentPage * listingsPerPage, listingsData.total)} of {(listingsData.total ?? 0).toLocaleString()} listings
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= (listingsData.totalPages ?? 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Sync Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`sync-job-${job.id}`}
                >
                  <div className="flex items-center gap-3">
                    {job.marketplace === 'walmart' ? (
                      <SiWalmart className="h-5 w-5 text-blue-600" />
                    ) : (
                      <SiAmazon className="h-5 w-5 text-orange-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {job.jobType.replace('_', ' ').charAt(0).toUpperCase() + job.jobType.slice(1).replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p>{job.successItems.toLocaleString()} synced</p>
                      {job.failedItems > 0 && (
                        <p className="text-red-600 text-xs">{job.failedItems} failed</p>
                      )}
                    </div>
                    {job.status === 'completed' ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" /> Completed
                      </Badge>
                    ) : job.status === 'running' ? (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running
                      </Badge>
                    ) : job.status === 'failed' ? (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" /> Failed
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">{job.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
