import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface WalmartSyncLog {
  id: number;
  productId: number;
  productSku: string;
  productName: string;
  upc: string;
  walmartItemId?: string;
  result: 'success' | 'not_found' | 'rate_limited' | 'error';
  responseTimeMs?: number;
  syncStartedAt: string;
  syncCompletedAt?: string;
  errorMessage?: string;
}

export interface WalmartSyncStats {
  total: number;
  successful: number;
  failed: number;
  notFound: number;
  avgResponseTime?: number;
}

export interface SchedulerStatus {
  active: boolean;
  details: {
    id: string;
    name: string;
    interval: number;
    lastRun: number;
    isRunning: boolean;
  } | null;
  allJobs: Array<{
    id: string;
    name: string;
    interval: number;
    lastRun: number;
    isRunning: boolean;
  }>;
}

export function useRecentWalmartSyncLogs(limit: number = 25) {
  return useQuery<WalmartSyncLog[]>({
    queryKey: ['/api/marketplace/walmart/sync-logs', limit],
  });
}

export function useWalmartSyncStats() {
  return useQuery<WalmartSyncStats>({
    queryKey: ['/api/marketplace/walmart/sync-stats'],
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useWalmartSyncProgress() {
  return useQuery<{
    isRunning: boolean;
    progress: number;
    total: number;
    currentProduct?: string;
  }>({
    queryKey: ['/api/marketplace/walmart/sync-progress'],
    refetchInterval: (query) => query.state.data?.isRunning ? 2000 : false,
  });
}

/**
 * Hook to check Walmart API configuration status
 */
export function useWalmartConfigStatus() {
  return useQuery({
    queryKey: ['/api/marketplace/walmart/config-status'],
    retry: 1,
    refetchInterval: 30000, // Refetch every 30 seconds to check for updated credentials
    refetchOnWindowFocus: true
  });
}

/**
 * Hook to run a batch sync of Walmart data
 */
export function useBatchSyncWalmartData() {
  const mutation = useMutation({
    mutationFn: async (limit: number = 10) => {
      const response = await fetch('/api/marketplace/walmart/batch-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit })
      });
      if (!response.ok) throw new Error('Batch sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Walmart batch sync completed',
        description: `Processed ${data.processed} products. ${data.successful} successful, ${data.failed} failed.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/walmart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/walmart/sync-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to run Walmart batch sync',
        description: error.message || 'An error occurred while syncing with Walmart.',
        variant: 'destructive'
      });
    }
  });

  return mutation;
}

/**
 * Hook to get scheduler status
 */
export function useWalmartSchedulerStatus() {
  return useQuery<SchedulerStatus>({
    queryKey: ['/api/marketplace/walmart/scheduler/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to trigger a scheduled job
 */
export function useTriggerWalmartSyncJob() {
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/marketplace/walmart/scheduler/trigger', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Trigger sync job failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Walmart sync job triggered',
        description: `Job has been manually triggered and is now running.`,
      });
      
      // Invalidate scheduler status
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/walmart/scheduler/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to trigger Walmart sync job',
        description: error.message || 'An error occurred while triggering the job.',
        variant: 'destructive'
      });
    }
  });

  return mutation;
}
