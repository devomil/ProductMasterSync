import { useQuery } from "@tanstack/react-query";
import { Import } from "@shared/schema";

export function useImports() {
  const {
    data: imports = [],
    isLoading,
    isError,
    error,
  } = useQuery<Import[]>({
    queryKey: ['/api/imports'],
  });

  return {
    imports,
    isLoading,
    isError,
    error,
  };
}
