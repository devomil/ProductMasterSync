import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
  MapPin,
  CreditCard,
  FileText,
  Star,
  RotateCcw,
  Tag,
  Phone,
  Mail,
  Globe,
  Gift,
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
  purchaseOrderNumber?: string;
  vendorOrderStatus?: string;
  vendorOrderDate?: string;
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

interface FinancialsResponse {
  orderId: number;
  marketplace: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  shipByDate: string | null;
  shippingService: string;
  shippingAddress: {
    name?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateOrRegion?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
  } | null;
  customerName: string | null;
  customerEmail: string | null;
  financials: {
    itemsTotal: number;
    customerItemsTotal: number;
    taxTotal: number;
    grandTotal: number;
    referralFees: number;
    referralFeeRate: number;
    referralFeeCategory: string;
    estimatedPayout: number;
    vendorCost: number;
    vendorShipping: number;
    totalVendorCost: number;
    estimatedNetProceeds: number;
    margin: number;
    hasFulfillmentData: boolean;
    walmartFundedIncentiveTotal: number;
  };
  walmartIncentives: {
    sku: string;
    sellerPriceInCents: number;
    customerPriceInCents: number;
    incentiveAmountInCents: number;
    incentiveType: string;
    incentiveStatus: string;
  }[];
  items: {
    id: number;
    orderId: number;
    marketplaceSku: string;
    title: string | null;
    quantity: number | null;
    unitPriceInCents: number | null;
    sellerPriceInCents: number | null;
    incentiveAmountInCents: number | null;
    upc: string | null;
    taxInCents: number | null;
    commissionInCents: number | null;
    commissionRate: number | null;
    commissionCategory: string | null;
    vendorCostInCents: number | null;
    vendorShippingCostInCents: number | null;
    vendorName: string | null;
    vendorSku: string | null;
    fulfilledAt: string | null;
  }[];
  rawData: any;
}

interface VendorAllocationItem {
  vendorName: string;
  vendorId: string;
  vendorSku: string;
  upc: string;
  available: number;
  costInCents: number | null;
  shippingCostInCents: number;
  hasPromotion: boolean;
  margin: number;
  proceeds: number;
  source: string;
}

interface VendorAllocationGroup {
  orderItemId: number;
  marketplaceSku: string;
  title: string | null;
  quantity: number;
  unitPriceInCents: number | null;
  allocations: VendorAllocationItem[];
}

interface VendorLookupResponse {
  vendorAllocations: VendorAllocationGroup[];
}

interface SelectedVendor {
  orderItemId: number;
  vendorName: string;
  vendorSku: string;
  vendorId: string;
  costInCents: number | null;
  shippingCostInCents: number;
  margin: number;
  proceeds: number;
  ingramPartNumber?: string;
  quantity?: number;
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
  const [fulfillOrderId, setFulfillOrderId] = useState<number | null>(null);
  const [selectedVendors, setSelectedVendors] = useState<SelectedVendor[]>([]);
  const [sellerNotes, setSellerNotes] = useState('');
  const [showPOConfirmation, setShowPOConfirmation] = useState(false);
  const [fulfillmentStep, setFulfillmentStep] = useState<'select' | 'submitting' | 'complete'>('select');
  const [poResult, setPOResult] = useState<{ ingramOrderNumber?: string; orderTotal?: number; warning?: string } | null>(null);
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

