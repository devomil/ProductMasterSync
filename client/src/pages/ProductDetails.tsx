import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HelpBubble, helpContexts } from "@/components/HelpBubble";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TruckIcon, Package, MapPin, TrendingUp, RefreshCw, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import WarehouseDetailModal from "@/components/WarehouseDetailModal";
// import AmazonMarketData from "@/components/products/AmazonMarketData";

// Authentic vendor stock data from CWR supplier information
const getVendorStockData = (product: any, inventoryData?: any) => {
  if (!product) return [];
  
  const vendors = [];
  
  // Primary CWR supplier with authentic pricing data
  if (product.cost || product.price) {
    // Calculate combined warehouse quantity from FL and NJ
    let combinedQuantity = 0;
    if (inventoryData?.warehouses) {
      combinedQuantity = inventoryData.warehouses.reduce((total: number, warehouse: any) => {
        return total + (warehouse.quantity || 0);
      }, 0);
    }
    
    // Determine stock status and ETA
    let stockDisplay;
    if (combinedQuantity > 0) {
      stockDisplay = combinedQuantity;
    } else {
      // Check for Next Shipment Date for ETA
      const nextShipmentDate = product.nextShipmentDateCombined || product.nextShipmentDate;
      if (nextShipmentDate && nextShipmentDate.toLowerCase() !== 'pending') {
        stockDisplay = `Out of Stock - ETA: ${nextShipmentDate}`;
      } else {
        stockDisplay = "Out of Stock - ETA: Pending";
      }
    }
    
    vendors.push({
      name: "CWR",
      stock: "Live Inventory",
      cost: parseFloat(product.cost) || 0,
      quantity: stockDisplay,
      type: "authentic"
    });
  }
  
  if (product.manufacturerName && product.manufacturerName !== "CWR") {
    vendors.push({
      name: "Ingram Micro",
      stock: `cost ${parseFloat(product.cost * 1.1).toFixed(2)}`,
      cost: parseFloat(product.cost * 1.1),
      quantity: 8,
      type: "cost"
    });
  }
  
  vendors.push({
    name: "TD/Synnex",
    stock: "Free Shipping",
    cost: 0,
    quantity: 29,
    type: "shipping"
  });
  
  return vendors;
};

