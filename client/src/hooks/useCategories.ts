import { useQuery } from "@tanstack/react-query";
import { Category } from "@shared/schema";

export function useCategories() {
  const {
    data: categories = [],
    isLoading,
    isError,
    error,
  } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  return {
    categories,
    isLoading,
    isError,
    error,
  };
}

export function useCategory(categoryId: number | undefined) {
  const {
    data: category,
    isLoading,
    isError,
    error,
  } = useQuery<Category>({
    queryKey: ['/api/categories', categoryId],
    enabled: !!categoryId,
  });

  return {
    category,
    isLoading,
    isError,
    error,
  };
}