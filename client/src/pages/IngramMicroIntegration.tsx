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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  Eye,
  MapPin,
  Tag,
  ArrowRight,
  AlertTriangle,
  Percent,
  Weight,
  Warehouse,
  Shield,
  ArrowLeftRight,
  Info,
} from "lucide-react";

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "-";
  return `$${Number(val).toFixed(2)}`;
}

function ProductDetailModal({ partNumber, open, onClose }: { partNumber: string; open: boolean; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/marketplace/ingram-micro/products", partNumber, "full"],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/ingram-micro/products/${partNumber}/full`);
      if (!res.ok) throw new Error("Failed to load product details");
      return res.json();
    },
    enabled: open && !!partNumber,
  });

  const details = data?.details;
  const price = data?.priceAvailability;
  const mapping = data?.fieldMapping;
  const freight = data?.freightEstimate;
  const images = data?.images || [];
  const warehouses = price?.availability?.availabilityByWarehouse || [];
  const discounts = price?.discounts?.[0]?.quantityDiscounts || [];
  const indicators = details?.indicators || {};

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-600" />
            {details?.description || price?.description || partNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading product details...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load product details</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Discounts</TabsTrigger>
              <TabsTrigger value="warehouses">Warehouse Stock</TabsTrigger>
              <TabsTrigger value="fieldmap">Field Mapping</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {images.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Product Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {images.map((img: any, i: number) => (
                        <div key={i} className="flex-shrink-0 border rounded-lg overflow-hidden">
                          <img 
                            src={img.url} 
                            alt={`Product ${i + 1}`} 
                            className="h-32 w-32 object-contain bg-white"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                          <div className="text-xs text-center text-muted-foreground p-1 capitalize">{img.type}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Product Identification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingram Part #</span>
                      <span className="font-mono font-medium">{partNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor Part #</span>
                      <span className="font-mono">{details?.vendorPartNumber || price?.vendorPartNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UPC</span>
                      <span className="font-mono">{details?.upc || price?.upc || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor</span>
                      <span>{details?.vendorName || price?.vendorName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor #</span>
                      <span className="font-mono">{details?.vendorNumber || price?.vendorNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span>{details?.productCategory || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sub-Category</span>
                      <span>{details?.productSubCategory || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Product Class</span>
                      <span>
                        <Badge variant="outline">
                          {details?.productClass === 'A' ? 'A - Stock' : details?.productClass === 'B' ? 'B - Special Order' : details?.productClass || "-"}
                        </Badge>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Pricing Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">Your Cost</div>
                        <div className="text-xl font-bold text-green-700">{formatCurrency(price?.pricing?.customerPrice)}</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">Retail / MSRP</div>
                        <div className="text-xl font-bold text-blue-700">{formatCurrency(price?.pricing?.retailPrice)}</div>
                      </div>
                    </div>
                    {price?.pricing?.customerPrice && price?.pricing?.retailPrice && (
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">Margin</div>
                        <div className="text-lg font-bold text-amber-700">
                          {((1 - price.pricing.customerPrice / price.pricing.retailPrice) * 100).toFixed(1)}%
                          <span className="text-sm font-normal ml-2">
                            ({formatCurrency(price.pricing.retailPrice - price.pricing.customerPrice)} per unit)
                          </span>
                        </div>
                      </div>
                    )}
                    {price?.pricing?.mapPrice && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">MAP Price</span>
                        <span className="font-medium">{formatCurrency(price.pricing.mapPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Currency</span>
                      <span>{price?.pricing?.currencyCode || "USD"}</span>
                    </div>
                    {price?.pricing?.specialBidPricingAvailable && (
                      <Badge className="bg-purple-100 text-purple-800">Special Bid Pricing Available</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Shipping & Dimensions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {details?.additionalInformation?.productWeight?.map((pw: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">Weight ({pw.plantId})</span>
                        <span>{pw.weight} {pw.weightUnit}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Weight</span>
                      <span>{details?.additionalInformation?.netWeight || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Height</span>
                      <span>{details?.additionalInformation?.height || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Width</span>
                      <span>{details?.additionalInformation?.width || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Length</span>
                      <span>{details?.additionalInformation?.length || "-"}</span>
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {indicators.isHeavyWeight && <Badge variant="destructive">Heavy Weight</Badge>}
                      {indicators.isOversizeProduct && <Badge variant="destructive">Oversized</Badge>}
                      {details?.additionalInformation?.isBulkFreight && <Badge className="bg-orange-100 text-orange-800">Bulk Freight</Badge>}
                      {indicators.isDirectship && <Badge className="bg-purple-100 text-purple-800">Direct Ship</Badge>}
                      {indicators.isIngramShip && <Badge className="bg-blue-100 text-blue-800">Ingram Ships</Badge>}
                      {!indicators.isHeavyWeight && !indicators.isOversizeProduct && (
                        <Badge className="bg-green-100 text-green-800">Standard Shipping</Badge>
                      )}
                    </div>
                    {freight && (
                      <>
                        <Separator />
                        <div className="font-medium text-sm flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5" />
                          Estimated Freight (to NYC 10001)
                        </div>
                        {freight.freightEstimateResponse ? (
                          <div className="space-y-1">
                            {(Array.isArray(freight.freightEstimateResponse) ? freight.freightEstimateResponse : [freight.freightEstimateResponse]).map((fe: any, i: number) => (
                              <div key={i} className="space-y-1">
                                {fe.lines?.map((line: any, j: number) => (
                                  <div key={j}>
                                    {line.shipFromBranchNumber && (
                                      <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Ship From</span>
                                        <span>Branch #{line.shipFromBranchNumber}</span>
                                      </div>
                                    )}
                                    {line.freightCharges?.map((fc: any, k: number) => (
                                      <div key={k} className="flex justify-between">
                                        <span className="text-muted-foreground">{fc.freightDescription || 'Freight'}</span>
                                        <span className="font-bold text-blue-700">{formatCurrency(fc.amount || fc.freightAmount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {fe.distributionBillOfDistribution && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Freight</span>
                                    <span className="font-bold">{formatCurrency(fe.totalFreightAmount)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {typeof freight === 'object' ? JSON.stringify(freight).slice(0, 200) : 'Freight data received'}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Product Indicators
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        { label: 'Authorized', value: details?.productAuthorized === 'True' || price?.productAuthorized },
                        { label: 'New Product', value: indicators.isNewProduct },
                        { label: 'Discontinued', value: indicators.isDiscontinuedProduct },
                        { label: 'Refurbished', value: indicators.isRefurbished },
                        { label: 'Returnable', value: indicators.isReturnableProduct },
                        { label: 'Has Warranty', value: indicators.hasWarranty },
                        { label: 'Clearance', value: indicators.isClearanceProduct },
                        { label: 'Backorder OK', value: price?.acceptBackOrder },
                        { label: 'End-User Required', value: indicators.isEnduserRequired || price?.endUserInfoRequired },
                        { label: 'Downloadable', value: indicators.isDownloadable },
                        { label: 'License Product', value: indicators.isLicenseProduct },
                        { label: 'Configurable', value: indicators.isConfigurable },
                      ].map((ind) => (
                        <div key={ind.label} className="flex items-center gap-2">
                          {ind.value ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-gray-300" />
                          )}
                          <span className={ind.value ? "font-medium" : "text-muted-foreground"}>{ind.label}</span>
                        </div>
                      ))}
                    </div>
                    {details?.warrantyInformation && details.warrantyInformation.length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div>
                          <span className="text-xs text-muted-foreground">Warranty SKUs:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {details.warrantyInformation.map((sku: string) => (
                              <Badge key={sku} variant="outline" className="text-xs font-mono">{sku}</Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Stock Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="bg-green-50 rounded-lg px-4 py-2">
                      <div className="text-xs text-muted-foreground">Total Available</div>
                      <div className="text-2xl font-bold text-green-700">
                        {price?.availability?.totalAvailability?.toLocaleString() || "0"}
                      </div>
                    </div>
                    <Badge className={price?.availability?.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {price?.availability?.available ? "In Stock" : "Out of Stock"}
                    </Badge>
                  </div>
                  {warehouses.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {warehouses.map((wh: any, i: number) => (
                        <div key={i} className="border rounded-lg p-2 text-center">
                          <MapPin className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                          <div className="text-xs text-muted-foreground">{wh.location}</div>
                          <div className="text-lg font-bold">{wh.quantityAvailable?.toLocaleString()}</div>
                          {wh.quantityOnOrder > 0 && (
                            <div className="text-xs text-blue-600">+{wh.quantityOnOrder} on order</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-200">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="h-8 w-8 mx-auto text-green-600 mb-2" />
                    <div className="text-sm text-muted-foreground">Your Cost Price</div>
                    <div className="text-3xl font-bold text-green-700">{formatCurrency(price?.pricing?.customerPrice)}</div>
                  </CardContent>
                </Card>
                <Card className="border-blue-200">
                  <CardContent className="pt-6 text-center">
                    <Tag className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                    <div className="text-sm text-muted-foreground">Retail / MSRP</div>
                    <div className="text-3xl font-bold text-blue-700">{formatCurrency(price?.pricing?.retailPrice)}</div>
                  </CardContent>
                </Card>
                <Card className="border-amber-200">
                  <CardContent className="pt-6 text-center">
                    <Percent className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                    <div className="text-sm text-muted-foreground">Gross Margin</div>
                    <div className="text-3xl font-bold text-amber-700">
                      {price?.pricing?.customerPrice && price?.pricing?.retailPrice
                        ? `${((1 - price.pricing.customerPrice / price.pricing.retailPrice) * 100).toFixed(1)}%`
                        : "-"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {discounts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Volume Discount Tiers (Promo Pricing)
                    </CardTitle>
                    <CardDescription>Buy more to unlock lower pricing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quantity Range</TableHead>
                          <TableHead className="text-right">Original Price</TableHead>
                          <TableHead className="text-right">Discounted Price</TableHead>
                          <TableHead className="text-right">Savings Per Unit</TableHead>
                          <TableHead className="text-right">Discount %</TableHead>
                          <TableHead>Expires</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discounts.map((d: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {d.minQuantity} - {d.minQuantityEndRange > 100000 ? "∞" : d.minQuantityEndRange}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(d.beforeOriginalPrice)}</TableCell>
                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(d.originalPrice)}</TableCell>
                            <TableCell className="text-right text-green-600">-{formatCurrency(d.discount)}</TableCell>
                            <TableCell className="text-right">
                              <Badge className="bg-green-100 text-green-800">
                                {d.beforeOriginalPrice ? ((d.discount / d.beforeOriginalPrice) * 100).toFixed(1) : 0}%
                              </Badge>
                            </TableCell>
                            <TableCell>{d.expiryDate || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {discounts.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Percent className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No volume discounts or promotional pricing currently available for this product.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="warehouses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Warehouse Availability ({warehouses.length} locations)
                  </CardTitle>
                  <CardDescription>Real-time stock levels across Ingram Micro distribution centers</CardDescription>
                </CardHeader>
                <CardContent>
                  {warehouses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No warehouse data available</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {warehouses.map((wh: any, i: number) => (
                          <Card key={i} className={`border ${wh.quantityAvailable > 0 ? 'border-green-200' : 'border-red-200'}`}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <div className="font-medium text-sm">{wh.location}</div>
                                    <div className="text-xs text-muted-foreground">Warehouse #{wh.warehouseId}</div>
                                  </div>
                                </div>
                                <Badge className={wh.quantityAvailable > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {wh.quantityAvailable > 0 ? "In Stock" : "Out"}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Available</span>
                                  <span className="font-bold text-lg">{wh.quantityAvailable?.toLocaleString()}</span>
                                </div>
                                {wh.quantityBackordered > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Backordered</span>
                                    <span className="text-orange-600">{wh.quantityBackordered}</span>
                                  </div>
                                )}
                                {wh.quantityOnOrder > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">On Order</span>
                                    <span className="text-blue-600">+{wh.quantityOnOrder}</span>
                                  </div>
                                )}
                                {wh.backOrderInfo?.length > 0 && wh.backOrderInfo[0].etaDate && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">ETA</span>
                                    <span className="text-xs">{wh.backOrderInfo[0].etaDate}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Available</TableHead>
                            <TableHead className="text-right">On Order</TableHead>
                            <TableHead className="text-right">Backordered</TableHead>
                            <TableHead>ETA</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {warehouses.map((wh: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">#{wh.warehouseId}</TableCell>
                              <TableCell>{wh.location}</TableCell>
                              <TableCell className="text-right font-bold">{wh.quantityAvailable?.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-blue-600">{wh.quantityOnOrder || 0}</TableCell>
                              <TableCell className="text-right text-orange-600">{wh.quantityBackordered || 0}</TableCell>
                              <TableCell className="text-xs">{wh.quantityBackorderedEta || wh.backOrderInfo?.[0]?.etaDate || "-"}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{price?.availability?.totalAvailability?.toLocaleString() || 0}</TableCell>
                            <TableCell className="text-right text-blue-600">
                              {warehouses.reduce((sum: number, wh: any) => sum + (wh.quantityOnOrder || 0), 0)}
                            </TableCell>
                            <TableCell className="text-right text-orange-600">
                              {warehouses.reduce((sum: number, wh: any) => sum + (wh.quantityBackordered || 0), 0)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fieldmap" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Ingram Micro to Master Catalog Field Mapping
                  </CardTitle>
                  <CardDescription>Shows how Ingram Micro fields map to your master product catalog</CardDescription>
                </CardHeader>
                <CardContent>
                  {mapping?.masterCatalogMapping && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingram Micro Field</TableHead>
                          <TableHead className="text-center">
                            <ArrowRight className="h-4 w-4 mx-auto" />
                          </TableHead>
                          <TableHead>Master Catalog Field</TableHead>
                          <TableHead>Current Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mapping.masterCatalogMapping.map((m: any, i: number) => {
                          const val = mapping.ingramFields?.[m.ingramField.split(' ')[0]];
                          return (
                            <TableRow key={i}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs">{m.ingramField}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <ArrowRight className="h-4 w-4 mx-auto text-blue-500" />
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-blue-100 text-blue-800 font-mono text-xs">{m.masterField}</Badge>
                                <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {val != null && val !== '' && val !== false ? (
                                  typeof val === 'boolean' ? (
                                    val ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-gray-300" />
                                  ) : typeof val === 'number' ? (
                                    m.ingramField.toLowerCase().includes('price') || m.ingramField.toLowerCase().includes('cost')
                                      ? formatCurrency(val)
                                      : val.toLocaleString()
                                  ) : (
                                    String(val).slice(0, 60)
                                  )
                                ) : (
                                  <span className="text-muted-foreground italic">empty</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-500" />
                    Unmapped Ingram Micro Fields (Unique to Ingram)
                  </CardTitle>
                  <CardDescription>These Ingram Micro-specific fields don't have a direct match in the master catalog yet. They can be added as custom attributes or new catalog fields.</CardDescription>
                </CardHeader>
                <CardContent>
                  {mapping?.unmappedIngramFields && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Current Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mapping.unmappedIngramFields.map((f: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs bg-amber-50">{f.field}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{f.description}</TableCell>
                            <TableCell className="max-w-[200px] text-sm">
                              {f.value != null && f.value !== '' ? (
                                typeof f.value === 'boolean' ? (
                                  f.value ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge variant="secondary">No</Badge>
                                ) : Array.isArray(f.value) ? (
                                  <span className="text-xs text-muted-foreground">[{f.value.length} items]</span>
                                ) : typeof f.value === 'object' ? (
                                  <span className="text-xs text-muted-foreground">Object</span>
                                ) : (
                                  String(f.value)
                                )
                              ) : (
                                <span className="text-muted-foreground italic">empty</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function IngramMicroIntegration() {
  const { toast } = useToast();

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchVendorPartNumber, setSearchVendorPartNumber] = useState("");
  const [searchVendorName, setSearchVendorName] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [pricePartNumbers, setPricePartNumbers] = useState("");

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

  const [viewingProduct, setViewingProduct] = useState<string | null>(null);
  const [expandedPriceRow, setExpandedPriceRow] = useState<string | null>(null);

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Product Search
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Price & Availability
          </TabsTrigger>
          <TabsTrigger value="fieldmapping" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Field Mapping
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
                  <Input placeholder="Search keyword..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleProductSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vendor Part Number</label>
                  <Input placeholder="Vendor part #..." value={searchVendorPartNumber} onChange={(e) => setSearchVendorPartNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleProductSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vendor Name</label>
                  <Input placeholder="Vendor name..." value={searchVendorName} onChange={(e) => setSearchVendorName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleProductSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Input placeholder="Category..." value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleProductSearch()} />
                </div>
              </div>
              <Button onClick={handleProductSearch} disabled={searchLoading}>
                {searchLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</> : <><Search className="h-4 w-4 mr-2" />Search Products</>}
              </Button>
            </CardContent>
          </Card>

          {searchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Search Results
                  {products.length > 0 && <Badge variant="secondary">{searchResults?.recordsFound || products.length} products</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
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
                          <TableHead>Type</TableHead>
                          <TableHead>UPC</TableHead>
                          <TableHead className="text-center">Flags</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: any, idx: number) => (
                          <TableRow key={product.ingramPartNumber || idx} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingProduct(product.ingramPartNumber)}>
                            <TableCell className="font-mono text-sm font-medium">{product.ingramPartNumber || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{product.vendorPartNumber || "-"}</TableCell>
                            <TableCell>{product.vendorName || product.vendor || "-"}</TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate">{product.description || "-"}</div>
                              {product.extraDescription && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">{product.extraDescription}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{product.category || "-"}</div>
                              {product.subCategory && <div className="text-xs text-muted-foreground">{product.subCategory}</div>}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{product.productType || product.type || "-"}</Badge></TableCell>
                            <TableCell className="font-mono text-sm">{product.upcCode || product.upc || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap justify-center">
                                {product.hasDiscounts === "True" && <Badge className="bg-green-100 text-green-800 text-xs">Sale</Badge>}
                                {product.newProduct === "True" && <Badge className="bg-blue-100 text-blue-800 text-xs">New</Badge>}
                                {product.discontinued === "True" && <Badge variant="destructive" className="text-xs">EOL</Badge>}
                                {product.directShip === "True" && <Badge className="bg-purple-100 text-purple-800 text-xs">DS</Badge>}
                                {product.hasWarranty === "True" && <Badge variant="outline" className="text-xs">WTY</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" title="View Full Details" onClick={() => setViewingProduct(product.ingramPartNumber)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" title="Check Price" onClick={() => product.ingramPartNumber && handleCheckPriceForProduct(product.ingramPartNumber)} disabled={!product.ingramPartNumber}>
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
              <CardDescription>Enter Ingram Micro part numbers to check real-time pricing, stock, and promotional discounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Ingram Part Numbers</label>
                <Textarea placeholder={"Enter part numbers separated by commas or one per line\ne.g. SN1135, ABC456"} value={pricePartNumbers} onChange={(e) => setPricePartNumbers(e.target.value)} rows={4} />
                <p className="text-xs text-muted-foreground mt-1">{parsePricePartNumbers().length} part number(s) entered (max 50)</p>
              </div>
              <Button onClick={handlePriceCheck} disabled={priceMutation.isPending}>
                {priceMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking Prices...</> : <><DollarSign className="h-4 w-4 mr-2" />Check Price & Availability</>}
              </Button>
            </CardContent>
          </Card>

          {(priceMutation.data || priceMutation.isPending) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Price & Availability Results
                  {Array.isArray(priceResults) && priceResults.length > 0 && <Badge variant="secondary">{priceResults.length} products</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {priceMutation.isPending ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : !Array.isArray(priceResults) || priceResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pricing data available.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {priceResults.map((item: any, idx: number) => {
                      const isExpanded = expandedPriceRow === item.ingramPartNumber;
                      const itemDiscounts = item.discounts?.[0]?.quantityDiscounts || [];
                      const itemWarehouses = item.availability?.availabilityByWarehouse || [];
                      return (
                        <Card key={item.ingramPartNumber || idx} className="border">
                          <div className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedPriceRow(isExpanded ? null : item.ingramPartNumber)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="font-mono font-medium">{item.ingramPartNumber}</div>
                                  <div className="text-xs text-muted-foreground">{item.vendorPartNumber} | {item.vendorName}</div>
                                </div>
                                <div className="max-w-[300px] text-sm truncate hidden md:block">{item.description}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Cost</div>
                                  <div className="font-bold text-green-700">{formatCurrency(item.pricing?.customerPrice)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Retail</div>
                                  <div className="font-medium">{formatCurrency(item.pricing?.retailPrice)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Margin</div>
                                  <div className="font-medium text-amber-700">
                                    {item.pricing?.customerPrice && item.pricing?.retailPrice
                                      ? `${((1 - item.pricing.customerPrice / item.pricing.retailPrice) * 100).toFixed(1)}%`
                                      : "-"}
                                  </div>
                                </div>
                                <Badge className={item.availability?.totalAvailability > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {item.availability?.totalAvailability?.toLocaleString() || 0} avail.
                                </Badge>
                                {itemDiscounts.length > 0 && (
                                  <Badge className="bg-purple-100 text-purple-800">
                                    <Percent className="h-3 w-3 mr-1" />{itemDiscounts.length} tier{itemDiscounts.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setViewingProduct(item.ingramPartNumber); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t p-4 bg-muted/10 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium text-sm mb-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> Warehouse Stock</h4>
                                  {itemWarehouses.length > 0 ? (
                                    <div className="space-y-1">
                                      {itemWarehouses.map((wh: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm border-b pb-1">
                                          <span>{wh.location} <span className="text-xs text-muted-foreground">(#{wh.warehouseId})</span></span>
                                          <span className="font-medium">{wh.quantityAvailable?.toLocaleString()}</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between text-sm font-bold pt-1">
                                        <span>Total</span>
                                        <span>{item.availability?.totalAvailability?.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ) : <p className="text-sm text-muted-foreground">No warehouse data</p>}
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm mb-2 flex items-center gap-1"><Percent className="h-3 w-3" /> Volume Discounts</h4>
                                  {itemDiscounts.length > 0 ? (
                                    <div className="space-y-1">
                                      {itemDiscounts.map((d: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm border-b pb-1">
                                          <span>{d.minQuantity}-{d.minQuantityEndRange > 100000 ? "∞" : d.minQuantityEndRange} units</span>
                                          <span>
                                            <span className="font-medium text-green-700">{formatCurrency(d.originalPrice)}</span>
                                            <span className="text-xs text-muted-foreground ml-1">(-{formatCurrency(d.discount)})</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : <p className="text-sm text-muted-foreground">No volume discounts available</p>}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap text-xs">
                                {item.acceptBackOrder && <Badge variant="outline">Backorder OK</Badge>}
                                {item.endUserInfoRequired && <Badge variant="outline">End-User Info Required</Badge>}
                                {item.productAuthorized && <Badge className="bg-green-100 text-green-800">Authorized</Badge>}
                                {item.bundlePartIndicator && <Badge className="bg-blue-100 text-blue-800">Bundle</Badge>}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fieldmapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Ingram Micro Field Mapping
              </CardTitle>
              <CardDescription>
                View how Ingram Micro product fields map to your master product catalog. 
                Search for a product by part number to see a live field mapping preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Ingram Part Number (e.g. SN1135)"
                  value={pricePartNumbers}
                  onChange={(e) => setPricePartNumbers(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && pricePartNumbers.trim() && setViewingProduct(pricePartNumbers.trim())}
                  className="max-w-md"
                />
                <Button onClick={() => pricePartNumbers.trim() && setViewingProduct(pricePartNumbers.trim())}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Mapping
                </Button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Mapped Fields (Ingram → Master Catalog)</CardTitle>
                    <CardDescription>These Ingram Micro fields automatically map to your master catalog</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingram Micro Field</TableHead>
                          <TableHead className="text-center"><ArrowRight className="h-3 w-3 mx-auto" /></TableHead>
                          <TableHead>Master Catalog Field</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { from: 'vendorPartNumber', to: 'manufacturerPartNumber', desc: 'MPN' },
                          { from: 'upc / upcCode', to: 'upc', desc: 'UPC Code' },
                          { from: 'vendorName', to: 'manufacturerName', desc: 'Manufacturer' },
                          { from: 'description', to: 'name', desc: 'Product Title' },
                          { from: 'extraDescription', to: 'description', desc: 'Long Description' },
                          { from: 'category', to: 'categoryId', desc: 'Category' },
                          { from: 'customerPrice', to: 'cost', desc: 'Your Cost' },
                          { from: 'retailPrice', to: 'price', desc: 'Retail Price' },
                          { from: 'netWeight', to: 'weight', desc: 'Weight' },
                          { from: 'height+width+length', to: 'dimensions', desc: 'Dimensions' },
                          { from: 'totalAvailability', to: 'inventoryQuantity', desc: 'Stock Level' },
                          { from: 'isOversizeProduct', to: 'isOversized', desc: 'Oversized' },
                          { from: 'isReturnableProduct', to: 'isReturnable', desc: 'Returnable' },
                          { from: 'isClearanceProduct', to: 'isCloseout', desc: 'Clearance' },
                          { from: 'isRefurbished', to: 'isRemanufactured', desc: 'Refurbished' },
                        ].map((m, i) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{m.from}</Badge></TableCell>
                            <TableCell className="text-center"><ArrowRight className="h-3 w-3 mx-auto text-blue-500" /></TableCell>
                            <TableCell>
                              <Badge className="bg-blue-100 text-blue-800 font-mono text-xs">{m.to}</Badge>
                              <span className="text-xs text-muted-foreground ml-1">{m.desc}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Unmapped Fields (Ingram-Unique)
                    </CardTitle>
                    <CardDescription>These fields are unique to Ingram Micro and need custom mapping or new catalog fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingram Field</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Suggested Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { field: 'ingramPartNumber', desc: 'Ingram internal SKU', action: 'Store in supplierSku' },
                          { field: 'productClass', desc: 'A=Stock, B=Special Order', action: 'Custom attribute' },
                          { field: 'acceptBackOrder', desc: 'Backorder acceptance flag', action: 'Custom attribute' },
                          { field: 'endUserInfoRequired', desc: 'Requires end-user registration', action: 'Custom attribute' },
                          { field: 'isDirectShip', desc: 'Ships from vendor directly', action: 'Custom attribute' },
                          { field: 'isBulkFreight', desc: 'Requires freight shipping', action: 'Shipping template' },
                          { field: 'isHeavyWeight', desc: 'Heavy item special handling', action: 'Shipping template' },
                          { field: 'mapPrice', desc: 'Minimum Advertised Price', action: 'Add to supplierProducts.mapPrice' },
                          { field: 'quantityDiscounts', desc: 'Volume pricing tiers', action: 'Custom attribute (JSON)' },
                          { field: 'availabilityByWarehouse', desc: 'Per-warehouse stock levels', action: 'Custom attribute (JSON)' },
                          { field: 'warrantySkus', desc: 'Available warranty SKUs', action: 'Custom attribute' },
                          { field: 'specialBidPricing', desc: 'Special bid availability', action: 'Custom attribute' },
                          { field: 'estimatedFreight', desc: 'Estimated shipping cost', action: 'Add to master catalog' },
                        ].map((m, i) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="outline" className="font-mono text-xs bg-amber-50">{m.field}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.desc}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{m.action}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
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
                  <Input placeholder="Ingram order #..." value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleOrderSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Order Number</label>
                  <Input placeholder="Customer order #..." value={customerOrderNumber} onChange={(e) => setCustomerOrderNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleOrderSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={orderStatus} onValueChange={setOrderStatus}>
                    <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
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
                  <Input type="date" value={orderDateFrom} onChange={(e) => setOrderDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date To</label>
                  <Input type="date" value={orderDateTo} onChange={(e) => setOrderDateTo(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleOrderSearch} disabled={orderLoading}>
                {orderLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</> : <><Search className="h-4 w-4 mr-2" />Search Orders</>}
              </Button>
            </CardContent>
          </Card>

          {orderSearchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Results
                  {orders.length > 0 && <Badge variant="secondary">{orders.length} orders</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No orders found.</p>
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
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any, idx: number) => (
                          <TableRow key={order.ingramOrderNumber || idx}>
                            <TableCell className="font-mono">{order.ingramOrderNumber || "-"}</TableCell>
                            <TableCell className="font-mono">{order.customerOrderNumber || "-"}</TableCell>
                            <TableCell>{order.vendorName || "-"}</TableCell>
                            <TableCell><Badge variant="outline">{order.orderStatus || "-"}</Badge></TableCell>
                            <TableCell className="text-right">{order.orderTotal != null ? formatCurrency(order.orderTotal) : "-"}</TableCell>
                            <TableCell>{order.ingramOrderDate || "-"}</TableCell>
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
              <CardDescription>Search and manage Ingram Micro invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Invoice Number</label>
                  <Input placeholder="Invoice #..." value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInvoiceSearch()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={invoiceType} onValueChange={setInvoiceType}>
                    <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date From</label>
                  <Input type="date" value={invoiceDateFrom} onChange={(e) => setInvoiceDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date To</label>
                  <Input type="date" value={invoiceDateTo} onChange={(e) => setInvoiceDateTo(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleInvoiceSearch} disabled={invoiceLoading}>
                {invoiceLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</> : <><Search className="h-4 w-4 mr-2" />Search Invoices</>}
              </Button>
            </CardContent>
          </Card>

          {invoiceSearchTriggered && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Results
                  {invoices.length > 0 && <Badge variant="secondary">{invoices.length} invoices</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoiceLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No invoices found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Order #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv: any, idx: number) => (
                          <TableRow key={inv.invoiceNumber || idx}>
                            <TableCell className="font-mono">{inv.invoiceNumber || inv.paymentTermsInfo?.invoiceNumber || "-"}</TableCell>
                            <TableCell className="font-mono">{inv.ingramOrderNumber || "-"}</TableCell>
                            <TableCell><Badge variant="outline">{inv.invoiceStatus || inv.status || "-"}</Badge></TableCell>
                            <TableCell>{inv.invoiceType || inv.type || "-"}</TableCell>
                            <TableCell className="text-right">{inv.invoicedAmountDue != null ? formatCurrency(inv.invoicedAmountDue) : "-"}</TableCell>
                            <TableCell>{inv.invoiceDate || "-"}</TableCell>
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

      {viewingProduct && (
        <ProductDetailModal
          partNumber={viewingProduct}
          open={!!viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}
    </div>
  );
}
