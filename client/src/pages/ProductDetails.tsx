import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ArrowLeft, ShoppingCart, TruckIcon, PackageOpen } from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  code: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  active: boolean;
}

interface ProductSupplier {
  supplierId: number;
  supplierName: string;
  cost: string;
  stock: number;
  shippingTime: string;
  shippingOptions?: {
    method: string;
    cost: string;
    estimatedDays: string;
  }[];
  locations: {
    warehouse: string;
    quantity: number;
  }[];
  specifications?: Record<string, string>;
  documents?: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
  images?: {
    id: string;
    url: string;
    alt: string;
    isPrimary: boolean;
  }[];
  notes?: string;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  upc: string | null;
  manufacturerPartNumber: string | null;
  price: string | null;
  cost: string | null;
  weight: string | null;
  dimensions: {
    length: string | null;
    width: string | null;
    height: string | null;
    unit: string | null;
  } | null;
  status: string | null;
  manufacturer: string | null;
  brand: string | null;
  category: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  imageUrl: string | null;
  additionalImageUrls: string[] | null;
  suppliers: ProductSupplier[];
  specifications: Record<string, string> | null;
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSupplier, setSelectedSupplier] = useState<ProductSupplier | null>(null);
  const [showSupplierDetails, setShowSupplierDetails] = useState(false);
  
  // Fetch product details
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['/api/products', id],
    queryFn: async () => {
      // In a real app, this would fetch from the actual API
      // For now, we'll return mock data that matches our expected structure
      
      const mockProduct: Product = {
        id: parseInt(id),
        name: "Ultra HD 4K Wireless Security Camera System",
        description: "Professional-grade security camera system with 4K resolution, night vision, and motion detection. Includes 4 wireless cameras and a central hub for monitoring.",
        sku: "SEC-4K-PRO-01",
        upc: "856721009462",
        manufacturerPartNumber: "SC4K-PRO-01",
        price: "599.99",
        cost: "350.00",
        weight: "12.5",
        dimensions: {
          length: "15.5",
          width: "12.2",
          height: "8.7",
          unit: "in"
        },
        status: "active",
        manufacturer: "SecureTech",
        brand: "ProVision",
        category: "Security Systems",
        createdAt: "2025-01-15T00:00:00Z",
        updatedAt: "2025-04-22T00:00:00Z",
        imageUrl: "https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?q=80&w=2070&auto=format&fit=crop",
        additionalImageUrls: [
          "https://images.unsplash.com/photo-1551706872-8212cb663d9d?q=80&w=2070&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1595750213943-d4dbc91d19b3?q=80&w=2000&auto=format&fit=crop"
        ],
        suppliers: [
          {
            supplierId: 1,
            supplierName: "CWR",
            cost: "345.99",
            stock: 78,
            shippingTime: "2-3 business days",
            shippingOptions: [
              { method: "Standard Ground", cost: "12.99", estimatedDays: "3-5 days" },
              { method: "Expedited", cost: "24.99", estimatedDays: "2 days" },
              { method: "Next Day Air", cost: "39.99", estimatedDays: "1 day" }
            ],
            locations: [
              { warehouse: "East Coast", quantity: 32 },
              { warehouse: "Midwest", quantity: 46 }
            ],
            specifications: {
              "Resolution": "4K Ultra HD (3840 x 2160)",
              "Night Vision": "Up to 100ft",
              "Storage": "1TB Expandable",
              "Power": "AC Adapter with Battery Backup",
              "Weather Resistance": "IP67 Rated",
              "Warranty": "3 Years Limited",
              "Installation": "Professional installation available",
              "Package Contents": "4 Cameras, 1 Hub, Power Adapters, Mounting Kit"
            },
            documents: [
              {
                id: "doc1",
                name: "Installation Guide",
                type: "pdf",
                url: "https://example.com/installation-guide.pdf"
              },
              {
                id: "doc2",
                name: "User Manual",
                type: "pdf",
                url: "https://example.com/user-manual.pdf"
              }
            ],
            images: [
              {
                id: "img1",
                url: "https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?q=80&w=2070&auto=format&fit=crop",
                alt: "Camera System - Front View",
                isPrimary: true
              },
              {
                id: "img2",
                url: "https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=2071&auto=format&fit=crop",
                alt: "Camera System - Package Contents",
                isPrimary: false
              }
            ],
            notes: "CWR is an authorized retailer. Products include full manufacturer warranty."
          },
          {
            supplierId: 2,
            supplierName: "D&H",
            cost: "349.99",
            stock: 105,
            shippingTime: "1-2 business days",
            shippingOptions: [
              { method: "Standard Ground", cost: "10.99", estimatedDays: "3-4 days" },
              { method: "2-Day Express", cost: "19.99", estimatedDays: "2 days" },
              { method: "Priority Overnight", cost: "34.99", estimatedDays: "1 day" },
              { method: "Free Economy", cost: "0.00", estimatedDays: "5-7 days" }
            ],
            locations: [
              { warehouse: "West Coast", quantity: 65 },
              { warehouse: "South", quantity: 40 }
            ],
            specifications: {
              "Resolution": "4K Ultra HD (3840 x 2160)",
              "Night Vision": "Up to 120ft",
              "Storage": "2TB Expandable",
              "Power": "AC Adapter with Battery Backup",
              "Weather Resistance": "IP68 Rated",
              "Wireless Range": "Up to 400ft",
              "Cloud Storage": "Optional subscription available",
              "Smart Home Integration": "Works with Alexa, Google Home, HomeKit"
            },
            documents: [
              {
                id: "doc3",
                name: "Technical Specifications",
                type: "pdf",
                url: "https://example.com/tech-specs.pdf"
              },
              {
                id: "doc4",
                name: "Smart Home Integration Guide",
                type: "pdf",
                url: "https://example.com/smart-home-guide.pdf"
              }
            ],
            images: [
              {
                id: "img3",
                url: "https://images.unsplash.com/photo-1595750213943-d4dbc91d19b3?q=80&w=2000&auto=format&fit=crop",
                alt: "Camera System - Smart App View",
                isPrimary: true
              },
              {
                id: "img4",
                url: "https://images.unsplash.com/photo-1550345332-09e3ac987658?q=80&w=1887&auto=format&fit=crop",
                alt: "Camera System - Installation Example",
                isPrimary: false
              }
            ],
            notes: "D&H offers premium edition with extended warranty and free cloud storage for 3 months."
          }
        ],
        specifications: {
          "Resolution": "4K Ultra HD (3840 x 2160)",
          "Night Vision": "Up to 100ft",
          "Storage": "1TB Expandable",
          "Power": "AC Adapter with Battery Backup",
          "Weather Resistance": "IP67 Rated",
          "Connectivity": "Wireless (2.4GHz & 5GHz)",
          "Mobile App": "iOS & Android Compatible",
          "Motion Detection": "Advanced AI with Zone Setting",
          "Field of View": "130° Wide Angle",
          "Warranty": "3 Years Limited"
        }
      };
      
      return mockProduct;
    }
  });
  
  const handleAddToCart = () => {
    if (!selectedSupplier) {
      toast({
        title: "Please select a supplier",
        description: "You must select a supplier before adding to cart",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Added to cart",
      description: `${product?.name} from ${selectedSupplier.supplierName} added to cart`,
    });
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
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/products">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Products
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product image area */}
        <div className="col-span-1">
          <Card className="overflow-hidden">
            <div className="relative pb-[100%]">
              <img 
                src={
                  selectedSupplier?.images?.find(img => img.isPrimary)?.url || 
                  product.imageUrl || 
                  "/placeholder-product.jpg"
                } 
                alt={
                  selectedSupplier?.images?.find(img => img.isPrimary)?.alt || 
                  product.name
                }
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <CardFooter className="py-2 justify-center">
              <Button variant="link" asChild>
                <a 
                  href={
                    selectedSupplier?.images?.find(img => img.isPrimary)?.url || 
                    product.imageUrl || 
                    "#"
                  } 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-1" /> View Hi-Res Image
                </a>
              </Button>
            </CardFooter>
          </Card>
          
          {selectedSupplier?.notes && (
            <div className="mt-4 border rounded-md p-3 bg-blue-50 text-sm">
              <p className="font-medium text-blue-800">Supplier Notes:</p>
              <p className="mt-1 text-gray-700">{selectedSupplier.notes}</p>
            </div>
          )}
        </div>
        
        {/* Product details and tabs area */}
        <div className="col-span-1 lg:col-span-2">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50">SKU: {product.sku}</Badge>
              {product.status && (
                <Badge className={
                  product.status === 'active' ? 'bg-green-100 text-green-800' : 
                  product.status === 'discontinued' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }>
                  {product.status.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
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
                        )}
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
                  <CardTitle>Technical Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSupplier?.specifications ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(selectedSupplier.specifications).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">{key}:</span>
                          <span className="text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No detailed specifications available from selected supplier.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Product Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSupplier?.images && selectedSupplier.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedSupplier.images.map((image) => (
                        <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img 
                            src={image.url} 
                            alt={image.alt}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                          />
                          {image.isPrimary && (
                            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No additional images available from selected supplier.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Sidebar */}
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Options</CardTitle>
              <CardDescription>Select a supplier to view details and add to cart</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-4 bg-blue-50 border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">CWR</h3>
                      <div className="flex items-center mt-1 text-sm text-gray-600">
                        <TruckIcon className="w-3 h-3 mr-1" />
                        <span>2-3 business days</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${product.cost || "N/A"}</div>
                      <div className={`text-sm ${(product.inventoryQuantity || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(product.inventoryQuantity || 0) > 0 ? `${product.inventoryQuantity} in stock` : 'Contact for availability'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><strong>MPN:</strong> {product.manufacturerPartNumber || "N/A"}</div>
                      <div><strong>UPC:</strong> {product.upc || "N/A"}</div>
                      <div><strong>Brand:</strong> {product.manufacturerName || "N/A"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={handleAddToCart}
                    disabled={!selectedSupplier}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Specifications Tab */}
            <TabsContent value="specifications">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Technical Specifications</CardTitle>
                  {selectedSupplier && (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                      {selectedSupplier.supplierName} Specifications
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  {/* If a supplier is selected and has specs, show those; otherwise, show the general product specs */}
                  {(selectedSupplier?.specifications || product.specifications) ? (
                    <Table>
                      <TableBody>
                        {Object.entries(selectedSupplier?.specifications || product.specifications || {}).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium w-1/3">{key}</TableCell>
                            <TableCell>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-600">No specifications available for this product.</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Documents section - only show if a supplier is selected and has documents */}
              {selectedSupplier?.documents && selectedSupplier.documents.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Documentation</CardTitle>
                    <CardDescription>
                      Product manuals and resources provided by {selectedSupplier.supplierName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {selectedSupplier.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="flex items-center">
                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                              {doc.type === 'pdf' ? 
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg> : 
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <path d="M14 2v6h6"/>
                                  <path d="M16 13H8"/>
                                  <path d="M16 17H8"/>
                                  <path d="M10 9H8"/>
                                </svg>
                              }
                            </div>
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-gray-500 uppercase">{doc.type}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" /> Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Gallery Tab */}
            <TabsContent value="gallery">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Product Gallery</CardTitle>
                  {selectedSupplier && selectedSupplier.images && selectedSupplier.images.length > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                      {selectedSupplier.supplierName} Images
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* If a supplier is selected and has images, show those instead of general product images */}
                    {selectedSupplier?.images ? (
                      // Supplier-specific images
                      selectedSupplier.images.map((image) => (
                        <a 
                          key={image.id}
                          href={image.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="block aspect-square overflow-hidden rounded-md"
                        >
                          <img 
                            src={image.url} 
                            alt={image.alt} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                          <div className="p-2 bg-white bg-opacity-90 absolute bottom-0 left-0 right-0">
                            <p className="text-sm text-gray-700">{image.alt}</p>
                          </div>
                        </a>
                      ))
                    ) : (
                      // General product images
                      <>
                        {/* Main product image */}
                        {product.imageUrl && (
                          <a 
                            href={product.imageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square overflow-hidden rounded-md relative"
                          >
                            <img 
                              src={product.imageUrl} 
                              alt={`${product.name} - Main`} 
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                            <div className="p-2 bg-white bg-opacity-90 absolute bottom-0 left-0 right-0">
                              <p className="text-sm text-gray-700">{product.name} - Main View</p>
                            </div>
                          </a>
                        )}
                        
                        {/* Additional images */}
                        {product.additionalImageUrls?.map((imageUrl, index) => (
                          <a 
                            key={index}
                            href={imageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block aspect-square overflow-hidden rounded-md relative"
                          >
                            <img 
                              src={imageUrl} 
                              alt={`${product.name} - Image ${index + 2}`} 
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                            <div className="p-2 bg-white bg-opacity-90 absolute bottom-0 left-0 right-0">
                              <p className="text-sm text-gray-700">{product.name} - Additional View {index + 1}</p>
                            </div>
                          </a>
                        ))}
                      </>
                    )}
                    
                    {/* No images message */}
                    {(!selectedSupplier?.images || selectedSupplier.images.length === 0) && 
                     (!product.imageUrl && (!product.additionalImageUrls || product.additionalImageUrls.length === 0)) && (
                      <p className="text-gray-600 col-span-2">No gallery images available for this product.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Supplier Details Modal */}
      <Dialog open={showSupplierDetails} onOpenChange={setShowSupplierDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.supplierName} - Supply Details</DialogTitle>
            <DialogDescription>
              Inventory and shipping information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Cost</h4>
                <p className="text-lg font-semibold">${selectedSupplier?.cost}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Shipping Time</h4>
                <p className="text-lg">{selectedSupplier?.shippingTime}</p>
              </div>
            </div>
            
            {/* Shipping Options */}
            {selectedSupplier?.shippingOptions && selectedSupplier.shippingOptions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Shipping Options</h4>
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedSupplier.shippingOptions.map((option, index) => (
                        <tr key={index} className={option.cost === "0.00" ? "bg-green-50" : ""}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{option.method}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {option.cost === "0.00" ? (
                              <span className="text-green-600 font-medium">FREE</span>
                            ) : (
                              `$${option.cost}`
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{option.estimatedDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Warehouse Inventory</h4>
              <div className="border rounded-md divide-y">
                {selectedSupplier?.locations.map((location, index) => (
                  <div key={index} className="flex justify-between p-3">
                    <div className="flex items-center">
                      <PackageOpen className="w-4 h-4 mr-2 text-gray-500" />
                      <span>{location.warehouse}</span>
                    </div>
                    <span className="font-medium">{location.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={() => {
                  handleAddToCart();
                  setShowSupplierDetails(false);
                }}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}