import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAmazonConfigStatus, useAmazonSchedulerStatus, useTriggerAmazonSyncJob } from '@/hooks/useAmazonMarketData';
import { Loader2, PlayCircle, PauseCircle, StopCircle, Calendar, Clock, AlertCircle, CheckCircle2, Settings2, Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export function AmazonScheduler() {
  const { data: configStatus, isLoading: isLoadingConfig } = useAmazonConfigStatus();
  const { data: schedulerStatus, isLoading: isLoadingScheduler } = useAmazonSchedulerStatus();
  const triggerSyncJob = useTriggerAmazonSyncJob();
  const [isConfiguring, setIsConfiguring] = useState(false);

  const { data: overviewStats } = useQuery<{
    amazonMatches: number;
    productsRemaining: number;
    productsWithIdentifiers: number;
    productsSynced: number;
  }>({
    queryKey: ['/api/marketplace/amazon/overview-stats'],
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (config: { intervalHours?: number; limit?: number; enabled?: boolean }) => {
      const res = await apiRequest('PUT', '/api/marketplace/amazon/scheduler/config', config);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon/scheduler/status'] });
      if (variables.enabled === false) {
        toast({ title: 'Schedule Paused', description: 'Automated sync has been paused. You can run manual batches without interference.' });
      } else if (variables.enabled === true) {
        toast({ title: 'Schedule Resumed', description: 'Automated sync has been resumed.' });
      } else {
        toast({ title: 'Schedule Updated', description: 'Amazon sync schedule has been updated.' });
      }
      setIsConfiguring(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleTriggerSync = () => {
    triggerSyncJob.mutate();
  };

  const handlePause = () => {
    updateScheduleMutation.mutate({ enabled: false });
  };

  const handleResume = () => {
    updateScheduleMutation.mutate({ enabled: true });
  };

  const getIntervalHours = () => {
    const config = schedulerStatus?.details?.config;
    return config?.intervalHours || 2;
  };

  const getBatchLimit = () => {
    const config = schedulerStatus?.details?.config;
    return config?.limit || 50;
  };

  const formatLastRun = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatNextRun = (timestamp: number) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diff = timestamp - now;
    if (diff <= 0) return 'Any moment now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `in ${hours}h ${remainingMins}m`;
  };

  if (isLoadingConfig || isLoadingScheduler) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><Skeleton className="h-6 w-[250px]" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-[350px]" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const configValid = configStatus?.configValid;
  const isActive = schedulerStatus?.active;
  const isPaused = schedulerStatus?.paused;
  const jobDetails = schedulerStatus?.details;
  const hasJob = isActive || isPaused;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Automated Sync Schedule</CardTitle>
            <CardDescription>
              Configure automatic syncing of Amazon marketplace data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                Paused
              </Badge>
            )}
            {isActive && !isPaused && (
              <Badge variant={jobDetails?.isRunning ? "default" : "secondary"} className="text-xs">
                {jobDetails?.isRunning ? "Running" : "Active"}
              </Badge>
            )}
            {configValid && hasJob && (
              <Button variant="ghost" size="sm" onClick={() => setIsConfiguring(!isConfiguring)}>
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configValid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Configuration</AlertTitle>
            <AlertDescription>
              Amazon SP-API credentials are not configured. Please set up your credentials to enable automated syncing.
            </AlertDescription>
          </Alert>
        )}

        {configValid && !hasJob && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scheduler Not Active</AlertTitle>
            <AlertDescription>
              Automated syncing is not currently enabled. The scheduler will be activated automatically when the server restarts with valid API credentials.
            </AlertDescription>
          </Alert>
        )}

        {configValid && hasJob && (
          <div className="space-y-4">
            {isConfiguring ? (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select
                    defaultValue={String(getIntervalHours())}
                    onValueChange={(val) => {
                      updateScheduleMutation.mutate({ intervalHours: parseInt(val) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every 1 hour</SelectItem>
                      <SelectItem value="2">Every 2 hours</SelectItem>
                      <SelectItem value="4">Every 4 hours</SelectItem>
                      <SelectItem value="6">Every 6 hours</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Every 24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Products per Batch</Label>
                  <Select
                    defaultValue={String(getBatchLimit())}
                    onValueChange={(val) => {
                      updateScheduleMutation.mutate({ limit: parseInt(val) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 products</SelectItem>
                      <SelectItem value="50">50 products</SelectItem>
                      <SelectItem value="100">100 products</SelectItem>
                      <SelectItem value="200">200 products</SelectItem>
                      <SelectItem value="500">500 products</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Sync Frequency</p>
                      <p className="text-sm text-muted-foreground">
                        Every {getIntervalHours()} hour{getIntervalHours() !== 1 ? 's' : ''} · {getBatchLimit()} products per batch
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Last Run</p>
                      <p className="text-sm text-muted-foreground">
                        {formatLastRun(jobDetails?.lastRun || 0)}
                      </p>
                    </div>
                  </div>
                  <div>
                    {jobDetails?.isRunning ? (
                      <Badge variant="secondary" className="flex items-center">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Running
                      </Badge>
                    ) : isPaused ? (
                      <Badge variant="outline" className="flex items-center text-amber-600">
                        <PauseCircle className="mr-1 h-3 w-3" />
                        Paused
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {jobDetails?.nextRun ? `Next ${formatNextRun(jobDetails.nextRun)}` : 'Idle'}
                      </Badge>
                    )}
                  </div>
                </div>

                {overviewStats && (
                  <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                    <div className="flex items-center space-x-4">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Discovery Progress</p>
                        <p className="text-sm text-muted-foreground">
                          {overviewStats.amazonMatches} matched · {overviewStats.productsRemaining} remaining of {overviewStats.productsWithIdentifiers} scannable
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {isPaused && (
              <Alert className="border-amber-200 bg-amber-50">
                <PauseCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Schedule Paused</AlertTitle>
                <AlertDescription className="text-amber-700">
                  Automated sync is paused. You can run manual batch syncs without interference. Resume when ready.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              {isPaused ? (
                <Button
                  className="flex-1"
                  onClick={handleResume}
                  disabled={updateScheduleMutation.isPending}
                >
                  {updateScheduleMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Resume Schedule
                </Button>
              ) : (
                <Button 
                  className="flex-1" 
                  onClick={handleTriggerSync} 
                  disabled={!configValid || triggerSyncJob.isPending || (jobDetails?.isRunning || false)}
                >
                  {triggerSyncJob.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Trigger Sync Now
                    </>
                  )}
                </Button>
              )}
              
              {isActive && !isPaused && (
                <Button
                  variant="outline"
                  onClick={handlePause}
                  disabled={updateScheduleMutation.isPending || (jobDetails?.isRunning || false)}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  {updateScheduleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
