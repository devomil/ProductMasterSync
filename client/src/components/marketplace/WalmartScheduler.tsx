import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useWalmartConfigStatus, useWalmartSchedulerStatus, useTriggerWalmartSyncJob, useToggleWalmartScheduler } from '@/hooks/useWalmartMarketData';
import { Loader2, PlayCircle, Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function WalmartScheduler() {
  const { data: configStatus, isLoading: isLoadingConfig } = useWalmartConfigStatus();
  const { data: schedulerStatus, isLoading: isLoadingScheduler } = useWalmartSchedulerStatus();
  const triggerSyncJob = useTriggerWalmartSyncJob();
  const toggleScheduler = useToggleWalmartScheduler();

  const handleTriggerSync = () => {
    triggerSyncJob.mutate();
  };

  const handleToggleScheduler = (enabled: boolean) => {
    toggleScheduler.mutate(enabled);
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
              Configure automatic syncing of Walmart marketplace data
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {configValid && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="scheduler-toggle"
                  checked={isJobActive}
                  onCheckedChange={handleToggleScheduler}
                  disabled={toggleScheduler.isPending || jobDetails?.isRunning}
                  data-testid="switch-scheduler-toggle"
                />
                <Label htmlFor="scheduler-toggle" className="text-sm">
                  {toggleScheduler.isPending ? 'Updating...' : (isJobActive ? 'Enabled' : 'Disabled')}
                </Label>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobDetails?.isRunning && (
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Sync In Progress</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Walmart listings are currently being synced. This may take several minutes depending on catalog size.
            </AlertDescription>
          </Alert>
        )}

        {!configValid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Configuration</AlertTitle>
            <AlertDescription>
              Walmart API credentials are not configured. Please set up your credentials to enable automated syncing.
            </AlertDescription>
          </Alert>
        )}

        {configValid && !isJobActive && !jobDetails?.isRunning && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scheduler Disabled</AlertTitle>
            <AlertDescription>
              Automated syncing is turned off. Toggle the switch above to enable automatic syncs every 12 hours.
            </AlertDescription>
          </Alert>
        )}

        {configValid && (
          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
              <div className="flex items-center space-x-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sync Frequency</p>
                  <p className="text-sm text-muted-foreground">
                    Every {formatInterval(jobDetails?.interval || 43200000)}
                  </p>
                </div>
              </div>
              <Badge variant={isJobActive ? "default" : "secondary"}>
                {isJobActive ? "Scheduled" : "Manual Only"}
              </Badge>
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
                  <Badge variant="default" className="flex items-center bg-blue-600">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Syncing
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
          data-testid="button-trigger-sync"
        >
          {triggerSyncJob.isPending || jobDetails?.isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {jobDetails?.isRunning ? 'Sync In Progress...' : 'Starting...'}
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