  const { data: financialsData, isLoading: isLoadingFinancials } = useQuery<FinancialsResponse>({
    queryKey: ['/api/marketplace/orders', fulfillOrderId, 'financials'],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/orders/${fulfillOrderId}/financials`);
      if (!response.ok) throw new Error('Failed to fetch financials');
      return response.json();
    },
    enabled: !!fulfillOrderId,
  });

  const { data: vendorData, isLoading: isLoadingVendors, refetch: refetchVendors } = useQuery<VendorLookupResponse>({
    queryKey: ['/api/marketplace/orders', fulfillOrderId, 'vendor-lookup'],
    queryFn: async () => {
      const response = await apiRequest('POST', `/api/marketplace/orders/${fulfillOrderId}/vendor-lookup`, {});
      return response.json();
    },
    enabled: !!fulfillOrderId,
  });

  const fulfillMutation = useMutation({
    mutationFn: async (data: { items: any[]; fulfillmentMethod: string; sellerNotes: string; submitToIngram?: boolean }) => {
      const response = await apiRequest('POST', `/api/marketplace/orders/${fulfillOrderId}/fulfill`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.ingramOrder) {
        setPOResult({
          ingramOrderNumber: data.ingramOrder.ingramOrderNumber,
          orderTotal: data.ingramOrder.orderTotal,
        });
        setFulfillmentStep('complete');
        toast({
          title: 'Purchase Order Submitted',
          description: `Ingram Micro PO #${data.ingramOrder.ingramOrderNumber} created successfully.`,
        });
      } else if (data.ingramWarning) {
        setPOResult({ warning: data.ingramWarning });
        setFulfillmentStep('complete');
        toast({
          title: 'Order Fulfilled (PO Warning)',
          description: data.ingramWarning,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Order Fulfilled', description: 'Order has been fulfilled successfully.' });
        closeFulfillModal();
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/orders/stats/summary'] });
    },
    onError: (error: Error) => {
      setFulfillmentStep('select');
      toast({ title: 'Fulfillment Failed', description: error.message, variant: 'destructive' });
    },
  });

  const openFulfillModal = useCallback((orderId: number) => {
    setFulfillOrderId(orderId);
    setSelectedVendors([]);
    setSellerNotes('');
    setShowPOConfirmation(false);
    setFulfillmentStep('select');
    setPOResult(null);
  }, []);

  const closeFulfillModal = useCallback(() => {
    setFulfillOrderId(null);
    setSelectedVendors([]);
    setSellerNotes('');
    setShowPOConfirmation(false);
    setFulfillmentStep('select');
    setPOResult(null);
  }, []);

  const toggleVendorSelection = useCallback((orderItemId: number, vendor: VendorAllocationItem, quantity?: number) => {
    setSelectedVendors(prev => {
      const existing = prev.find(v => v.orderItemId === orderItemId);
      if (existing && existing.vendorId === vendor.vendorId && existing.vendorName === vendor.vendorName) {
        return prev.filter(v => v.orderItemId !== orderItemId);
      }
      const isIngram = vendor.source === 'ingram_micro' || vendor.vendorName.toLowerCase().includes('ingram');
      return [
        ...prev.filter(v => v.orderItemId !== orderItemId),
        {
          orderItemId,
          vendorName: vendor.vendorName,
          vendorSku: vendor.vendorSku,
          vendorId: vendor.vendorId,
          costInCents: vendor.costInCents,
          shippingCostInCents: vendor.shippingCostInCents,
          margin: vendor.margin,
          proceeds: vendor.proceeds,
          ingramPartNumber: isIngram ? vendor.vendorId : undefined,
          quantity: quantity || 1,
        },
      ];
    });
  }, []);

  useEffect(() => {
    if (vendorData?.vendorAllocations && selectedVendors.length === 0) {
      const autoSelected: SelectedVendor[] = [];
      for (const group of vendorData.vendorAllocations) {
        if (group.allocations.length > 0) {
          const best = group.allocations.reduce((a, b) => (a.margin > b.margin ? a : b));
          const isIngram = best.source === 'ingram_micro' || best.vendorName.toLowerCase().includes('ingram');
          autoSelected.push({
            orderItemId: group.orderItemId,
            vendorName: best.vendorName,
            vendorSku: best.vendorSku,
            vendorId: best.vendorId,
            costInCents: best.costInCents,
            shippingCostInCents: best.shippingCostInCents,
            margin: best.margin,
            proceeds: best.proceeds,
            ingramPartNumber: isIngram ? best.vendorId : undefined,
            quantity: group.quantity || 1,
          });
        }
      }
      if (autoSelected.length > 0) {
        setSelectedVendors(autoSelected);
      }
    }
  }, [vendorData]);

  const dynamicFinancials = useMemo(() => {
    if (!financialsData) return null;
    const f = financialsData.financials;
    if (selectedVendors.length === 0) return f;
    const vendorCost = selectedVendors.reduce((sum, v) => sum + (v.costInCents || 0), 0);
    const vendorShipping = selectedVendors.reduce((sum, v) => sum + v.shippingCostInCents, 0);
    const totalVendorCost = vendorCost + vendorShipping;
    const estimatedNetProceeds = f.estimatedPayout - totalVendorCost;
    const margin = f.estimatedPayout > 0 ? Math.round((estimatedNetProceeds / f.estimatedPayout) * 10000) / 100 : 0;
    return {
      ...f,
      vendorCost,
      vendorShipping,
      totalVendorCost,
      estimatedNetProceeds,
      margin,
      hasFulfillmentData: true,
    };
  }, [financialsData, selectedVendors]);

  const hasIngramVendor = useMemo(() => {
    return selectedVendors.some(v => v.ingramPartNumber || v.vendorName.toLowerCase().includes('ingram'));
  }, [selectedVendors]);

  const handleFulfillOrder = useCallback((submitToIngram: boolean = false) => {
    if (!fulfillOrderId || selectedVendors.length === 0) return;
    if (submitToIngram) {
      setFulfillmentStep('submitting');
    }
    fulfillMutation.mutate({
      items: selectedVendors.map(v => ({
        orderItemId: v.orderItemId,
        vendorCostInCents: v.costInCents,
        vendorShippingCostInCents: v.shippingCostInCents,
        vendorName: v.vendorName,
        vendorSku: v.vendorSku,
        ingramPartNumber: v.ingramPartNumber || null,
        quantity: v.quantity || 1,
      })),
      fulfillmentMethod: 'dropship',
      sellerNotes,
      submitToIngram,
    });
  }, [fulfillOrderId, selectedVendors, sellerNotes, fulfillMutation]);

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
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">COGS</div>
                <div className="text-sm font-semibold text-orange-600">
                  {summaryData?.cogs?.totalReferralFees > 0 
                    ? formatRevenue(summaryData.cogs.totalReferralFees + (summaryData.cogs.totalVendorCosts || 0) + (summaryData.cogs.totalVendorShipping || 0))
                    : '--'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Gross Profit</div>
                <div className={`text-sm font-semibold ${(() => {
                  if (!summaryData?.cogs?.totalReferralFees) return 'text-slate-400';
                  const totalCogs = summaryData.cogs.totalReferralFees + (summaryData.cogs.totalVendorCosts || 0) + (summaryData.cogs.totalVendorShipping || 0);
                  const gp = marketplaceStats.allChannels.revenue - totalCogs;
                  return gp >= 0 ? 'text-emerald-600' : 'text-red-600';
                })()}`}>
                  {(() => {
                    if (!summaryData?.cogs?.totalReferralFees) return '--';
                    const totalCogs = summaryData.cogs.totalReferralFees + (summaryData.cogs.totalVendorCosts || 0) + (summaryData.cogs.totalVendorShipping || 0);
                    const gp = marketplaceStats.allChannels.revenue - totalCogs;
                    const margin = marketplaceStats.allChannels.revenue > 0 ? Math.round((gp / marketplaceStats.allChannels.revenue) * 100) : 0;
                    return `${formatRevenue(gp)} (${margin}%)`;
                  })()}
                </div>
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className={`${statusBadgeStyle(order.status)} text-xs font-medium`}>
                                {statusLabel(order.status)}
                              </Badge>
                              {order.purchaseOrderNumber && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-mono">
                                  PO: {order.purchaseOrderNumber}
                                </Badge>
                              )}
                              {order.vendorOrderStatus && order.vendorOrderStatus !== 'no_po' && (
                                <Badge variant="outline" className={`text-[10px] ${
                                  order.vendorOrderStatus.toLowerCase().includes('ship') ? 'bg-green-50 text-green-700 border-green-200' :
                                  order.vendorOrderStatus.toLowerCase().includes('back') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {order.vendorOrderStatus}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-900">
                            USD {formatCurrency(order.totalInCents)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {needsFulfillment(order.status) && (
                                <Button
                                  size="sm"
                                  className="h-7 bg-red-500 hover:bg-red-600 text-white text-xs px-3"
                                  onClick={() => openFulfillModal(order.id)}
                                >
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

      {/* Fulfillment Modal */}
      <Dialog open={!!fulfillOrderId} onOpenChange={(open) => !open && closeFulfillModal()}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-y-auto p-0">
          {(isLoadingFinancials || isLoadingVendors) && !financialsData ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="ml-3 text-slate-500">Loading order details...</span>
            </div>
          ) : financialsData ? (
            <>
              <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {financialsData.marketplace === 'walmart' && <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center"><SiWalmart className="h-4 w-4 text-white" /></div>}
                    {financialsData.marketplace === 'amazon' && <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center"><SiAmazon className="h-4 w-4 text-white" /></div>}
                    <div>
                      <DialogTitle className="text-lg font-semibold">Order #{financialsData.orderNumber}</DialogTitle>
                      <div className="text-xs text-slate-500 mt-0.5">{financialsData.marketplace?.charAt(0).toUpperCase()}{financialsData.marketplace?.slice(1)} Order</div>
                    </div>
                    <Badge variant="outline" className={`ml-2 ${statusBadgeStyle(financialsData.status)}`}>
                      {statusLabel(financialsData.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Refund Order
                    </Button>
                    <Button variant="outline" size="sm">
                      <Star className="h-3.5 w-3.5 mr-1.5" /> Request a Review
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-0">
                <div className="col-span-2 p-6 space-y-6 border-r">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border border-slate-200">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-500" /> Order Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Ship By</span>
                          <span className={`font-medium ${financialsData.shipByDate && new Date(financialsData.shipByDate) < new Date() ? 'text-red-600' : 'text-slate-900'}`}>
                            {financialsData.shipByDate ? new Date(financialsData.shipByDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Shipping Service</span>
                          <span className="font-medium text-slate-900">{financialsData.shippingService || 'Standard'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Order Date</span>
                          <span className="font-medium text-slate-900">{new Date(financialsData.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-500" /> Ship To
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        {financialsData.shippingAddress ? (
                          <div className="text-sm space-y-1">
                            <div className="font-medium text-slate-900">{financialsData.shippingAddress.name || financialsData.customerName || 'N/A'}</div>
                            {financialsData.shippingAddress.addressLine1 && <div className="text-slate-600">{financialsData.shippingAddress.addressLine1}</div>}
                            {financialsData.shippingAddress.addressLine2 && <div className="text-slate-600">{financialsData.shippingAddress.addressLine2}</div>}
                            <div className="text-slate-600">
                              {[financialsData.shippingAddress.city, financialsData.shippingAddress.stateOrRegion, financialsData.shippingAddress.postalCode].filter(Boolean).join(', ')}
                            </div>
                            {financialsData.shippingAddress.countryCode && <div className="text-slate-500 text-xs">{financialsData.shippingAddress.countryCode}</div>}
                            {financialsData.shippingAddress.phone && (
                              <div className="text-slate-500 text-xs flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{financialsData.shippingAddress.phone}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No shipping address available</div>
                        )}
                        <Separator className="my-2" />
                        <div className="text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Contact Buyer</span>
                          <div className="text-slate-600 mt-0.5">{financialsData.customerEmail || 'No email available'}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border border-slate-200">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" /> More Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tax Collection Model</span>
                          <span className="font-medium text-slate-900">MarketplaceFacilitator</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tax Collection Responsible Party</span>
                          <span className="font-medium text-slate-900">{financialsData.marketplace === 'amazon' ? 'Amazon Services, Inc.' : 'Walmart Marketplace'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-500" /> Order Contents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 text-xs">
                            <TableHead className="text-xs font-semibold">Status</TableHead>
                            <TableHead className="text-xs font-semibold">Product</TableHead>
                            <TableHead className="text-xs font-semibold">More Info</TableHead>
                            <TableHead className="text-xs font-semibold text-center">Qty</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Unit Price</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Proceeds</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financialsData.items?.length > 0 ? financialsData.items.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${item.fulfilledAt ? 'bg-green-50 text-green-700 border-green-200' : statusBadgeStyle(financialsData.status)}`}>
                                  {item.fulfilledAt ? 'Fulfilled' : statusLabel(financialsData.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <div className="text-sm font-medium text-slate-900 truncate">{item.title || 'Unknown Product'}</div>
                                  <div className="text-xs text-slate-400 mt-0.5 space-x-2">
                                    <span>SKU: {item.marketplaceSku}</span>
                                    {item.upc && <span>UPC: {item.upc}</span>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.vendorName && (
                                  <div className="text-xs text-slate-500">Vendor: {item.vendorName}</div>
                                )}
                                {item.vendorSku && (
                                  <div className="text-xs text-slate-400">V-SKU: {item.vendorSku}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.unitPriceInCents)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency((item.unitPriceInCents || 0) * (item.quantity || 1))}
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-sm text-slate-400 py-8">
                                {isLoadingFinancials ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'No items found'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-blue-200">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-blue-500" /> Vendors Allocation
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => refetchVendors()} disabled={isLoadingVendors} className="h-7 text-xs">
                          {isLoadingVendors ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                          Refresh Pricing
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {isLoadingVendors ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                          <span className="ml-2 text-sm text-slate-500">Looking up vendor pricing...</span>
                        </div>
                      ) : vendorData?.vendorAllocations?.length ? (
                        <div className="divide-y">
                          {vendorData.vendorAllocations.map(group => (
                            <div key={group.orderItemId} className="p-4">
                              <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                {group.title || group.marketplaceSku} × {group.quantity}
                                <span className="text-slate-400">({formatCurrency(group.unitPriceInCents)} ea)</span>
                              </div>
                              {group.allocations.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="text-[10px]">
                                      <TableHead className="text-[10px] w-8"></TableHead>
                                      <TableHead className="text-[10px]">Vendor</TableHead>
                                      <TableHead className="text-[10px]">Vendor ID</TableHead>
                                      <TableHead className="text-[10px]">Vendor SKU</TableHead>
                                      <TableHead className="text-[10px]">UPC</TableHead>
                                      <TableHead className="text-[10px] text-center">Available</TableHead>
                                      <TableHead className="text-[10px] text-right">Cost</TableHead>
                                      <TableHead className="text-[10px] text-right">Shipping</TableHead>
                                      <TableHead className="text-[10px] text-center">Promo</TableHead>
                                      <TableHead className="text-[10px] text-right">Margin</TableHead>
                                      <TableHead className="text-[10px] text-right">Proceeds</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.allocations.map((alloc, idx) => {
                                      const isSelected = selectedVendors.some(
                                        v => v.orderItemId === group.orderItemId && v.vendorId === alloc.vendorId && v.vendorName === alloc.vendorName
                                      );
                                      return (
                                        <TableRow
                                          key={idx}
                                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'}`}
                                          onClick={() => toggleVendorSelection(group.orderItemId, alloc, group.quantity)}
                                        >
                                          <TableCell className="w-8 pr-0">
                                            <Checkbox checked={isSelected} className="h-4 w-4" />
                                          </TableCell>
                                          <TableCell className="text-xs font-medium">
                                            {alloc.vendorName}
                                            {alloc.source === 'ingram_micro' && (
                                              <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-600">API</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs font-mono text-slate-500">{alloc.vendorId}</TableCell>
                                          <TableCell className="text-xs font-mono">{alloc.vendorSku}</TableCell>
                                          <TableCell className="text-xs font-mono text-slate-500">{alloc.upc || '-'}</TableCell>
                                          <TableCell className="text-center">
                                            <span className={`text-xs font-semibold ${alloc.available > 10 ? 'text-green-600' : alloc.available > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                              {alloc.available}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right text-xs font-medium">{formatCurrency(alloc.costInCents)}</TableCell>
                                          <TableCell className="text-right text-xs">{formatCurrency(alloc.shippingCostInCents)}</TableCell>
                                          <TableCell className="text-center">
                                            {alloc.hasPromotion ? (
                                              <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">Promo</Badge>
                                            ) : <span className="text-slate-300 text-xs">—</span>}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={`text-xs font-semibold ${getProfitColor(alloc.margin)}`}>
                                              {alloc.margin}%
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={`text-xs font-semibold ${alloc.proceeds >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {formatCurrency(alloc.proceeds)}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              ) : (
                                <div className="text-sm text-slate-400 py-2 pl-5">No vendor pricing found for this item</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No vendor allocations available</p>
                          <p className="text-xs text-slate-400 mt-1">Products may not have matching vendor catalog entries</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="col-span-1 p-6 space-y-5 bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Billing Info
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Billing Country</span>
                        <span className="font-medium">{financialsData.shippingAddress?.countryCode || 'US'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Methods</span>
                        <span className="font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" /> Other</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Status</span>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Paid</Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" /> Financial Breakdown
                    </h3>
                    {dynamicFinancials && (
                      <div className="space-y-2 text-sm">
                        {dynamicFinancials.walmartFundedIncentiveTotal > 0 ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Subtotal (Seller Price)</span>
                              <span className="font-medium">{formatCurrency(dynamicFinancials.itemsTotal)}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1">
                                  <Gift className="h-3 w-3" /> Walmart Funded Incentive
                                </span>
                                <span className="text-xs text-blue-400">Walmart covers this — based on current listing price</span>
                              </div>
                              <span className="font-medium">-{formatCurrency(dynamicFinancials.walmartFundedIncentiveTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Customer Paid</span>
                              <span className="font-medium">{formatCurrency(dynamicFinancials.customerItemsTotal)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Items Total</span>
                            <span className="font-medium">{formatCurrency(dynamicFinancials.itemsTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tax Total</span>
                          <span className="font-medium">{formatCurrency(dynamicFinancials.taxTotal)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-slate-700 font-medium">Grand Total</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(dynamicFinancials.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between text-orange-600">
                          <div className="flex flex-col">
                            <span>Marketplace Referral Fee</span>
                            {dynamicFinancials.referralFeeRate > 0 && (
                              <span className="text-xs text-orange-400">{dynamicFinancials.referralFeeRate}% — {dynamicFinancials.referralFeeCategory}</span>
                            )}
                          </div>
                          <span className="font-medium">-{formatCurrency(dynamicFinancials.referralFees)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-slate-700 font-medium">Estimated Payout</span>
                          <span className="font-semibold text-emerald-700">{formatCurrency(dynamicFinancials.estimatedPayout)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> Vendor Costs
                    </h3>
                    {dynamicFinancials && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vendor Cost</span>
                          <span className="font-medium">
                            {isLoadingVendors ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                            ) : selectedVendors.length > 0 ? (
                              formatCurrency(dynamicFinancials.vendorCost)
                            ) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Shipping Cost</span>
                          <span className="font-medium">
                            {isLoadingVendors ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                            ) : selectedVendors.length > 0 ? (
                              formatCurrency(dynamicFinancials.vendorShipping)
                            ) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Margin</span>
                          <span className={`font-semibold flex items-center gap-1 ${selectedVendors.length > 0 ? getProfitColor(dynamicFinancials.margin) : 'text-slate-400'}`}>
                            {isLoadingVendors ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                            ) : selectedVendors.length > 0 ? (
                              <>
                                {dynamicFinancials.margin >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                {dynamicFinancials.margin}%
                              </>
                            ) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2 border-dashed">
                          <span className="text-slate-700 font-medium">Est. Net Proceeds</span>
                          <span className={`font-bold text-lg ${selectedVendors.length > 0 ? (dynamicFinancials.estimatedNetProceeds >= 0 ? 'text-green-600' : 'text-red-600') : 'text-slate-400'}`}>
                            {isLoadingVendors ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                            ) : selectedVendors.length > 0 ? (
                              formatCurrency(dynamicFinancials.estimatedNetProceeds)
                            ) : '--'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seller Notes</h3>
                    <Textarea
                      value={sellerNotes}
                      onChange={(e) => setSellerNotes(e.target.value)}
                      placeholder="Add notes for this order..."
                      className="text-sm min-h-[80px] bg-white"
                    />
                  </div>

                  <div>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Star className="h-3.5 w-3.5 mr-1.5" /> Manage Feedback
                    </Button>
                  </div>
                </div>
              </div>

              {fulfillmentStep === 'complete' && poResult ? (
                <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                  {poResult.ingramOrderNumber ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-green-700">Purchase Order Submitted</div>
                          <div className="text-xs text-slate-500">Ingram Micro PO #{poResult.ingramOrderNumber}</div>
                        </div>
                      </div>
                      <Button onClick={closeFulfillModal} className="bg-emerald-600 hover:bg-emerald-700">Done</Button>
                    </div>
                  ) : poResult.warning ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-amber-700">Fulfilled Locally (PO Not Submitted)</div>
                          <div className="text-xs text-slate-500 max-w-md truncate">{poResult.warning}</div>
                        </div>
                      </div>
                      <Button onClick={closeFulfillModal} variant="outline">Close</Button>
                    </div>
                  ) : null}
                </div>
              ) : fulfillmentStep === 'submitting' ? (
                <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                  <div className="flex items-center justify-center gap-3 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Submitting Purchase Order to Ingram Micro...</div>
                      <div className="text-xs text-slate-400">This may take a moment</div>
                    </div>
                  </div>
                </div>
              ) : showPOConfirmation && hasIngramVendor ? (
                <div className="sticky bottom-0 bg-white border-t">
                  <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">Confirm Purchase Order — Ingram Micro</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <div className="text-xs text-blue-600 font-medium mb-1">Items to Order</div>
                        {selectedVendors.filter(v => v.ingramPartNumber).map(v => (
                          <div key={v.orderItemId} className="text-xs text-slate-600 flex justify-between">
                            <span className="font-mono">{v.ingramPartNumber}</span>
                            <span>Qty: {v.quantity || 1} — {formatCurrency(v.costInCents)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-xs text-blue-600 font-medium mb-1">Ship To</div>
                        {financialsData?.shippingAddress ? (
                          <div className="text-xs text-slate-600">
                            <div>{financialsData.shippingAddress.name || financialsData.customerName}</div>
                            <div>{financialsData.shippingAddress.addressLine1}</div>
                            <div>{[financialsData.shippingAddress.city, financialsData.shippingAddress.stateOrRegion, financialsData.shippingAddress.postalCode].filter(Boolean).join(', ')}</div>
                          </div>
                        ) : (
                          <div className="text-xs text-red-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> No shipping address — PO cannot be submitted
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-white/60 rounded px-3 py-2">
                      <span className="text-slate-600">
                        Total Vendor Cost: <span className="font-semibold">{formatCurrency(dynamicFinancials?.vendorCost || 0)}</span>
                        {' + '}Shipping: <span className="font-semibold">{formatCurrency(dynamicFinancials?.vendorShipping || 0)}</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        = {formatCurrency(dynamicFinancials?.totalVendorCost || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="px-6 py-3 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setShowPOConfirmation(false)} className="text-slate-500">
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowPOConfirmation(false); handleFulfillOrder(false); }}
                        disabled={fulfillMutation.isPending}
                      >
                        Save Fulfillment Only
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                        disabled={fulfillMutation.isPending || !financialsData?.shippingAddress?.addressLine1}
                        onClick={() => handleFulfillOrder(true)}
                      >
                        <Package className="h-4 w-4" />
                        Submit PO to Ingram Micro
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {selectedVendors.length > 0 ? (
                      <span className="text-blue-600 font-medium">{selectedVendors.length} vendor(s) selected</span>
                    ) : (
                      'Select vendors from the allocation table to fulfill'
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={closeFulfillModal}>Cancel</Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" /> Get Shipstation Label
                    </Button>
                    {hasIngramVendor ? (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                        disabled={selectedVendors.length === 0 || fulfillMutation.isPending}
                        onClick={() => setShowPOConfirmation(true)}
                      >
                        <Package className="h-4 w-4" />
                        Dropship via Ingram Micro
                      </Button>
                    ) : (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
                        disabled={selectedVendors.length === 0 || fulfillMutation.isPending}
                        onClick={() => handleFulfillOrder(false)}
                      >
                        {fulfillMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Truck className="h-4 w-4" />
                        )}
                        Fulfill Order
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Simple Order Details Dialog (for non-fulfill clicks) */}
      <Dialog open={!!selectedOrderId && !fulfillOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.marketplaceSku}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={item.title || ''}>
                              {item.title || 'Unknown Product'}
                            </div>
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
                          <TableCell className="text-orange-600">{formatCurrency(item.referralFeeInCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedOrderId(null)}>Close</Button>
                {needsFulfillment(orderDetails.status) && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
                    onClick={() => { setSelectedOrderId(null); openFulfillModal(orderDetails.id); }}
                  >
                    <Truck className="h-4 w-4" />
                    Fulfill Order
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
