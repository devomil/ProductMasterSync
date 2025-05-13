import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@lib/queryClient';
import { toast } from '@hooks/use-toast';

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
    retry: 1
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