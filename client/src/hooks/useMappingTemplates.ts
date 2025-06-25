import { useQuery } from "@tanstack/react-query";

export interface MappingTemplate {
  id: number;
  name: string;
  sourceType: string;
  mappings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export function useMappingTemplates() {
  return useQuery<MappingTemplate[]>({
    queryKey: ["/api/mapping-templates"],
  });
}

export function useMappingTemplate(id: string | number) {
  return useQuery<MappingTemplate>({
    queryKey: ["/api/mapping-templates", id],
    enabled: !!id,
  });
}