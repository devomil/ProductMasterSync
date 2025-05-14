import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

// Types for Amazon data syncing
export interface AmazonSyncStats {
  total: number;
  successful: number;
  failed: number;
  notFound: number;
  rateLimited: number;
  avgResponseTime: number;
}

export interface AmazonSyncLog {
  id: number;
  productId: number;
  batchId: string;
  syncStartedAt: string;
  syncCompletedAt: string | null;
  result: string;
  responseTimeMs: number;
  errorMessage: string | null;
  errorDetails: Record<string, any> | null;
  upc: string | null;
  asin: string | null;
  createdAt: string;
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

/**
 * Hook to fetch Amazon marketplace data for a product
 */
export function useAmazonMarketData(productId: number) {
  return useQuery({
    queryKey: ['/api/marketplace/amazon', productId],
    enabled: !!productId,
    retry: 1
  });
}

/**
 * Hook to fetch Amazon marketplace data for a product by UPC
 */
export function useFetchAmazonDataByUpc(productId: number) {
  const mutation = useMutation({
    mutationFn: async (upc: string) => {
      return apiRequest(`/api/marketplace/amazon/fetch/${productId}`, {
        method: 'POST',
        body: JSON.stringify({ upc }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      // Invalidate the Amazon data query
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon', productId] });
      toast({
        title: 'Amazon data fetched',
        description: 'The product data has been retrieved from Amazon successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to fetch Amazon data',
        description: error.message || 'An error occurred while fetching Amazon data.',
        variant: 'destructive'
      });
    }
  });

  return mutation;
}

/**
 * Hook to check Amazon SP-API configuration status
 */
export function useAmazonConfigStatus() {
  return useQuery({
    queryKey: ['/api/marketplace/amazon/config-status'],
    retry: 1,
    refetchInterval: 30000, // Refetch every 30 seconds to check for updated credentials
    refetchOnWindowFocus: true
  });
}

/**
 * Hook to run a batch sync of Amazon data
 */
export function useBatchSyncAmazonData() {
  const mutation = useMutation({
    mutationFn: async (limit: number = 10) => {
      return apiRequest('/api/marketplace/amazon/batch-sync', {
        method: 'POST',
        body: JSON.stringify({ limit }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Amazon batch sync completed',
        description: `Processed ${data.processed} products. ${data.successful} successful, ${data.failed} failed.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon/sync-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to run Amazon batch sync',
        description: error.message || 'An error occurred while syncing with Amazon.',
        variant: 'destructive'
      });
    }
  });

  return mutation;
}

/**
 * Hook to get Amazon sync statistics
 */
export function useAmazonSyncStats() {
  return useQuery<AmazonSyncStats>({
    queryKey: ['/api/marketplace/amazon/sync-stats'],
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to get Amazon sync logs for a product
 */
export function useAmazonSyncLogsForProduct(productId?: number) {
  return useQuery<AmazonSyncLog[]>({
    queryKey: ['/api/marketplace/amazon/sync-logs', productId],
    enabled: !!productId,
  });
}

/**
 * Hook to get Amazon sync logs for a batch
 */
export function useAmazonSyncLogsByBatch(batchId?: string) {
  return useQuery<AmazonSyncLog[]>({
    queryKey: ['/api/marketplace/amazon/batch-logs', batchId],
    enabled: !!batchId,
  });
}

/**
 * Hook to get scheduler status
 */
export function useAmazonSchedulerStatus() {
  return useQuery<SchedulerStatus>({
    queryKey: ['/api/marketplace/amazon/scheduler/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to trigger a scheduled job
 */
export function useTriggerAmazonSyncJob() {
  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/marketplace/amazon/scheduler/trigger', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Amazon sync job triggered',
        description: `Job has been manually triggered and is now running.`,
      });
      
      // Invalidate scheduler status
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon/scheduler/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to trigger Amazon sync job',
        description: error.message || 'An error occurred while triggering the job.',
        variant: 'destructive'
      });
    }
  });

  return mutation;
}