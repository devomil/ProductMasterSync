import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";

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
