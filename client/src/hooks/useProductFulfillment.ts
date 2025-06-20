import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

// Types for fulfillment data
export interface WarehouseLocation {
  location: string;
  stock: number;
}

export interface InternalStock {
  enabled: boolean;
  warehouses: WarehouseLocation[];
}

export interface DropshipOption {
  enabled: boolean;
  supplier_id: string | null;
  stock: number;
  lead_time_days: number;
}

export interface ProductFulfillment {
  internal_stock: InternalStock;
  dropship: DropshipOption;
  bulk_discount_available: boolean;
  preferred_source: 'internal' | 'dropship' | 'auto';
}

// Types for suppliers (used in dropship selection)
export interface Supplier {
  id: string;
  name: string;
  code: string;
}

/**
 * Hook for managing product fulfillment data
 */
export function useProductFulfillment(productId: string | null) {
  // Get fulfillment options for a product
  const { data: fulfillment, isLoading, error } = useQuery({
    queryKey: [`/api/products/${productId}/fulfillment`],
    enabled: !!productId,
  });

  // Get warehouse stock for product
  const { data: stockData } = useQuery({
    queryKey: [`/api/products/${productId}/stock`],
    enabled: !!productId,
  });

  // Get suppliers list for dropship selection
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update fulfillment options
  const { mutate: updateFulfillment, isPending: isUpdating } = useMutation({
    mutationFn: async (updatedData: Partial<ProductFulfillment>) => {
      if (!productId) throw new Error('Product ID is required');
      return await apiRequest('POST', `/api/products/${productId}/fulfillment`, updatedData)
        .then(response => response.json());
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/fulfillment`] });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] }); // To update stock data in products list
    },
  });

  return {
    fulfillment,
    stockData,
    suppliers,
    isLoading,
    isUpdating,
    error,
    updateFulfillment,
  };
}