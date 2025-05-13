import { useQuery } from "@tanstack/react-query";

export interface Category {
  id: number;
  name: string;
  path: string;
  parentId: number | null;
  level: number;
  isActive: boolean;
  productCount: number;
}

/**
 * Hook to fetch all product categories
 */
export function useCategories() {
  const {
    data: categories = [],
    isLoading,
    isError,
    error,
  } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Return a flat list of all categories, ordered by path to ensure proper hierarchy
  const categoriesWithAll = [
    // Add "All Categories" option at the top
    { id: 0, name: "All Categories", path: "/", parentId: null, level: 0, isActive: true, productCount: 0 },
    ...categories
  ];
  
  return {
    categories: categoriesWithAll,
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to fetch a single category and its direct children
 */
export function useCategoryDetails(categoryId: number | undefined) {
  const {
    data: categoryDetails,
    isLoading,
    isError,
    error,
  } = useQuery<{category: Category, children: Category[]}>({
    queryKey: ['/api/categories', categoryId],
    enabled: !!categoryId && categoryId > 0,
  });

  return {
    category: categoryDetails?.category,
    children: categoryDetails?.children || [],
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to fetch breadcrumb path for a category
 */
export function useCategoryBreadcrumbs(categoryId: number | undefined) {
  const {
    data: breadcrumbs = [],
    isLoading,
    isError,
    error,
  } = useQuery<Category[]>({
    queryKey: ['/api/categories', categoryId, 'breadcrumbs'],
    enabled: !!categoryId && categoryId > 0,
  });

  return {
    breadcrumbs,
    isLoading,
    isError,
    error,
  };
}