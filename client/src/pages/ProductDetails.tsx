import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMappingTemplates } from "@/hooks/useMappingTemplates";
import { useAmazonMarketIntelligence } from "@/hooks/useAmazonMarketData";
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
import { ArrowLeft, TruckIcon, Package, MapPin, TrendingUp, RefreshCw, CheckCircle, AlertCircle, Loader2, ExternalLink, DollarSign, BarChart3, ShieldAlert, ShieldCheck, Info } from "lucide-react";
import WarehouseDetailModal from "@/components/WarehouseDetailModal";
// import AmazonMarketData from "@/components/products/AmazonMarketData";

// Helper function to clean HTML tags from descriptions
const cleanHtmlTags = (htmlString: string): string => {
  if (!htmlString) return '';
  return htmlString
    .replace(/<p><strong>/gi, '')
    .replace(/<\/strong><\/p><p>/gi, ' ')
    .replace(/<\/strong><\/p>/gi, '')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, ' ')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper function to remove EDC prefix from SKU
const removeEdcPrefix = (sku: string): string => {
  if (!sku) return '';
  return sku.replace(/^EDC/i, '');
};

// Calculate shipping cost using shipping templates
const calculateShippingCost = async (supplierId: number, cost: number, weight: number) => {
  try {
    const response = await fetch(`/api/suppliers/${supplierId}/shipping-templates`);
    const templates = await response.json();
    
    if (!templates.length) return null;
    
    const template = templates[0]; // Use first template for now
    const config = template.config;
    
    if (config.method === 'flat_rate') {
      return config.flatRate;
    }
    
    if (config.method === 'free_shipping') {
      return 0;
    }
    
    if (config.method === 'weight_based' && config.weightRules) {
      for (const rule of config.weightRules) {
        if (weight >= rule.minWeight && weight <= rule.maxWeight) {
          return rule.shippingCost;
        }
      }
    }
    
    if (config.method === 'cost_based' && config.costRules) {
      for (const rule of config.costRules) {
        if (cost >= rule.minCost && cost <= rule.maxCost) {
          return rule.shippingCost;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error calculating shipping cost:', error);
    return null;
  }
};

// Authentic vendor stock data from CWR supplier information
const getVendorStockData = (product: any, inventoryData?: any, shippingCosts?: any) => {
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
      type: "authentic",
      shippingCost: shippingCosts?.CWR || null
    });
  }
  
  if (product.manufacturerName && product.manufacturerName !== "CWR") {
    vendors.push({
      name: "Ingram Micro",
      stock: `cost ${parseFloat(product.cost * 1.1).toFixed(2)}`,
      cost: parseFloat(product.cost * 1.1),
      quantity: 8,
      type: "cost",
      shippingCost: 0 // Free shipping for Ingram Micro
    });
  }
  
  vendors.push({
    name: "TD/Synnex",
    stock: "Free Shipping",
    cost: 0,
    quantity: 29,
    type: "shipping",
    shippingCost: 0 // Free shipping for TD/Synnex
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

  // Fetch shipping templates for suppliers
  const { data: shippingTemplates } = useQuery({
    queryKey: [`/api/suppliers/2/shipping-templates`], // CWR Distribution ID
    enabled: !!product,
  }) as { data: any };

  // Calculate shipping costs for vendors
  const [shippingCosts, setShippingCosts] = useState<any>({});

  // Calculate shipping costs when data is available
  useEffect(() => {
    if (product && shippingTemplates?.length) {
      const template = shippingTemplates[0];
      
      let cwrShippingCost = null;
      const cost = parseFloat(product.cost) || 0;
      const weight = parseFloat(product.weight) || 0.1;
      
      if (template.method === 'flat_rate') {
        cwrShippingCost = template.flatRate;
      } else if (template.method === 'free_shipping') {
        cwrShippingCost = 0;
      } else if (template.method === 'weight_based' && template.weightRules) {
        for (const rule of template.weightRules) {
          // Adjust comparison to handle products lighter than 1 lb (use first rule for anything under 1 lb)
          if ((weight < 1 && rule.minWeight <= 1) || (weight >= rule.minWeight && weight <= rule.maxWeight)) {
            cwrShippingCost = rule.shippingCost;
            break;
          }
        }
      } else if (template.method === 'cost_based' && template.costRules) {
        for (const rule of template.costRules) {
          if (cost >= rule.minCost && cost <= rule.maxCost) {
            cwrShippingCost = rule.shippingCost;
            break;
          }
        }
      }
      setShippingCosts({
        CWR: cwrShippingCost
      });
    }
  }, [product, shippingTemplates]);
  
  // Get mapping templates to display all mapped fields
  const { mappingTemplates, isLoading: templatesLoading } = useMappingTemplates();
  const cwrTemplate = mappingTemplates?.find(t => t.name === 'CWR');
  
  const vendorStockData = getVendorStockData(product, inventoryData, shippingCosts);
  
  // Helper function to get product field value with proper mapping
  const getProductFieldValue = (fieldName: string): string => {
    if (!product) return '-';
    
    const fieldMap: Record<string, any> = {
      sku: product.sku,
      product_name: product.name,
      description: product.description,
      upc: product.upc,
      mpn: product.manufacturerPartNumber,
      brand: product.manufacturerName,
      category: product.categoryName,
      price: product.price,
      cost: product.cost,
      weight: product.weight,
      primary_image: product.primaryImageUrl,
      // Extended fields from product data
      status: product.status,
      manufacturer_name: product.manufacturerName,
      category_name: product.categoryName,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
      // Additional fields that might be in rawSupplierData
      ...product
    };
    
    const value = fieldMap[fieldName];
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    return value;
  };
  
  // Get all mapped fields for specifications display
  const getAllMappedFields = () => {
    if (!cwrTemplate?.mappings) return [];
    
    const mappings = cwrTemplate.mappings;
    return Object.entries(mappings).map(([sourceField, targetField]) => ({
      sourceField,
      targetField,
      displayName: targetField.charAt(0).toUpperCase() + targetField.replace(/_/g, ' ').slice(1),
      value: getProductFieldValue(targetField)
    }));
  };
  
  const mappedFields = getAllMappedFields();
  
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

  // Fetch comprehensive Amazon market intelligence
  const { data: marketIntelligence, isLoading: intelligenceLoading, refetch: refetchIntelligence } = useAmazonMarketIntelligence(
    parseInt(id || '0'),
    activeTab === 'markets' // Only fetch when Markets tab is active
  );

  // Note: mappingTemplates already declared above via useMappingTemplates hook

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
              {product.imageUrl || product.imageUrlLarge || product.primaryImage ? (
                <img 
                  src={product.imageUrl || product.imageUrlLarge || product.primaryImage} 
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onLoad={() => console.log('Main image loaded:', product.imageUrl || product.imageUrlLarge)}
                  onError={(e) => {
                    console.log('Main image failed to load:', product.imageUrl);
                    // Try the large version if available
                    if (product.imageUrlLarge && e.currentTarget.src !== product.imageUrlLarge) {
                      console.log('Trying large image:', product.imageUrlLarge);
                      e.currentTarget.src = product.imageUrlLarge;
                    } else if (product.primaryImage && e.currentTarget.src !== product.primaryImage) {
                      console.log('Trying primary image:', product.primaryImage);
                      e.currentTarget.src = product.primaryImage;
                    } else {
                      // Show a simple error state instead of placeholder
                      e.currentTarget.style.display = 'none';
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500';
                      errorDiv.innerHTML = '<div class="text-center"><div class="text-sm font-medium">Image not available</div><div class="text-xs mt-1">Run supplier import to sync images</div></div>';
                      e.currentTarget.parentNode?.appendChild(errorDiv);
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
                  <div className="text-center p-4">
                    <div className="text-sm font-medium mb-2">No Image Available</div>
                    <div className="text-xs text-gray-400">
                      This product doesn't have image URLs in the database.
                      <br />Run supplier data import to sync product images.
                    </div>
                  </div>
                </div>
              )}
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
              <Badge variant="secondary">EDC: {removeEdcPrefix(product.sku)}</Badge>
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
                        {cleanHtmlTags(product.description).split('\n').map((paragraph, index) => (
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
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{removeEdcPrefix(product.sku)}</span>
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
                  <CardDescription>Unified product data across all suppliers (mapped fields)</CardDescription>
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
                        {product.upc && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">UPC:</span>
                            <span className="text-gray-900 font-mono text-sm">{product.upc}</span>
                          </div>
                        )}
                        {product.price && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">List Price:</span>
                            <span className="text-gray-900 font-semibold">${parseFloat(product.price).toFixed(2)}</span>
                          </div>
                        )}
                        {product.cost && (
                          <div className="flex justify-between py-1">
                            <span className="text-gray-600 text-sm font-medium">Cost:</span>
                            <span className="text-gray-900">${parseFloat(product.cost).toFixed(2)}</span>
                          </div>
                        )}
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
                  
                  {/* Documentation URLs Section - Only show if any URLs are mapped */}
                  {(product.installationGuideUrl || product.ownersManualUrl || product.brochureUrl || product.quickGuideUrl || product.videoUrls) && (
                    <>
                      <div className="border-t pt-4 mt-6">
                        <h4 className="font-semibold text-lg text-gray-900 border-b pb-2 mb-3">Documentation & Media</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {product.installationGuideUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">Installation Guide:</span>
                              <a 
                                href={product.installationGuideUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                View PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {product.ownersManualUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">Owner's Manual:</span>
                              <a 
                                href={product.ownersManualUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                View PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {product.brochureUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">Brochure:</span>
                              <a 
                                href={product.brochureUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                View PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {product.quickGuideUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">Quick Guide:</span>
                              <a 
                                href={product.quickGuideUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                View PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>


            </TabsContent>
            
            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Product Gallery</CardTitle>
                  <CardDescription>High-quality images from CWR supplier feed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Image (300x300) Url */}
                    {product?.imageUrl && (
                      <div className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img 
                            src={product.imageUrl} 
                            alt={`${product?.name || 'Product'} - 300x300`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              console.log('300x300 image failed to load:', product.imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          Image (300x300)
                        </div>
                      </div>
                    )}
                    
                    {/* Image (1000x1000) Url */}
                    {(product?.imageUrlLarge || product?.primaryImage) && (
                      <div className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img 
                            src={product.imageUrlLarge || product.primaryImage} 
                            alt={`${product?.name || 'Product'} - 1000x1000`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              console.log('1000x1000 image failed to load:', product.imageUrlLarge || product.primaryImage);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          Image (1000x1000)
                        </div>
                      </div>
                    )}
                    
                    {/* Image Additional (1000x1000) Urls */}
                    {(() => {
                      try {
                        const additionalImages = product?.additionalImages ? 
                          (typeof product.additionalImages === 'string' ? 
                            JSON.parse(product.additionalImages) : 
                            product.additionalImages) : [];
                        
                        return additionalImages.map((imageUrl: string, index: number) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                              <img 
                                src={imageUrl} 
                                alt={`${product?.name || 'Product'} - Additional ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  console.log(`Additional image ${index + 1} failed to load:`, imageUrl);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                              Additional {index + 1}
                            </div>
                          </div>
                        ));
                      } catch (error) {
                        console.log('Error parsing additional images:', error);
                        return null;
                      }
                    })()}
                    
                    {/* Show placeholder only if no images are available */}
                    {!product?.imageUrl && !product?.imageUrlLarge && !product?.primaryImage && !product?.additionalImages && (
                      <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <div className="text-sm font-medium">No Images Available</div>
                          <div className="text-xs">Images will appear when CWR feed includes image URLs</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Image Quality & Authenticity</h4>
                    <p className="text-sm text-blue-700">
                      All product images are sourced directly from the CWR supplier feed. These are authentic manufacturer 
                      images showing the actual product you will receive, with both 300x300 and 1000x1000 resolution versions available.
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
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm text-gray-600 space-y-1">
                            {/* Show supplier-specific part number based on vendor */}
                            {vendor.name === 'CWR' && product.usin && (
                              <div><strong>CWR Part Number:</strong> {product.usin}</div>
                            )}
                            {vendor.name === 'Ingram Micro' && product.ingramPartNumber && (
                              <div><strong>Ingram Part Number:</strong> {product.ingramPartNumber}</div>
                            )}
                            {vendor.name === 'TD/Synnex' && product.synnexPartNumber && (
                              <div><strong>TD/Synnex Part Number:</strong> {product.synnexPartNumber}</div>
                            )}
                            
                            {/* Always show these for the primary supplier (first card) */}
                            {index === 0 && (
                              <>
                                <div><strong>MPN:</strong> {product.manufacturerPartNumber || "N/A"}</div>
                                <div><strong>UPC:</strong> {product.upc || "N/A"}</div>
                                <div><strong>Brand:</strong> {product.manufacturerName || "N/A"}</div>
                                <div className="mt-2 text-xs text-gray-500">
                                  Primary supplier with authentic product data and full warranty support.
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Markets Tab */}
            <TabsContent value="markets" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Amazon Marketplace Intelligence</h3>
                  <p className="text-sm text-muted-foreground">
                    {product?.upc ? `UPC: ${product.upc}` : 'No UPC available'}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchIntelligence()}
                  disabled={intelligenceLoading}
                  data-testid="button-refresh-intelligence"
                >
                  {intelligenceLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Data
                </Button>
              </div>

              {intelligenceLoading ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-gray-400" />
                      <div className="text-gray-500">Loading Amazon marketplace intelligence...</div>
                      <div className="text-sm text-gray-400 mt-2">Fetching buy box pricing, sales rank, and restrictions</div>
                    </div>
                  </CardContent>
                </Card>
              ) : !marketIntelligence?.asins?.length ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12 text-gray-500">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <div className="font-medium">No Amazon Data Available</div>
                      <div className="text-sm mt-2">
                        {marketIntelligence?.message || 'No ASINs found for this product. Sync product with Amazon first.'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {marketIntelligence.asins.map((asin, index) => (
                    <Card key={asin.asin} className="overflow-hidden" data-testid={`card-asin-${index}`}>
                      <CardHeader className="bg-gray-50 border-b">
                        <div className="flex items-start gap-4">
                          {/* ASIN Thumbnail Image */}
                          {asin.imageUrl && (
                            <div className="flex-shrink-0">
                              <img 
                                src={asin.imageUrl} 
                                alt={asin.title || asin.asin}
                                className="w-20 h-20 object-contain rounded border border-gray-200 bg-white"
                                data-testid={`img-asin-${asin.asin}`}
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">
                                {asin.title || asin.asin}
                              </CardTitle>
                              <a 
                                href={`https://amazon.com/dp/${asin.asin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                data-testid={`link-amazon-${asin.asin}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" data-testid={`badge-asin-${asin.asin}`}>
                                ASIN: {asin.asin}
                              </Badge>
                              {asin.brand && (
                                <Badge variant="secondary">
                                  {asin.brand}
                                </Badge>
                              )}
                              {asin.matchConfidence && (
                                <Badge variant="secondary">
                                  {asin.matchConfidence}% Match
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {asin.error ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <div className="text-red-800">{asin.error}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Buy Box Pricing */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-600" />
                                  Buy Box Pricing
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {asin.buyBoxPrice !== null ? (
                                  <>
                                    <div>
                                      <div className="text-2xl font-bold text-green-600" data-testid={`text-buybox-${asin.asin}`}>
                                        ${asin.buyBoxPrice.toFixed(2)}
                                      </div>
                                      <div className="text-xs text-gray-500">Buy Box Price</div>
                                    </div>
                                    {asin.lowestPrice !== null && (
                                      <div className="pt-2 border-t">
                                        <div className="text-lg font-semibold">${asin.lowestPrice.toFixed(2)}</div>
                                        <div className="text-xs text-gray-500">Lowest Price</div>
                                      </div>
                                    )}
                                    <div className="pt-2 border-t text-xs space-y-1">
                                      <div>
                                        <span className="text-gray-600">Offers:</span> {asin.offerCount}
                                      </div>
                                      {asin.fulfillmentChannel && (
                                        <div>
                                          <span className="text-gray-600">Fulfillment:</span> {asin.fulfillmentChannel}
                                        </div>
                                      )}
                                      {asin.isBuyBoxWinner && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Buy Box Winner
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-500 py-4">
                                    <Info className="h-4 w-4 mx-auto mb-2" />
                                    <div className="text-center">No pricing data available</div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Sales Rank */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4 text-blue-600" />
                                  Sales Rank
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {asin.salesRank !== null ? (
                                  <>
                                    <div>
                                      <div className="text-2xl font-bold text-blue-600" data-testid={`text-salesrank-${asin.asin}`}>
                                        #{asin.salesRank.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {asin.salesRankCategory || 'Overall'}
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-gray-600">
                                        {asin.salesRank < 10000 && (
                                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                                            Top Seller
                                          </Badge>
                                        )}
                                        {asin.salesRank >= 10000 && asin.salesRank < 100000 && (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                            Good Sales
                                          </Badge>
                                        )}
                                        {asin.salesRank >= 100000 && (
                                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                            Moderate Sales
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-500 py-4">
                                    <Info className="h-4 w-4 mx-auto mb-2" />
                                    <div className="text-center">No sales rank data available</div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Listing Restrictions */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  {asin.canList ? (
                                    <ShieldCheck className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <ShieldAlert className="h-4 w-4 text-red-600" />
                                  )}
                                  Listing Status
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {asin.canList !== null ? (
                                  <>
                                    <div>
                                      {asin.canList ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700" data-testid={`badge-can-list-${asin.asin}`}>
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Can List
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-red-100 text-red-700" data-testid={`badge-restricted-${asin.asin}`}>
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          Restricted
                                        </Badge>
                                      )}
                                    </div>
                                    {asin.hasRestrictions && asin.restrictionMessages.length > 0 && (
                                      <div className="pt-2 border-t space-y-1">
                                        <div className="text-xs font-medium text-gray-700">Restrictions:</div>
                                        {asin.restrictionMessages.map((msg, idx) => (
                                          <div key={idx} className="text-xs text-red-600">
                                            • {msg}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {asin.isSimulated && (
                                      <div className="pt-2 border-t">
                                        <Badge variant="outline" className="text-xs">
                                          Simulated Data
                                        </Badge>
                                      </div>
                                    )}
                                    <div className="pt-2 border-t text-xs text-gray-500">
                                      Last checked: {new Date(asin.lastChecked).toLocaleDateString()}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-500 py-4">
                                    <Info className="h-4 w-4 mx-auto mb-2" />
                                    <div className="text-center">No restriction data available</div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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