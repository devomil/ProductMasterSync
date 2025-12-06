import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, Upload, Download, CheckCircle, XCircle, Clock, AlertCircle, Package, ExternalLink, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FlxpointStats {
  totalVariants: number;
  pendingSync: number;
  synced: number;
  withErrors: number;
  withAsin: number;
  withWalmartId: number;
  withUpc: number;
  matchedWalmart: number;
  lastPullRun?: any;
  lastPushRun?: any;
  lastEnrichRun?: any;
}

interface FlxpointVariant {
  id: number;
  parentSku: string;
  sourceSku?: string;
  asin?: string;
  walmartId?: string;
  wmCommissionRate?: number;
  amzCommissionRate?: number;
  wmProductType?: string;
  wmBuyBoxPrice?: number;
  amzBuyBoxPrice?: number;
  syncStatus: string;
  lastPulledAt?: string;
  lastPushedAt?: string;
  errorMessage?: string;
}

interface SyncRun {
  id: number;
  jobType: string;
  status: string;
  totalVariants: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  startedAt: string;
  finishedAt?: string;
}

interface SyncProgress {
  jobId: number;
  status: string;
  totalVariants: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
}

export default function FlxpointSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [variantPage, setVariantPage] = useState(1);

  const { data: connectionTest } = useQuery({
    queryKey: ['/api/marketplace/flxpoint/test-connection'],
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<FlxpointStats>({
    queryKey: ['/api/marketplace/flxpoint/stats'],
    refetchInterval: 10000,
  });

  const { data: syncRuns } = useQuery<SyncRun[]>({
    queryKey: ['/api/marketplace/flxpoint/sync-runs'],
    refetchInterval: 5000,
  });

  const { data: variantsData } = useQuery<{ variants: FlxpointVariant[]; total: number; totalPages: number }>({
    queryKey: ['/api/marketplace/flxpoint/variants', variantPage, syncFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(variantPage), limit: '25' });
      if (syncFilter !== 'all') {
        params.set('syncStatus', syncFilter);
      }
      const res = await fetch(`/api/marketplace/flxpoint/variants?${params}`);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: progressData } = useQuery<SyncProgress | null>({
    queryKey: ['/api/marketplace/flxpoint/sync-progress', activeJobId],
    enabled: !!activeJobId,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (progressData && (progressData.status === 'completed' || progressData.status === 'failed')) {
      setActiveJobId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/flxpoint/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/flxpoint/sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/flxpoint/variants'] });
    }
  }, [progressData, queryClient]);

  const pullMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/flxpoint/pull', { fullSync: true, perPage: 100 });
      return response.json();
    },
    onSuccess: (data: { jobId: number }) => {
      setActiveJobId(data.jobId);
      toast({ title: 'Pull Started', description: 'Fetching variants from Flxpoint...' });
    },
    onError: (error: any) => {
      toast({ title: 'Pull Failed', description: error.message, variant: 'destructive' });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (dryRun: boolean = false) => {
      const response = await apiRequest('POST', '/api/marketplace/flxpoint/push', { dryRun, onlyChanged: true });
      return response.json();
    },
    onSuccess: (data: { jobId: number }) => {
      setActiveJobId(data.jobId);
      toast({ title: 'Push Started', description: 'Syncing commission data to Flxpoint...' });
    },
    onError: (error: any) => {
      toast({ title: 'Push Failed', description: error.message, variant: 'destructive' });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace/flxpoint/start-enrichment');
      return response.json();
    },
    onSuccess: (data: { jobId: number }) => {
      setActiveJobId(data.jobId);
      toast({ title: 'Enrichment Started', description: 'Matching variants with marketplace data...' });
    },
    onError: (error: any) => {
      toast({ title: 'Enrichment Failed', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Synced</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'skipped':
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Skipped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCommissionRate = (rate?: number) => {
    if (!rate) return '-';
    const percentage = (rate - 1) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  const formatPrice = (cents?: number) => {
    if (!cents) return '-';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const isConnected = (connectionTest as { success?: boolean } | undefined)?.success === true;
  const isJobRunning = activeJobId !== null && progressData?.status === 'running';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Flxpoint Integration</h1>
          <p className="text-muted-foreground mt-1">
            Sync products and commission data with Flxpoint for marketplace listings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="default" className="bg-green-500" data-testid="badge-connection-status">
              <CheckCircle className="w-4 h-4 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge variant="destructive" data-testid="badge-connection-status">
              <XCircle className="w-4 h-4 mr-1" /> Not Connected
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Variants</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-variants">{stats?.totalVariants?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From Flxpoint catalog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-sync">{stats?.pendingSync?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to push to Flxpoint
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-synced">{stats?.synced?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully pushed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-errors">{stats?.withErrors?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Failed to sync
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Marketplace Coverage</CardTitle>
              <CardDescription>Variants with marketplace IDs and enrichment data</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">With UPC</span>
              <Badge variant="secondary" data-testid="stat-with-upc">{stats?.withUpc?.toLocaleString() || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">With ASIN (Amazon)</span>
              <Badge variant="secondary" data-testid="stat-with-asin">{stats?.withAsin?.toLocaleString() || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Matched to Walmart Listings</span>
              <Badge variant="secondary" data-testid="stat-with-walmart">{stats?.withWalmartId?.toLocaleString() || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Enriched with Commission Rates</span>
              <Badge variant="default" className="bg-purple-500" data-testid="stat-enriched">{stats?.matchedWalmart?.toLocaleString() || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Sync Operations</CardTitle>
              <CardDescription>Pull from or push to Flxpoint</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => pullMutation.mutate()}
                disabled={!isConnected || isJobRunning || pullMutation.isPending}
                data-testid="button-pull-variants"
              >
                <Download className="w-4 h-4 mr-2" />
                Pull Variants
              </Button>
              <Button
                onClick={() => pushMutation.mutate(false)}
                disabled={!isConnected || isJobRunning || pushMutation.isPending || !stats?.pendingSync}
                variant="default"
                data-testid="button-push-data"
              >
                <Upload className="w-4 h-4 mr-2" />
                Push to Flxpoint
              </Button>
              <Button
                onClick={() => enrichMutation.mutate()}
                disabled={!isConnected || isJobRunning || enrichMutation.isPending || !stats?.totalVariants}
                variant="outline"
                data-testid="button-enrich-data"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${enrichMutation.isPending || isJobRunning ? 'animate-spin' : ''}`} />
                Enrich from Marketplace
              </Button>
              <Button
                asChild
                variant="secondary"
                disabled={!stats?.synced}
                data-testid="button-download-verification"
              >
                <a href="/api/downloads/flxpoint-verification" download>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Download Verification CSV
                </a>
              </Button>
            </div>

            {isJobRunning && progressData && (
              <div className="space-y-2" data-testid="sync-progress">
                <div className="flex items-center justify-between text-sm">
                  <span>Syncing...</span>
                  <span>{progressData.processedCount} / {progressData.totalVariants}</span>
                </div>
                <Progress value={(progressData.processedCount / (progressData.totalVariants || 1)) * 100} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="text-green-600">Success: {progressData.successCount}</span>
                  <span className="text-red-600">Errors: {progressData.errorCount}</span>
                  <span>Skipped: {progressData.skippedCount}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="variants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="variants" data-testid="tab-variants">Variants</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Flxpoint Variants</CardTitle>
                <CardDescription>Products synced from Flxpoint with commission data</CardDescription>
              </div>
              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-sync-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parent SKU</TableHead>
                      <TableHead>ASIN</TableHead>
                      <TableHead>Walmart ID</TableHead>
                      <TableHead>WM Rate</TableHead>
                      <TableHead>AMZ Rate</TableHead>
                      <TableHead>WM Buy Box</TableHead>
                      <TableHead>AMZ Buy Box</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantsData?.variants?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No variants found. Click "Pull Variants" to fetch from Flxpoint.
                        </TableCell>
                      </TableRow>
                    ) : (
                      variantsData?.variants?.map((variant) => (
                        <TableRow key={variant.id} data-testid={`row-variant-${variant.id}`}>
                          <TableCell className="font-mono text-sm">{variant.parentSku}</TableCell>
                          <TableCell>
                            {variant.asin ? (
                              <a
                                href={`https://www.amazon.com/dp/${variant.asin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {variant.asin}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {variant.walmartId ? (
                              <span className="font-mono text-sm">{variant.walmartId}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{formatCommissionRate(variant.wmCommissionRate)}</TableCell>
                          <TableCell>{formatCommissionRate(variant.amzCommissionRate)}</TableCell>
                          <TableCell>{formatPrice(variant.wmBuyBoxPrice)}</TableCell>
                          <TableCell>{formatPrice(variant.amzBuyBoxPrice)}</TableCell>
                          <TableCell>{getStatusBadge(variant.syncStatus)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {variant.lastPushedAt
                              ? formatDistanceToNow(new Date(variant.lastPushedAt), { addSuffix: true })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {variantsData && variantsData.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {((variantPage - 1) * 25) + 1} - {Math.min(variantPage * 25, variantsData.total)} of {variantsData.total}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVariantPage(p => Math.max(1, p - 1))}
                      disabled={variantPage === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVariantPage(p => Math.min(variantsData.totalPages, p + 1))}
                      disabled={variantPage >= variantsData.totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent pull and push operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncRuns?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No sync runs yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncRuns?.map((run) => (
                        <TableRow key={run.id} data-testid={`row-syncrun-${run.id}`}>
                          <TableCell>
                            <Badge variant={run.jobType === 'pull' ? 'secondary' : run.jobType === 'enrich' ? 'outline' : 'default'}>
                              {run.jobType === 'pull' ? (
                                <><Download className="w-3 h-3 mr-1" /> Pull</>
                              ) : run.jobType === 'enrich' ? (
                                <><RefreshCw className="w-3 h-3 mr-1" /> Enrich</>
                              ) : (
                                <><Upload className="w-3 h-3 mr-1" /> Push</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                run.status === 'completed' ? 'default' :
                                run.status === 'running' ? 'secondary' :
                                'destructive'
                              }
                              className={run.status === 'completed' ? 'bg-green-500' : ''}
                            >
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{run.totalVariants.toLocaleString()}</TableCell>
                          <TableCell>{run.processedCount.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">{run.successCount.toLocaleString()}</TableCell>
                          <TableCell className="text-red-600">{run.errorCount.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">
                            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {run.finishedAt
                              ? `${Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
