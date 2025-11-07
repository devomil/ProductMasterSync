import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SyncJob {
  id: number;
  batchId: string;
  totalQueued: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  notFoundCount: number;
  asinMatchesFound: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  failureReason: string | null;
}

export function AmazonSyncProgress() {
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Poll for current sync job
  const { data: syncJob, isLoading } = useQuery<SyncJob | null>({
    queryKey: ['/api/marketplace/amazon/sync-jobs/current'],
    refetchInterval: (query) => {
      // Poll every 10 seconds if job is in progress
      const currentJob = query.state.data;
      if (currentJob?.status === 'in_progress' || currentJob?.status === 'pending') {
        return 10000;
      }
      // Otherwise poll every 30 seconds to check for new jobs
      return 30000;
    },
  });

  // Auto-dismiss completed/failed jobs after 2 minutes
  useEffect(() => {
    if (syncJob && (syncJob.status === 'completed' || syncJob.status === 'failed')) {
      const dismissTimer = setTimeout(() => {
        setDismissed(syncJob.batchId);
      }, 120000); // 2 minutes

      return () => clearTimeout(dismissTimer);
    }
  }, [syncJob]);

  // Don't show if loading, no job, or dismissed
  if (isLoading || !syncJob || dismissed === syncJob.batchId) {
    return null;
  }

  // Don't show old completed jobs (older than 1 hour)
  if ((syncJob.status === 'completed' || syncJob.status === 'failed') && syncJob.completedAt) {
    const completedTime = new Date(syncJob.completedAt).getTime();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (completedTime < oneHourAgo) {
      return null;
    }
  }

  const progress = syncJob.totalQueued > 0 
    ? Math.round((syncJob.processedCount / syncJob.totalQueued) * 100) 
    : 0;

  const handleDismiss = () => {
    setDismissed(syncJob.batchId);
  };

  // In progress state
  if (syncJob.status === 'in_progress' || syncJob.status === 'pending') {
    return (
      <Card className="border-blue-200 bg-blue-50" data-testid="card-sync-progress">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Amazon Sync in Progress
                </h3>
                <p className="text-sm text-blue-700">
                  Processing {syncJob.processedCount} of {syncJob.totalQueued} products
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white">
              {progress}%
            </Badge>
          </div>

          <Progress value={progress} className="h-2 mb-4" data-testid="progress-sync" />

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-blue-600 font-medium" data-testid="text-success-count">
                {syncJob.successCount}
              </p>
              <p className="text-blue-700">Successful</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium" data-testid="text-failed-count">
                {syncJob.failedCount}
              </p>
              <p className="text-blue-700">Failed</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium" data-testid="text-not-found-count">
                {syncJob.notFoundCount}
              </p>
              <p className="text-blue-700">Not Found</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium" data-testid="text-asin-matches">
                {syncJob.asinMatchesFound}
              </p>
              <p className="text-blue-700">ASIN Matches</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state
  if (syncJob.status === 'completed') {
    const durationSeconds = syncJob.durationMs ? Math.round(syncJob.durationMs / 1000) : 0;
    const durationMinutes = Math.floor(durationSeconds / 60);
    const remainingSeconds = durationSeconds % 60;
    const durationText = durationMinutes > 0 
      ? `${durationMinutes}m ${remainingSeconds}s` 
      : `${durationSeconds}s`;

    return (
      <Card className="border-green-200 bg-green-50" data-testid="card-sync-complete">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">
                  Amazon Sync Completed
                </h3>
                <p className="text-sm text-green-700">
                  Processed {syncJob.processedCount} products in {durationText}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDismiss}
              data-testid="button-dismiss-success"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-green-600 font-medium" data-testid="text-success-count-complete">
                {syncJob.successCount}
              </p>
              <p className="text-green-700">Successful</p>
            </div>
            <div>
              <p className="text-green-600 font-medium">
                {syncJob.failedCount}
              </p>
              <p className="text-green-700">Failed</p>
            </div>
            <div>
              <p className="text-green-600 font-medium">
                {syncJob.notFoundCount}
              </p>
              <p className="text-green-700">Not Found</p>
            </div>
            <div>
              <p className="text-green-600 font-medium" data-testid="text-asin-matches-complete">
                {syncJob.asinMatchesFound}
              </p>
              <p className="text-green-700">ASIN Matches</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed state
  if (syncJob.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50" data-testid="card-sync-failed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">
                  Amazon Sync Failed
                </h3>
                <p className="text-sm text-red-700">
                  {syncJob.failureReason || 'An error occurred during sync'}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDismiss}
              data-testid="button-dismiss-error"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {syncJob.processedCount > 0 && (
            <div className="grid grid-cols-4 gap-4 text-sm mt-4">
              <div>
                <p className="text-red-600 font-medium">
                  {syncJob.processedCount}
                </p>
                <p className="text-red-700">Processed</p>
              </div>
              <div>
                <p className="text-red-600 font-medium">
                  {syncJob.successCount}
                </p>
                <p className="text-red-700">Successful</p>
              </div>
              <div>
                <p className="text-red-600 font-medium">
                  {syncJob.failedCount}
                </p>
                <p className="text-red-700">Failed</p>
              </div>
              <div>
                <p className="text-red-600 font-medium">
                  {syncJob.asinMatchesFound}
                </p>
                <p className="text-red-700">ASIN Matches</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
