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
  locations: {
    warehouse: string;
    quantity: number;
  }[];
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
            locations: [
              { warehouse: "East Coast", quantity: 32 },
              { warehouse: "Midwest", quantity: 46 }
            ]
          },
          {
            supplierId: 2,
            supplierName: "D&H",
            cost: "349.99",
            stock: 105,
            shippingTime: "1-2 business days",
            locations: [
              { warehouse: "West Coast", quantity: 65 },
              { warehouse: "South", quantity: 40 }
            ]
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
                src={product.imageUrl || "/placeholder-product.jpg"} 
                alt={product.name} 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <CardFooter className="py-2 justify-center">
              <Button variant="link" asChild>
                <a href={product.imageUrl || "#"} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> View Hi-Res Image
                </a>
              </Button>
            </CardFooter>
          </Card>
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
                  <p className="text-gray-700">{product.description}</p>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">Basic Information</h3>
                      <ul className="mt-2 space-y-2">
                        {product.price && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">Price:</span>
                            <span className="font-medium">${product.price}</span>
                          </li>
                        )}
                        {product.manufacturer && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">Manufacturer:</span>
                            <span>{product.manufacturer}</span>
                          </li>
                        )}
                        {product.brand && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">Brand:</span>
                            <span>{product.brand}</span>
                          </li>
                        )}
                        {product.category && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">Category:</span>
                            <span>{product.category}</span>
                          </li>
                        )}
                        {product.upc && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">UPC:</span>
                            <span>{product.upc}</span>
                          </li>
                        )}
                        {product.manufacturerPartNumber && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">MPN:</span>
                            <span>{product.manufacturerPartNumber}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900">Dimensions & Weight</h3>
                      <ul className="mt-2 space-y-2">
                        {product.weight && (
                          <li className="flex justify-between">
                            <span className="text-gray-600">Weight:</span>
                            <span>{product.weight} lbs</span>
                          </li>
                        )}
                        {product.dimensions && (
                          <>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Dimensions:</span>
                              <span>
                                {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} {product.dimensions.unit}
                              </span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Supplier Options</CardTitle>
                  <CardDescription>Select a supplier to view details and add to cart</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {product.suppliers.map((supplier) => (
                      <div 
                        key={supplier.supplierId}
                        className={`border rounded-md p-4 cursor-pointer transition-colors ${
                          selectedSupplier?.supplierId === supplier.supplierId 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedSupplier(supplier)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{supplier.supplierName}</h3>
                            <div className="flex items-center mt-1 text-sm text-gray-600">
                              <TruckIcon className="w-3 h-3 mr-1" />
                              <span>{supplier.shippingTime}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${supplier.cost}</div>
                            <div className={`text-sm ${supplier.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {supplier.stock > 0 ? `${supplier.stock} in stock` : 'Out of stock'}
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          variant="link" 
                          className="p-0 h-auto mt-2 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupplier(supplier);
                            setShowSupplierDetails(true);
                          }}
                        >
                          View warehouse inventory
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
                <CardHeader>
                  <CardTitle>Technical Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  {product.specifications ? (
                    <Table>
                      <TableBody>
                        {Object.entries(product.specifications).map(([key, value]) => (
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
            </TabsContent>
            
            {/* Gallery Tab */}
            <TabsContent value="gallery">
              <Card>
                <CardHeader>
                  <CardTitle>Product Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Main product image */}
                    {product.imageUrl && (
                      <a 
                        href={product.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block aspect-square overflow-hidden rounded-md"
                      >
                        <img 
                          src={product.imageUrl} 
                          alt={`${product.name} - Main`} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </a>
                    )}
                    
                    {/* Additional images */}
                    {product.additionalImageUrls?.map((imageUrl, index) => (
                      <a 
                        key={index}
                        href={imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block aspect-square overflow-hidden rounded-md"
                      >
                        <img 
                          src={imageUrl} 
                          alt={`${product.name} - Image ${index + 2}`} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </a>
                    ))}
                    
                    {(!product.imageUrl && (!product.additionalImageUrls || product.additionalImageUrls.length === 0)) && (
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