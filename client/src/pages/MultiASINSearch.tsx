import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, ExternalLink, TrendingUp, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ASIN {
  asin: string;
  title: string;
  brand: string;
  imageUrl?: string;
  category: string;
  salesRank?: number;
  manufacturerNumber?: string;
}

interface SearchResult {
  searchCriteria?: {
    upc?: string;
    manufacturerNumber?: string;
  };
  upc?: string;
  manufacturerNumber?: string;
  foundASINs: ASIN[];
  totalFound: number;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  upc?: string;
  manufacturerPartNumber?: string;
}

export default function MultiASINSearch() {
  const [searchType, setSearchType] = useState<'manual' | 'product'>('manual');
  const [upc, setUpc] = useState('');
  const [manufacturerNumber, setManufacturerNumber] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products for selection
  const { data: products } = useQuery({
    queryKey: ['/api/products'],
    enabled: searchType === 'product'
  });

  // Manual search mutation
  const manualSearchMutation = useMutation({
    mutationFn: async ({ upc, manufacturerNumber }: { upc?: string; manufacturerNumber?: string }) => {
      let url = '/api/asin-search/multiple';
      const params = new URLSearchParams();
      if (upc) params.append('upc', upc);
      if (manufacturerNumber) params.append('manufacturerNumber', manufacturerNumber);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.data);
      toast({
        title: "Search Complete",
        description: `Found ${data.data.totalFound} ASINs`
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  // Product-based search mutation
  const productSearchMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = products?.find((p: Product) => p.id.toString() === productId);
      if (!product) throw new Error('Product not found');

      let url = '/api/asin-search/multiple';
      const params = new URLSearchParams();
      if (product.upc) params.append('upc', product.upc);
      if (product.manufacturerPartNumber) params.append('manufacturerNumber', product.manufacturerPartNumber);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.data);
      toast({
        title: "Search Complete", 
        description: `Found ${data.data.totalFound} ASINs`
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  const handleManualSearch = () => {
    if (!upc && !manufacturerNumber) {
      toast({
        title: "Search Criteria Required",
        description: "Please provide either UPC or manufacturer number",
        variant: "destructive"
      });
      return;
    }
    manualSearchMutation.mutate({ upc, manufacturerNumber });
  };

  const handleProductSearch = () => {
    if (!selectedProductId) {
      toast({
        title: "Product Required",
        description: "Please select a product to search",
        variant: "destructive"
      });
      return;
    }
    productSearchMutation.mutate(selectedProductId);
  };

  const selectedProduct = products?.find((p: Product) => p.id.toString() === selectedProductId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Multi-ASIN Discovery</h1>
          <p className="text-muted-foreground">Find multiple Amazon ASINs for the same product using UPC and manufacturer numbers</p>
        </div>
      </div>

      <Tabs value={searchType} onValueChange={(value) => setSearchType(value as 'manual' | 'product')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Search</TabsTrigger>
          <TabsTrigger value="product">Product Search</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual ASIN Search</CardTitle>
              <CardDescription>
                Enter UPC or manufacturer number to find multiple ASINs for the same product
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="upc">UPC Code</Label>
                  <Input
                    id="upc"
                    placeholder="Enter UPC code"
                    value={upc}
                    onChange={(e) => setUpc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturerNumber">Manufacturer Number</Label>
                  <Input
                    id="manufacturerNumber"
                    placeholder="Enter manufacturer part number"
                    value={manufacturerNumber}
                    onChange={(e) => setManufacturerNumber(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleManualSearch}
                disabled={manualSearchMutation.isPending}
                className="w-full"
              >
                <Search className="w-4 h-4 mr-2" />
                {manualSearchMutation.isPending ? 'Searching...' : 'Search ASINs'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product-Based ASIN Search</CardTitle>
              <CardDescription>
                Select an existing product to search for multiple ASINs using its UPC and manufacturer number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Select Product</Label>
                <select
                  id="product"
                  className="w-full p-2 border rounded-md"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Choose a product...</option>
                  {products?.map((product: Product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedProduct && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold">{selectedProduct.name}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">SKU:</span> {selectedProduct.sku}
                    </div>
                    <div>
                      <span className="font-medium">UPC:</span> {selectedProduct.upc || 'Not available'}
                    </div>
                    <div>
                      <span className="font-medium">Manufacturer #:</span> {selectedProduct.manufacturerPartNumber || 'Not available'}
                    </div>
                  </div>
                  {!selectedProduct.upc && !selectedProduct.manufacturerPartNumber && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">No UPC or manufacturer number available for this product</span>
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={handleProductSearch}
                disabled={productSearchMutation.isPending || !selectedProductId}
                className="w-full"
              >
                <Search className="w-4 h-4 mr-2" />
                {productSearchMutation.isPending ? 'Searching...' : 'Search ASINs'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {searchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Search Results
              <Badge variant="secondary">{searchResults.totalFound} ASINs Found</Badge>
            </CardTitle>
            <CardDescription>
              {searchResults.searchCriteria && (
                <div className="flex gap-4">
                  {searchResults.searchCriteria.upc && (
                    <span>UPC: {searchResults.searchCriteria.upc}</span>
                  )}
                  {searchResults.searchCriteria.manufacturerNumber && (
                    <span>Manufacturer #: {searchResults.searchCriteria.manufacturerNumber}</span>
                  )}
                </div>
              )}
              {searchResults.upc && <span>UPC: {searchResults.upc}</span>}
              {searchResults.manufacturerNumber && <span>Manufacturer #: {searchResults.manufacturerNumber}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.foundASINs.map((asin) => (
                <Card key={asin.asin} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {asin.imageUrl && (
                        <img 
                          src={asin.imageUrl} 
                          alt={asin.title}
                          className="w-full h-48 object-cover rounded-md"
                        />
                      )}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm line-clamp-2">{asin.title}</h4>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{asin.asin}</Badge>
                          <a
                            href={`https://amazon.com/dp/${asin.asin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div><span className="font-medium">Brand:</span> {asin.brand}</div>
                          <div><span className="font-medium">Category:</span> {asin.category}</div>
                          {asin.manufacturerNumber && (
                            <div><span className="font-medium">Mfg #:</span> {asin.manufacturerNumber}</div>
                          )}
                          {asin.salesRank && (
                            <div><span className="font-medium">Sales Rank:</span> {asin.salesRank.toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}