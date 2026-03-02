import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Upload, Search, TrendingUp, AlertCircle, CheckCircle, XCircle,
  FileSpreadsheet, Loader2, DollarSign, Package, BarChart3,
  Clock, RefreshCw, ArrowUpDown, ExternalLink, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { SiAmazon, SiWalmart } from 'react-icons/si';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UploadResult {
  id: number;
  fileName: string;
  fileSize: number | null;
  status: string;
  totalRows: number | null;
  processedRows: number | null;
  successRows: number | null;
  failedRows: number | null;
  opportunitiesFound: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface AnalysisResult {
  id: number;
  uploadId: number;
  asin: string;
  upc: string | null;
  description: string | null;
  brand: string | null;
  quantity: number | null;
  supplierPrice: number | null;
  buyBoxPrice: number | null;
  amazonPrice: number | null;
  estimatedFees: number | null;
  isRestricted: boolean;
  restrictionReasons: string[] | null;
  dropshipMargin: number | null;
  warehouseMargin: number | null;
  isOpportunity: boolean;
  opportunityType: string | null;
  confidenceScore: number | null;
  errorMessage: string | null;
}

export default function ResearchOpportunities() {
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [dropshipThreshold, setDropshipThreshold] = useState(12);
  const [warehouseThreshold, setWarehouseThreshold] = useState(25);
  const [activeTab, setActiveTab] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: uploads, isLoading: uploadsLoading } = useQuery<UploadResult[]>({
    queryKey: ['/api/purchasing/uploads'],
  });

  const activeUpload = uploads?.find(u => u.status === 'running' || u.status === 'pending');

  const { data: activeUploadStatus } = useQuery<UploadResult>({
    queryKey: ['/api/purchasing/uploads', activeUpload?.id],
    enabled: !!activeUpload?.id,
    refetchInterval: activeUpload ? 3000 : false,
  });

  const { data: selectedResults, isLoading: resultsLoading } = useQuery<AnalysisResult[]>({
    queryKey: ['/api/purchasing/uploads', selectedUploadId, 'results'],
    enabled: !!selectedUploadId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dropshipThreshold', dropshipThreshold.toString());
      formData.append('warehouseThreshold', warehouseThreshold.toString());

      const response = await fetch('/api/purchasing/upload-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Research Started",
        description: `Analyzing ${data.totalRows} products from ${data.fileName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/uploads'] });
      setActiveTab('progress');
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Could not process the file",
        variant: "destructive",
      });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      uploadMutation.mutate(file);
    } else {
      toast({ title: "Invalid file", description: "Please upload a CSV or Excel file", variant: "destructive" });
    }
  }, [uploadMutation, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadMutation]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return `$${value.toFixed(2)}`;
  };

  const formatMargin = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(1)}%`;
  };

  const getOpportunityBadge = (type: string | null) => {
    switch (type) {
      case 'both':
        return <Badge className="bg-emerald-500 text-white">Both</Badge>;
      case 'dropship':
        return <Badge className="bg-blue-500 text-white">Dropship</Badge>;
      case 'warehouse':
        return <Badge className="bg-purple-500 text-white">Warehouse</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400">No Match</Badge>;
    }
  };

  const currentUpload = activeUploadStatus || activeUpload;
  const progressPct = currentUpload && currentUpload.totalRows
    ? Math.round(((currentUpload.processedRows || 0) / currentUpload.totalRows) * 100)
    : 0;

  const opportunities = selectedResults?.filter(r => r.isOpportunity) || [];
  const errors = selectedResults?.filter(r => r.errorMessage) || [];
  const analyzed = selectedResults?.filter(r => !r.errorMessage && r.buyBoxPrice !== null) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Research Opportunities</h1>
        <p className="text-muted-foreground">
          Upload product lists to discover marketplace selling opportunities across Amazon, Walmart, and more
        </p>
      </div>

      {currentUpload && (currentUpload.status === 'running' || currentUpload.status === 'pending') && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="font-medium">Analyzing: {currentUpload.fileName}</span>
                </div>
                <Badge variant="default" className="bg-blue-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {currentUpload.status === 'pending' ? 'Starting...' : 'Running'}
                </Badge>
              </div>
              <Progress value={progressPct} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{currentUpload.processedRows || 0} of {currentUpload.totalRows || 0} products</span>
                <div className="flex gap-4">
                  <span className="text-green-600">{currentUpload.successRows || 0} matched</span>
                  <span className="text-red-600">{currentUpload.failedRows || 0} failed</span>
                  <span className="text-emerald-600">{currentUpload.opportunitiesFound || 0} opportunities</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-4 w-4" />
            Upload & Analyze
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Research History
          </TabsTrigger>
          {selectedUploadId && (
            <TabsTrigger value="results" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Results
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    Upload Product List
                  </CardTitle>
                  <CardDescription>
                    Upload a CSV or Excel file with UPCs, MPNs, or keywords. The system will look up each product
                    across marketplaces to find profitable selling opportunities.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                      dragActive ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {uploadMutation.isPending ? (
                      <div className="space-y-3">
                        <Loader2 className="h-10 w-10 mx-auto animate-spin text-emerald-600" />
                        <p className="text-sm font-medium">Uploading and parsing file...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-10 w-10 mx-auto text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">Drop your file here or click to browse</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Supports CSV and Excel files up to 10MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 mb-2">Supported column formats:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>UPC / barcode</span>
                      <span>ASIN (Amazon)</span>
                      <span>MPN / Item # / Part Number</span>
                      <span>Description / Item Description</span>
                      <span>Brand / Manufacturer</span>
                      <span>Price / Unit Retail / Retail Price</span>
                      <span>Qty / Quantity / Available</span>
                      <span>Category / Condition</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Analysis Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dropshipThreshold" className="text-xs">Dropship Min Margin %</Label>
                    <Input
                      id="dropshipThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={dropshipThreshold}
                      onChange={(e) => setDropshipThreshold(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warehouseThreshold" className="text-xs">Warehouse Min Margin %</Label>
                    <Input
                      id="warehouseThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={warehouseThreshold}
                      onChange={(e) => setWarehouseThreshold(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</div>
                    <p className="text-xs text-gray-600">Upload a product list with UPCs, MPNs, or ASINs</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</div>
                    <p className="text-xs text-gray-600">System looks up each product on Amazon and Walmart via API</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</div>
                    <p className="text-xs text-gray-600">Compares your cost against marketplace prices, fees, and restrictions</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">4</div>
                    <p className="text-xs text-gray-600">Highlights profitable opportunities above your margin thresholds</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Research History</CardTitle>
              <CardDescription>
                Past research uploads and their analysis status. Click a row to view detailed results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uploadsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading history...</span>
                </div>
              ) : uploads && uploads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Opportunities</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploads.map((upload) => (
                      <TableRow
                        key={upload.id}
                        className={`cursor-pointer ${selectedUploadId === upload.id ? 'bg-emerald-50' : ''}`}
                        onClick={() => {
                          setSelectedUploadId(upload.id);
                          if (upload.status === 'completed') {
                            setActiveTab('results');
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm">{upload.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {upload.status === 'completed' && (
                            <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>
                          )}
                          {upload.status === 'running' && (
                            <Badge className="bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>
                          )}
                          {upload.status === 'pending' && (
                            <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                          )}
                          {upload.status === 'failed' && (
                            <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{upload.processedRows || 0} / {upload.totalRows || 0}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-emerald-600">{upload.opportunitiesFound || 0}</span>
                        </TableCell>
                        <TableCell>
                          {upload.totalRows && upload.totalRows > 0
                            ? `${Math.round(((upload.successRows || 0) / upload.totalRows) * 100)}%`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(upload.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUploadId(upload.id);
                            setActiveTab('results');
                          }}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-muted-foreground">No research uploads yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Upload a product list to get started</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedUploadId && (
          <TabsContent value="results" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-muted-foreground">Total Products</span>
                  </div>
                  <div className="text-2xl font-bold">{selectedResults?.length || 0}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-muted-foreground">Opportunities</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">{opportunities.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Analyzed</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{analyzed.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-muted-foreground">Errors</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{errors.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis Results</CardTitle>
                    <CardDescription>
                      {opportunities.length > 0
                        ? `Found ${opportunities.length} profitable opportunities`
                        : 'Detailed marketplace research results'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/purchasing/uploads', selectedUploadId, 'results'] })}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {resultsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading results...</span>
                  </div>
                ) : selectedResults && selectedResults.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Product</TableHead>
                          <TableHead>UPC</TableHead>
                          <TableHead>ASIN</TableHead>
                          <TableHead className="text-right">Your Cost</TableHead>
                          <TableHead className="text-right">Buy Box</TableHead>
                          <TableHead className="text-right">Fees</TableHead>
                          <TableHead className="text-right">Dropship %</TableHead>
                          <TableHead className="text-right">Warehouse %</TableHead>
                          <TableHead>Restricted</TableHead>
                          <TableHead>Opportunity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedResults
                          .sort((a, b) => {
                            if (a.isOpportunity && !b.isOpportunity) return -1;
                            if (!a.isOpportunity && b.isOpportunity) return 1;
                            return (b.dropshipMargin || 0) - (a.dropshipMargin || 0);
                          })
                          .map((result) => (
                          <TableRow key={result.id} className={result.isOpportunity ? 'bg-emerald-50/50' : ''}>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <div className="text-sm font-medium truncate">{result.description || result.brand || '—'}</div>
                                {result.brand && result.description && (
                                  <div className="text-xs text-muted-foreground truncate">{result.brand}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{result.upc || '—'}</TableCell>
                            <TableCell>
                              {result.asin ? (
                                <a
                                  href={`https://www.amazon.com/dp/${result.asin}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  {result.asin}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(result.supplierPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(result.buyBoxPrice)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(result.estimatedFees)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${
                                result.dropshipMargin !== null && result.dropshipMargin >= dropshipThreshold
                                  ? 'text-emerald-600' : 'text-gray-500'
                              }`}>
                                {formatMargin(result.dropshipMargin)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${
                                result.warehouseMargin !== null && result.warehouseMargin >= warehouseThreshold
                                  ? 'text-purple-600' : 'text-gray-500'
                              }`}>
                                {formatMargin(result.warehouseMargin)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {result.isRestricted ? (
                                <ShieldAlert className="h-4 w-4 text-red-500" />
                              ) : result.asin ? (
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {result.errorMessage ? (
                                <Badge variant="outline" className="text-red-500 text-xs">
                                  Error
                                </Badge>
                              ) : (
                                getOpportunityBadge(result.opportunityType)
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No results available yet. The analysis may still be running.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
