import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Eye, MapPin, Settings, TestTube, Download, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AsinExplainer from '@/components/AsinExplainer';

interface AmazonProduct {
  asin: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  rank: number;
  rating: number;
  review_count: number;
  features: string[];
  specifications: Record<string, string>;
  restrictions: string[];
  fulfillment_type: string;
  images: string[];
  variations: Array<{
    asin: string;
    type: string;
    value: string;
  }>;
  raw_data: Record<string, any>;
}

interface MappingRule {
  id: string;
  field_name: string;
  amazon_field: string;
  transformation: string;
  required: boolean;
  validation: string;
  active: boolean;
}

export default function MarketplaceAmazon() {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [testBatchSize, setTestBatchSize] = useState('10');
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([]);
  const [activeTab, setActiveTab] = useState('testing');

  // Fetch products for testing
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    select: (data) => data.filter((p: any) => p.usin && p.status === 'active').slice(0, 50)
  });

  // Fetch selected product details
  const { data: selectedProductData } = useQuery({
    queryKey: ['/api/products', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      const response = await fetch(`/api/products/${selectedProduct}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      return response.json();
    }
  });

  // Fetch Amazon API response for selected product
  const { data: amazonData, isLoading: amazonLoading, refetch: refetchAmazon } = useQuery({
    queryKey: ['/api/marketplace/amazon', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/amazon/${selectedProduct}`);
      if (!response.ok) throw new Error('Failed to fetch Amazon data');
      return response.json();
    }
  });

  // Fetch existing mapping rules
  const { data: existingRules = [] } = useQuery({
    queryKey: ['/api/marketplace/amazon/mapping-rules']
  });

  const testAPICall = async () => {
    if (!selectedProduct) return;
    await refetchAmazon();
  };

  const createMappingRule = (fieldName: string, amazonField: string) => {
    const newRule: MappingRule = {
      id: Date.now().toString(),
      field_name: fieldName,
      amazon_field: amazonField,
      transformation: 'direct',
      required: false,
      validation: '',
      active: true
    };
    setMappingRules([...mappingRules, newRule]);
  };

  const saveMappingRules = async () => {
    try {
      const response = await fetch('/api/marketplace/amazon/mapping-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: mappingRules })
      });
      if (!response.ok) throw new Error('Failed to save mapping rules');
    } catch (error) {
      console.error('Error saving mapping rules:', error);
    }
  };

  const runBatchTest = async () => {
    try {
      const response = await fetch('/api/marketplace/amazon/batch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          batchSize: parseInt(testBatchSize),
          rules: mappingRules 
        })
      });
      if (!response.ok) throw new Error('Failed to run batch test');
      const result = await response.json();
      console.log('Batch test result:', result);
    } catch (error) {
      console.error('Error running batch test:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Amazon Marketplace Mapping</h1>
          <p className="text-muted-foreground">Test API responses and create mapping rules for large-scale catalog processing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Rules
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Rules
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            API Testing
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Mapping Rules
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Batch Testing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="testing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Selection</CardTitle>
                <CardDescription>
                Amazon searches return real ASINs (Amazon Standard Identification Numbers) via cascading UPC → MPN → Description
              </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-select">Select Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any, index: number) => (
                        <SelectItem key={`${product.id}-${index}`} value={product.id.toString()}>
                          {product.sku} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={testAPICall} 
                  disabled={!selectedProduct || amazonLoading}
                  className="w-full"
                >
                  {amazonLoading ? 'Testing...' : 'Test API Call'}
                </Button>

                {selectedProduct && selectedProductData && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <img 
                          src={selectedProductData.imageUrl || selectedProductData.imageUrlLarge} 
                          alt={selectedProductData.name}
                          className="w-20 h-20 object-contain rounded border bg-white"
                          onError={(e) => {
                            e.currentTarget.src = '/api/placeholder/80/80';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground mb-1">
                          {selectedProductData.sku} - {selectedProductData.name?.replace(/&[^;]+;/g, '') || 'No name'}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div><strong>UPC:</strong> {selectedProductData.upc}</div>
                          <div><strong>Manufacturer:</strong> {selectedProductData.manufacturerName}</div>
                          <div><strong>Price:</strong> ${selectedProductData.price}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedProduct && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Testing Product ID: {selectedProduct}
                      {(() => {
                        const product = products.find((p: any) => p.id.toString() === selectedProduct);
                        return product ? ` (${product.sku})` : '';
                      })()}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>API Response</CardTitle>
                <CardDescription>Live Amazon Seller API data for selected product</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[700px]">
                  {amazonLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">Loading Amazon data...</div>
                    </div>
                  ) : amazonData && amazonData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg mb-4">
                        <h4 className="font-medium mb-2">Amazon ASINs Found: {amazonData.length}</h4>
                        <div className="text-sm text-gray-600">
                          {selectedProductData ? 
                            `Marketplace matches for ${selectedProductData.sku} (UPC: ${selectedProductData.upc})` :
                            'Multiple marketplace matches discovered'
                          }
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {amazonData.map((asinMapping: any, idx: number) => (
                          <div key={idx} className="bg-white rounded border p-3">
                            <div className="flex items-start gap-4 mb-3">
                              <div className="flex-shrink-0">
                                <img 
                                  src={asinMapping.asinData?.primaryImageUrl || `https://images-na.ssl-images-amazon.com/images/P/${asinMapping.asin}.01.L.jpg`}
                                  alt={asinMapping.asinData?.title || 'Amazon product'}
                                  className="w-16 h-16 object-contain rounded border bg-white"
                                  onError={(e) => {
                                    e.currentTarget.src = '/api/placeholder/64/64';
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-medium font-mono text-blue-600">{asinMapping.asin}</div>
                                    <div className="text-gray-900 text-sm font-medium">{asinMapping.asinData?.title || 'No title available'}</div>
                                    {asinMapping.asinData?.description && (
                                      <div className="text-gray-600 text-xs mt-1 line-clamp-2">{asinMapping.asinData.description}</div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-green-600 font-medium">
                                      {asinMapping.matchConfidence || 0}% Confidence
                                    </div>
                                    <Badge variant="default" className="text-xs">
                                      Active Mapping
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div className="flex gap-1 mb-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {asinMapping.matchMethod || 'Unknown match'}
                                  </Badge>
                                  {asinMapping.asinData?.upc && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      UPC: {asinMapping.asinData.upc}
                                    </Badge>
                                  )}
                                </div>
                                
                                {asinMapping.asinData && (
                                  <div className="border rounded p-3 bg-gray-50">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div><strong>Brand:</strong> {asinMapping.asinData.brand || 'Not specified'}</div>
                                      <div><strong>Category:</strong> {asinMapping.asinData.category || 'Not specified'}</div>
                                      <div><strong>Stock:</strong> {asinMapping.intelligence?.inStock ? 'In Stock' : 'Out of Stock'}</div>
                                      <div><strong>Prime:</strong> {asinMapping.intelligence?.isPrime ? 'Yes' : 'No'}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Complete Raw API Response:</h4>
                        <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                          {JSON.stringify(amazonData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : selectedProduct ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                      <div className="text-muted-foreground">No Amazon marketplace data found</div>
                      <div className="text-sm text-gray-500">
                        {selectedProductData ? 
                          `No ASIN mappings exist for ${selectedProductData.sku} (UPC: ${selectedProductData.upc})` :
                          'No ASIN mappings found for this product'
                        }
                      </div>
                      <Button variant="outline" size="sm" onClick={testAPICall}>
                        Try Live Amazon Search
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Select a product to see API response
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Field Mapping Tab */}
        <TabsContent value="field-mapping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Rules</CardTitle>
              <CardDescription>Create mapping rules for large-scale catalog processing</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Field mapping functionality coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mapping Rules Tab */}  
        <TabsContent value="mapping-rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mapping Rules</CardTitle>
              <CardDescription>Manage mapping rules configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Mapping rules configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Testing Tab */}
        <TabsContent value="batch-testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch Testing</CardTitle>
              <CardDescription>Test mapping rules on multiple products</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Batch testing functionality coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
