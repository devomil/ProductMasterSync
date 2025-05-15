import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Filter, Plus, Trash, ArrowUp, ArrowDown, Info, Maximize } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EnhancedSampleDataTable from "./EnhancedSampleDataTable";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface EnhancedMappingInterfaceProps {
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
  onAutoMap: () => void;
  maxPreviewRows?: number;
  isFullscreen?: boolean;
}

export default function EnhancedMappingInterface({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  onUpdateMappings,
  onAutoMap,
  maxPreviewRows = 25,
  isFullscreen = false
}: EnhancedMappingInterfaceProps) {
  // State for interface interactions
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // Stats about mappings
  const mappedFieldsCount = fieldMappings.filter(m => m.targetField).length;
  const totalFields = sampleHeaders.length;
  const requiredFieldsCount = targetFields.filter(f => f.required).length;
  const mappedRequiredFields = fieldMappings
    .filter(m => m.targetField && targetFields.find(f => f.id === m.targetField)?.required)
    .length;
  
  // Filter mappings based on search and filter criteria
  const getFilteredMappings = () => {
    let filtered = [...fieldMappings];
    
    // Apply search term filter
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(mapping => {
        // Get target field name for display
        const targetFieldName = targetFields.find(f => f.id === mapping.targetField)?.name || '';
        
        return mapping.sourceField.toLowerCase().includes(lowercaseSearch) || 
               targetFieldName.toLowerCase().includes(lowercaseSearch);
      });
    }
    
    // Apply filter by category
    if (filterType) {
      filtered = filtered.filter(mapping => {
        if (filterType === 'required') {
          return targetFields.find(f => f.id === mapping.targetField)?.required === true;
        }
        
        if (filterType === 'mapped') {
          return mapping.targetField !== '';
        }
        
        if (filterType === 'unmapped') {
          return mapping.targetField === '';
        }
        
        if (filterType === 'identification') {
          return ['sku', 'mpn', 'upc'].includes(mapping.targetField);
        }
        
        if (filterType === 'pricing') {
          return ['price', 'cost'].includes(mapping.targetField);
        }
        
        if (filterType === 'inventory') {
          return ['stock_quantity', 'weight'].includes(mapping.targetField);
        }
        
        return true;
      });
    }
    
    return filtered;
  };
  
  // Function to generate mapping preview
  const generateMappingPreview = () => {
    if (!sampleData || sampleData.length === 0) return [];
    
    // Convert mappings to a lookup for faster access
    const mappingsLookup: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingsLookup[mapping.sourceField] = mapping.targetField;
      }
    });
    
    // Generate preview rows
    return sampleData.slice(0, maxPreviewRows).map((row, rowIndex) => {
      const mappedRow: Record<string, any> = { _rowIndex: rowIndex };
      
      // For each mapping, add it to the preview with the target field name as key
      Object.entries(mappingsLookup).forEach(([sourceField, targetFieldId]) => {
        const targetField = targetFields.find(f => f.id === targetFieldId);
        if (targetField) {
          mappedRow[targetField.name] = row[sourceField];
        }
      });
      
      return mappedRow;
    });
  };
  
  // Function to update a mapping
  const updateMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings[index][field] = value;
    onUpdateMappings(updatedMappings);
  };
  
  // Function to add a new mapping
  const addMapping = () => {
    onUpdateMappings([...fieldMappings, { sourceField: '', targetField: '' }]);
  };
  
  // Function to remove a mapping
  const removeMapping = (index: number) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings.splice(index, 1);
    onUpdateMappings(updatedMappings);
  };
  
  // Function to handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(fieldMappings);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onUpdateMappings(items);
  };
  
  // Function to scroll sample data to show the selected field
  const scrollToField = (fieldName: string) => {
    if (!previewContainerRef.current || !fieldName) return;
    
    const container = previewContainerRef.current;
    const columns = container.querySelectorAll('th');
    
    let targetColumn = -1;
    columns.forEach((col, index) => {
      if (col.textContent?.includes(fieldName)) {
        targetColumn = index;
      }
    });
    
    if (targetColumn >= 0) {
      const columnElement = columns[targetColumn];
      if (columnElement) {
        const containerLeft = container.scrollLeft;
        const containerWidth = container.clientWidth;
        const columnLeft = columnElement.offsetLeft;
        const columnWidth = columnElement.offsetWidth;
        
        // If column is not fully visible, scroll to center it
        if (columnLeft < containerLeft || columnLeft + columnWidth > containerLeft + containerWidth) {
          container.scrollLeft = columnLeft - (containerWidth / 2) + (columnWidth / 2);
        }
      }
    }
  };
  
  // Get filtered mappings
  const filteredMappings = getFilteredMappings();
  
  // Generate preview data
  const previewData = generateMappingPreview();
  
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${isFullscreen ? 'h-[85vh]' : 'h-[70vh]'}`}>
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
            <Button variant="outline" size="sm" onClick={onAutoMap}>
              <Maximize className="h-3.5 w-3.5 mr-2" /> Auto Map
            </Button>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Add Field
            </Button>
          </div>
        </div>
        
        {/* Search and filter bar */}
        <div className="border-b p-2 flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" /> Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterType(null)}>
                All Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('required')}>
                Required Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('mapped')}>
                Mapped Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('unmapped')}>
                Unmapped Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('identification')}>
                Identification Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('pricing')}>
                Pricing Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('inventory')}>
                Inventory Fields
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Field mapping list */}
        <div className="overflow-y-auto flex-grow p-2 bg-slate-50">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="mappings">
              {(provided) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {filteredMappings.map((mapping, index) => {
                    const targetField = targetFields.find(f => f.id === mapping.targetField);
                    
                    return (
                      <Draggable key={`mapping-${index}`} draggableId={`mapping-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`
                              flex items-center gap-2 p-2 bg-white border rounded 
                              ${snapshot.isDragging ? 'shadow-lg' : ''}
                              ${mapping.sourceField === selectedField ? 'border-blue-500 bg-blue-50' : ''}
                              ${mapping.sourceField === hoveredField ? 'border-blue-300' : ''}
                            `}
                            onMouseEnter={() => setHoveredField(mapping.sourceField)}
                            onMouseLeave={() => setHoveredField(null)}
                            onClick={() => {
                              setSelectedField(mapping.sourceField);
                              scrollToField(mapping.sourceField);
                            }}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab px-1">
                              <div className="flex flex-col items-center justify-center">
                                <ArrowUp className="h-3 w-3 text-gray-300" />
                                <ArrowDown className="h-3 w-3 text-gray-300" />
                              </div>
                            </div>
                            
                            <div className="flex-grow grid grid-cols-2 gap-2">
                              <div>
                                <Select
                                  value={mapping.sourceField}
                                  onValueChange={(val) => updateMapping(index, 'sourceField', val)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Source field" />
                                  </SelectTrigger>
                                  <SelectContent>
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
                                  value={mapping.targetField}
                                  onValueChange={(val) => updateMapping(index, 'targetField', val)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Target field" />
                                  </SelectTrigger>
                                  <SelectContent>
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
                                    onClick={() => removeMapping(index)}
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          {filteredMappings.length === 0 && (
            <div className="text-center p-4 text-muted-foreground">
              No fields match your filters
            </div>
          )}
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
          
          <div ref={previewContainerRef} className="overflow-auto flex-grow">
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
              Showing how your first row will be imported
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