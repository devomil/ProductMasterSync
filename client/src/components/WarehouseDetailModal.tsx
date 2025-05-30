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
}

export default function WarehouseDetailModal({ 
  isOpen, 
  onClose, 
  vendorName, 
  sku,
  productId 
}: WarehouseDetailModalProps) {
  const [isValidatingUrls, setIsValidatingUrls] = useState(false);
  const queryClient = useQueryClient();

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: [`/api/inventory/${sku}`],
    enabled: isOpen && !!sku,
  }) as { data: any, isLoading: boolean };

  // Get comprehensive product data for supplier-specific fields
  const { data: productData } = useQuery({
    queryKey: [`/api/products/${productId}`],
    enabled: isOpen && !!productId,
  }) as { data: any };

  // URL health validation query
  const { data: documentationHealth, isLoading: isLoadingHealth } = useQuery({
    queryKey: [`/api/products/${productId}/documentation-health`],
    enabled: isOpen && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }) as { data: any, isLoading: boolean };

  // URL validation mutation
  const validateUrlsMutation = useMutation({
    mutationFn: async () => {
      setIsValidatingUrls(true);
      const response = await fetch(`/api/products/${productId}/documentation-health`);
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/products/${productId}/documentation-health`], data);
      setIsValidatingUrls(false);
    },
    onError: () => {
      setIsValidatingUrls(false);
    },
  });

  const getStatusColor = (quantity: number) => {
    if (quantity > 10) return "bg-green-100 text-green-800";
    if (quantity > 0) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusText = (quantity: number) => {
    if (quantity > 10) return "In Stock";
    if (quantity > 0) return "Low Stock";
    return "Out of Stock";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {vendorName} Supplier Information Hub
          </DialogTitle>
          <DialogDescription>
            Complete supplier data and real-time inventory for SKU: <span className="font-mono">{sku}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading supplier data...</span>
          </div>
        ) : (
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </TabsTrigger>
              <TabsTrigger value="shipping" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipping
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Promotions
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentation
              </TabsTrigger>
            </TabsList>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-4">
              {inventoryData?.warehouses?.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Last updated: {new Date(inventoryData.lastUpdated).toLocaleString()}
                    </div>
                    <Badge variant="outline" className="text-blue-600">
                      {inventoryData.source}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventoryData.warehouses.map((warehouse: WarehouseLocation, index: number) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600" />
                              {warehouse.name}
                            </div>
                            <Badge 
                              className={getStatusColor(warehouse.quantity)}
                              variant="outline"
                            >
                              {getStatusText(warehouse.quantity)}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Location:</span>
                              <span className="font-medium">{warehouse.location}</span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Warehouse Code:</span>
                              <span className="font-mono text-sm">{warehouse.code}</span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Available Quantity:</span>
                              <span className="font-bold text-lg">
                                {warehouse.quantity}
                              </span>
                            </div>
                            
                            {warehouse.quantity > 0 && (
                              <div className="pt-2 border-t">
                                <Button 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => {
                                    console.log(`Order from ${warehouse.name} - Qty: ${warehouse.quantity}`);
                                  }}
                                >
                                  <TruckIcon className="h-4 w-4 mr-2" />
                                  Request from this warehouse
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Inventory Update Schedule
                    </h4>
                    <p className="text-sm text-blue-700">
                      {vendorName} inventory data is automatically synchronized every 2 hours from 
                      the live SFTP feed. Data shown reflects real-time availability from authorized supplier systems.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No warehouse data available for this product</p>
                  <p className="text-sm text-gray-500 mt-1">
                    This may be a new product or inventory sync is in progress
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-blue-600">{vendorName} Pricing & Financial Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">MSRP:</span>
                        <span className="font-semibold text-green-600">{productData?.price ? `$${productData.price}` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Your Cost:</span>
                        <span className="font-semibold">{productData?.cost ? `$${productData.cost}` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">M.A.P. Price:</span>
                        <span className="font-medium">{productData?.mapPrice ? `$${productData.mapPrice}` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">M.R.P. Price:</span>
                        <span className="font-medium">{productData?.mrpPrice ? `$${productData.mrpPrice}` : "N/A"}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Original Price:</span>
                        <span className="font-medium">{productData?.originalPrice ? `$${productData.originalPrice}` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Freight Class:</span>
                        <span className="font-medium">{productData?.freightClass || "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Harmonization Code:</span>
                        <span className="font-medium">{productData?.harmonizationCode || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Shipping Tab */}
            <TabsContent value="shipping" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-blue-600">{vendorName} Shipping & Logistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Hazardous Materials:</span>
                        <Badge variant={productData?.hazardousMaterials ? 'destructive' : 'secondary'}>
                          {productData?.hazardousMaterials ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Truck Freight:</span>
                        <Badge variant={productData?.truckFreight ? 'default' : 'secondary'}>
                          {productData?.truckFreight ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Free Shipping:</span>
                        <Badge variant={productData?.freeShipping ? 'default' : 'secondary'}>
                          {productData?.freeShipping ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Oversized:</span>
                        <Badge variant={productData?.oversized ? 'destructive' : 'secondary'}>
                          {productData?.oversized ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Exportable:</span>
                        <Badge variant={productData?.exportable ? 'default' : 'secondary'}>
                          {productData?.exportable ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Country of Origin:</span>
                        <span className="font-medium">{productData?.countryOfOrigin || "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Dropship Available:</span>
                        <Badge variant={productData?.dropship ? 'default' : 'secondary'}>
                          {productData?.dropship ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Lead Time:</span>
                        <span className="font-medium">{productData?.leadTime || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Packaging Dimensions Section */}
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Package Dimensions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Height</div>
                        <div className="font-semibold text-lg">{productData?.boxHeight || "N/A"}</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Length</div>
                        <div className="font-semibold text-lg">{productData?.boxLength || "N/A"}</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Width</div>
                        <div className="font-semibold text-lg">{productData?.boxWidth || "N/A"}</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Case Qty</div>
                        <div className="font-semibold text-lg">{productData?.caseQuantity || "N/A"}</div>
                      </div>
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
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Prop 65 Warning:</span>
                      <Badge variant={productData?.prop65 ? 'destructive' : 'secondary'}>
                        {productData?.prop65 ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {productData?.prop65Description && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">{productData.prop65Description}</p>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">FCC ID:</span>
                      <span className="font-medium">{productData?.fccId || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">3rd Party Marketplaces:</span>
                      <span className="font-medium">{productData?.thirdPartyMarketplaces || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Google Merchant Category:</span>
                      <span className="font-medium">{productData?.googleMerchantCategory || "N/A"}</span>
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
                        <Badge variant={productData?.sale ? 'default' : 'secondary'}>
                          {productData?.sale ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {productData?.saleStartDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Sale Start:</span>
                          <span className="font-medium">{productData.saleStartDate}</span>
                        </div>
                      )}
                      {productData?.saleEndDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Sale End:</span>
                          <span className="font-medium">{productData.saleEndDate}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Rebate Information</h4>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600 font-medium">Rebate Available:</span>
                        <Badge variant={productData?.rebate ? 'default' : 'secondary'}>
                          {productData?.rebate ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {productData?.rebateDescription && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">{productData.rebateDescription}</p>
                        </div>
                      )}
                      {productData?.rebateStartDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Rebate Start:</span>
                          <span className="font-medium">{productData.rebateStartDate}</span>
                        </div>
                      )}
                      {productData?.rebateEndDate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600 font-medium">Rebate End:</span>
                          <span className="font-medium">{productData.rebateEndDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documentation Tab */}
            <TabsContent value="docs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg text-blue-600">
                    <span>{vendorName} Documentation & Resources</span>
                    <div className="flex items-center gap-2">
                      {(isLoadingHealth || isValidatingUrls) && (
                        <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateUrlsMutation.mutate()}
                        disabled={isValidatingUrls || !productId}
                        className="text-xs"
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Check Links
                      </Button>
                    </div>
                  </CardTitle>
                  {documentationHealth?.result?.overallHealth && (
                    <div className="text-sm text-gray-600">
                      Overall Health: <Badge variant={
                        documentationHealth.result.overallHealth === 'healthy' ? 'default' :
                        documentationHealth.result.overallHealth === 'partial' ? 'secondary' : 'destructive'
                      }>
                        {documentationHealth.result.overallHealth}
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Product Documentation</h4>
                      {productData?.quickGuideUrl && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-gray-600 font-medium">Quick Guide:</span>
                          <div className="flex items-center gap-2">
                            {documentationHealth?.result?.quickGuide && (
                              <UrlHealthIndicator 
                                status={documentationHealth.result.quickGuide} 
                                compact={true} 
                              />
                            )}
                            <a href={productData.quickGuideUrl} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800 font-medium">
                              View PDF
                            </a>
                          </div>
                        </div>
                      )}
                      {productData?.ownersManualUrl && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-gray-600 font-medium">Owner's Manual:</span>
                          <div className="flex items-center gap-2">
                            {documentationHealth?.result?.ownersManual && (
                              <UrlHealthIndicator 
                                status={documentationHealth.result.ownersManual} 
                                compact={true} 
                              />
                            )}
                            <a href={productData.ownersManualUrl} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800 font-medium">
                              View PDF
                            </a>
                          </div>
                        </div>
                      )}
                      {productData?.brochureUrl && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-gray-600 font-medium">Brochure:</span>
                          <div className="flex items-center gap-2">
                            {documentationHealth?.result?.brochure && (
                              <UrlHealthIndicator 
                                status={documentationHealth.result.brochure} 
                                compact={true} 
                              />
                            )}
                            <a href={productData.brochureUrl} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800 font-medium">
                              View PDF
                            </a>
                          </div>
                        </div>
                      )}
                      {productData?.installationGuideUrl && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-gray-600 font-medium">Installation Guide:</span>
                          <div className="flex items-center gap-2">
                            {documentationHealth?.result?.installationGuide && (
                              <UrlHealthIndicator 
                                status={documentationHealth.result.installationGuide} 
                                compact={true} 
                              />
                            )}
                            <a href={productData.installationGuideUrl} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800 font-medium">
                              View PDF
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Additional Resources</h4>
                      {productData?.videoUrls && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-600 font-medium">Video Resources:</span>
                          <div className="text-gray-900 text-sm mt-2">
                            {productData.videoUrls}
                          </div>
                        </div>
                      )}
                      {productData?.quickSpecs && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-600 font-medium">Quick Specs:</span>
                          <div className="text-gray-900 text-sm mt-2">
                            {productData.quickSpecs}
                          </div>
                        </div>
                      )}
                      {productData?.accessoriesBySku && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-600 font-medium">Accessories (by SKU):</span>
                          <div className="text-gray-900 text-sm mt-2">
                            {productData.accessoriesBySku}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}