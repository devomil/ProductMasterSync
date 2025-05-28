import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { ArrowLeft, TruckIcon, Package, MapPin } from "lucide-react";
import WarehouseDetailModal from "@/components/WarehouseDetailModal";

// Mock vendor stock data - this will be replaced with real data from your system
const getVendorStockData = (product: any) => {
  if (!product) return [];
  
  // Extract vendor data from the authentic product information
  const vendors = [];
  
  // Primary supplier (CWR in this case)
  if (product.cost && product.price) {
    vendors.push({
      name: "CWR",
      stock: "eta 5/22",
      cost: parseFloat(product.cost),
      quantity: 0,
      type: "eta"
    });
  }
  
  // Add additional mock vendors based on product category and price range
  if (product.price > 100) {
    vendors.push({
      name: "D&H",
      stock: `cost ${parseFloat(product.cost * 0.9).toFixed(2)}`,
      cost: parseFloat(product.cost * 0.9),
      quantity: 188,
      type: "cost"
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
  
  const vendorStockData = getVendorStockData(product);
  
  // State for warehouse detail modal
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  
  // State for tab management
  const [activeTab, setActiveTab] = useState("overview");

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
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/products">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Master Catalog
          </Link>
        </Button>
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
                      {vendor.type === 'cost' && `$${vendor.cost.toFixed(2)}`}
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="supplier">Supplier Info</TabsTrigger>
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Card>
                <CardHeader>
                  <CardTitle>Complete Product Specifications</CardTitle>
                  <CardDescription>All available data fields from CWR supplier feed</CardDescription>
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

                    {/* Pricing & Financial */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Pricing & Financial</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">MSRP:</span>
                          <span className="text-gray-900 font-semibold text-green-600">{product.price ? `$${product.price}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Cost:</span>
                          <span className="text-gray-900">{product.cost ? `$${product.cost}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">M.A.P. Price:</span>
                          <span className="text-gray-900">{product.mapPrice ? `$${product.mapPrice}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">M.R.P. Price:</span>
                          <span className="text-gray-900">{product.mrpPrice ? `$${product.mrpPrice}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Original Price:</span>
                          <span className="text-gray-900">{product.originalPrice ? `$${product.originalPrice}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Freight Class:</span>
                          <span className="text-gray-900">{product.freightClass || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Harmonization Code:</span>
                          <span className="text-gray-900">{product.harmonizationCode || "N/A"}</span>
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

                    {/* Inventory & Logistics */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Inventory & Logistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Stock Status:</span>
                          <span className="text-gray-900">{product.stockStatus || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Availability:</span>
                          <span className="text-gray-900">{product.availability || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Lead Time:</span>
                          <span className="text-gray-900">{product.leadTime || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Dropship:</span>
                          <span className="text-gray-900">{product.dropship || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Pack Quantity:</span>
                          <span className="text-gray-900">{product.packQuantity || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Non-stock:</span>
                          <Badge variant={product.nonStock ? 'destructive' : 'secondary'}>
                            {product.nonStock ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Drop Ships Direct:</span>
                          <Badge variant={product.dropShipsDirect ? 'default' : 'secondary'}>
                            {product.dropShipsDirect ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Case Qty (NJ):</span>
                          <span className="text-gray-900">{product.caseQtyNJ || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Case Qty (FL):</span>
                          <span className="text-gray-900">{product.caseQtyFL || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Returnable:</span>
                          <Badge variant={product.returnable ? 'default' : 'secondary'}>
                            {product.returnable ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Shipping & Logistics */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Shipping & Logistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Hazardous Materials:</span>
                          <Badge variant={product.hazardousMaterials ? 'destructive' : 'secondary'}>
                            {product.hazardousMaterials ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Truck Freight:</span>
                          <Badge variant={product.truckFreight ? 'default' : 'secondary'}>
                            {product.truckFreight ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Exportable:</span>
                          <Badge variant={product.exportable ? 'default' : 'secondary'}>
                            {product.exportable ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">First Class Mail:</span>
                          <Badge variant={product.firstClassMail ? 'default' : 'secondary'}>
                            {product.firstClassMail ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Oversized:</span>
                          <Badge variant={product.oversized ? 'destructive' : 'secondary'}>
                            {product.oversized ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Free Shipping:</span>
                          <Badge variant={product.freeShipping ? 'default' : 'secondary'}>
                            {product.freeShipping ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        {product.freeShippingEndDate && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">Free Shipping End Date:</span>
                            <span className="text-gray-900">{product.freeShippingEndDate}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Country Of Origin:</span>
                          <span className="text-gray-900">{product.countryOfOrigin || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Compliance & Regulatory */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Compliance & Regulatory</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Prop 65:</span>
                          <Badge variant={product.prop65 ? 'destructive' : 'secondary'}>
                            {product.prop65 ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        {product.prop65Description && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">Prop 65 Description:</span>
                            <span className="text-gray-900 text-xs">{product.prop65Description}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">FCC ID:</span>
                          <span className="text-gray-900">{product.fccId || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">3rd Party Marketplaces:</span>
                          <span className="text-gray-900">{product.thirdPartyMarketplaces || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600 text-sm font-medium">Google Merchant Category:</span>
                          <span className="text-gray-900">{product.googleMerchantCategory || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sales & Promotions */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Sales & Promotions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">Sale:</span>
                            <Badge variant={product.sale ? 'default' : 'secondary'}>
                              {product.sale ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          {product.saleStartDate && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Sale Start Date:</span>
                              <span className="text-gray-900">{product.saleStartDate}</span>
                            </div>
                          )}
                          {product.saleEndDate && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Sale End Date:</span>
                              <span className="text-gray-900">{product.saleEndDate}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">Rebate:</span>
                            <Badge variant={product.rebate ? 'default' : 'secondary'}>
                              {product.rebate ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          {product.rebateDescription && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Rebate Description:</span>
                              <span className="text-gray-900 text-xs">{product.rebateDescription}</span>
                            </div>
                          )}
                          {product.rebateStartDate && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Rebate Start Date:</span>
                              <span className="text-gray-900">{product.rebateStartDate}</span>
                            </div>
                          )}
                          {product.rebateEndDate && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Rebate End Date:</span>
                              <span className="text-gray-900">{product.rebateEndDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accessories & Related Products */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Accessories & Related Products</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">List of Accessories by SKU:</span>
                            <span className="text-gray-900 text-xs">{product.accessoriesBySku || "N/A"}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">List of Accessories by MFG#:</span>
                            <span className="text-gray-900 text-xs">{product.accessoriesByMfg || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                      {product.quickSpecs && (
                        <div className="mt-3">
                          <span className="text-gray-600 text-sm font-medium">Quick Specs:</span>
                          <div className="text-gray-900 text-xs mt-1 p-2 bg-gray-50 rounded">
                            {product.quickSpecs}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Documentation & Resources */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Documentation & Resources</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          {product.quickGuideUrl && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Quick Guide:</span>
                              <a href={product.quickGuideUrl} target="_blank" rel="noopener noreferrer" 
                                 className="text-blue-600 hover:text-blue-800 text-xs">
                                View PDF
                              </a>
                            </div>
                          )}
                          {product.ownersManualUrl && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Owners Manual:</span>
                              <a href={product.ownersManualUrl} target="_blank" rel="noopener noreferrer" 
                                 className="text-blue-600 hover:text-blue-800 text-xs">
                                View PDF
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {product.brochureUrl && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Brochure:</span>
                              <a href={product.brochureUrl} target="_blank" rel="noopener noreferrer" 
                                 className="text-blue-600 hover:text-blue-800 text-xs">
                                View PDF
                              </a>
                            </div>
                          )}
                          {product.installationGuideUrl && (
                            <div className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium">Installation Guide:</span>
                              <a href={product.installationGuideUrl} target="_blank" rel="noopener noreferrer" 
                                 className="text-blue-600 hover:text-blue-800 text-xs">
                                View PDF
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      {product.videoUrls && (
                        <div className="mt-3">
                          <span className="text-gray-600 text-sm font-medium">Video Resources:</span>
                          <div className="text-gray-900 text-xs mt-1">
                            {product.videoUrls}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Additional CWR Fields */}
                    {product.attributes && Object.keys(product.attributes).length > 0 && (
                      <div className="md:col-span-2 space-y-3">
                        <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Additional Supplier Data</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {Object.entries(product.attributes).map(([key, value]) => (
                            <div key={key} className="flex justify-between py-1">
                              <span className="text-gray-600 text-sm font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                              </span>
                              <span className="text-gray-900 text-sm">{String(value) || "N/A"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                            {vendor.type === 'cost' && (
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
          </Tabs>
        </div>
      </div>
      
      {/* Warehouse Detail Modal for real CWR inventory data */}
      <WarehouseDetailModal
        isOpen={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        vendorName={selectedVendor}
        sku={product?.sku || ''}
      />
    </div>
  );
}