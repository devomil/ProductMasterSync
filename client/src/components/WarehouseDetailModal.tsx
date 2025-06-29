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
    queryKey: [`/api/products/${sku}`],
    enabled: isOpen && !!sku,
  }) as { data: any };

  // Get documentation health status
  const { data: documentationHealth, isLoading: isLoadingHealth } = useQuery({
    queryKey: [`/api/products/${productId}/documentation-health`],
    enabled: isOpen && !!productId,
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
                        {productData?.quantityAvailableToShip || "0"}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Backordered:</span>
                      <Badge variant={productData?.quantityBackordered > 0 ? 'destructive' : 'secondary'}>
                        {productData?.quantityBackordered || "0"}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Committed:</span>
                      <span className="font-medium">{productData?.quantityCommitted || "0"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">On Hand:</span>
                      <span className="font-medium">{productData?.quantityOnHand || "0"}</span>
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
                      <span className="font-medium">{productData?.weight || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Case Quantity:</span>
                      <span className="font-medium">{productData?.caseQuantity || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">UPC:</span>
                      <span className="font-medium text-sm">{productData?.upc || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Manufacturer:</span>
                      <span className="font-medium">{productData?.manufacturer || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Warehouse Locations */}
              {inventoryData?.warehouses && inventoryData.warehouses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Warehouse Locations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inventoryData.warehouses.map((warehouse: WarehouseLocation, index: number) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="font-semibold">{warehouse.name}</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Code:</span>
                              <span>{warehouse.code}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Location:</span>
                              <span>{warehouse.location}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Quantity:</span>
                              <Badge variant="outline">{warehouse.quantity}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cost:</span>
                              <span className="font-medium">${warehouse.cost}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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
                      <span className="font-bold text-lg">${productData?.listPrice || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Cost:</span>
                      <span className="font-medium">${productData?.cost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Map Price:</span>
                      <span className="font-medium">${productData?.mapPrice || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">MSRP:</span>
                      <span className="font-medium">${productData?.msrp || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Pricing Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Core Cost:</span>
                      <span className="font-medium">${productData?.coreCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Tariff Cost:</span>
                      <span className="font-medium">${productData?.tariffCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Price Updated:</span>
                      <span className="font-medium">{productData?.priceUpdateDate || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                      <span className="font-medium">${productData?.shippingCost || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Free Freight:</span>
                      <Badge variant={productData?.freeFreight ? 'default' : 'secondary'}>
                        {productData?.freeFreight ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Direct Ship:</span>
                      <Badge variant={productData?.directShip ? 'default' : 'secondary'}>
                        {productData?.directShip ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600">Shipping Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 font-medium">Oversized:</span>
                      <Badge variant={productData?.oversized ? 'destructive' : 'secondary'}>
                        {productData?.oversized ? 'Yes' : 'No'}
                      </Badge>
                    </div>
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
                  </CardContent>
                </Card>
              </div>
              
              {/* Package Dimensions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Package Dimensions</CardTitle>
                </CardHeader>
                <CardContent>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Documentation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Product Documentation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {productData?.quickGuideLiteratureUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Quick Guide:</span>
                        <a 
                          href={productData.quickGuideLiteratureUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Quick Guide (PDF)
                        </a>
                      </div>
                    )}
                    {productData?.ownersManualUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Owner's Manual:</span>
                        <a 
                          href={productData.ownersManualUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Owner's Manual (PDF)
                        </a>
                      </div>
                    )}
                    {productData?.brochureLiteratureUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Brochure:</span>
                        <a 
                          href={productData.brochureLiteratureUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Brochure (PDF)
                        </a>
                      </div>
                    )}
                    {productData?.installationGuideUrl && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Installation Guide:</span>
                        <a 
                          href={productData.installationGuideUrl} 
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
                    {productData?.videoUrls && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Video Resources:</span>
                        <a 
                          href={productData.videoUrls} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Product Videos
                        </a>
                      </div>
                    )}
                    {productData?.quickSpecs && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Quick Specs:</span>
                        <span className="text-sm text-gray-700">{productData.quickSpecs}</span>
                      </div>
                    )}
                    {productData?.listOfAccessoriesBySku && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Accessories (by SKU):</span>
                        <span className="text-sm text-gray-700">{productData.listOfAccessoriesBySku}</span>
                      </div>
                    )}
                    {productData?.imageAdditionalUrls && (
                      <div className="py-2 border-b">
                        <span className="text-gray-600 font-medium block mb-1">Additional Images:</span>
                        <a 
                          href={productData.imageAdditionalUrls} 
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