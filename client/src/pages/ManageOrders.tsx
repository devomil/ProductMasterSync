import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Loader2,
  Package,
  ExternalLink,
  Edit3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Truck,
  AlertCircle,
  AlertTriangle,
  Search,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { SiAmazon, SiWalmart } from 'react-icons/si';

interface Order {
  id: number;
  marketplace: 'amazon' | 'walmart' | 'ebay' | 'newegg';
  marketplaceOrderId: string;
  orderNumber: string;
  status: 'pending' | 'unshipped' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold';
  orderType: 'standard' | 'subscription' | 'preorder';
  customerName?: string;
  customerEmail?: string;
  shippingTrackingNumber?: string;
  shippingCarrier?: string;
  orderDate: string;
  shipByDate?: string;
  totalInCents: number;
  needsAttention: boolean;
  vergeOfCancellation: boolean;
  vergeOfLateShipment: boolean;
  buyerRequestedCancel: boolean;
  isPremium: boolean;
  isBusinessCustomer: boolean;
  shippingSettingsType: 'automated' | 'manual';
  requiresSignature: boolean;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalOrders: number;
    pending: number;
    unshipped: number;
    shipped: number;
    cancelled: number;
    delivered: number;
  };
}

interface SupplierOption {
  source: string;
  supplierName: string;
  costInCents: number;
  referralFeeInCents: number;
  profitInCents: number;
  marginPercentage: number;
  inStock: boolean;
  leadTime?: string | null;
}

interface OrderItem {
  id: number;
  orderId: number;
  marketplaceSku: string;
  title: string | null;
  quantity: number;
  unitPriceInCents: number | null;
  productType: string | null;
  category: string | null;
  contractCategory: string | null;
  referralFeeInCents: number;
  referralFeePercentage: number;
  flxpointCommissionRate: number | null;
  upc: string | null;
  costInCents: number | null;
  supplierOptions: SupplierOption[];
  profitability: {
    bestOption: SupplierOption;
    hasMultipleSuppliers: boolean;
  } | null;
}

interface OrderProfitability {
  totalRevenue: number;
  totalCost: number;
  totalReferralFees: number;
  totalProfit: number;
  marginPercentage: number;
  hasMissingCosts: boolean;
}

interface OrderDetails extends Order {
  items: OrderItem[];
  profitability: OrderProfitability;
  availableSuppliers: { id: number; name: string; code: string }[];
  shippingAddress?: string;
  currencyCode?: string;
}

interface MarketplaceStat {
  marketplace: string;
  totalOrders: string;
  pending: string;
  unshipped: string;
  shipped: string;
  cancelled: string;
  totalRevenue: string;
}

type SubTab = 'orders' | 'sync_jobs' | 'inventory_rules' | 'access_control';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Orders', icon: ShoppingBag },
  { id: 'pending', label: 'Pending Fulfillment', icon: Clock },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Completed', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
  { id: 'on_hold', label: 'On Hold', icon: AlertCircle },
];

