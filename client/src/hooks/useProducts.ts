import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";

export type InventoryStatusType = 'all' | 'inStock' | 'lowStock' | 'outOfStock';
export type SearchType = 'all' | 'sku' | 'mfgPart' | 'upc' | 'title' | 'description' | 'category' | 'manufacturer';

export interface ProductSearchFilters {
  searchType: SearchType;
  query?: string;
  category?: string;
  supplier?: string;
  manufacturer?: string;
  isRemanufactured?: boolean;
  isCloseout?: boolean;
  isOnSale?: boolean;
  hasRebate?: boolean;
  hasFreeShipping?: boolean;
  priceMin?: string;
  priceMax?: string;
  inventoryStatus?: InventoryStatusType;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductSearchResponse {
  products: Product[];
  pagination: PaginationData;
}

export function useProducts() {
  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  return {
    products,
    isLoading,
    isError,
    error,
  };
}

export function useProductSearch(filters: ProductSearchFilters) {
  // Build query string from filters
  const queryParams = new URLSearchParams();
  
  if (filters.query) queryParams.append('query', filters.query);
  if (filters.searchType) queryParams.append('searchType', filters.searchType);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.supplier) queryParams.append('supplier', filters.supplier);
  if (filters.isRemanufactured) queryParams.append('isRemanufactured', 'true');
  if (filters.isCloseout) queryParams.append('isCloseout', 'true');
  if (filters.isOnSale) queryParams.append('isOnSale', 'true');
  if (filters.hasRebate) queryParams.append('hasRebate', 'true');
  if (filters.hasFreeShipping) queryParams.append('hasFreeShipping', 'true');
  if (filters.priceMin) queryParams.append('priceMin', filters.priceMin);
  if (filters.priceMax) queryParams.append('priceMax', filters.priceMax);
  if (filters.inventoryStatus) queryParams.append('inventoryStatus', filters.inventoryStatus);
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortDir) queryParams.append('sortDir', filters.sortDir);
  
  const queryString = queryParams.toString();
  const url = `/api/products/search${queryString ? `?${queryString}` : ''}`;

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ProductSearchResponse>({
    queryKey: ['/api/products/search', filters],
    enabled: Object.keys(filters).length > 0
  });

  return {
    products: data?.products ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    isLoading,
    isError,
    error,
  };
}

export function useProductDetails(productId: number | undefined) {
  const {
    data: productDetails,
    isLoading,
    isError,
    error,
  } = useQuery<any>({
    queryKey: ['/api/products', productId, 'details'],
    queryFn: async () => {
      if (!productId) return ;
      const response = await fetch(`/api/products/${productId}/details`);
      if (!response.ok) {
        throw new Error('Failed to fetch product details');
      }
      return response.json();
    },
    enabled: !!productId,
  });

  return {
    productDetails,
    isLoading,
    isError,
    error,
  };
}
