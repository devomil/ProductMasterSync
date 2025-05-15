import React from 'react';
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EnhancedMappingInterface from "./EnhancedMappingInterface";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface MappingInterfaceWrapperProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  targetFields: Array<{
    id: string;
    name: string;
    required?: boolean;
    description?: string;
  }>;
  setFieldMappings: (mappings: FieldMapping[]) => void;
  expandedPreview: boolean;
  rowCount: number;
}

// This component wraps our enhanced mapping interface to avoid syntax errors in the main file
export default function MappingInterfaceWrapper({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  setFieldMappings,
  expandedPreview,
  rowCount
}: MappingInterfaceWrapperProps) {
  
  // Auto-map fields by matching source field names to target field names
  const autoMapFields = (headers: string[]) => {
    const targetFieldMap = new Map(targetFields.map(field => [field.id.toLowerCase(), field.id]));
    
    // Create initial mappings with all headers
    const initialMappings = headers.map(header => ({ 
      sourceField: header, 
      targetField: "" 
    }));
    
    // Try to auto-map based on matching field names
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase().replace(/[_\s-]/g, '');
      
      // Check for exact match
      if (targetFieldMap.has(headerLower)) {
        initialMappings[index].targetField = targetFieldMap.get(headerLower)!;
        return;
      }
      
      // Check for partial matches
      for (const [targetKey, targetId] of Array.from(targetFieldMap.entries())) {
        if (headerLower.includes(targetKey) || targetKey.includes(headerLower)) {
          initialMappings[index].targetField = targetId;
          return;
        }
      }
      
      // Special cases
      if (headerLower.includes('title') || headerLower.includes('name')) {
        initialMappings[index].targetField = 'product_name';
      } else if (headerLower.includes('brand')) {
        initialMappings[index].targetField = 'manufacturer';
      } else if (headerLower.includes('partno') || headerLower.includes('partnumber')) {
        initialMappings[index].targetField = 'mpn';
      } else if (headerLower.includes('qty') || headerLower.includes('quantity') || headerLower.includes('stock')) {
        initialMappings[index].targetField = 'stock_quantity';
      } else if (headerLower.includes('barcode')) {
        initialMappings[index].targetField = 'upc';
      }
    });
    
    return initialMappings;
  };
  
  return (
    <EnhancedMappingInterface
      sampleData={sampleData}
      sampleHeaders={sampleHeaders}
      fieldMappings={fieldMappings}
      targetFields={targetFields}
      onUpdateMappings={setFieldMappings}
      onAutoMap={() => {
        if (sampleHeaders.length > 0) {
          const autoMappings = autoMapFields(sampleHeaders);
          setFieldMappings(autoMappings);
          toast({
            title: "Auto-mapping complete",
            description: `Mapped ${autoMappings.filter(m => m.targetField).length} of ${autoMappings.length} fields.`,
          });
        }
      }}
      maxPreviewRows={rowCount}
      isFullscreen={expandedPreview}
    />
  );
}