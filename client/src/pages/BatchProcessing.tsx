import { useState, useEffect } from 'react';
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
import { Play, Square, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface BatchProcessingStats {
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  totalASINsFound: number;
  averageASINsPerProduct: number;
  processingTimeMs: number;
  rateLimitHits: number;
  errors: string[];
}

interface BatchProcessingStatus {
  isRunning: boolean;
  stats: BatchProcessingStats;
  currentBatchId?: string;
}

interface BatchHistory {
  id: number;
  batchId: string;
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  totalAsinsFound: number;
  processingTimeMs: number;
  rateLimitHits: number;
  startedAt: string;
  completedAt?: string;
  status: string;
}

interface CatalogOverview {
  totalProducts: number;
  withUPC: number;
  withManufacturerPartNumber: number;
  withASINMappings: number;
  pendingLookup: number;
  avgASINsPerProduct: number;
}

export default function BatchProcessing() {
  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [batchSize, setBatchSize] = useState(100);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for current batch processing status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/batch/status'],
    refetchInterval: status?.isRunning ? 2000 : 10000, // Poll every 2s when running, 10s when idle
  });

  // Query for catalog overview
  const { data: overview } = useQuery({
    queryKey: ['/api/batch/overview'],
  });

  // Query for batch processing history
  const { data: history } = useQuery({
    queryKey: ['/api/batch/history'],
  });

  // Start batch processing mutation
  const startBatchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/batch/start', 'POST', {
        maxConcurrency,
        batchSize,
        skipProcessed: true
      });
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Started",
        description: "Automated ASIN discovery has begun for the entire catalog.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/batch/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Batch Processing",
        description: error.message || "An error occurred while starting batch processing.",
        variant: "destructive",
      });
    },
  });

  // Stop batch processing mutation
  const stopBatchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/batch/stop', 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Batch Processing Stopped",
        description: "Processing has been stopped gracefully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/batch/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Stop Batch Processing",
        description: error.message || "An error occurred while stopping batch processing.",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />Running</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'stopped':
        return <Badge variant="secondary"><Square className="w-3 h-3 mr-1" />Stopped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const progressPercentage = status?.stats ? Math.round((status.stats.processedProducts / status.stats.totalProducts) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Automated Batch Processing</h1>
        <p className="text-muted-foreground">
          Discover Amazon ASINs for your entire catalog using UPC codes and manufacturer part numbers
        </p>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalProducts.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">With UPC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{overview.withUPC.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">With MPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{overview.withManufacturerPartNumber.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ASIN Mapped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{overview.withASINMappings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{overview.pendingLookup.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg ASINs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{overview.avgASINsPerProduct.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="control" className="w-full">
        <TabsList>
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="history">Processing History</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Current Status
                {status?.isRunning && <RefreshCw className="w-4 h-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading status...
                </div>
              ) : status?.isRunning ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Processing in progress...</span>
                    <Badge variant="default" className="bg-blue-500">
                      <Clock className="w-3 h-3 mr-1" />
                      Running
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{status.stats.processedProducts} / {status.stats.totalProducts}</span>
                    </div>
                    <Progress value={progressPercentage} className="w-full" />
                    <div className="text-xs text-muted-foreground">
                      {progressPercentage}% complete
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Successful</div>
                      <div className="font-medium text-green-600">{status.stats.successfulProducts}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Failed</div>
                      <div className="font-medium text-red-600">{status.stats.failedProducts}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">ASINs Found</div>
                      <div className="font-medium text-blue-600">{status.stats.totalASINsFound}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Rate Limits</div>
                      <div className="font-medium text-orange-600">{status.stats.rateLimitHits}</div>
                    </div>
                  </div>

                  {status.stats.errors.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Recent errors: {status.stats.errors.slice(-3).join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-2">No batch processing currently running</div>
                  <Badge variant="secondary">Idle</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Controls</CardTitle>
              <CardDescription>
                Configure and start automated ASIN discovery for your entire catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrency">Max Concurrent Requests</Label>
                    <Input
                      id="maxConcurrency"
                      type="number"
                      min="1"
                      max="10"
                      value={maxConcurrency}
                      onChange={(e) => setMaxConcurrency(parseInt(e.target.value))}
                      disabled={status?.isRunning}
                    />
                    <div className="text-xs text-muted-foreground">
                      Recommended: 3-5 to respect Amazon rate limits
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      min="10"
                      max="1000"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      disabled={status?.isRunning}
                    />
                    <div className="text-xs text-muted-foreground">
                      Number of products to process in each batch
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => startBatchMutation.mutate()}
                    disabled={status?.isRunning || startBatchMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {startBatchMutation.isPending ? 'Starting...' : 'Start Batch Processing'}
                  </Button>
                  
                  {status?.isRunning && (
                    <Button
                      variant="outline"
                      onClick={() => stopBatchMutation.mutate()}
                      disabled={stopBatchMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      {stopBatchMutation.isPending ? 'Stopping...' : 'Stop Processing'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Processing History</CardTitle>
              <CardDescription>
                View past batch processing runs and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>ASINs Found</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((batch: BatchHistory) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-xs">{batch.batchId}</TableCell>
                        <TableCell>{getStatusBadge(batch.status)}</TableCell>
                        <TableCell>
                          {batch.processedProducts} / {batch.totalProducts}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {batch.totalProducts > 0 
                              ? `${Math.round((batch.successfulProducts / batch.totalProducts) * 100)}%`
                              : '0%'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {batch.successfulProducts} success, {batch.failedProducts} failed
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{batch.totalAsinsFound}</div>
                          <div className="text-xs text-muted-foreground">
                            {batch.totalProducts > 0 
                              ? `${(batch.totalAsinsFound / batch.totalProducts).toFixed(1)} avg`
                              : '0 avg'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          {batch.processingTimeMs ? formatDuration(batch.processingTimeMs) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(batch.startedAt).toLocaleDateString()} {new Date(batch.startedAt).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No processing history available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}