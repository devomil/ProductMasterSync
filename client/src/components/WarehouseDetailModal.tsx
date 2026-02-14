import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Package, Clock, TruckIcon, DollarSign, Truck, Shield, Tag, FileText, RefreshCw } from "lucide-react";
import UrlHealthIndicator from "@/components/url-validation/UrlHealthIndicator";
import { apiRequest } from "@/lib/queryClient";

interface WarehouseLocation {
  code: string;
  name: string;
  location: string;
  quantity: number;
  cost: number;
}

interface WarehouseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  sku: string;
  productId?: string;
  supplierSku?: string;
}

export default function WarehouseDetailModal({ 
  isOpen, 
  onClose, 
  vendorName, 
  sku,
  productId,
  supplierSku 
}: WarehouseDetailModalProps) {
  const [isValidatingUrls, setIsValidatingUrls] = useState(false);
  const queryClient = useQueryClient();

  const isIngramMicro = vendorName?.toLowerCase().includes('ingram');

  // Fetch Ingram Micro real-time data when vendor is Ingram Micro
  const { data: ingramData, isLoading: isLoadingIngram } = useQuery({
    queryKey: [`/api/marketplace/ingram-micro/warehouse-details/${supplierSku}`],
    enabled: isOpen && isIngramMicro && !!supplierSku,
  }) as { data: any, isLoading: boolean };

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: [`/api/inventory/${sku}`],
    enabled: isOpen && !!sku && !isIngramMicro,
  }) as { data: any, isLoading: boolean };

  // Get comprehensive product data for supplier-specific fields using warehouse-specific endpoint
  const { data: productData } = useQuery({
    queryKey: [`/api/products/${productId}/warehouse-details`],
    enabled: isOpen && !!productId && !isIngramMicro,
  }) as { data: any };

  // For Ingram Micro, use the API data as both inventory and product data
  const effectiveProductData = isIngramMicro ? ingramData : productData;
  const effectiveInventoryData = isIngramMicro ? {
    warehouses: ingramData?.warehouses || [],
    totalStock: ingramData?.totalStock || 0,
    reservedStock: ingramData?.reservedStock || 0,
    supplierName: 'Ingram Micro',
    source: 'Ingram Micro API (Real-time)',
  } : inventoryData;
  const isLoading = isIngramMicro ? isLoadingIngram : isLoadingInventory;

  // Get documentation health status
  const { data: documentationHealth, isLoading: isLoadingHealth } = useQuery({
    queryKey: [`/api/products/${productId}/documentation-health`],
    enabled: isOpen && !!productId && !isIngramMicro,
  }) as { data: any, isLoading: boolean };

  // Mutation for validating URLs
  const validateUrlsMutation = useMutation({
    mutationFn: () => {
      return fetch(`/api/products/${productId}/validate-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json());
    },
    onMutate: () => setIsValidatingUrls(true),
    onSettled: () => setIsValidatingUrls(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/documentation-health`] });
    }
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {vendorName} - {sku}
          </DialogTitle>
          <DialogDescription>
            Comprehensive inventory and supplier information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="inventory" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Pricing
              </TabsTrigger>
              <TabsTrigger value="shipping" className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                Shipping
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Promotions
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Documentation
              </TabsTrigger>
            </TabsList>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Stock Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Available Quantity:</span>
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {effectiveProductData?.quantityAvailableToShip || "0"}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Backordered:</span>
                      <Badge variant={effectiveProductData?.quantityBackordered > 0 ? 'destructive' : 'secondary'}>
                        {effectiveProductData?.quantityBackordered || "0"}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Committed:</span>
                      <span className="font-medium">{effectiveProductData?.quantityCommitted || "0"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">On Hand:</span>
                      <span className="font-medium">{effectiveProductData?.quantityOnHand || "0"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Product Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Product Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Weight:</span>
                      <span className="font-medium">{effectiveProductData?.weight || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Case Quantity:</span>
                      <span className="font-medium">{effectiveProductData?.caseQuantity || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">UPC:</span>
                      <span className="font-medium text-sm">{effectiveProductData?.upc || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Manufacturer:</span>
                      <span className="font-medium">{effectiveProductData?.manufacturer || "N/A"}</span>
                    </div>
                    {isIngramMicro && effectiveProductData?.productClass && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Product Class:</span>
                        <Badge variant="outline">{effectiveProductData.productClass === 'A' ? 'Stock Item' : effectiveProductData.productClass === 'B' ? 'Special Order' : effectiveProductData.productClass}</Badge>
                      </div>
                    )}
                    {isIngramMicro && effectiveProductData?.supplierSku && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Ingram Part #:</span>
                        <span className="font-mono font-medium">{effectiveProductData.supplierSku}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Pricing & Dimensions Summary (for Ingram Micro) */}
              {isIngramMicro && effectiveProductData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-green-600">Live Pricing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-xs text-gray-600">Customer Cost</div>
                          <div className="font-bold text-xl text-green-700">${parseFloat(effectiveProductData.cost || '0').toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-xs text-gray-600">MSRP / List</div>
                          <div className="font-bold text-xl text-blue-700">${parseFloat(effectiveProductData.listPrice || effectiveProductData.msrp || '0').toFixed(2)}</div>
                        </div>
                      </div>
                      {effectiveProductData.mapPrice > 0 && (
                        <div className="mt-3 text-center p-2 bg-yellow-50 rounded-lg">
                          <div className="text-xs text-gray-600">MAP Price</div>
                          <div className="font-semibold text-yellow-700">${parseFloat(effectiveProductData.mapPrice).toFixed(2)}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-purple-600">Package Dimensions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-600">Height</div>
                          <div className="font-semibold">{effectiveProductData.boxHeight || 'N/A'}</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-600">Length</div>
                          <div className="font-semibold">{effectiveProductData.boxLength || 'N/A'}</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-600">Width</div>
                          <div className="font-semibold">{effectiveProductData.boxWidth || 'N/A'}</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-600">Weight</div>
                          <div className="font-semibold">{effectiveProductData.weight || 'N/A'}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* No stock warning when warehouses are empty (only show when API data was fetched) */}
              {effectiveInventoryData?.warehouses && effectiveInventoryData.warehouses.length === 0 && isIngramMicro && ingramData && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-medium text-yellow-800">No Warehouse Stock Available</div>
                        <div className="text-sm text-yellow-700">
                          This product currently has 0 units across all Ingram Micro warehouses.
                          {effectiveProductData?.productClass === 'X' && ' Product class "X" indicates this item may be discontinued or withdrawn.'}
                          {effectiveProductData?.productStatusCode === 'W' && ' Status "W" indicates withdrawn status.'}
                          {effectiveProductData?.acceptBackOrder && ' Back orders are accepted.'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dynamic Warehouse Locations from Supplier Feed */}
              {effectiveInventoryData?.warehouses && effectiveInventoryData.warehouses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      {isIngramMicro ? 'Ingram Micro Warehouse Locations' : 'Supplier Warehouse Locations'}
                      {effectiveInventoryData.source && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {effectiveInventoryData.source}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="text-sm text-gray-600">
                      Real-time inventory from {effectiveInventoryData.supplierName || 'supplier'} warehouse network
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {effectiveInventoryData.warehouses.map((warehouse: any, index: number) => (
                        <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-gray-900">{warehouse.name}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Code:</span>
                              <Badge variant="secondary" className="text-xs">{warehouse.code}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Location:</span>
                              <span className="font-medium">{warehouse.location}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Region:</span>
                              <span className="text-blue-600">{warehouse.region || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Available:</span>
                              <Badge variant={warehouse.quantity > 10 ? 'default' : warehouse.quantity > 0 ? 'secondary' : 'destructive'}>
                                {warehouse.quantity} units
                              </Badge>
                            </div>
                            {warehouse.backOrderQuantity > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Backordered:</span>
                                <Badge variant="destructive">{warehouse.backOrderQuantity} units</Badge>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Lead Time:</span>
                              <span className="text-green-600 font-medium">{warehouse.leadTime || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cost:</span>
                              <span className="font-bold">${parseFloat(warehouse.cost || '0').toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Summary */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{effectiveInventoryData.totalStock || 0}</div>
                          <div className="text-xs text-gray-600">Total Available</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{effectiveInventoryData.warehouses.length}</div>
                          <div className="text-xs text-gray-600">Locations</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{effectiveInventoryData.reservedStock || 0}</div>
                          <div className="text-xs text-gray-600">Reserved</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">{vendorName} Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">List Price:</span>
                      <span className="font-bold text-lg">${effectiveProductData?.listPrice || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Cost:</span>
                      <span className="font-medium">${effectiveProductData?.cost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Map Price:</span>
                      <span className="font-medium">${effectiveProductData?.mapPrice || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">MSRP:</span>
                      <span className="font-medium">${effectiveProductData?.msrp || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Pricing Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isIngramMicro && effectiveProductData?.specialBidPricingAvailable && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Special Bid Pricing:</span>
                        <Badge variant="default">Available</Badge>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Core Cost:</span>
                      <span className="font-medium">${effectiveProductData?.coreCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Tariff Cost:</span>
                      <span className="font-medium">${effectiveProductData?.tariffCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Price Updated:</span>
                      <span className="font-medium">{effectiveProductData?.priceUpdateDate || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Volume Discounts for Ingram Micro */}
              {isIngramMicro && effectiveProductData?.discounts && effectiveProductData.discounts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Volume Discounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-gray-600">Min Quantity</th>
                            <th className="text-right py-2 font-medium text-gray-600">Unit Price</th>
                            <th className="text-right py-2 font-medium text-gray-600">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveProductData.discounts.map((d: any, i: number) => (
                            <tr key={i} className="border-b">
                              <td className="py-2">{d.quantity}+</td>
                              <td className="py-2 text-right font-bold text-green-700">${parseFloat(d.price || '0').toFixed(2)}</td>
                              <td className="py-2 text-right text-xs text-gray-500">{d.expiryDate || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Shipping Tab */}
            <TabsContent value="shipping" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">{vendorName} Shipping</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Shipping Cost:</span>
                      <span className="font-medium">{effectiveProductData?.shippingCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Free Freight:</span>
                      <Badge variant={effectiveProductData?.freeFreight ? 'default' : 'secondary'}>
                        {effectiveProductData?.freeFreight ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Direct Ship:</span>
                      <Badge variant={effectiveProductData?.directShip ? 'default' : 'secondary'}>
                        {effectiveProductData?.directShip ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {isIngramMicro && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Heavy Weight:</span>
                        <Badge variant={effectiveProductData?.isHeavyWeight ? 'destructive' : 'secondary'}>
                          {effectiveProductData?.isHeavyWeight ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Shipping Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Oversized:</span>
                      <Badge variant={effectiveProductData?.oversized ? 'destructive' : 'secondary'}>
                        {effectiveProductData?.oversized ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Exportable:</span>
                      <Badge variant={effectiveProductData?.exportable ? 'default' : 'secondary'}>
                        {effectiveProductData?.exportable ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Country of Origin:</span>
                      <span className="font-medium">{effectiveProductData?.countryOfOrigin || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Dropship Available:</span>
                      <Badge variant={effectiveProductData?.dropship ? 'default' : 'secondary'}>
                        {effectiveProductData?.dropship ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Lead Time:</span>
                      <span className="font-medium">{effectiveProductData?.leadTime || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Freight Estimate for Ingram Micro */}
              {isIngramMicro && effectiveProductData?.freightEstimate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Estimated Freight (to NYC 10001)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-gray-600">
                      {typeof effectiveProductData.freightEstimate === 'object' 
                        ? JSON.stringify(effectiveProductData.freightEstimate, null, 2).slice(0, 500)
                        : effectiveProductData.freightEstimate}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Package Dimensions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Package Dimensions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Height</div>
                      <div className="font-semibold text-lg">{effectiveProductData?.boxHeight || "N/A"}</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Length</div>
                      <div className="font-semibold text-lg">{effectiveProductData?.boxLength || "N/A"}</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Width</div>
                      <div className="font-semibold text-lg">{effectiveProductData?.boxWidth || "N/A"}</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Case Qty</div>
                      <div className="font-semibold text-lg">{effectiveProductData?.caseQuantity || "N/A"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-blue-600">{vendorName} Compliance & Regulatory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isIngramMicro && (
                      <>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">End User Info Required:</span>
                          <Badge variant={effectiveProductData?.endUserInfoRequired ? 'destructive' : 'secondary'}>
                            {effectiveProductData?.endUserInfoRequired ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Accept Back Order:</span>
                          <Badge variant={effectiveProductData?.acceptBackOrder ? 'default' : 'secondary'}>
                            {effectiveProductData?.acceptBackOrder ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Product Status:</span>
                          <span className="font-medium">{effectiveProductData?.productStatusCode || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Prop 65 Warning:</span>
                      <Badge variant={effectiveProductData?.prop65 ? 'destructive' : 'secondary'}>
                        {effectiveProductData?.prop65 ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {effectiveProductData?.prop65Description && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">{effectiveProductData.prop65Description}</p>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">FCC ID:</span>
                      <span className="font-medium">{effectiveProductData?.fccId || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">3rd Party Marketplaces:</span>
                      <span className="font-medium">{effectiveProductData?.thirdPartyMarketplaces || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Google Merchant Category:</span>
                      <span className="font-medium">{effectiveProductData?.googleMerchantCategory || "N/A"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Promotions Tab */}
            <TabsContent value="promotions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-blue-600">{vendorName} Sales & Promotions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Sale Information</h4>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">On Sale:</span>
                        <Badge variant={effectiveProductData?.sale ? 'default' : 'secondary'}>
                          {effectiveProductData?.sale ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {effectiveProductData?.saleStartDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Sale Start:</span>
                          <span className="font-medium">{effectiveProductData.saleStartDate}</span>
                        </div>
                      )}
                      {effectiveProductData?.saleEndDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Sale End:</span>
                          <span className="font-medium">{effectiveProductData.saleEndDate}</span>
                        </div>
                      )}
                      {isIngramMicro && effectiveProductData?.specialBidPricingAvailable && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Special Bid Pricing:</span>
                          <Badge variant="default">Available - Contact Rep</Badge>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Rebate Information</h4>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Rebate Available:</span>
                        <Badge variant={effectiveProductData?.rebate ? 'default' : 'secondary'}>
                          {effectiveProductData?.rebate ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {effectiveProductData?.rebateDescription && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">{effectiveProductData.rebateDescription}</p>
                        </div>
                      )}
                      {effectiveProductData?.rebateStartDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Rebate Start:</span>
                          <span className="font-medium">{effectiveProductData.rebateStartDate}</span>
                        </div>
                      )}
                      {effectiveProductData?.rebateEndDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Rebate End:</span>
                          <span className="font-medium">{effectiveProductData.rebateEndDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Volume Discounts for Ingram Micro in Promotions tab too */}
              {isIngramMicro && effectiveProductData?.discounts && effectiveProductData.discounts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Volume Discount Tiers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Min Qty</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Unit Price</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Savings vs List</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveProductData.discounts.map((d: any, i: number) => {
                            const listPrice = parseFloat(effectiveProductData?.listPrice || '0');
                            const discountPrice = parseFloat(d.price || '0');
                            const savings = listPrice > 0 && discountPrice > 0 ? ((listPrice - discountPrice) / listPrice * 100).toFixed(1) : '0';
                            return (
                              <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{d.quantity}+</td>
                                <td className="py-2 px-3 text-right font-bold text-green-700">${discountPrice.toFixed(2)}</td>
                                <td className="py-2 px-3 text-right text-green-600">{savings}%</td>
                                <td className="py-2 px-3 text-right text-xs text-gray-500">{d.expiryDate || 'N/A'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Documentation Tab */}
            <TabsContent value="docs" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Documentation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Product Documentation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {effectiveProductData?.quickGuideLiteratureUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Quick Guide:</span>
                        <a 
                          href={effectiveProductData.quickGuideLiteratureUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Quick Guide (PDF)
                        </a>
                      </div>
                    )}
                    {effectiveProductData?.ownersManualUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Owner's Manual:</span>
                        <a 
                          href={effectiveProductData.ownersManualUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Owner's Manual (PDF)
                        </a>
                      </div>
                    )}
                    {effectiveProductData?.brochureLiteratureUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Brochure:</span>
                        <a 
                          href={effectiveProductData.brochureLiteratureUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Brochure (PDF)
                        </a>
                      </div>
                    )}
                    {effectiveProductData?.installationGuideUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Installation Guide:</span>
                        <a 
                          href={effectiveProductData.installationGuideUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Installation Guide (PDF)
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Additional Content & Media */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Additional Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {effectiveProductData?.videoUrls && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Video Resources:</span>
                        <a 
                          href={effectiveProductData.videoUrls} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Product Videos
                        </a>
                      </div>
                    )}
                    {effectiveProductData?.quickSpecs && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Quick Specs:</span>
                        <span className="text-sm text-gray-700">{effectiveProductData.quickSpecs}</span>
                      </div>
                    )}
                    {effectiveProductData?.listOfAccessoriesBySku && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Accessories (by SKU):</span>
                        <span className="text-sm text-gray-700">{effectiveProductData.listOfAccessoriesBySku}</span>
                      </div>
                    )}
                    {effectiveProductData?.imageAdditionalUrls && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Additional Images:</span>
                        <a 
                          href={effectiveProductData.imageAdditionalUrls} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Additional Images
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* URL Health Status */}
              {documentationHealth && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Documentation Health Status
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateUrlsMutation.mutate()}
                        disabled={isValidatingUrls}
                      >
                        {isValidatingUrls ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Validate URLs
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(documentationHealth.urlStatus || {}).map(([field, statusData]: [string, any]) => (
                        <div key={field} className="p-3 border rounded-lg">
                          <div className="font-medium text-sm text-gray-700 mb-1">{field}</div>
                          <UrlHealthIndicator
                            status={statusData}
                            showDetails={true}
                            compact={false}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}