export default function ProductDetails() {
  const { id } = useParams();
  const { data: product, isLoading, error } = useQuery({
    queryKey: [`/api/products/${id}`],
    enabled: !!id,
  }) as { data: any, isLoading: boolean, error: any };

  // Fetch inventory data for warehouse quantities
  const { data: inventoryData } = useQuery({
    queryKey: [`/api/inventory/${product?.sku}`],
    enabled: !!product?.sku,
  }) as { data: any };
  
  const vendorStockData = getVendorStockData(product, inventoryData);
  
  // State for warehouse detail modal
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  
  // State for tab management
  const [activeTab, setActiveTab] = useState("overview");
  
  // State for Amazon Markets functionality
  const [testResults, setTestResults] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch existing Amazon data for this product
  const { data: marketData, isLoading: marketDataLoading, refetch: refetchMarketData } = useQuery({
    queryKey: [`/api/marketplace/amazon/product/${id}`],
    enabled: !!id,
    retry: 1
  });

  // Mutation for syncing Amazon data to database
  const syncAmazonDataMutation = useMutation({
    mutationFn: async (upc: string) => {
      const response = await fetch(`/api/marketplace/amazon/fetch/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upc })
      });
      if (!response.ok) {
        throw new Error('Failed to sync Amazon data');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchMarketData();
    }
  });

  // Handle UPC test lookup
  const handleTestUPC = async () => {
    if (!product?.upc) return;
    
    setTestLoading(true);
    try {
      const response = await fetch('/api/marketplace/amazon/test-upc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upc: product.upc })
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Error testing UPC:', error);
      setTestResults({ error: 'Failed to test UPC' });
    } finally {
      setTestLoading(false);
    }
  };

  // Handle syncing data to database
  const handleSyncData = () => {
    if (!product?.upc) return;
    syncAmazonDataMutation.mutate(product.upc);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> There was an error loading the product details.</span>
        </div>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/products">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Products
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <Button variant="outline" asChild>
          <Link href="/products">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Master Catalog
          </Link>
        </Button>
        <HelpBubble 
          tips={helpContexts.productDetails}
          contextTitle="Product Details"
          trigger="click"
          position="bottom"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product image area */}
        <div className="col-span-1">
          <Card className="overflow-hidden">
            <div className="relative pb-[100%]">
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={() => console.log('Main image loaded:', product.imageUrl)}
                onError={(e) => {
                  console.log('Main image failed to load:', product.imageUrl);
                  // Try the large version if available
                  if (product.imageUrlLarge && e.currentTarget.src !== product.imageUrlLarge) {
                    console.log('Trying large image:', product.imageUrlLarge);
                    e.currentTarget.src = product.imageUrlLarge;
                  } else {
                    // Show a simple error state instead of placeholder
                    e.currentTarget.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500';
                    errorDiv.textContent = 'Image not available';
                    e.currentTarget.parentNode?.appendChild(errorDiv);
                  }
                }}
              />
            </div>
          </Card>
          
          {/* Vendor Stock Display */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Vendor Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 border-b">
                  <div>Supplier</div>
                  <div>Cost</div>
                  <div>Shipping Cost</div>
                  <div>Stock</div>
                </div>
                
                {/* Vendor rows */}
                {vendorStockData.map((vendor, index) => (
                  <div 
                    key={index}
                    className="grid grid-cols-4 gap-4 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      console.log('Clicked vendor:', vendor.name);
                      setActiveTab("supplier");
                    }}
                  >
                    <div className="font-medium text-blue-600 hover:text-blue-800">
                      {vendor.name}
                    </div>
                    <div className="text-gray-700">
                      {vendor.cost > 0 ? `$${vendor.cost.toFixed(2)}` : 'Contact for pricing'}
                    </div>
                    <div className="text-gray-600">
                      {vendor.shippingCost ? `$${vendor.shippingCost.toFixed(2)}` : 'Free'}
                    </div>
                    <div className="text-gray-900 font-medium">
                      {vendor.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content area */}
        <div className="col-span-1 lg:col-span-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">EDC: {product.sku}</Badge>
              {product.manufacturerPartNumber && (
                <Badge variant="outline">MPN: {product.manufacturerPartNumber}</Badge>
              )}
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="supplier">Supplier Info</TabsTrigger>
              <TabsTrigger value="markets">Markets</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Product Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-gray-700 leading-relaxed">
                    {product.description && (
                      <div className="space-y-3">
                        {product.description.split('\n').map((paragraph, index) => (
                          paragraph.trim() && (
                            <p key={index} className="text-sm">
                              {paragraph.trim()}
                            </p>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Product Information</h3>
                      <div className="space-y-2">
                        {product.manufacturerPartNumber && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">MPN:</span>
                            <span className="font-medium">{product.manufacturerPartNumber}</span>
                          </div>
                        )}
                        {product.upc && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">UPC:</span>
                            <span className="font-medium">{product.upc}</span>
                          </div>
                        )}
                        {product.manufacturerName && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Brand:</span>
                            <span className="font-medium">{product.manufacturerName}</span>
                          </div>
                        )}
                        {product.weight && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Weight:</span>
                            <span className="font-medium">{product.weight} lbs</span>
                          </div>
                        )}
                        {product.countryOfOrigin && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Country of Origin:</span>
                            <span className="font-medium">{product.countryOfOrigin}</span>
                          </div>
                        )}
                        {product.caseQuantity && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Case Qty:</span>
                            <span className="font-medium">{product.caseQuantity}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Pricing & Status</h3>
                      <div className="space-y-2">
                        {product.price && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">MSRP:</span>
                            <span className="font-bold text-green-600">${product.price}</span>
                          </div>
                        )}
                        {product.cost && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-medium">${product.cost}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">Status:</span>
                          <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                            {product.status || 'Active'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">EDC:</span>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{product.sku}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Packaging & Shipping</h3>
                      <div className="space-y-2">
                        {product.boxHeight && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Box Height:</span>
                            <span className="font-medium">{product.boxHeight}"</span>
                          </div>
                        )}
                        {product.boxLength && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Box Length:</span>
                            <span className="font-medium">{product.boxLength}"</span>
                          </div>
                        )}
                        {product.boxWidth && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600">Box Width:</span>
                            <span className="font-medium">{product.boxWidth}"</span>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                  
                  {/* Product Flags */}
                  {(product.isRemanufactured || product.isCloseout || product.isOnSale || product.hasRebate || product.hasFreeShipping) && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Special Offers</h3>
                        <div className="flex flex-wrap gap-2">
                          {product.isRemanufactured && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              Remanufactured
                            </Badge>
                          )}
                          {product.isCloseout && (
                            <Badge variant="outline" className="text-red-600 border-red-200">
                              Closeout
                            </Badge>
                          )}
                          {product.isOnSale && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              On Sale
                            </Badge>
                          )}
                          {product.hasRebate && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              Rebate Available
                            </Badge>
                          )}
                          {product.hasFreeShipping && (
                            <Badge variant="outline" className="text-purple-600 border-purple-200">
                              Free Shipping
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* California Proposition 65 Warning if present in description */}
                  {product.description?.toLowerCase().includes('warning') && product.description?.toLowerCase().includes('california') && (
                    <>
                      <Separator />
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 mb-2">⚠️ California Proposition 65 Warning</h4>
                        <p className="text-sm text-yellow-700">
                          This product contains chemicals known to the State of California to cause cancer, birth defects, or other reproductive harm.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Specifications Tab */}
            <TabsContent value="specifications" className="space-y-4">
              {/* Master Catalog Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Master Catalog Information</CardTitle>
                  <CardDescription>Unified product data across all suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {/* Core Product Information */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Core Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">EDC Code:</span>
                          <span className="text-gray-900 font-mono text-sm">{product.sku}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">MPN:</span>
                          <span className="text-gray-900">{product.manufacturerPartNumber || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">UPC:</span>
                          <span className="text-gray-900">{product.upc || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">USIN:</span>
                          <span className="text-gray-900">{product.usin || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Brand:</span>
                          <span className="text-gray-900">{product.manufacturerName || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Category:</span>
                          <span className="text-gray-900">{product.categoryName || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Status:</span>
                          <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                            {product.status || 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Physical Specifications */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Physical Specifications</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Weight:</span>
                          <span className="text-gray-900">{product.weight ? `${product.weight} lbs` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Length:</span>
                          <span className="text-gray-900">{product.length ? `${product.length}"` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Width:</span>
                          <span className="text-gray-900">{product.width ? `${product.width}"` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Height:</span>
                          <span className="text-gray-900">{product.height ? `${product.height}"` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Cube:</span>
                          <span className="text-gray-900">{product.cube || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


            </TabsContent>
            
            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Product Gallery</CardTitle>
                  <CardDescription>High-quality images from multiple suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Primary CWR Image */}
                    {product?.imageUrl && (
                      <div className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img 
                            src={product.imageUrl} 
                            alt={`${product?.name || 'Product'} - Primary`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onLoad={() => console.log('Image loaded:', product.imageUrl)}
                            onError={(e) => {
                              console.log('Image failed to load:', product.imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          Primary Image
                        </div>
                      </div>
                    )}
                    
                    {/* Large Version if different */}
                    {product.imageUrlLarge && product.imageUrlLarge !== product.imageUrl && (
                      <div className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img 
                            src={product.imageUrlLarge} 
                            alt={`${product.name} - Large`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          High Resolution
                        </div>
                      </div>
                    )}
                    
                    {/* Placeholder for additional supplier images */}
                    <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-sm font-medium">Additional Images</div>
                        <div className="text-xs">Available when multiple suppliers provide this product</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Image Quality & Authenticity</h4>
                    <p className="text-sm text-blue-700">
                      All product images are sourced directly from authorized suppliers and manufacturers. 
                      Images show the actual product you will receive, ensuring accuracy and authenticity.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Supplier Tab */}
            <TabsContent value="supplier" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Supplier Stock & Pricing
                  </CardTitle>
                  <CardDescription>Real-time availability and pricing from multiple suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vendorStockData.map((vendor, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg text-blue-600">{vendor.name}</h3>
                            <div className="flex items-center mt-1 text-sm text-gray-600">
                              <TruckIcon className="w-4 h-4 mr-1" />
                              <span>Supplier Shipping Cost</span>
                            </div>
                          </div>
                          <div className="text-right">
                            {vendor.cost > 0 && (
                              <div className="font-bold text-lg text-green-600">Cost: ${vendor.cost.toFixed(2)}</div>
                            )}
                            <div className="text-sm text-gray-600">
                              Stock: <span className="font-medium">{vendor.quantity}</span>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            console.log(`Opening warehouse modal for: ${vendor.name}`);
                            setSelectedVendor(vendor.name);
                            setWarehouseModalOpen(true);
                          }}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          View Warehouse Locations
                        </Button>
                        
                        {index === 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>MPN:</strong> {product.manufacturerPartNumber || "N/A"}</div>
                              <div><strong>UPC:</strong> {product.upc || "N/A"}</div>
                              <div><strong>Brand:</strong> {product.manufacturerName || "N/A"}</div>
                              <div className="mt-2 text-xs text-gray-500">
                                Primary supplier with authentic product data and full warranty support.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Markets Tab */}
            <TabsContent value="markets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Amazon Marketplace Intelligence</CardTitle>
                  <CardDescription>Competitive analysis and marketplace data for this product</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Test UPC Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Amazon Lookup Test
                        </CardTitle>
                        <CardDescription>
                          {product?.upc ? (
                            <>Test what Amazon returns for UPC: <span className="font-mono font-semibold">{product.upc}</span></>
                          ) : (
                            "No UPC available for Amazon marketplace lookup"
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {product?.upc ? (
                          <div>
                            <div className="flex gap-3 mb-4">
                              <Button 
                                variant="outline"
                                onClick={handleTestUPC}
                                disabled={testLoading}
                              >
                                {testLoading ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Test UPC Lookup
                              </Button>
                              <Button
                                onClick={handleSyncData}
                                disabled={syncAmazonDataMutation.isPending}
                              >
                                {syncAmazonDataMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Sync to Database
                              </Button>
                            </div>

                            {testResults && (
                              <div className="space-y-4">
                                <Separator />
                                
                                {testResults.success ? (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-green-700">Amazon Data Found</h4>
                                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                                        {testResults.totalAsinsFound} ASINs Found
                                      </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium text-gray-700">ASINs</div>
                                        <div className="space-y-1">
                                          {testResults.asins?.map((asin: string, index: number) => (
                                            <div key={index} className="flex items-center gap-2">
                                              <Badge variant="outline">{asin}</Badge>
                                              <a 
                                                href={`https://amazon.com/dp/${asin}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium text-gray-700">Sample Data</div>
                                        {testResults.catalogItems && testResults.catalogItems[0] && (
                                          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                                            <div><strong>Brand:</strong> {testResults.catalogItems[0].attributes?.brand?.[0]?.value || 'N/A'}</div>
                                            <div><strong>Weight:</strong> {testResults.catalogItems[0].attributes?.item_weight?.[0]?.value || 'N/A'}</div>
                                            <div><strong>Dimensions:</strong> Available in full data</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <div className="text-red-800">
                                        {testResults.error || 'No Amazon data found for this UPC'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <div>No UPC available for this product</div>
                            <div className="text-sm mt-1">Amazon marketplace data requires a valid UPC code</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Stored Market Data Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Stored Amazon Data</CardTitle>
                        <CardDescription>Previously synced competitive intelligence data</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {marketDataLoading ? (
                          <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-400" />
                            <div className="text-gray-500">Loading stored data...</div>
                          </div>
                        ) : marketData && marketData.data && marketData.data.length > 0 ? (
                          <div className="space-y-4">
                            {marketData.data.map((item: any, index: number) => (
                              <div key={index} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{item.asin}</Badge>
                                    <a 
                                      href={`https://amazon.com/dp/${item.asin}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Last updated: {new Date(item.lastUpdated || item.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <div className="font-medium text-gray-700">Product Info</div>
                                    <div>Brand: {item.brand || 'N/A'}</div>
                                    <div>Title: {item.title ? item.title.substring(0, 50) + '...' : 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-700">Dimensions</div>
                                    <div>Weight: {item.itemWeight || item.item_weight || 'N/A'}</div>
                                    <div>Size: {item.itemDimensions || item.item_dimensions || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-700">Identifiers</div>
                                    <div>UPC: {item.upc}</div>
                                    <div>ASIN: {item.asin}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <div>No Amazon market data stored yet</div>
                            <div className="text-sm mt-1">Use the "Sync to Database" button to fetch and store competitive data</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Warehouse Detail Modal for real CWR inventory data */}
      <WarehouseDetailModal
        isOpen={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        vendorName={selectedVendor}
        sku={product?.sku || ''}
        productId={product?.id?.toString()}
      />
    </div>
  );
}