export default function ManageOrders() {
  const [activeTab, setActiveTab] = useState<SubTab>('orders');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const resultsPerPage = 25;

  const { toast } = useToast();

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        params.append('status', 'pending,unshipped');
      } else {
        params.append('status', statusFilter);
      }
    }
    if (channelFilter !== 'all') params.append('marketplace', channelFilter);
    params.append('dateRange', dateRange);
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    params.append('page', page.toString());
    params.append('limit', resultsPerPage.toString());
    params.append('sortOrder', 'desc');
    return params.toString();
  };

  const { data: ordersData, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['/api/marketplace/orders', statusFilter, channelFilter, dateRange, searchQuery, page],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/orders?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    }
  });

  const { data: summaryData } = useQuery<{ byMarketplace: MarketplaceStat[]; syncStatus?: { active: boolean; isRunning: boolean; lastAmazonSync: string | null; lastWalmartSync: string | null; intervalHours: number } }>({
    queryKey: ['/api/marketplace/orders/stats/summary'],
  });

  const { data: orderDetails, isLoading: isLoadingDetails } = useQuery<OrderDetails>({
    queryKey: ['/api/marketplace/orders', selectedOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/orders/${selectedOrderId}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      return response.json();
    },
    enabled: !!selectedOrderId,
  });

  const syncAmazonMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/orders/sync/amazon', { daysBack: 60 });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Amazon Orders Synced', description: `Synced ${data.synced} new, updated ${data.updated} existing orders.` });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders/stats/summary'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    },
  });

  const syncWalmartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/orders/sync/walmart', { daysBack: 60 });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Walmart Orders Synced', description: `Synced ${data.synced} new, updated ${data.updated} existing orders.` });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders/stats/summary'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    },
  });

  const marketplaceStats = useMemo(() => {
    const stats = summaryData?.byMarketplace || [];
    const walmartData = stats.find(s => s.marketplace === 'walmart');
    const amazonData = stats.find(s => s.marketplace === 'amazon');

    const toNum = (v: string | undefined) => parseInt(v || '0') || 0;
    const toCents = (v: string | undefined) => parseInt(v || '0') || 0;

    const walmart = {
      orders: toNum(walmartData?.totalOrders),
      revenue: toCents(walmartData?.totalRevenue),
      pending: toNum(walmartData?.pending) + toNum(walmartData?.unshipped),
      shipped: toNum(walmartData?.shipped),
    };
    const amazon = {
      orders: toNum(amazonData?.totalOrders),
      revenue: toCents(amazonData?.totalRevenue),
      pending: toNum(amazonData?.pending) + toNum(amazonData?.unshipped),
      shipped: toNum(amazonData?.shipped),
    };
    const allChannels = {
      orders: walmart.orders + amazon.orders,
      revenue: walmart.revenue + amazon.revenue,
      pending: walmart.pending + amazon.pending,
      shipped: walmart.shipped + amazon.shipped,
    };

    return { walmart, amazon, allChannels };
  }, [summaryData]);

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return '-';
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatRevenue = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const statusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'unshipped': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'shipped': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      case 'on_hold': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'unshipped': return 'Incomplete';
      case 'shipped': return 'Shipped';
      case 'delivered': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'on_hold': return 'On Hold';
      default: return status;
    }
  };

  const getProfitColor = (margin: number) => {
    if (margin >= 20) return 'text-green-600';
    if (margin >= 10) return 'text-yellow-600';
    if (margin > 0) return 'text-orange-600';
    return 'text-red-600';
  };

  const needsFulfillment = (status: string) => {
    return status === 'pending' || status === 'unshipped' || status === 'on_hold';
  };

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Overview</h2>
        <div className="flex items-center gap-3">
          {summaryData?.syncStatus?.active && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-sync every {summaryData.syncStatus.intervalHours}h
            </span>
          )}
          <span className="text-xs text-slate-400">All Time</span>
        </div>
      </div>

      {/* Marketplace Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Walmart Card */}
        <Card className="border border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <SiWalmart className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-slate-900">Walmart</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Orders</div>
                <div className="text-2xl font-bold text-slate-900">{marketplaceStats.walmart.orders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Revenue</div>
                <div className="text-2xl font-bold text-emerald-600">{formatRevenue(marketplaceStats.walmart.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pending</div>
                <div className="text-sm font-semibold text-amber-600">{marketplaceStats.walmart.pending.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Shipped</div>
                <div className="text-sm font-semibold text-emerald-600">{marketplaceStats.walmart.shipped.toLocaleString()}</div>
              </div>
            </div>
            {summaryData?.syncStatus?.lastWalmartSync && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Last synced: {new Date(summaryData.syncStatus.lastWalmartSync).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amazon Card */}
        <Card className="border border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center">
                  <SiAmazon className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-slate-900">Amazon</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Orders</div>
                <div className="text-2xl font-bold text-slate-900">{marketplaceStats.amazon.orders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Revenue</div>
                <div className="text-2xl font-bold text-emerald-600">{formatRevenue(marketplaceStats.amazon.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pending</div>
                <div className="text-sm font-semibold text-amber-600">{marketplaceStats.amazon.pending.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Shipped</div>
                <div className="text-sm font-semibold text-emerald-600">{marketplaceStats.amazon.shipped.toLocaleString()}</div>
              </div>
            </div>
            {summaryData?.syncStatus?.lastAmazonSync && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Last synced: {new Date(summaryData.syncStatus.lastAmazonSync).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Channels Card */}
        <Card className="border-2 border-emerald-200 bg-emerald-50/30 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-slate-900">All Channels</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Orders</div>
                <div className="text-2xl font-bold text-slate-900">{marketplaceStats.allChannels.orders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Revenue</div>
                <div className="text-2xl font-bold text-emerald-600">{formatRevenue(marketplaceStats.allChannels.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pending</div>
                <div className="text-sm font-semibold text-amber-600">{marketplaceStats.allChannels.pending.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Shipped</div>
                <div className="text-sm font-semibold text-emerald-600">{marketplaceStats.allChannels.shipped.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {[
            { id: 'orders' as SubTab, label: 'Orders', icon: ShoppingBag },
            { id: 'sync_jobs' as SubTab, label: 'Sync Jobs', icon: RefreshCw },
            { id: 'inventory_rules' as SubTab, label: 'Inventory Rules', icon: Package },
            { id: 'access_control' as SubTab, label: 'Access Control', icon: AlertCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'orders' && (
        <>
          {/* Orders Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Marketplace Orders</h2>
              <p className="text-sm text-slate-500 mt-0.5">Orders synced from connected marketplaces ready for fulfillment</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAmazonMutation.mutate()}
                disabled={syncAmazonMutation.isPending}
                className="text-sm"
              >
                {syncAmazonMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                Sync Amazon
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncWalmartMutation.mutate()}
                disabled={syncWalmartMutation.isPending}
                className="text-sm"
              >
                {syncWalmartMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                Sync Walmart
              </Button>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => { setStatusFilter(filter.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  statusFilter === filter.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <filter.icon className="h-3.5 w-3.5" />
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search & Filters Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by order number or customer..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="walmart">Walmart</SelectItem>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="newegg">Newegg</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table */}
          <Card className="border border-slate-200">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">Loading orders...</span>
                </div>
              ) : !ordersData?.orders?.length ? (
                <div className="text-center py-16">
                  <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-600">No orders found</p>
                  <p className="text-sm text-slate-400 mt-1">Orders from your connected marketplaces will appear here</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => syncAmazonMutation.mutate()}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Sync Amazon
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => syncWalmartMutation.mutate()}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Sync Walmart
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="font-semibold text-slate-700">Order #</TableHead>
                        <TableHead className="font-semibold text-slate-700">Channel</TableHead>
                        <TableHead className="font-semibold text-slate-700">Customer</TableHead>
                        <TableHead className="font-semibold text-slate-700">Date</TableHead>
                        <TableHead className="font-semibold text-slate-700">Status</TableHead>
                        <TableHead className="font-semibold text-slate-700">Total</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData.orders.map(order => (
                        <TableRow
                          key={order.id}
                          className="hover:bg-slate-50/50 cursor-pointer group"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <TableCell className="font-medium text-slate-900">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {order.marketplace === 'walmart' && (
                                <span className="text-sm text-slate-700">Walmart</span>
                              )}
                              {order.marketplace === 'amazon' && (
                                <span className="text-sm text-slate-700">Amazon</span>
                              )}
                              {order.marketplace === 'ebay' && (
                                <span className="text-sm text-slate-700">eBay</span>
                              )}
                              {order.marketplace === 'newegg' && (
                                <span className="text-sm text-slate-700">Newegg</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {order.customerName || 'Amazon Customer'}
                              </div>
                              {order.customerEmail && (
                                <div className="text-xs text-slate-400">{order.customerEmail}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusBadgeStyle(order.status)} text-xs font-medium`}>
                              {statusLabel(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-900">
                            USD {formatCurrency(order.totalInCents)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {needsFulfillment(order.status) && (
                                <Button size="sm" className="h-7 bg-red-500 hover:bg-red-600 text-white text-xs px-3">
                                  Fulfill
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                                onClick={() => setSelectedOrderId(order.id)}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {ordersData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                      <div className="text-sm text-slate-500">
                        Showing {((page - 1) * resultsPerPage) + 1}-{Math.min(page * resultsPerPage, ordersData.total)} of {ordersData.total} orders
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-slate-600">Page {page} of {ordersData.totalPages}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(ordersData.totalPages, p + 1))}
                          disabled={page >= ordersData.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'sync_jobs' && (
        <Card>
          <CardContent className="py-16 text-center">
            <RefreshCw className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Sync Jobs</h3>
            <p className="text-sm text-slate-400 mt-1">View and manage marketplace order sync history</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'inventory_rules' && (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Inventory Rules</h3>
            <p className="text-sm text-slate-400 mt-1">Configure inventory allocation and routing rules</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'access_control' && (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Access Control</h3>
            <p className="text-sm text-slate-400 mt-1">Manage user permissions for order management</p>
          </CardContent>
        </Card>
      )}

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {orderDetails?.marketplace === 'walmart' && <SiWalmart className="h-5 w-5" />}
              {orderDetails?.marketplace === 'amazon' && <SiAmazon className="h-5 w-5" />}
              Order #{orderDetails?.orderNumber}
              <Badge variant="outline" className={statusBadgeStyle(orderDetails?.status || '')}>
                {statusLabel(orderDetails?.status || '')}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-slate-500">Customer</div>
                    <div className="font-medium">{orderDetails.customerName || 'N/A'}</div>
                    {orderDetails.customerEmail && (
                      <div className="text-xs text-slate-400 mt-0.5">{orderDetails.customerEmail}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-slate-500">Order Date</div>
                    <div className="font-medium">{new Date(orderDetails.orderDate).toLocaleDateString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-slate-500">Ship By</div>
                    <div className="font-medium">{orderDetails.shipByDate ? new Date(orderDetails.shipByDate).toLocaleDateString() : '-'}</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2 border-emerald-200">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Order Profitability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-slate-500">Revenue</div>
                      <div className="text-lg font-semibold">{formatCurrency(orderDetails.profitability.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Cost</div>
                      <div className="text-lg font-semibold">
                        {orderDetails.profitability.hasMissingCosts ? (
                          <span className="text-yellow-600 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" /> Incomplete
                          </span>
                        ) : formatCurrency(orderDetails.profitability.totalCost)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Referral Fees</div>
                      <div className="text-lg font-semibold text-orange-600">{formatCurrency(orderDetails.profitability.totalReferralFees)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Profit</div>
                      <div className={`text-lg font-semibold ${getProfitColor(orderDetails.profitability.marginPercentage)}`}>
                        {orderDetails.profitability.hasMissingCosts ? '-' : formatCurrency(orderDetails.profitability.totalProfit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Margin</div>
                      <div className={`text-lg font-semibold flex items-center gap-1 ${getProfitColor(orderDetails.profitability.marginPercentage)}`}>
                        {orderDetails.profitability.hasMissingCosts ? '-' : (
                          <>
                            {orderDetails.profitability.marginPercentage >= 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {orderDetails.profitability.marginPercentage}%
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {orderDetails.profitability.hasMissingCosts && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded-md text-sm text-yellow-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Some items are missing supplier cost data. Profitability calculation may be incomplete.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Items ({orderDetails.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead className="max-w-xs">Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails.items.map(item => {
                        const profit = item.profitability?.bestOption;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">{item.marketplaceSku}</TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate" title={item.title || ''}>
                                {item.title || 'Unknown Product'}
                              </div>
                              {item.contractCategory && (
                                <div className="text-xs text-slate-400 mt-1">
                                  {item.contractCategory} ({item.referralFeePercentage.toFixed(1)}%)
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unitPriceInCents)}</TableCell>
                            <TableCell>
                              {item.costInCents !== null ? formatCurrency(item.costInCents) : (
                                <span className="text-yellow-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> N/A
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-orange-600">{formatCurrency(item.referralFeeInCents)}</div>
                              {item.flxpointCommissionRate !== null && (
                                <div className="text-xs text-slate-400">
                                  Flx: {item.flxpointCommissionRate.toFixed(1)}%
                                  {Math.abs(item.referralFeePercentage - item.flxpointCommissionRate) > 1 && (
                                    <span className="text-yellow-600 ml-1">(diff!)</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {profit ? (
                                <div className={getProfitColor(profit.marginPercentage)}>
                                  {formatCurrency(profit.profitInCents)}
                                  <span className="text-xs ml-1">({profit.marginPercentage}%)</span>
                                </div>
                              ) : <span className="text-slate-400">-</span>}
                            </TableCell>
                            <TableCell>
                              {item.supplierOptions.length > 0 ? (
                                <Select defaultValue={item.supplierOptions[0].supplierName}>
                                  <SelectTrigger className="h-8 text-xs w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.supplierOptions.map((supplier, idx) => (
                                      <SelectItem key={idx} value={supplier.supplierName}>
                                        {supplier.supplierName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : <span className="text-slate-400 text-sm">No suppliers</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedOrderId(null)}>Close</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Fulfill Order
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
