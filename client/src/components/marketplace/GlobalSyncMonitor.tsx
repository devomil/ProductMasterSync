import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

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

const MILESTONES = [25, 50, 75, 100];

export function GlobalSyncMonitor() {
  const notifiedMilestones = useRef<Set<string>>(new Set());
  const lastBatchId = useRef<string | null>(null);

  const { data: syncJob } = useQuery<SyncJob | null>({
    queryKey: ['/api/marketplace/amazon/sync-jobs/current'],
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === 'in_progress' || job?.status === 'pending') {
        return 8000;
      }
      return 60000;
    },
  });

  useEffect(() => {
    if (!syncJob) return;

    if (lastBatchId.current !== syncJob.batchId) {
      lastBatchId.current = syncJob.batchId;
      notifiedMilestones.current = new Set();
    }

    if (syncJob.status === 'in_progress' && syncJob.totalQueued > 0) {
      const progress = Math.round((syncJob.processedCount / syncJob.totalQueued) * 100);

      for (const milestone of MILESTONES) {
        if (milestone === 100) continue;
        const key = `${syncJob.batchId}-${milestone}`;
        if (progress >= milestone && !notifiedMilestones.current.has(key)) {
          notifiedMilestones.current.add(key);
          toast({
            title: `Amazon Sync ${milestone}% Complete`,
            description: `${syncJob.processedCount} of ${syncJob.totalQueued} products processed. ${syncJob.asinMatchesFound} ASINs found so far.`,
          });
        }
      }
    }

    if (syncJob.status === 'completed') {
      const key = `${syncJob.batchId}-100`;
      if (!notifiedMilestones.current.has(key)) {
        notifiedMilestones.current.add(key);
        const durationSec = syncJob.durationMs ? Math.round(syncJob.durationMs / 1000) : 0;
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        toast({
          title: 'Amazon Sync Complete',
          description: `Finished ${syncJob.processedCount} products in ${durationText}. ${syncJob.asinMatchesFound} ASINs matched, ${syncJob.failedCount} failed.`,
        });
      }
    }

    if (syncJob.status === 'failed') {
      const key = `${syncJob.batchId}-failed`;
      if (!notifiedMilestones.current.has(key)) {
        notifiedMilestones.current.add(key);
        toast({
          title: 'Amazon Sync Failed',
          description: syncJob.failureReason || `Processed ${syncJob.processedCount} of ${syncJob.totalQueued} before failure.`,
          variant: 'destructive',
        });
      }
    }
  }, [syncJob]);

  return null;
}
