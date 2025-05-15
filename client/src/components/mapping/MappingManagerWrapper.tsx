import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash, ArrowDown, ArrowUp, Info, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EnhancedSampleDataTable from "./EnhancedSampleDataTable";

// Interface for field mapping
interface FieldMapping {
  sourceField: string;
  targetField: string;
}

// Props for the component
interface MappingManagerWrapperProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  targetFields: Array<{
    id: string;
    name: string;
    required?: boolean;
    description?: string;
  }>;
  onUpdateMappings: (mappings: FieldMapping[]) => void;
  expandedPreview?: boolean;
  maxPreviewRows?: number;
}

export default function MappingManagerWrapper({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  onUpdateMappings,
  expandedPreview = false,
  maxPreviewRows = 25
}: MappingManagerWrapperProps) {
  // State for visual interactions
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  
  // Stats about mappings
  const mappedFieldsCount = fieldMappings.filter(m => m.targetField).length;
  const totalFields = sampleHeaders.length;
  const requiredFieldsCount = targetFields.filter(f => f.required).length;
  const mappedRequiredFields = fieldMappings
    .filter(m => m.targetField && targetFields.find(f => f.id === m.targetField)?.required)
    .length;
  
  // Filter mappings
  const getFilteredMappings = () => {
    return fieldMappings.filter(mapping => {
      // Apply search term filtering if any
      if (searchTerm) {
        const sourceMatches = mapping.sourceField.toLowerCase().includes(searchTerm.toLowerCase());
        const targetField = targetFields.find(f => f.id === mapping.targetField);
        const targetMatches = targetField?.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!sourceMatches && !targetMatches) {
          return false;
        }
      }
      
      // Apply category filtering if any
      if (filterType === 'required') {
        return targetFields.find(f => f.id === mapping.targetField)?.required === true;
      }
      
      if (filterType === 'mapped') {
        return !!mapping.targetField;
      }
      
      if (filterType === 'unmapped') {
        return !mapping.targetField;
      }
      
      return true;
    });
  };
  
  // Generate mapping preview
  const generateMappingPreview = () => {
    if (!sampleData || sampleData.length === 0) return [];
    
    // First, create a lookup table from mappings
    const mappingsLookup: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingsLookup[mapping.sourceField] = mapping.targetField;
      }
    });
    
    // Generate preview rows
    return sampleData.slice(0, maxPreviewRows).map((row, rowIndex) => {
      const mappedRow: Record<string, any> = { _rowIndex: rowIndex };
      
      Object.entries(mappingsLookup).forEach(([sourceField, targetFieldId]) => {
        const targetField = targetFields.find(f => f.id === targetFieldId);
        if (targetField) {
          mappedRow[targetField.name] = row[sourceField];
        }
      });
      
      return mappedRow;
    });
  };
  
  // Update a specific mapping
  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings[index][field] = value;
    onUpdateMappings(updatedMappings);
  };
  
  // Add a new mapping
  const addMapping = () => {
    onUpdateMappings([...fieldMappings, { sourceField: "", targetField: "" }]);
  };
  
  // Remove a mapping
  const removeMapping = (index: number) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings.splice(index, 1);
    
    // Always keep at least one mapping
    if (updatedMappings.length === 0) {
      updatedMappings.push({ sourceField: "", targetField: "" });
    }
    
    onUpdateMappings(updatedMappings);
  };
  
  // Move a mapping up or down
  const moveMapping = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === fieldMappings.length - 1)
    ) {
      return; // Can't move further
    }
    
    const updatedMappings = [...fieldMappings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap the mappings
    [updatedMappings[index], updatedMappings[targetIndex]] = 
      [updatedMappings[targetIndex], updatedMappings[index]];
    
    onUpdateMappings(updatedMappings);
  };
  
  // Auto-map fields by matching source field names to target field names
  const autoMapFields = () => {
    if (!sampleHeaders || sampleHeaders.length === 0) return;
    
    const targetFieldMap = new Map(
      targetFields.map(field => [field.id.toLowerCase(), field.id])
    );
    
    // Create initial mappings with all headers
    const initialMappings = sampleHeaders.map(header => ({ 
      sourceField: header, 
      targetField: "" 
    }));
    
    // Try to auto-map based on matching field names
    sampleHeaders.forEach((header, index) => {
      const headerLower = header.toLowerCase().replace(/[_\s-]/g, '');
      
      // Check for exact match
      if (targetFieldMap.has(headerLower)) {
        initialMappings[index].targetField = targetFieldMap.get(headerLower)!;
        return;
      }
      
      // Check for partial matches by iterating through the Map entries
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
    
    onUpdateMappings(initialMappings);
    
    toast({
      title: "Auto-mapping complete",
      description: `Mapped ${initialMappings.filter(m => m.targetField).length} of ${initialMappings.length} fields.`,
    });
  };
  
  const filteredMappings = getFilteredMappings();
  const previewData = generateMappingPreview();
  
  // If no sample data, display empty state
  if (!sampleData || sampleData.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-muted-foreground">
          <Upload className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-lg font-medium">No sample data loaded</p>
          <p className="text-sm">
            Upload a sample file or pull data from SFTP to map fields
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${expandedPreview ? 'h-[85vh]' : 'h-[70vh]'}`}>
      {/* Left side: Mapping Fields */}
      <div className="flex flex-col border rounded-md overflow-hidden">
        <div className="bg-slate-100 p-3 font-medium border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Field Mappings</span>
            <Badge variant="outline" className="ml-2 bg-blue-50">
              {mappedFieldsCount}/{totalFields} mapped
            </Badge>
            <Badge variant="outline" className={mappedRequiredFields === requiredFieldsCount ? 'bg-green-50' : 'bg-red-50'}>
              {mappedRequiredFields}/{requiredFieldsCount} required
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={autoMapFields}>
              Auto Map
            </Button>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Add Field
            </Button>
          </div>
        </div>
        
        {/* Field mapping list */}
        <div className="overflow-y-auto flex-grow p-2 bg-slate-50">
          <div className="space-y-2">
            {filteredMappings.map((mapping, index) => {
              const targetField = targetFields.find(f => f.id === mapping.targetField);
              
              return (
                <div
                  key={`mapping-${index}`}
                  className={`
                    flex items-center gap-2 p-2 bg-white border rounded 
                    ${mapping.sourceField === selectedField ? 'border-blue-500 bg-blue-50' : ''}
                    ${mapping.sourceField === hoveredField ? 'border-blue-300' : ''}
                  `}
                  onMouseEnter={() => setHoveredField(mapping.sourceField)}
                  onMouseLeave={() => setHoveredField(null)}
                  onClick={() => setSelectedField(mapping.sourceField)}
                >
                  <div className="cursor-grab px-1">
                    <div className="flex flex-col items-center justify-center">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveMapping(index, 'up');
                        }}
                      >
                        <ArrowUp className="h-3 w-3 text-gray-400" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveMapping(index, 'down');
                        }}
                      >
                        <ArrowDown className="h-3 w-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-grow grid grid-cols-2 gap-2">
                    <div>
                      <Select
                        value={mapping.sourceField || "select_source"}
                        onValueChange={(val) => updateMapping(index, 'sourceField', val === "select_source" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Source field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="select_source">Select source field</SelectItem>
                          {sampleHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Select
                        value={mapping.targetField || "select_target"}
                        onValueChange={(val) => updateMapping(index, 'targetField', val === "select_target" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="select_target">Select target field</SelectItem>
                          {targetFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}
                              {field.required && ' *'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMapping(index);
                          }}
                          className="h-8 w-8"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove mapping</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {targetField?.description && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{targetField.description}</p>
                          {targetField.required && (
                            <p className="text-red-500 text-xs mt-1">Required field</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              );
            })}
            
            {filteredMappings.length === 0 && (
              <div className="text-center p-4 text-muted-foreground">
                No fields match your filters
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right side: Split view with sample data and live mapping preview */}
      <div className="flex flex-col border rounded-md overflow-hidden">
        {/* Sample data view */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-slate-100 p-3 font-medium border-b">
            <span>Sample Data Preview</span>
            <div className="text-xs text-muted-foreground">
              Showing sample data from the imported file
            </div>
          </div>
          
          <div className="overflow-auto flex-grow">
            <EnhancedSampleDataTable 
              sampleData={sampleData} 
              maxHeight="100%" 
              maxRows={maxPreviewRows}
              highlightedColumn={hoveredField}
              selectedColumn={selectedField}
            />
          </div>
        </div>
        
        {/* Live mapping preview */}
        <div className="border-t">
          <div className="bg-slate-100 p-3 font-medium border-b">
            <span>Live Mapping Preview</span>
            <div className="text-xs text-muted-foreground">
              Showing how your data will be imported
            </div>
          </div>
          
          <div className="overflow-x-auto" style={{ maxHeight: '200px' }}>
            {previewData.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(previewData[0])
                      .filter(k => k !== '_rowIndex')
                      .map((field, i) => (
                        <th key={i} className="text-left p-2 border-b font-medium">
                          {field}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {Object.entries(row)
                        .filter(([key]) => key !== '_rowIndex')
                        .map(([field, value], j) => (
                          <td key={j} className="p-2 border-b">
                            {value !== null && value !== undefined
                              ? String(value)
                              : <span className="text-slate-400">null</span>
                            }
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No mapped fields to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}