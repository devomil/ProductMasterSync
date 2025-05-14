import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAmazonConfigStatus, useAmazonSchedulerStatus, useTriggerAmazonSyncJob } from '@/hooks/useAmazonMarketData';
import { Loader2, PlayCircle, Calendar, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function AmazonScheduler() {
  const { data: configStatus, isLoading: isLoadingConfig } = useAmazonConfigStatus();
  const { data: schedulerStatus, isLoading: isLoadingScheduler } = useAmazonSchedulerStatus();
  const triggerSyncJob = useTriggerAmazonSyncJob();

  const handleTriggerSync = () => {
    triggerSyncJob.mutate();
  };

  const formatInterval = (intervalMs: number) => {
    const minutes = Math.floor(intervalMs / (60 * 1000));
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const formatLastRun = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (isLoadingConfig || isLoadingScheduler) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-[250px]" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-[350px]" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const configValid = configStatus?.configValid;
  const isJobActive = schedulerStatus?.active;
  const jobDetails = schedulerStatus?.details;

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
          {isJobActive && (
            <Badge variant={jobDetails?.isRunning ? "default" : "outline"}>
              {jobDetails?.isRunning ? "Running" : "Active"}
            </Badge>
          )}
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

        {configValid && !isJobActive && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scheduler Not Active</AlertTitle>
            <AlertDescription>
              Automated syncing is not currently enabled. The scheduler will be activated automatically when the server restarts with valid API credentials.
            </AlertDescription>
          </Alert>
        )}

        {configValid && isJobActive && (
          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
              <div className="flex items-center space-x-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sync Frequency</p>
                  <p className="text-sm text-muted-foreground">
                    Every {formatInterval(jobDetails?.interval || 0)}
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
                ) : (
                  <Badge variant="outline" className="flex items-center">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Idle
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
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
      </CardFooter>
    </Card>
  );
}