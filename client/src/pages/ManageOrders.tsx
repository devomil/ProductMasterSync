import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw,
  Loader2,
  Package,
  ExternalLink,
  Filter,
  X,
  CheckCircle,
  AlertTriangle,
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
  stats: {
    totalOrders: number;
    pending: number;
    unshipped: number;
    shipped: number;
    cancelled: number;
  };
}

interface QuickFilter {
  id: string;
  label: string;
  count?: number;
}

export default function ManageOrders() {
  const [statusTab, setStatusTab] = useState<string>('all');
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);
  
  const [needsAttention, setNeedsAttention] = useState<string>('all');
  const [shipByDate, setShipByDate] = useState<string>('all');
  const [salesChannels, setSalesChannels] = useState<string[]>([]);
  const [shippingService, setShippingService] = useState<string[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [shippingSettingsType, setShippingSettingsType] = useState<string>('all');
  const [deliveryRecommendation, setDeliveryRecommendation] = useState<string[]>([]);
  
  const [dateRange, setDateRange] = useState<string>('7days');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [resultsPerPage, setResultsPerPage] = useState<string>('15');
  const [page, setPage] = useState(1);

  const { data: ordersData, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['/api/marketplace/orders', statusTab, salesChannels, shipByDate, page],
  });

  const quickFilters: QuickFilter[] = [
    { id: 'ship_today', label: 'Ship by today', count: 0 },
    { id: 'premium_unshipped', label: 'Premium unshipped', count: 0 },
    { id: 'business_unshipped', label: 'Business customer unshipped', count: 0 },
    { id: 'late_shipment', label: 'Verge of Late Shipment', count: 0 },
    { id: 'cancellation', label: 'Verge of Cancellation', count: 0 },
  ];

  const toggleQuickFilter = (filterId: string) => {
    setActiveQuickFilters(prev =>
      prev.includes(filterId) ? prev.filter(f => f !== filterId) : [...prev, filterId]
    );
  };

  const toggleSalesChannel = (channel: string) => {
    setSalesChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const toggleOrderType = (type: string) => {
    setOrderTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setActiveQuickFilters([]);
    setNeedsAttention('all');
    setShipByDate('all');
    setSalesChannels([]);
    setShippingService([]);
    setOrderTypes([]);
    setPendingActions([]);
    setShippingSettingsType('all');
    setDeliveryRecommendation([]);
  };

  const hasActiveFilters = activeQuickFilters.length > 0 || salesChannels.length > 0 || 
    needsAttention !== 'all' || shipByDate !== 'all' || orderTypes.length > 0;

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'unshipped': return 'bg-orange-100 text-orange-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {['pending', 'unshipped', 'cancelled', 'shipped'].map(status => (
            <button
              key={status}
              onClick={() => setStatusTab(status)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                statusTab === status
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`tab-${status}`}
            >
              {ordersData?.stats?.[status as keyof typeof ordersData.stats] || 0} {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <a href="#" className="text-blue-600 hover:underline text-sm flex items-center gap-1" data-testid="link-fba-orders">
          View FBA orders <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Quick Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Quick Filters:</span>
        {quickFilters.map(filter => (
          <Button
            key={filter.id}
            variant={activeQuickFilters.includes(filter.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleQuickFilter(filter.id)}
            className="text-xs"
            data-testid={`quick-filter-${filter.id}`}
          >
            {filter.count !== undefined && `${filter.count} `}{filter.label}
          </Button>
        ))}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="flex items-center gap-1">
            All dates
            <X className="h-3 w-3 cursor-pointer" onClick={() => setShipByDate('all')} />
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-blue-600">
            Clear all
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-blue-600">
            Save as quick filter
          </Button>
        </div>
      )}

      {/* Main Content with Sidebar */}
      <div className="flex gap-6">
        {/* Left Sidebar - Filters */}
        <div className="w-64 flex-shrink-0">
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Refine by:</CardTitle>
                <Button variant="outline" size="sm" className="text-xs h-7" data-testid="button-hide-filters">
                  <Filter className="h-3 w-3 mr-1" />
                  Hide Filters
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="space-y-6">
                  {/* Needs Attention */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Needs Attention</h4>
                    <RadioGroup value={needsAttention} onValueChange={setNeedsAttention}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cancellation" id="att-cancellation" />
                        <Label htmlFor="att-cancellation" className="text-sm">Verge of Cancellation</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="late" id="att-late" />
                        <Label htmlFor="att-late" className="text-sm">Verge of Late Shipment</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Ship by date */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Ship by date</h4>
                    <RadioGroup value={shipByDate} onValueChange={setShipByDate}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="ship-all" />
                        <Label htmlFor="ship-all" className="text-sm">All dates</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="today" id="ship-today" />
                        <Label htmlFor="ship-today" className="text-sm">Ship by today</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="tomorrow" id="ship-tomorrow" />
                        <Label htmlFor="ship-tomorrow" className="text-sm">Ship by tomorrow</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Sales channel */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Sales channel</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="channel-walmart" 
                          checked={salesChannels.includes('walmart')}
                          onCheckedChange={() => toggleSalesChannel('walmart')}
                          data-testid="checkbox-channel-walmart"
                        />
                        <Label htmlFor="channel-walmart" className="text-sm flex items-center gap-1">
                          <SiWalmart className="h-3 w-3" /> Walmart
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="channel-amazon" 
                          checked={salesChannels.includes('amazon')}
                          onCheckedChange={() => toggleSalesChannel('amazon')}
                          data-testid="checkbox-channel-amazon"
                        />
                        <Label htmlFor="channel-amazon" className="text-sm flex items-center gap-1">
                          <SiAmazon className="h-3 w-3" /> Amazon
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="channel-newegg" 
                          checked={salesChannels.includes('newegg')}
                          onCheckedChange={() => toggleSalesChannel('newegg')}
                          data-testid="checkbox-channel-newegg"
                        />
                        <Label htmlFor="channel-newegg" className="text-sm">NewEgg</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="channel-ebay" 
                          checked={salesChannels.includes('ebay')}
                          onCheckedChange={() => toggleSalesChannel('ebay')}
                          data-testid="checkbox-channel-ebay"
                        />
                        <Label htmlFor="channel-ebay" className="text-sm">eBay</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Shipping service */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Shipping service</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="shipping-premium" 
                          checked={shippingService.includes('premium')}
                          onCheckedChange={() => setShippingService(prev => 
                            prev.includes('premium') ? prev.filter(s => s !== 'premium') : [...prev, 'premium']
                          )}
                        />
                        <Label htmlFor="shipping-premium" className="text-sm">Premium</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Order type */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Order type</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="type-subscription" 
                          checked={orderTypes.includes('subscription')}
                          onCheckedChange={() => toggleOrderType('subscription')}
                        />
                        <Label htmlFor="type-subscription" className="text-sm">Subscribe & Save</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="type-business" 
                          checked={orderTypes.includes('business')}
                          onCheckedChange={() => toggleOrderType('business')}
                        />
                        <Label htmlFor="type-business" className="text-sm">Business customer</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pending actions */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Pending actions</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="action-cancel" 
                          checked={pendingActions.includes('buyer_cancel')}
                          onCheckedChange={() => setPendingActions(prev => 
                            prev.includes('buyer_cancel') ? prev.filter(a => a !== 'buyer_cancel') : [...prev, 'buyer_cancel']
                          )}
                        />
                        <Label htmlFor="action-cancel" className="text-sm">Buyer requested cancel</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Shipping Settings Type */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Shipping Settings Type</h4>
                    <RadioGroup value={shippingSettingsType} onValueChange={setShippingSettingsType}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="automated" id="settings-auto" />
                        <Label htmlFor="settings-auto" className="text-sm">Automated</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="settings-manual" />
                        <Label htmlFor="settings-manual" className="text-sm">Manual</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Delivery Recommendation */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Delivery Recommendation</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="delivery-signature" 
                          checked={deliveryRecommendation.includes('signature')}
                          onCheckedChange={() => setDeliveryRecommendation(prev => 
                            prev.includes('signature') ? prev.filter(d => d !== 'signature') : [...prev, 'signature']
                          )}
                        />
                        <Label htmlFor="delivery-signature" className="text-sm">Signature Confirmation</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Table Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{ordersData?.total || 0} orders</span>
              <span className="text-sm text-muted-foreground">Last 7 days</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40" data-testid="select-date-range">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Ship by date (ascending)</SelectItem>
                  <SelectItem value="date_asc">Ship by date (descending)</SelectItem>
                  <SelectItem value="order_date">Order date</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resultsPerPage} onValueChange={setResultsPerPage}>
                <SelectTrigger className="w-36" data-testid="select-per-page">
                  <SelectValue placeholder="Results per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" data-testid="button-table-preferences">
                Set Table Preferences
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Marketplace Connection Status */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium">Connected Marketplaces:</span>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <SiWalmart className="h-4 w-4" />
              <span className="text-sm">Walmart</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <SiAmazon className="h-4 w-4" />
              <span className="text-sm">Amazon</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">NewEgg (Not Connected)</span>
            </div>
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !ordersData?.orders?.length ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No orders found</p>
                  <p className="text-muted-foreground mt-1">Orders from your connected marketplaces will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox data-testid="checkbox-select-all" />
                      </TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Ship By</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersData.orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox data-testid={`checkbox-order-${order.id}`} />
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-order-${order.id}`}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.marketplace === 'walmart' && <SiWalmart className="h-4 w-4" />}
                            {order.marketplace === 'amazon' && <SiAmazon className="h-4 w-4" />}
                            <span className="capitalize">{order.marketplace}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeColor(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.customerName || 'N/A'}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.shipByDate ? new Date(order.shipByDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.shippingTrackingNumber || '-'}
                        </TableCell>
                        <TableCell>
                          ${((order.totalInCents || 0) / 100).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-end mt-4">
            <Select value={resultsPerPage} onValueChange={setResultsPerPage}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Results per page: 15</SelectItem>
                <SelectItem value="25">Results per page: 25</SelectItem>
                <SelectItem value="50">Results per page: 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
