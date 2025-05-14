import { useQuery } from "@tanstack/react-query";
import { Supplier } from "@shared/schema";

export function useSuppliers() {
  const {
    data: suppliers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  return {
    suppliers,
    isLoading,
    isError,
    error,
    refetch,
  };
}
