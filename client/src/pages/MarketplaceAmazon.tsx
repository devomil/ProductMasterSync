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

  // Fetch Amazon API response for selected product
  const { data: amazonData, isLoading: amazonLoading, refetch: refetchAmazon } = useQuery({
    queryKey: ['/api/marketplace/amazon/product', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/amazon/product/${selectedProduct}`);
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
                  ) : amazonData ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg mb-4">
                        <h4 className="font-medium mb-2">Amazon Search Sequence & Confidence:</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <div>
                              <div className="font-medium text-lg">{amazonData.confidence_score}% Confidence</div>
                              <div className="text-sm text-gray-600">{amazonData.confidence_tier}</div>
                            </div>
                            <Badge variant={
                              amazonData.confidence_score >= 90 ? 'default' :
                              amazonData.confidence_score >= 70 ? 'secondary' :
                              amazonData.confidence_score >= 50 ? 'outline' : 'destructive'
                            }>
                              {amazonData.matched_criteria?.join(', ')}
                            </Badge>
                          </div>
                          
                          <div>
                            <h5 className="font-medium mb-2">Search Steps Performed:</h5>
                            <div className="space-y-3">
                              {amazonData.search_sequence?.map((step: any, idx: number) => (
                                <div key={idx} className="bg-white rounded border p-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <div className="font-medium">Step {step.step}: {step.method}</div>
                                      <div className="text-gray-600 text-sm">{step.criteria}</div>
                                      {step.asins_found && step.asins_found.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                          {step.asins_found.map((asin: any, asinIdx: number) => (
                                            <Badge key={asinIdx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono">
                                              {asin.asin}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className={step.success ? 'text-green-600 font-medium' : 'text-red-600'}>
                                        {step.results_found} ASINs found
                                      </div>
                                      <Badge variant={step.success ? 'default' : 'destructive'} className="text-xs">
                                        {step.success ? 'Success' : 'Failed'}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {step.asins_found && step.asins_found.length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium text-gray-700 mb-2">Detailed ASIN Data:</div>
                                      <div className="space-y-2">
                                        {step.asins_found.map((asinData: any, asinIdx: number) => (
                                          <div key={asinIdx} className="border rounded p-3 bg-white">
                                            <div className="flex items-center justify-between mb-2">
                                              <div>
                                                <div className="font-mono font-medium text-sm text-blue-600">{asinData.asin}</div>
                                                <div className="flex gap-2 mt-1">
                                                  {asinData.title_match && (
                                                    <Badge variant="outline" className="text-xs px-1 py-0">Title Match</Badge>
                                                  )}
                                                  {asinData.brand_match && (
                                                    <Badge variant="outline" className="text-xs px-1 py-0">Brand Match</Badge>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-medium">{asinData.confidence}%</div>
                                                <div className="text-gray-500 text-xs">{asinData.category}</div>
                                              </div>
                                            </div>
                                            
                                            {/* Buy Box Information */}
                                            {asinData.buy_box_info && (
                                              <div className="mb-2 p-2 bg-blue-50 rounded text-xs">
                                                <div className="flex justify-between items-center mb-1">
                                                  <strong>Buy Box Analysis:</strong>
                                                  <Badge variant={asinData.buy_box_info.buy_box_eligible ? 'default' : 'destructive'} className="text-xs">
                                                    {asinData.buy_box_info.buy_box_probability}
                                                  </Badge>
                                                </div>
                                                <div>Price: ${asinData.buy_box_info.current_price}</div>
                                                <div>Rank: #{asinData.buy_box_info.competitive_analysis.price_rank} of {asinData.buy_box_info.competitive_analysis.total_sellers}</div>
                                                <div>Range: ${asinData.buy_box_info.competitive_analysis.lowest_price} - ${asinData.buy_box_info.competitive_analysis.highest_price}</div>
                                              </div>
                                            )}
                                            
                                            {/* Listing Restrictions Summary */}
                                            {asinData.listing_restrictions && asinData.listing_restrictions.length > 0 && (
                                              <div className="mb-2 p-2 bg-amber-50 rounded text-xs">
                                                <div className="font-medium mb-1">Listing Restrictions:</div>
                                                {asinData.listing_restrictions.slice(0, 2).map((restriction: any, ridx: number) => (
                                                  <div key={ridx} className="flex justify-between">
                                                    <span>{restriction.restriction_type}:</span>
                                                    <Badge variant={restriction.status === 'APPROVED' ? 'default' : 'destructive'} className="text-xs">
                                                      {restriction.status}
                                                    </Badge>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            
                                            {/* Product Details */}
                                            <div className="text-xs space-y-1">
                                              <div><strong>Title:</strong> {asinData.title}</div>
                                              <div><strong>Brand:</strong> {asinData.brand}</div>
                                              <div><strong>Price:</strong> ${asinData.price}</div>
                                              <div><strong>Sales Rank:</strong> #{asinData.rank}</div>
                                              <div><strong>Rating:</strong> {asinData.rating}/5 ({asinData.review_count} reviews)</div>
                                              {asinData.images && asinData.images.length > 0 && (
                                                <div><strong>Images:</strong> {asinData.images.length} available</div>
                                              )}
                                            </div>
                                            
                                            {/* Fulfillment Options */}
                                            {asinData.fulfillment_options && (
                                              <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                                                <div className="font-medium mb-1">Fulfillment:</div>
                                                <div>FBA Eligible: {asinData.fulfillment_options.fba_eligible ? '✓' : '✗'}</div>
                                                <div>Self Ship: {asinData.fulfillment_options.self_ship_allowed ? '✓' : '✗'}</div>
                                                <div>Hazmat: {asinData.fulfillment_options.hazmat_restrictions ? '⚠️' : '✓'}</div>
                                              </div>
                                            )}
                                            
                                            {/* Competitive Landscape */}
                                            {asinData.competitive_landscape && (
                                              <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                                                <div className="font-medium mb-1">Competition:</div>
                                                <div>Total Sellers: {asinData.competitive_landscape.total_sellers}</div>
                                                <div>Buy Box Rotation: {asinData.competitive_landscape.buy_box_rotation ? 'Yes' : 'No'}</div>
                                                <div>Price Sensitivity: {asinData.competitive_landscape.price_sensitivity}</div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="text-sm bg-gray-50 p-3 rounded">
                            <div><strong>UPC:</strong> {amazonData.search_criteria?.upc}</div>
                            <div><strong>MPN:</strong> {amazonData.search_criteria?.mpn}</div>
                            <div><strong>Title:</strong> {amazonData.search_criteria?.title}</div>
                            <div><strong>Total Unique ASINs Found:</strong> {amazonData.total_unique_asins}</div>
                            <div><strong>Related ASINs (Variations/Bundles):</strong> {amazonData.total_matches}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">Primary ASIN:</div>
                        <div>{amazonData.primary_asin}</div>
                        <div className="font-medium">Title:</div>
                        <div>{amazonData.title}</div>
                        <div className="font-medium">Brand:</div>
                        <div>{amazonData.brand}</div>
                        <div className="font-medium">Manufacturer:</div>
                        <div>{amazonData.manufacturer}</div>
                        <div className="font-medium">Category:</div>
                        <div>{amazonData.category} &gt; {amazonData.subcategory}</div>
                        <div className="font-medium">Price:</div>
                        <div>${amazonData.price}</div>
                        <div className="font-medium">Rank:</div>
                        <div>#{amazonData.rank}</div>
                        <div className="font-medium">Rating:</div>
                        <div>{amazonData.rating}/5 ({amazonData.review_count} reviews)</div>
                      </div>
                      
                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Related ASINs Found:</h4>
                        <div className="space-y-2">
                          {amazonData.related_asins?.map((asin: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="font-mono text-sm">{asin.asin}</span>
                              <Badge variant="outline">{asin.relationship}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Brand Variations Found:</h4>
                        <div className="flex flex-wrap gap-1">
                          {amazonData.brand_variations?.map((brand: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {brand}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium mb-2">Product Features:</h4>
                        <ul className="list-disc pl-4 space-y-1 text-sm">
                          {amazonData.features?.map((feature: string, idx: number) => (
                            <li key={idx}>{feature}</li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Technical Specifications:</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          {Object.entries(amazonData.specifications || {}).map(([key, value]) => (
                            <div key={key} className="flex justify-between border-b pb-1">
                              <div className="font-medium">{key}:</div>
                              <div>{value as string}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Seller Account Restrictions (A10D4VTYI7RMZ2):</h4>
                        <div className="space-y-3">
                          {Array.isArray(amazonData.listing_restrictions) && amazonData.listing_restrictions.map((restriction: any, idx: number) => (
                            <div key={idx} className={`border rounded p-3 ${
                              restriction.status === 'APPROVED' || restriction.status === 'COMPLIANT' || restriction.status === 'COMPETITIVE' 
                                ? 'border-green-200 bg-green-50' 
                                : restriction.status === 'CONDITIONAL_APPROVAL' 
                                ? 'border-yellow-200 bg-yellow-50'
                                : 'border-red-200 bg-red-50'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{restriction.restriction_type}</span>
                                <Badge variant={
                                  restriction.status === 'APPROVED' || restriction.status === 'COMPLIANT' || restriction.status === 'COMPETITIVE'
                                    ? 'default' 
                                    : restriction.status === 'CONDITIONAL_APPROVAL'
                                    ? 'secondary'
                                    : 'destructive'
                                }>
                                  {restriction.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-700 mb-2">{restriction.message}</div>
                              
                              {restriction.seller_id && (
                                <div className="text-xs mb-2 font-mono bg-gray-100 p-1 rounded">
                                  Seller: {restriction.seller_id} | Marketplace: {restriction.marketplace}
                                </div>
                              )}
                              
                              <div className="text-xs">
                                <strong>Requirements:</strong>
                                <ul className="list-disc list-inside mt-1">
                                  {restriction.requirements?.map((req: string, reqIdx: number) => (
                                    <li key={reqIdx}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                              
                              {restriction.shipping_restrictions && (
                                <div className="text-xs mt-2 p-2 bg-gray-100 rounded">
                                  <strong>Shipping Restrictions:</strong>
                                  <div>Air: {restriction.shipping_restrictions.air_shipping ? '✓' : '✗'}</div>
                                  <div>Ground: {restriction.shipping_restrictions.ground_shipping ? '✓' : '✗'}</div>
                                  <div>Max per shipment: {restriction.shipping_restrictions.max_quantity_per_shipment}</div>
                                </div>
                              )}
                              
                              {restriction.pricing_insights && (
                                <div className="text-xs mt-2 p-2 bg-blue-100 rounded">
                                  <strong>Buy Box Insights:</strong>
                                  <div>Current: ${restriction.pricing_insights.current_price}</div>
                                  <div>Competitive Range: ${restriction.pricing_insights.competitive_range.min} - ${restriction.pricing_insights.competitive_range.max}</div>
                                  <div>Buy Box Probability: {restriction.pricing_insights.buy_box_probability}</div>
                                </div>
                              )}
                              
                              {restriction.brand_authorization && (
                                <div className="text-xs mt-2 p-2 bg-green-100 rounded">
                                  <strong>Brand Authorization:</strong>
                                  <div>Approved Brands: {restriction.brand_authorization.approved_brands?.join(', ')}</div>
                                  <div>Type: {restriction.brand_authorization.authorization_type}</div>
                                  <div>Status: {restriction.brand_authorization.verification_status}</div>
                                </div>
                              )}
                              
                              {restriction.approval_date && (
                                <div className="text-xs mt-1 text-green-600">
                                  Approved: {restriction.approval_date}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Product Variations:</h4>
                        <div className="space-y-2">
                          {amazonData.variations?.map((variation: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <span className="font-mono text-sm">{variation.asin}</span>
                                <div className="text-xs text-gray-500">
                                  {variation.variation_theme}: {variation.variation_value}
                                </div>
                              </div>
                              <div className="text-sm font-medium">${variation.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Competitive Pricing Analysis:</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="font-medium">Amazon Price:</div>
                          <div>${amazonData.competitive_pricing?.amazon_price}</div>
                          <div className="font-medium">Lowest Competitor:</div>
                          <div>${amazonData.competitive_pricing?.lowest_competitor}</div>
                          <div className="font-medium">Highest Competitor:</div>
                          <div>${amazonData.competitive_pricing?.highest_competitor}</div>
                          <div className="font-medium">Price Position:</div>
                          <div>{amazonData.competitive_pricing?.price_rank}</div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Complete Raw API Response:</h4>
                        <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                          {JSON.stringify(amazonData.raw_data, null, 2)}
                        </pre>
                      </div>
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

        <TabsContent value="mapping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Assistant</CardTitle>
              <CardDescription>Map Amazon API fields to your product catalog fields</CardDescription>
            </CardHeader>
            <CardContent>
              {amazonData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-4">Available Amazon Fields</h4>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2">
                        {Object.keys(amazonData.raw_data || {}).map((field) => (
                          <div key={field} className="flex items-center justify-between p-2 border rounded">
                            <div className="space-y-1">
                              <div className="font-medium text-sm">{field}</div>
                              <div className="text-xs text-muted-foreground">
                                {typeof amazonData.raw_data[field] === 'object' 
                                  ? 'Object/Array' 
                                  : String(amazonData.raw_data[field]).substring(0, 50)
                                }
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => createMappingRule('', field)}
                            >
                              Map
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-4">Your Catalog Fields</h4>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2">
                        {['name', 'sku', 'price', 'cost', 'description', 'category', 'brand', 'upc', 'weight', 'dimensions'].map((field) => (
                          <div key={field} className="flex items-center justify-between p-2 border rounded">
                            <div className="font-medium text-sm">{field}</div>
                            <Button size="sm" variant="outline">
                              Configure
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Test an API call first to see available fields for mapping
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mapping Rules Configuration</CardTitle>
              <CardDescription>Define transformation rules for large-scale catalog processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mappingRules.map((rule) => (
                <div key={rule.id} className="border rounded p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Catalog Field</Label>
                      <Input 
                        value={rule.field_name}
                        onChange={(e) => {
                          const updated = mappingRules.map(r => 
                            r.id === rule.id ? { ...r, field_name: e.target.value } : r
                          );
                          setMappingRules(updated);
                        }}
                        placeholder="Enter field name"
                      />
                    </div>
                    <div>
                      <Label>Amazon Field</Label>
                      <Input 
                        value={rule.amazon_field}
                        onChange={(e) => {
                          const updated = mappingRules.map(r => 
                            r.id === rule.id ? { ...r, amazon_field: e.target.value } : r
                          );
                          setMappingRules(updated);
                        }}
                        placeholder="Amazon API field"
                      />
                    </div>
                    <div>
                      <Label>Transformation</Label>
                      <Select 
                        value={rule.transformation}
                        onValueChange={(value) => {
                          const updated = mappingRules.map(r => 
                            r.id === rule.id ? { ...r, transformation: value } : r
                          );
                          setMappingRules(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct Copy</SelectItem>
                          <SelectItem value="uppercase">Uppercase</SelectItem>
                          <SelectItem value="lowercase">Lowercase</SelectItem>
                          <SelectItem value="trim">Trim Whitespace</SelectItem>
                          <SelectItem value="custom">Custom Function</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Validation Rules</Label>
                      <Textarea 
                        value={rule.validation}
                        onChange={(e) => {
                          const updated = mappingRules.map(r => 
                            r.id === rule.id ? { ...r, validation: e.target.value } : r
                          );
                          setMappingRules(updated);
                        }}
                        placeholder="Enter validation rules"
                        className="h-20"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={rule.required}
                          onCheckedChange={(checked) => {
                            const updated = mappingRules.map(r => 
                              r.id === rule.id ? { ...r, required: checked } : r
                            );
                            setMappingRules(updated);
                          }}
                        />
                        <Label>Required Field</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={rule.active}
                          onCheckedChange={(checked) => {
                            const updated = mappingRules.map(r => 
                              r.id === rule.id ? { ...r, active: checked } : r
                            );
                            setMappingRules(updated);
                          }}
                        />
                        <Label>Active Rule</Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Button onClick={() => createMappingRule('', '')}>
                  Add New Rule
                </Button>
                <Button onClick={saveMappingRules} variant="outline">
                  Save All Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch Testing</CardTitle>
              <CardDescription>Test mapping rules on multiple products before full catalog processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Batch Size</Label>
                  <Select value={testBatchSize} onValueChange={setTestBatchSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Products</SelectItem>
                      <SelectItem value="10">10 Products</SelectItem>
                      <SelectItem value="25">25 Products</SelectItem>
                      <SelectItem value="50">50 Products</SelectItem>
                      <SelectItem value="100">100 Products</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Active Rules</Label>
                  <div className="text-sm text-muted-foreground mt-2">
                    {mappingRules.filter(r => r.active).length} rules configured
                  </div>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={runBatchTest}
                    disabled={mappingRules.filter(r => r.active).length === 0}
                    className="w-full"
                  >
                    Run Batch Test
                  </Button>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Batch testing will process {testBatchSize} products with your current mapping rules and show success/failure rates.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}