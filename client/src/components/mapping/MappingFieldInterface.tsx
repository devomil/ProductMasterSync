import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronUp, Trash, Save, Maximize, Minimize, Info, Search, ArrowDown, ArrowUp, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EnhancedSampleDataTable from "@/components/mapping/EnhancedSampleDataTable";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface MappingFieldInterfaceProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  targetFields: Array<{
    id: string;
    name: string;
    required?: boolean;
    description?: string;
  }>;
  onUpdateFieldMappings: (mappings: FieldMapping[]) => void;
  onAutoMap: () => void;
  isFullScreen?: boolean;
  maxHeight?: string;
}

export default function MappingFieldInterface({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  onUpdateFieldMappings,
  onAutoMap,
  isFullScreen = false,
  maxHeight = '600px',
}: MappingFieldInterfaceProps) {
  const [viewMode, setViewMode] = useState<'enhanced' | 'table'>('enhanced');
  const [showAllRows, setShowAllRows] = useState(false);
  const [previewRows, setPreviewRows] = useState(25);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Calculate mapped vs unmapped fields
  const mappedFields = fieldMappings.filter(m => m.targetField).length;
  const totalFields = sampleHeaders.length;
  
  // Generate live mapping preview data
  const getMappingPreview = () => {
    if (!sampleData || sampleData.length === 0) return [];
    
    // Convert field mappings to a lookup object
    const mappingLookup: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingLookup[mapping.sourceField] = mapping.targetField;
      }
    });
    
    // For each row in the sample data, extract values for preview
    return sampleData.slice(0, previewRows).map((row, rowIndex) => {
      const previewRow: Record<string, any> = { _rowIndex: rowIndex };
      
      // For each mapping, extract the target field label and the source value
      Object.entries(mappingLookup).forEach(([sourceField, targetFieldId]) => {
        const targetField = targetFields.find(f => f.id === targetFieldId);
        if (targetField) {
          // Use target field name as the key for the preview
          previewRow[targetField.name] = row[sourceField];
        }
      });
      
      return previewRow;
    });
  };
  
  // Filter mappings based on search term and filter type
  const getFilteredMappings = () => {
    let filtered = [...fieldMappings];
    
    // Apply search term filter
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(mapping => 
        mapping.sourceField.toLowerCase().includes(lowercaseSearch) || 
        mapping.targetField.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    // Apply field type filter
    if (filterType) {
      filtered = filtered.filter(mapping => {
        const targetField = targetFields.find(tf => tf.id === mapping.targetField);
        
        if (filterType === 'required') {
          return targetField?.required === true;
        }
        
        if (filterType === 'mapped') {
          return mapping.targetField !== '';
        }
        
        if (filterType === 'unmapped') {
          return mapping.targetField === '';
        }
        
        // Filter by field category
        if (filterType === 'inventory') {
          return ['stock_quantity', 'weight'].includes(mapping.targetField);
        }
        
        if (filterType === 'identification') {
          return ['sku', 'upc', 'mpn'].includes(mapping.targetField);
        }
        
        if (filterType === 'pricing') {
          return ['price', 'cost'].includes(mapping.targetField);
        }
        
        return true;
      });
    }
    
    return filtered;
  };
  
  // Scroll the table to show the selected column
  const scrollToColumn = (columnName: string) => {
    if (!tableRef.current) return;
    
    const tableContainer = tableRef.current;
    const columnHeaders = tableContainer.querySelectorAll('th');
    
    // Find the index of the column
    let columnIndex = -1;
    columnHeaders.forEach((header, index) => {
      if (header.textContent?.includes(columnName)) {
        columnIndex = index;
      }
    });
    
    if (columnIndex >= 0) {
      // Find the column element
      const columnElement = columnHeaders[columnIndex];
      if (columnElement) {
        // Scroll the column into view
        const containerLeft = tableContainer.scrollLeft;
        const containerWidth = tableContainer.clientWidth;
        const columnLeft = columnElement.offsetLeft;
        const columnWidth = columnElement.offsetWidth;
        
        // If column is not in view, scroll to it
        if (columnLeft < containerLeft || columnLeft + columnWidth > containerLeft + containerWidth) {
          tableContainer.scrollLeft = columnLeft - (containerWidth / 2) + (columnWidth / 2);
        }
      }
    }
  };
  
  // Handle mapping changes
  const updateMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index][field] = value;
    onUpdateFieldMappings(newMappings);
  };
  
  // Add a new mapping row
  const addMapping = () => {
    onUpdateFieldMappings([...fieldMappings, { sourceField: "", targetField: "" }]);
  };
  
  // Remove a mapping row
  const removeMapping = (index: number) => {
    const newMappings = [...fieldMappings];
    newMappings.splice(index, 1);
    onUpdateFieldMappings(newMappings);
  };
  
  // Jump to a specific field in the sample data
  const jumpToField = (fieldName: string) => {
    scrollToColumn(fieldName);
    setSelectedField(fieldName);
  };
  
  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(fieldMappings);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onUpdateFieldMappings(items);
  };
  
  // Create a formatted mapping preview
  const mappingPreview = getMappingPreview();
  const filteredMappings = getFilteredMappings();
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ maxHeight }}>
      {/* Left side: Mapping interface */}
      <div className="flex flex-col border rounded-md overflow-hidden">
        <div className="bg-slate-100 p-3 font-medium border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Field Mappings</span>
            <Badge variant="outline" className="ml-1">
              {mappedFields}/{totalFields} mapped
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAutoMap}>
              <Maximize className="h-3.5 w-3.5 mr-1" /> Auto Map
            </Button>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
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
                              jumpToField(mapping.sourceField);
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
          <div className="bg-slate-100 p-3 font-medium border-b flex justify-between items-center">
            <span>Sample Data Preview</span>
            <div className="flex items-center gap-2">
              <div className="flex border rounded overflow-hidden">
                <Button 
                  variant={viewMode === 'enhanced' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode('enhanced')}
                  className="h-8 text-xs"
                >
                  Enhanced
                </Button>
                <Button 
                  variant={viewMode === 'table' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 text-xs"
                >
                  Simple
                </Button>
              </div>
              
              <Select 
                value={previewRows.toString()} 
                onValueChange={(val) => setPreviewRows(parseInt(val))}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="overflow-auto flex-grow" ref={tableRef}>
            {viewMode === 'enhanced' ? (
              <EnhancedSampleDataTable 
                sampleData={sampleData} 
                maxHeight="100%" 
                maxRows={previewRows}
                highlightedColumn={hoveredField}
                selectedColumn={selectedField}
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {sampleHeaders.map((header, i) => (
                      <th 
                        key={i} 
                        className={`
                          text-left p-2 border-b font-medium
                          ${header === hoveredField ? 'bg-blue-100' : ''}
                          ${header === selectedField ? 'bg-blue-200' : ''}
                        `}
                      >
                        {header}
                        {fieldMappings.some(m => m.sourceField === header && m.targetField) && (
                          <Badge variant="outline" className="ml-1">
                            Mapped
                          </Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.slice(0, previewRows).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {sampleHeaders.map((header, j) => (
                        <td 
                          key={j} 
                          className={`
                            p-2 border-b
                            ${header === hoveredField ? 'bg-blue-100' : ''}
                            ${header === selectedField ? 'bg-blue-200' : ''}
                          `}
                        >
                          {row[header] !== null && row[header] !== undefined
                            ? String(row[header])
                            : <span className="text-slate-400">null</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
            {mappingPreview.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(mappingPreview[0])
                      .filter(k => k !== '_rowIndex')
                      .map((field, i) => (
                        <th key={i} className="text-left p-2 border-b font-medium">
                          {field}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {mappingPreview.map((row, i) => (
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