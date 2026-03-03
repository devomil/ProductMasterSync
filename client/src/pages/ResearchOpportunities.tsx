import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload, Search, TrendingUp, AlertCircle, CheckCircle, XCircle,
  FileSpreadsheet, Loader2, DollarSign, Package, BarChart3,
  Clock, RefreshCw, ExternalLink, ShieldCheck, ShieldAlert, Zap, Globe, Pause
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
  targetMarketplaces: string[] | null;
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
  walmartItemId: string | null;
  walmartPrice: number | null;
  walmartMatchMethod: string | null;
  walmartAvailability: string | null;
  dropshipMargin: number | null;
  warehouseMargin: number | null;
  isOpportunity: boolean;
  opportunityType: string | null;
  confidenceScore: number | null;
  errorMessage: string | null;
  matchMethod: string | null;
  imageUrl: string | null;
}

export default function ResearchOpportunities() {
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [dropshipThreshold, setDropshipThreshold] = useState(12);
  const [warehouseThreshold, setWarehouseThreshold] = useState(25);
  const [amazonEnabled, setAmazonEnabled] = useState(false);
  const [walmartEnabled, setWalmartEnabled] = useState(true);
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
    queryFn: async () => {
      const response = await fetch(`/api/purchasing/uploads/${activeUpload?.id}`);
      if (!response.ok) throw new Error('Failed to fetch upload status');
      return response.json();
    },
    enabled: !!activeUpload?.id,
    refetchInterval: activeUpload ? 3000 : false,
  });

  const { data: selectedResults, isLoading: resultsLoading } = useQuery<AnalysisResult[]>({
    queryKey: ['/api/purchasing/uploads', selectedUploadId, 'results'],
    queryFn: async () => {
      const response = await fetch(`/api/purchasing/uploads/${selectedUploadId}/results`);
      if (!response.ok) throw new Error('Failed to fetch results');
      return response.json();
    },
    enabled: !!selectedUploadId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const targetMarketplaces = [];
      if (amazonEnabled) targetMarketplaces.push('amazon');
      if (walmartEnabled) targetMarketplaces.push('walmart');
      if (targetMarketplaces.length === 0) {
        throw new Error('Please enable at least one marketplace');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('dropshipThreshold', dropshipThreshold.toString());
      formData.append('warehouseThreshold', warehouseThreshold.toString());
      formData.append('targetMarketplaces', JSON.stringify(targetMarketplaces));

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

  const reanalyzeMutation = useMutation({
    mutationFn: async (uploadId: number) => {
      const response = await fetch(`/api/purchasing/uploads/${uploadId}/restart`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Re-analysis failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Re-analysis Started",
        description: "Clearing old results and re-running multi-strategy search...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/uploads'] });
      setActiveTab('progress');
    },
    onError: (error: any) => {
      toast({
        title: "Re-analysis Failed",
        description: error.message,
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

  const getResultStatus = (result: AnalysisResult) => {
    if (result.errorMessage) {
      const msg = result.errorMessage;
      if (msg.includes('403') || msg.includes('Access') || msg.includes('Unauthorized')) {
        return { label: 'API Access Error', color: 'text-orange-600', icon: AlertCircle, detail: 'Amazon SP-API access denied — check API credentials/permissions' };
      }
      if (msg.includes('No ASIN found') || msg.includes('No match found')) {
        return { label: 'No Match', color: 'text-yellow-600', icon: Search, detail: msg };
      }
      if (msg.includes('Could not find ASIN')) {
        return { label: 'No Match', color: 'text-yellow-600', icon: Search, detail: `Tried UPC, MPN, and keyword searches — no match found` };
      }
      if (msg.includes('rate') || msg.includes('429') || msg.includes('throttl')) {
        return { label: 'Rate Limited', color: 'text-orange-500', icon: Clock, detail: 'API rate limit hit — retry later' };
      }
      return { label: 'Failed', color: 'text-red-600', icon: XCircle, detail: msg };
    }
    if (result.buyBoxPrice !== null && result.asin) {
      const matchLabel = result.matchMethod === 'upc' ? 'via UPC' : 
                         result.matchMethod === 'mpn' ? 'via MPN' : 
                         result.matchMethod === 'keyword' ? 'via Keywords' : '';
      return { label: 'Matched', color: 'text-green-600', icon: CheckCircle, detail: `Amazon pricing retrieved ${matchLabel} (${result.confidenceScore || 0}% confidence)` };
    }
    if (result.walmartItemId) {
      const matchLabel = result.walmartMatchMethod === 'walmart_upc' ? 'via UPC' : 'via MPN';
      return { label: 'Walmart Match', color: 'text-blue-600', icon: CheckCircle, detail: `Found on Walmart ${matchLabel}${result.walmartAvailability && result.walmartAvailability !== 'unknown' ? ` — ${result.walmartAvailability}` : ''}` };
    }
    if (result.asin && !result.buyBoxPrice) {
      return { label: 'No Buy Box', color: 'text-yellow-600', icon: AlertCircle, detail: 'ASIN found but no active Buy Box price' };
    }
    return { label: 'Pending', color: 'text-gray-400', icon: Clock, detail: 'Waiting to be analyzed' };
  };

  const currentUpload = activeUploadStatus || activeUpload;
  const progressPct = currentUpload && currentUpload.totalRows
    ? Math.round(((currentUpload.processedRows || 0) / currentUpload.totalRows) * 100)
    : 0;

  const opportunities = selectedResults?.filter(r => r.isOpportunity) || [];
  const errors = selectedResults?.filter(r => r.errorMessage) || [];
  const analyzed = selectedResults?.filter(r => !r.errorMessage && (r.buyBoxPrice !== null || r.walmartItemId)) || [];
  const restricted = selectedResults?.filter(r => r.isRestricted) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Research Opportunities</h1>
        <p className="text-muted-foreground">
          Upload product lists to discover marketplace selling opportunities across Amazon and Walmart
        </p>
      </div>

      {currentUpload && (currentUpload.status === 'running' || currentUpload.status === 'pending') && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Globe className="h-5 w-5 text-blue-600 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-medium">Analyzing: {currentUpload.fileName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">Searching:</span>
                      <div className="flex items-center gap-1.5">
                        {(!currentUpload?.targetMarketplaces || (currentUpload?.targetMarketplaces as string[])?.includes?.('amazon')) && (
                          <div className="flex items-center gap-0.5 bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                            <SiAmazon className="h-3 w-3" />
                            <span className="text-[10px] font-medium">SP-API</span>
                          </div>
                        )}
                        {(currentUpload?.targetMarketplaces as string[])?.includes?.('walmart') && (
                          <div className="flex items-center gap-0.5 bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                            <SiWalmart className="h-3 w-3" />
                            <span className="text-[10px] font-medium">Marketplace</span>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-400">UPC → Product Matching → Pricing</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Badge variant="default" className="bg-blue-500">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  {currentUpload.status === 'pending' ? 'Starting...' : 'Running'}
                </Badge>
              </div>
              <Progress value={progressPct} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{currentUpload.processedRows || 0} of {currentUpload.totalRows || 0} products</span>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" /> {currentUpload.successRows || 0} matched
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" /> {currentUpload.failedRows || 0} failed
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <TrendingUp className="h-3 w-3" /> {currentUpload.opportunitiesFound || 0} opportunities
                  </span>
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
                    Upload a CSV or Excel file with UPCs, MPNs, or keywords. Each product is analyzed against marketplace APIs in real-time.
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
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Marketplace APIs Used
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    amazonEnabled ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}>
                    <SiAmazon className={`h-5 w-5 flex-shrink-0 ${amazonEnabled ? 'text-orange-600' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${amazonEnabled ? 'text-orange-800' : 'text-gray-500'}`}>Amazon SP-API</p>
                      <p className={`text-[10px] ${amazonEnabled ? 'text-orange-600' : 'text-gray-400'}`}>Catalog Search, Pricing, Fees</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {amazonEnabled ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Paused</Badge>
                      )}
                      <Switch
                        checked={amazonEnabled}
                        onCheckedChange={setAmazonEnabled}
                        className="scale-75"
                      />
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    walmartEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}>
                    <SiWalmart className={`h-5 w-5 flex-shrink-0 ${walmartEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${walmartEnabled ? 'text-blue-800' : 'text-gray-500'}`}>Walmart Marketplace</p>
                      <p className={`text-[10px] ${walmartEnabled ? 'text-blue-600' : 'text-gray-400'}`}>Pricing, Product Matching</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {walmartEnabled ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Paused</Badge>
                      )}
                      <Switch
                        checked={walmartEnabled}
                        onCheckedChange={setWalmartEnabled}
                        className="scale-75"
                      />
                    </div>
                  </div>
                  {!amazonEnabled && !walmartEnabled && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">Enable at least one marketplace to analyze products.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</div>
                    <p className="text-xs text-gray-600">Upload a product list with UPCs, MPNs, ASINs, or descriptions</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</div>
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-0.5">Multi-strategy Amazon ASIN matching:</p>
                      <div className="space-y-0.5 ml-1">
                        <p><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span>UPC lookup — 100% confidence</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"></span>MPN/SKU search — 75% confidence</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>Keyword/description — 50% confidence</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</div>
                    <p className="text-xs text-gray-600">Fetches Buy Box price, referral/FBA fees, and listing restrictions</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">4</div>
                    <p className="text-xs text-gray-600">Calculates dropship and warehouse margins vs your supplier cost</p>
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
                      <TableHead>Marketplaces</TableHead>
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
                          <div className="flex items-center gap-1.5">
                            {(!upload.targetMarketplaces || upload.targetMarketplaces.includes('amazon')) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <SiAmazon className="h-4 w-4 text-orange-500" />
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-xs">Amazon SP-API</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {upload.targetMarketplaces?.includes('walmart') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <SiWalmart className="h-4 w-4 text-blue-600" />
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-xs">Walmart Marketplace</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
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
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUploadId(upload.id);
                              setActiveTab('results');
                            }}>
                              View
                            </Button>
                            {(upload.status === 'completed' || upload.status === 'failed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reanalyzeMutation.mutate(upload.id);
                                }}
                                disabled={reanalyzeMutation.isPending}
                              >
                                {reanalyzeMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Re-analyze
                              </Button>
                            )}
                          </div>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <div className="text-2xl font-bold">{selectedResults?.length || 0}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Opportunities</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">{opportunities.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Analyzed</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{analyzed.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="h-4 w-4 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Restricted</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{restricted.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Errors</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{errors.length}</div>
                </CardContent>
              </Card>
            </div>

            {errors.length > 0 && (() => {
              const accessErrors = errors.filter(e => e.errorMessage?.includes('access denied') || e.errorMessage?.includes('403'));
              const noMatchErrors = errors.filter(e => e.errorMessage?.includes('No ASIN found after trying') && !e.errorMessage?.includes('403'));
              const rateErrors = errors.filter(e => e.errorMessage?.includes('rate') || e.errorMessage?.includes('429'));
              return (
                <Alert className={accessErrors.length > 0 ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}>
                  <AlertCircle className={`h-4 w-4 ${accessErrors.length > 0 ? 'text-red-600' : 'text-orange-600'}`} />
                  <AlertDescription className={`text-sm ${accessErrors.length > 0 ? 'text-red-800' : 'text-orange-800'}`}>
                    <div className="space-y-1">
                      {accessErrors.length > 0 && (
                        <p className="font-medium">{accessErrors.length} products failed due to Amazon SP-API access denied (403). Check your API credentials and Catalog Items API permissions in Seller Central. Once fixed, click "Re-analyze" to retry.</p>
                      )}
                      {noMatchErrors.length > 0 && (
                        <p>{noMatchErrors.length} products had no Amazon match after trying all strategies (UPC, MPN, keyword).</p>
                      )}
                      {rateErrors.length > 0 && (
                        <p>{rateErrors.length} products were rate limited — click "Re-analyze" to retry.</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })()}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analysis Results</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                      <span>Data sources:</span>
                      {uploads?.find(u => u.id === selectedUploadId)?.targetMarketplaces?.includes('amazon') !== false && (
                        <div className="flex items-center gap-1 bg-orange-50 rounded px-1.5 py-0.5 border border-orange-100">
                          <SiAmazon className="h-3 w-3 text-orange-600" />
                          <span className="text-[10px] font-medium text-orange-700">Amazon SP-API</span>
                        </div>
                      )}
                      {uploads?.find(u => u.id === selectedUploadId)?.targetMarketplaces?.includes('walmart') && (
                        <div className="flex items-center gap-1 bg-blue-50 rounded px-1.5 py-0.5 border border-blue-100">
                          <SiWalmart className="h-3 w-3 text-blue-600" />
                          <span className="text-[10px] font-medium text-blue-700">Walmart</span>
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedUploadId) reanalyzeMutation.mutate(selectedUploadId);
                      }}
                      disabled={reanalyzeMutation.isPending}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      {reanalyzeMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Re-analyze
                    </Button>
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
                          <TableHead className="w-[180px]">Product</TableHead>
                          <TableHead>UPC</TableHead>
                          <TableHead>ASIN</TableHead>
                          <TableHead>Walmart</TableHead>
                          <TableHead>API Status</TableHead>
                          <TableHead className="text-right">Your Cost</TableHead>
                          <TableHead className="text-right">Buy Box</TableHead>
                          <TableHead className="text-right">Walmart Price</TableHead>
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
                          .map((result) => {
                          const status = getResultStatus(result);
                          const StatusIcon = status.icon;
                          return (
                          <TableRow key={result.id} className={result.isOpportunity ? 'bg-emerald-50/50' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-2.5 max-w-[220px]">
                                {result.imageUrl ? (
                                  <img
                                    src={result.imageUrl}
                                    alt={result.description || 'Product'}
                                    className="w-10 h-10 rounded object-contain border border-gray-100 bg-white flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
                                    <Package className="h-4 w-4 text-gray-300" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{result.description || result.brand || '—'}</div>
                                  {result.brand && result.description && (
                                    <div className="text-xs text-muted-foreground truncate">{result.brand}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{result.upc || '—'}</TableCell>
                            <TableCell>
                              {result.asin ? (
                                <div className="space-y-1">
                                  <a
                                    href={`https://www.amazon.com/dp/${result.asin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    {result.asin}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  {result.matchMethod && (
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                      result.matchMethod === 'upc' || result.matchMethod === 'direct' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : result.matchMethod === 'mpn' 
                                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {result.matchMethod === 'upc' ? 'UPC Match' :
                                       result.matchMethod === 'direct' ? 'Direct ASIN' :
                                       result.matchMethod === 'mpn' ? 'MPN Match' :
                                       'Keyword Match'}
                                      {result.confidenceScore ? ` ${result.confidenceScore}%` : ''}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.walmartItemId ? (
                                <div className="space-y-1">
                                  <a
                                    href={`https://www.walmart.com/ip/${result.walmartItemId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    {result.walmartItemId}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  {result.walmartMatchMethod && (
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                      result.walmartMatchMethod === 'walmart_upc' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                      {result.walmartMatchMethod === 'walmart_upc' ? 'UPC Match' : 'MPN Match'}
                                    </Badge>
                                  )}
                                  {result.walmartAvailability && result.walmartAvailability !== 'unknown' && (
                                    <div className="text-[9px] text-gray-500">{result.walmartAvailability}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className={`flex items-center gap-1 ${status.color}`}>
                                      <StatusIcon className="h-3.5 w-3.5" />
                                      <span className="text-xs">{status.label}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <p className="text-xs max-w-[250px]">{status.detail}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(result.supplierPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              {result.buyBoxPrice !== null ? (
                                <div className="flex items-center justify-end gap-1">
                                  <SiAmazon className="h-3 w-3 text-orange-400" />
                                  <span>{formatCurrency(result.buyBoxPrice)}</span>
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {result.walmartPrice !== null ? (
                                <div className="flex items-center justify-end gap-1">
                                  <SiWalmart className="h-3 w-3 text-blue-500" />
                                  <span>{formatCurrency(result.walmartPrice)}</span>
                                </div>
                              ) : result.walmartItemId ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className="text-[10px] text-gray-400 italic">Listed</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Product exists on Walmart but price not available via catalog API</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : '—'}
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <ShieldAlert className="h-4 w-4 text-red-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Restricted: {result.restrictionReasons?.join(', ') || 'Approval needed'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : result.asin ? (
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {result.errorMessage ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="text-red-500 text-xs">Error</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs max-w-[300px]">{result.errorMessage}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                getOpportunityBadge(result.opportunityType)
                              )}
                            </TableCell>
                          </TableRow>
                          );
                        })}
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
