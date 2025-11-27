import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Package,
  Truck,
  AlertCircle,
  Calendar,
  Filter,
  ChevronDown,
  Loader2,
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
  shippingDate?: string;
  orderDate: string;
  totalInCents: number;
  needsAttention: boolean;
  hasLateDocument: boolean;
  isCancelled: boolean;
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
    needsAttention: number;
  };
}

export default function ManageOrders() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [page, setPage] = useState(1);

  const { data: ordersData, isLoading } = useQuery<OrdersResponse>({
    queryKey: ['/api/marketplace/orders', statusFilter, marketplaceFilter, searchQuery, page],
  });

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'unshipped': return 'bg-orange-100 text-orange-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'on_hold': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleOrder = (orderId: number) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === ordersData?.orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(ordersData?.orders.map(o => o.id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manage Orders</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage orders from all marketplaces
          </p>
        </div>
        <Button data-testid="button-view-all-orders">
          View All Orders
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersData?.stats.totalOrders || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{ordersData?.stats.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unshipped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{ordersData?.stats.unshipped || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Shipped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{ordersData?.stats.shipped || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{ordersData?.stats.needsAttention || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{ordersData?.stats.cancelled || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Status */}
      <Tabs defaultValue="all" onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="unshipped">Unshipped</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-orders"
                  />
                </div>

                {/* Marketplace Filter */}
                <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
                  <SelectTrigger data-testid="select-marketplace">
                    <SelectValue placeholder="All Marketplaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Marketplaces</SelectItem>
                    <SelectItem value="walmart">Walmart</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="ebay">eBay</SelectItem>
                    <SelectItem value="newegg">Newegg</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range (placeholder) */}
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Orders</CardTitle>
                <CardDescription>
                  {ordersData?.orders.length || 0} orders found
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedOrders.length > 0 && `${selectedOrders.length} selected`}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !ordersData?.orders.length ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No orders found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            checked={selectedOrders.length === ordersData.orders.length}
                            onCheckedChange={toggleAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Marketplace</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData.orders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleOrder(order.id)}
                              data-testid={`checkbox-order-${order.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {order.marketplace === 'walmart' && (
                                <SiWalmart className="h-4 w-4" />
                              )}
                              {order.marketplace === 'amazon' && (
                                <SiAmazon className="h-4 w-4" />
                              )}
                              <span className="capitalize">{order.marketplace}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeColor(order.status)}>
                              {order.status}
                            </Badge>
                            {order.needsAttention && (
                              <div className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Needs Attention
                              </div>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-customer-${order.id}`}>
                            {order.customerName || 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground" data-testid={`text-date-${order.id}`}>
                            {new Date(order.orderDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-tracking-${order.id}`}>
                            {order.shippingTrackingNumber ? (
                              <div>
                                <div className="font-mono text-xs">{order.shippingTrackingNumber}</div>
                                <div className="text-muted-foreground text-xs">{order.shippingCarrier}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not shipped</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-total-${order.id}`}>
                            ${(order.totalInCents / 100).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
