import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Search, Package, ExternalLink, TrendingUp, AlertTriangle, Upload, FileText, Database, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import BulkProgressMonitor from '@/components/BulkProgressMonitor';
import ASINDiscoveryDemo from '@/components/ASINDiscoveryDemo';

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
    asin?: string;
    description?: string;
  };
  upc?: string;
  manufacturerNumber?: string;
  foundASINs: ASIN[];
  totalFound: number;
}

interface FileUploadResult {
  totalRows: number;
  processedRows: number;
  successfulSearches: number;
  failedSearches: number;
  results: Array<{
    row: number;
    searchCriteria: any;
    foundASINs: ASIN[];
    error?: string;
  }>;
}

interface CSVRow {
  [key: string]: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  upc?: string;
  manufacturerPartNumber?: string;
}

export default function MultiASINSearch() {
  const [searchType, setSearchType] = useState<'manual' | 'product' | 'asin' | 'description' | 'file-upload'>('manual');
  const [upc, setUpc] = useState('');
  const [manufacturerNumber, setManufacturerNumber] = useState('');
  const [asinDirect, setAsinDirect] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [fileUploadResults, setFileUploadResults] = useState<FileUploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [showBulkProgress, setShowBulkProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products for selection
  const { data: products = [] } = useQuery({
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

  // ASIN direct lookup mutation
  const asinSearchMutation = useMutation({
    mutationFn: async (asin: string) => {
      const response = await fetch(`/api/marketplace/asin-details/${asin}`);
      if (!response.ok) throw new Error('ASIN lookup failed');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.asinDetails) {
        setSearchResults({
          searchCriteria: { asin: asinDirect },
          foundASINs: [data.asinDetails],
          totalFound: 1
        });
        toast({
          title: "ASIN Found",
          description: `Retrieved details for ${asinDirect}`
        });
      } else {
        toast({
          title: "ASIN Not Found",
          description: "No details found for this ASIN",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "ASIN Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  // Description-based search mutation
  const descriptionSearchMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await fetch('/api/marketplace/search/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          description,
          maxResults: 20
        })
      });
      if (!response.ok) throw new Error('Description search failed');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.results) {
        setSearchResults({
          searchCriteria: { description },
          foundASINs: data.results,
          totalFound: data.results.length
        });
        toast({
          title: "Description Search Complete",
          description: `Found ${data.results.length} matching ASINs`
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Description Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  // File upload mutation
  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/marketplace/bulk-asin-search', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.jobId) {
        setBulkJobId(data.jobId);
        setShowBulkProgress(true);
        setIsProcessing(false);
        toast({
          title: "Bulk Processing Started",
          description: `Processing ${data.totalRows} rows with optimized rate limiting`
        });
      } else {
        setFileUploadResults(data);
        toast({
          title: "File Upload Complete",
          description: `Processed ${data.processedRows} rows, found ASINs for ${data.successfulSearches} products`
        });
      }
    },
    onError: (error) => {
      toast({
        title: "File Upload Failed",
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

  const handleAsinSearch = () => {
    if (!asinDirect.trim()) {
      toast({
        title: "ASIN Required",
        description: "Please enter an ASIN to search",
        variant: "destructive"
      });
      return;
    }
    asinSearchMutation.mutate(asinDirect.trim());
  };

  const handleDescriptionSearch = () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please enter a product description to search",
        variant: "destructive"
      });
      return;
    }
    descriptionSearchMutation.mutate(description.trim());
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    fileUploadMutation.mutate(file);
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

      <Tabs value={searchType} onValueChange={(value) => setSearchType(value as 'manual' | 'product' | 'asin' | 'description' | 'file-upload')}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="manual">UPC/MPN</TabsTrigger>
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="asin">ASIN</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="file-upload">File Upload</TabsTrigger>
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

        <TabsContent value="asin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Direct ASIN Lookup</CardTitle>
              <CardDescription>
                Enter a specific ASIN to retrieve detailed product information from Amazon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asin">Amazon ASIN</Label>
                <Input
                  id="asin"
                  placeholder="Enter ASIN (e.g., B000THUD1A)"
                  value={asinDirect}
                  onChange={(e) => setAsinDirect(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleAsinSearch}
                disabled={asinSearchMutation.isPending}
                className="w-full"
              >
                <Database className="w-4 h-4 mr-2" />
                {asinSearchMutation.isPending ? 'Looking up...' : 'Lookup ASIN'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="description" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description-Based Search</CardTitle>
              <CardDescription>
                Search Amazon catalog using product descriptions and keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Product Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter product description or keywords (e.g., 'Marine GPS chartplotter with touchscreen')"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                onClick={handleDescriptionSearch}
                disabled={descriptionSearchMutation.isPending}
                className="w-full"
              >
                <Search className="w-4 h-4 mr-2" />
                {descriptionSearchMutation.isPending ? 'Searching...' : 'Search by Description'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file-upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk File Upload</CardTitle>
              <CardDescription>
                Upload CSV or Excel files to search for multiple ASINs at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload File</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing file...</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Supported formats:</strong> CSV, Excel (.xlsx, .xls)</p>
                <p><strong>Expected columns:</strong> UPC, MPN/Part Number, ASIN, Description, Brand, Model</p>
                <p><strong>Note:</strong> The system will automatically detect column mappings from your file</p>
              </div>
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

      {showBulkProgress && bulkJobId && (
        <BulkProgressMonitor 
          jobId={bulkJobId}
          onJobComplete={(job) => {
            setShowBulkProgress(false);
            setBulkJobId(null);
            setFileUploadResults({
              totalRows: job.totalRows,
              processedRows: job.processedRows,
              successfulSearches: job.successfulSearches,
              failedSearches: job.failedSearches,
              results: job.results
            });
            toast({
              title: "Bulk Processing Complete",
              description: `Processed ${job.totalRows} rows with ${job.successfulSearches} successful searches.`,
            });
          }}
        />
      )}

      {fileUploadResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              File Upload Results
              <Badge variant="secondary">
                {fileUploadResults.successfulSearches}/{fileUploadResults.processedRows} Found
              </Badge>
            </CardTitle>
            <CardDescription>
              Processed {fileUploadResults.totalRows} rows from uploaded file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-700">{fileUploadResults.successfulSearches}</div>
                  <div className="text-green-600">Successful</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="font-semibold text-red-700">{fileUploadResults.failedSearches}</div>
                  <div className="text-red-600">Failed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-700">{fileUploadResults.processedRows}</div>
                  <div className="text-blue-600">Total Processed</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {fileUploadResults.results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Row {result.row}</Badge>
                        {result.foundASINs.length > 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : result.error ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <Badge variant={result.foundASINs.length > 0 ? "default" : "secondary"}>
                        {result.foundASINs.length} ASINs Found
                      </Badge>
                    </div>
                    
                    {/* Product Information */}
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {result.searchCriteria?.upc && (
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">UPC:</span>
                            <div className="font-mono">{result.searchCriteria.upc}</div>
                          </div>
                        )}
                        {result.searchCriteria?.manufacturerNumber && (
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">MPN:</span>
                            <div className="font-mono">{result.searchCriteria.manufacturerNumber}</div>
                          </div>
                        )}
                        {result.searchCriteria?.brand && (
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Brand:</span>
                            <div>{result.searchCriteria.brand}</div>
                          </div>
                        )}
                        {result.searchCriteria?.model && (
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Model:</span>
                            <div>{result.searchCriteria.model}</div>
                          </div>
                        )}
                      </div>
                      {result.searchCriteria?.description && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-600 dark:text-gray-400">Description:</span>
                          <div className="text-sm mt-1">{result.searchCriteria.description}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* ASIN Results */}
                    {result.foundASINs.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Found {result.foundASINs.length} Matching ASIN{result.foundASINs.length > 1 ? 's' : ''}
                        </h4>
                        <div className="grid gap-3">
                          {result.foundASINs.map((asin: any, asinIndex: number) => (
                            <div key={asinIndex} className="border rounded p-3 bg-white dark:bg-gray-800">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono">{asin.asin}</Badge>
                                  <a
                                    href={`https://amazon.com/dp/${asin.asin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                                <div className="flex gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    Rank: {asin.salesRank?.toLocaleString() || 'N/A'}
                                  </Badge>
                                  {asin.price && (
                                    <Badge variant="default" className="text-xs">
                                      ${asin.price}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex gap-3">
                                {asin.imageUrl && (
                                  <img 
                                    src={asin.imageUrl} 
                                    alt={asin.title}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-sm line-clamp-2 mb-1">{asin.title}</h5>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                    <div><span className="font-medium">Brand:</span> {asin.brand}</div>
                                    <div><span className="font-medium">Category:</span> {asin.category}</div>
                                    {asin.manufacturerNumber && (
                                      <div><span className="font-medium">MPN:</span> {asin.manufacturerNumber}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Purchasing Decision Indicators */}
                              <div className="mt-3 pt-2 border-t">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex gap-3">
                                    <span className={`px-2 py-1 rounded ${
                                      asin.salesRank && asin.salesRank < 100000 
                                        ? 'bg-green-100 text-green-700' 
                                        : asin.salesRank && asin.salesRank < 500000
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {asin.salesRank && asin.salesRank < 100000 
                                        ? '🟢 High Demand' 
                                        : asin.salesRank && asin.salesRank < 500000
                                        ? '🟡 Medium Demand'
                                        : '🔴 Low Demand'
                                      }
                                    </span>
                                    <span className="text-gray-500">
                                      Search Type: UPC Lookup
                                    </span>
                                  </div>
                                  <Button variant="outline" size="sm">
                                    Analyze Profitability
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        {result.error ? (
                          <div className="flex items-center justify-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span>Error: {result.error}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Search className="h-4 w-4" />
                            <span>No ASINs found for this product</span>
                          </div>
                        )}
                      </div>
                    )}

                    {result.error && (
                      <div className="text-sm text-red-600 mb-2">
                        Error: {result.error}
                      </div>
                    )}

                    {result.foundASINs.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {result.foundASINs.map((asin) => (
                          <div key={asin.asin} className="flex items-center gap-2 p-2 bg-muted rounded">
                            <Badge variant="outline" className="text-xs">{asin.asin}</Badge>
                            <span className="text-xs truncate">{asin.title}</span>
                            <a
                              href={`https://amazon.com/dp/${asin.asin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ASIN Discovery Demo - Shows what results look like with valid Amazon API credentials */}
      <ASINDiscoveryDemo />
    </div>
  );
}