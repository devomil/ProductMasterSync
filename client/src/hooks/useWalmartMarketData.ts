import { useQuery } from '@tanstack/react-query';

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

export function useRecentWalmartSyncLogs(limit: number = 25) {
  return useQuery<WalmartSyncLog[]>({
    queryKey: ['/api/marketplace/walmart/sync-logs', limit],
  });
}

export function useWalmartSyncStats() {
  return useQuery<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    avgResponseTime: number;
  }>({
    queryKey: ['/api/marketplace/walmart/sync-stats'],
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
