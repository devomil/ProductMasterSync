import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Package,
  Truck,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  FileText,
  Wifi,
  WifiOff,
  Eye,
} from "lucide-react";

export default function IngramMicroIntegration() {
  const { toast } = useToast();

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchVendorPartNumber, setSearchVendorPartNumber] = useState("");
  const [searchVendorName, setSearchVendorName] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [pricePartNumbers, setPricePartNumbers] = useState("");
  const [priceTriggered, setPriceTriggered] = useState(false);

  const [orderNumber, setOrderNumber] = useState("");
  const [customerOrderNumber, setCustomerOrderNumber] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderSearchTriggered, setOrderSearchTriggered] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");
  const [invoiceSearchTriggered, setInvoiceSearchTriggered] = useState(false);

  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const { data: configStatus, isLoading: configLoading } = useQuery<{ configured: boolean; hasClientId: boolean; hasClientSecret: boolean; hasCustomerNumber: boolean }>({
    queryKey: ["/api/marketplace/ingram-micro/config-status"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/ingram-micro/config-status");
      if (!res.ok) throw new Error("Failed to fetch config status");
      return res.json();
    },
  });

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await fetch("/api/marketplace/ingram-micro/test-connection");
      const data = await res.json();
      setConnectionTestResult({ success: data.success ?? res.ok, message: data.message || (res.ok ? "Connection successful" : "Connection failed") });
      toast({
        title: data.success || res.ok ? "Connection Successful" : "Connection Failed",
        description: data.message || (res.ok ? "Successfully connected to Ingram Micro API" : "Failed to connect"),
        variant: data.success || res.ok ? "default" : "destructive",
      });
    } catch (error: any) {
      setConnectionTestResult({ success: false, message: error.message });
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (searchKeyword) params.set("keyword", searchKeyword);
    if (searchVendorPartNumber) params.set("vendorPartNumber", searchVendorPartNumber);
    if (searchVendorName) params.set("vendorName", searchVendorName);
    if (searchCategory) params.set("category", searchCategory);
    return params.toString();
  };

  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery<any>({
    queryKey: ["/api/marketplace/ingram-micro/products/search", searchKeyword, searchVendorPartNumber, searchVendorName, searchCategory],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/ingram-micro/products/search?${buildSearchParams()}`);
      if (!res.ok) throw new Error("Failed to search products");
      return res.json();
    },
    enabled: searchTriggered,
  });

  const handleProductSearch = () => {
    if (!searchKeyword && !searchVendorPartNumber && !searchVendorName && !searchCategory) {
      toast({ title: "Search Required", description: "Please enter at least one search criterion", variant: "destructive" });
      return;
    }
    setSearchTriggered(true);
    setTimeout(() => refetchSearch(), 0);
  };

  const parsePricePartNumbers = () => {
    return pricePartNumbers
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((ingramPartNumber) => ({ ingramPartNumber }));
  };

  const priceMutation = useMutation({
    mutationFn: async (products: { ingramPartNumber: string }[]) => {
      const response = await apiRequest("POST", "/api/marketplace/ingram-micro/products/price-availability", { products });
      return response.json();
    },
    onError: (error: any) => {
      toast({ title: "Price Check Failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePriceCheck = () => {
    const products = parsePricePartNumbers();
    if (products.length === 0) {
      toast({ title: "Input Required", description: "Please enter at least one Ingram part number", variant: "destructive" });
      return;
    }
    priceMutation.mutate(products);
  };

  const handleCheckPriceForProduct = (ingramPartNumber: string) => {
    setPricePartNumbers(ingramPartNumber);
    priceMutation.mutate([{ ingramPartNumber }]);
  };

  const buildOrderSearchParams = () => {
    const params = new URLSearchParams();
    if (orderNumber) params.set("orderNumber", orderNumber);
    if (customerOrderNumber) params.set("customerOrderNumber", customerOrderNumber);
    if (orderStatus) params.set("status", orderStatus);
    if (orderDateFrom) params.set("dateFrom", orderDateFrom);
    if (orderDateTo) params.set("dateTo", orderDateTo);
    return params.toString();
  };

  const { data: orderResults, isLoading: orderLoading, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["/api/marketplace/ingram-micro/orders/search", orderNumber, customerOrderNumber, orderStatus, orderDateFrom, orderDateTo],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/ingram-micro/orders/search?${buildOrderSearchParams()}`);
      if (!res.ok) throw new Error("Failed to search orders");
      return res.json();
    },
    enabled: orderSearchTriggered,
  });

  const handleOrderSearch = () => {
    setOrderSearchTriggered(true);
    setTimeout(() => refetchOrders(), 0);
  };

  const buildInvoiceSearchParams = () => {
    const params = new URLSearchParams();
    if (invoiceNumber) params.set("invoiceNumber", invoiceNumber);
    if (invoiceStatus) params.set("status", invoiceStatus);
    if (invoiceType) params.set("type", invoiceType);
    if (invoiceDateFrom) params.set("dateFrom", invoiceDateFrom);
    if (invoiceDateTo) params.set("dateTo", invoiceDateTo);
    return params.toString();
  };

  const { data: invoiceResults, isLoading: invoiceLoading, refetch: refetchInvoices } = useQuery<any>({
    queryKey: ["/api/marketplace/ingram-micro/invoices/search", invoiceNumber, invoiceStatus, invoiceType, invoiceDateFrom, invoiceDateTo],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/ingram-micro/invoices/search?${buildInvoiceSearchParams()}`);
      if (!res.ok) throw new Error("Failed to search invoices");
      return res.json();
    },
    enabled: invoiceSearchTriggered,
  });

  const handleInvoiceSearch = () => {
    setInvoiceSearchTriggered(true);
    setTimeout(() => refetchInvoices(), 0);
  };

  const isConfigured = configStatus?.configured === true;
  const products = searchResults?.products || searchResults?.catalog || searchResults?.items || [];
  const orders = orderResults?.orders || orderResults?.items || [];
  const invoices = invoiceResults?.invoices || invoiceResults?.items || [];
  const priceResults = priceMutation.data?.products || priceMutation.data?.items || priceMutation.data || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ingram Micro Integration</h1>
            <p className="text-muted-foreground mt-1">
              Search products, check pricing, and manage orders with Ingram Micro
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wifi className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>Ingram Micro API configuration and connectivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Configuration:</span>
                {configLoading ? (
                  <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Checking...</Badge>
                ) : isConfigured ? (
                  <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Configured</Badge>
                ) : (
                  <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Configured</Badge>
                )}
              </div>
              {configStatus && !configLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Client ID: {configStatus.hasClientId ? "✓" : "✗"}</span>
                  <span>Client Secret: {configStatus.hasClientSecret ? "✓" : "✗"}</span>
                  <span>Customer #: {configStatus.hasCustomerNumber ? "✓" : "✗"}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:ml-auto">
              <Button onClick={handleTestConnection} disabled={testingConnection} variant="outline" size="sm">
                {testingConnection ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Test Connection</>
                )}
              </Button>
              {connectionTestResult && (
                <Badge className={connectionTestResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {connectionTestResult.success ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {connectionTestResult.success ? "Connected" : "Failed"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Product Search
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Price & Availability
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Products</CardTitle>
              <CardDescription>Search the Ingram Micro product catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Keyword</label>
                  <Input
                    placeholder="Search keyword..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vendor Part Number</label>
                  <Input
                    placeholder="Vendor part #..."
                    value={searchVendorPartNumber}
                    onChange={(e) => setSearchVendorPartNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vendor Name</label>
                  <Input
                    placeholder="Vendor name..."
                    value={searchVendorName}
                    onChange={(e) => setSearchVendorName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Input
                    placeholder="Category..."
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
                  />
                </div>
              </div>
              <Button onClick={handleProductSearch} disabled={searchLoading}>
                {searchLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Search Products</>
                )}
              </Button>
            </CardContent>
          </Card>

          {searchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Search Results
                  {products.length > 0 && (
                    <Badge variant="secondary">{products.length} products</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No products found. Try different search criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingram Part#</TableHead>
                          <TableHead>Vendor Part#</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="max-w-[300px]">Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>UPC</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: any, idx: number) => (
                          <TableRow key={product.ingramPartNumber || idx}>
                            <TableCell className="font-mono text-sm">{product.ingramPartNumber || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{product.vendorPartNumber || "-"}</TableCell>
                            <TableCell>{product.vendorName || product.vendor || "-"}</TableCell>
                            <TableCell className="max-w-[300px] truncate">{product.description || "-"}</TableCell>
                            <TableCell>{product.category || product.subCategory || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{product.upc || product.upcCode || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Check Price"
                                  onClick={() => product.ingramPartNumber && handleCheckPriceForProduct(product.ingramPartNumber)}
                                  disabled={!product.ingramPartNumber}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Check Price & Availability</CardTitle>
              <CardDescription>Enter Ingram Micro part numbers to check real-time pricing and stock availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Ingram Part Numbers</label>
                <Textarea
                  placeholder="Enter part numbers separated by commas or one per line&#10;e.g. ABC123, DEF456&#10;or&#10;ABC123&#10;DEF456"
                  value={pricePartNumbers}
                  onChange={(e) => setPricePartNumbers(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {parsePricePartNumbers().length} part number(s) entered
                </p>
              </div>
              <Button onClick={handlePriceCheck} disabled={priceMutation.isPending}>
                {priceMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking Prices...</>
                ) : (
                  <><DollarSign className="h-4 w-4 mr-2" />Check Price & Availability</>
                )}
              </Button>
            </CardContent>
          </Card>

          {(priceMutation.data || priceMutation.isPending) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Price & Availability Results
                  {Array.isArray(priceResults) && priceResults.length > 0 && (
                    <Badge variant="secondary">{priceResults.length} products</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {priceMutation.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !Array.isArray(priceResults) || priceResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pricing data available.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part#</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="max-w-[250px]">Description</TableHead>
                          <TableHead className="text-right">Customer Price</TableHead>
                          <TableHead className="text-right">Retail Price</TableHead>
                          <TableHead className="text-right">Available Qty</TableHead>
                          <TableHead>Warehouse</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {priceResults.map((item: any, idx: number) => (
                          <TableRow key={item.ingramPartNumber || idx}>
                            <TableCell className="font-mono text-sm">{item.ingramPartNumber || "-"}</TableCell>
                            <TableCell>{item.vendorName || item.vendor || "-"}</TableCell>
                            <TableCell className="max-w-[250px] truncate">{item.description || "-"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {item.customerPrice != null ? `$${Number(item.customerPrice).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.retailPrice != null ? `$${Number(item.retailPrice).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.availability?.totalAvailability != null ? (
                                <Badge className={item.availability.totalAvailability > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {item.availability.totalAvailability}
                                </Badge>
                              ) : item.totalAvailability != null ? (
                                <Badge className={item.totalAvailability > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {item.totalAvailability}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {item.availability?.availabilityByWarehouse ? (
                                <div className="space-y-1">
                                  {item.availability.availabilityByWarehouse.map((wh: any, whIdx: number) => (
                                    <div key={whIdx} className="text-xs">
                                      <span className="font-medium">{wh.warehouseId || wh.location}:</span> {wh.quantityAvailable ?? wh.quantity ?? 0}
                                    </div>
                                  ))}
                                </div>
                              ) : item.warehouseDetails ? (
                                <div className="space-y-1">
                                  {(Array.isArray(item.warehouseDetails) ? item.warehouseDetails : []).map((wh: any, whIdx: number) => (
                                    <div key={whIdx} className="text-xs">
                                      <span className="font-medium">{wh.warehouseId || wh.location}:</span> {wh.quantityAvailable ?? wh.quantity ?? 0}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Orders</CardTitle>
              <CardDescription>Search and manage Ingram Micro orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Number</label>
                  <Input
                    placeholder="Ingram order #..."
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOrderSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Order Number</label>
                  <Input
                    placeholder="Customer order #..."
                    value={customerOrderNumber}
                    onChange={(e) => setCustomerOrderNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOrderSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={orderStatus} onValueChange={setOrderStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="backordered">Backordered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date From</label>
                  <Input
                    type="date"
                    value={orderDateFrom}
                    onChange={(e) => setOrderDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date To</label>
                  <Input
                    type="date"
                    value={orderDateTo}
                    onChange={(e) => setOrderDateTo(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleOrderSearch} disabled={orderLoading}>
                {orderLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Search Orders</>
                )}
              </Button>
            </CardContent>
          </Card>

          {orderSearchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Results
                  {orders.length > 0 && (
                    <Badge variant="secondary">{orders.length} orders</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No orders found. Try different search criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingram Order#</TableHead>
                          <TableHead>Customer Order#</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any, idx: number) => (
                          <TableRow key={order.ingramOrderNumber || order.orderNumber || idx}>
                            <TableCell className="font-mono text-sm">{order.ingramOrderNumber || order.orderNumber || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{order.customerOrderNumber || "-"}</TableCell>
                            <TableCell>{order.vendorName || order.vendor || "-"}</TableCell>
                            <TableCell>
                              <Badge className={
                                (order.status || "").toLowerCase() === "shipped" ? "bg-blue-100 text-blue-800" :
                                (order.status || "").toLowerCase() === "delivered" ? "bg-green-100 text-green-800" :
                                (order.status || "").toLowerCase() === "cancelled" ? "bg-red-100 text-red-800" :
                                (order.status || "").toLowerCase() === "processing" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }>
                                {order.status || "Unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>{order.orderDate || order.createdDate || "-"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {order.totalAmount != null ? `$${Number(order.totalAmount).toFixed(2)}` : order.total != null ? `$${Number(order.total).toFixed(2)}` : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Invoices</CardTitle>
              <CardDescription>Search Ingram Micro invoices by number, status, type, or date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Invoice Number</label>
                  <Input
                    placeholder="Invoice #..."
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvoiceSearch()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={invoiceType} onValueChange={setInvoiceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="credit_memo">Credit Memo</SelectItem>
                      <SelectItem value="debit_memo">Debit Memo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date From</label>
                  <Input
                    type="date"
                    value={invoiceDateFrom}
                    onChange={(e) => setInvoiceDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date To</label>
                  <Input
                    type="date"
                    value={invoiceDateTo}
                    onChange={(e) => setInvoiceDateTo(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleInvoiceSearch} disabled={invoiceLoading}>
                {invoiceLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Search Invoices</>
                )}
              </Button>
            </CardContent>
          </Card>

          {invoiceSearchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Results
                  {invoices.length > 0 && (
                    <Badge variant="secondary">{invoices.length} invoices</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoiceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No invoices found. Try different search criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice#</TableHead>
                          <TableHead>Order#</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice: any, idx: number) => (
                          <TableRow key={invoice.invoiceNumber || idx}>
                            <TableCell className="font-mono text-sm">{invoice.invoiceNumber || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{invoice.orderNumber || invoice.ingramOrderNumber || "-"}</TableCell>
                            <TableCell>
                              <Badge className={
                                (invoice.status || "").toLowerCase() === "paid" ? "bg-green-100 text-green-800" :
                                (invoice.status || "").toLowerCase() === "past_due" ? "bg-red-100 text-red-800" :
                                (invoice.status || "").toLowerCase() === "void" ? "bg-gray-100 text-gray-600" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {invoice.status || "Unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>{invoice.invoiceType || invoice.type || "-"}</TableCell>
                            <TableCell>{invoice.invoiceDate || invoice.date || "-"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {invoice.totalAmount != null ? `$${Number(invoice.totalAmount).toFixed(2)}` : invoice.amount != null ? `$${Number(invoice.amount).toFixed(2)}` : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
