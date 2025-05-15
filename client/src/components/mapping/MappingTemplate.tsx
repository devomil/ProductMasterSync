import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronLeft, 
  Save, 
  Download, 
  Upload, 
  Plus, 
  Trash, 
  Search, 
  ArrowDown, 
  ArrowUp, 
  Filter, 
  Info, 
  Eye, 
  EyeOff,
  ChevronUp,
  ChevronDown,
  Maximize,
  Minimize
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface TargetField {
  id: string;
  name: string;
  required?: boolean;
  description?: string;
}

interface MappingTemplateProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  targetFields: TargetField[];
  onUpdateMappings: (mappings: FieldMapping[]) => void;
  templateInfo: {
    name?: string;
    sourceType?: string;
    supplierName?: string;
    filePath?: string;
  };
  onPullSftpSample?: () => void;
  rowsLimit?: number;
  onChangeRowsLimit?: (limit: number) => void;
}

export default function MappingTemplate({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  onUpdateMappings,
  templateInfo,
  onPullSftpSample,
  rowsLimit = 25,
  onChangeRowsLimit
}: MappingTemplateProps) {
  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [collapseUnmapped, setCollapseUnmapped] = useState(false);
  const [activeView, setActiveView] = useState<"enhanced" | "simple">("enhanced");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  
  // Sample data preview state
  const [previewMode, setPreviewMode] = useState<"table" | "formatted">("table");
  const previewTableRef = useRef<HTMLDivElement>(null);
  
  // Stats
  const mappedCount = fieldMappings.filter(m => m.sourceField && m.targetField).length;
  const requiredFields = targetFields.filter(f => f.required);
  const mappedRequiredFields = requiredFields.filter(rf => 
    fieldMappings.some(m => m.targetField === rf.id && m.sourceField)
  );
  
  // Filter mappings based on search term and other filters
  const getFilteredMappings = () => {
    return fieldMappings.filter(mapping => {
      // Filter by search term
      if (searchTerm) {
        const sourceMatch = mapping.sourceField?.toLowerCase().includes(searchTerm.toLowerCase());
        const targetField = targetFields.find(tf => tf.id === mapping.targetField);
        const targetMatch = targetField?.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!sourceMatch && !targetMatch) return false;
      }
      
      // Filter by mapped status
      if (showOnlyMapped && (!mapping.sourceField || !mapping.targetField)) {
        return false;
      }
      
      // Filter by category
      if (filterCategory) {
        if (filterCategory === 'required') {
          const isRequired = targetFields.find(tf => tf.id === mapping.targetField)?.required;
          return isRequired;
        } else if (filterCategory === 'unmapped') {
          return !mapping.sourceField || !mapping.targetField;
        } else if (filterCategory === 'identification') {
          return ['sku', 'upc', 'ean', 'mpn'].includes(mapping.targetField);
        } else if (filterCategory === 'pricing') {
          return ['price', 'cost'].includes(mapping.targetField);
        } else if (filterCategory === 'inventory') {
          return ['stock_quantity', 'weight'].includes(mapping.targetField);
        }
      }
      
      return true;
    });
  };
  
  // Jump to field in sample data
  const scrollToField = (fieldName: string) => {
    if (!previewTableRef.current || !fieldName) return;
    
    const headerCells = previewTableRef.current.querySelectorAll('th');
    let targetIndex = -1;
    
    headerCells.forEach((cell, index) => {
      if (cell.textContent === fieldName) {
        targetIndex = index;
      }
    });
    
    if (targetIndex > 0) { // Skip the first index which is the row number
      const targetCell = headerCells[targetIndex];
      const tableContainer = previewTableRef.current;
      
      if (targetCell) {
        tableContainer.scrollLeft = targetCell.offsetLeft - tableContainer.offsetWidth / 3;
      }
    }
  };

  // Function to update a mapping
  const updateMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings[index][field] = value;
    onUpdateMappings(updatedMappings);
  };
  
  // Function to add a new mapping
  const addMapping = () => {
    const updatedMappings = [...fieldMappings, { sourceField: "", targetField: "" }];
    onUpdateMappings(updatedMappings);
  };
  
  // Function to remove a mapping
  const removeMapping = (index: number) => {
    const updatedMappings = [...fieldMappings];
    updatedMappings.splice(index, 1);
    onUpdateMappings(updatedMappings);
  };
  
  // Auto map fields based on matching names
  const autoMapFields = () => {
    const updatedMappings = [...fieldMappings];
    const unmappedSourceFields = sampleHeaders.filter(
      header => !fieldMappings.some(m => m.sourceField === header)
    );
    
    const targetFieldsById = targetFields.reduce((acc, field) => {
      acc[field.id] = field.name.toLowerCase();
      return acc;
    }, {} as Record<string, string>);
    
    // Map source fields to target fields based on name similarity
    unmappedSourceFields.forEach(sourceField => {
      const sourceFieldLower = sourceField.toLowerCase().replace(/[_\s-]/g, '');
      
      // Find the best matching target field
      let bestMatchId: string | null = null;
      let bestMatchScore = 0;
      
      Object.entries(targetFieldsById).forEach(([id, name]) => {
        const nameLower = name.replace(/[_\s-]/g, '');
        
        // Check for exact match
        if (sourceFieldLower === nameLower) {
          bestMatchId = id;
          bestMatchScore = 2;
          return;
        }
        
        // Check for substring match
        if (
          (sourceFieldLower.includes(nameLower) || nameLower.includes(sourceFieldLower)) &&
          bestMatchScore < 1
        ) {
          bestMatchId = id;
          bestMatchScore = 1;
        }
      });
      
      // Apply special case rules if no match found
      if (!bestMatchId) {
        if (sourceFieldLower.includes('title') || sourceFieldLower.includes('name')) {
          bestMatchId = 'product_name';
        } else if (sourceFieldLower.includes('brand') || sourceFieldLower.includes('manuf')) {
          bestMatchId = 'manufacturer';
        } else if (sourceFieldLower.includes('part') || sourceFieldLower.includes('number')) {
          bestMatchId = 'mpn';
        } else if (sourceFieldLower.includes('desc')) {
          bestMatchId = 'description';
        } else if (sourceFieldLower.includes('cat')) {
          bestMatchId = 'category';
        } else if (sourceFieldLower.includes('subcat')) {
          bestMatchId = 'subcategory';
        } else if (
          sourceFieldLower.includes('price') || 
          sourceFieldLower.includes('msrp') || 
          sourceFieldLower.includes('retail')
        ) {
          bestMatchId = 'price';
        } else if (
          sourceFieldLower.includes('cost') || 
          sourceFieldLower.includes('wholesale')
        ) {
          bestMatchId = 'cost';
        } else if (sourceFieldLower.includes('qty') || sourceFieldLower.includes('quantity')) {
          bestMatchId = 'stock_quantity';
        } else if (sourceFieldLower.includes('weight')) {
          bestMatchId = 'weight';
        } else if (sourceFieldLower.includes('upc') || sourceFieldLower.includes('barcode')) {
          bestMatchId = 'upc';
        }
      }
      
      // If we found a match, add it to the mappings
      if (bestMatchId) {
        // Check if the target field is already mapped
        const existingIndex = updatedMappings.findIndex(m => m.targetField === bestMatchId);
        
        if (existingIndex >= 0) {
          // If the target has no source field, update it
          if (!updatedMappings[existingIndex].sourceField) {
            updatedMappings[existingIndex].sourceField = sourceField;
          } else {
            // Otherwise create a new mapping
            updatedMappings.push({
              sourceField,
              targetField: bestMatchId
            });
          }
        } else {
          // Create a new mapping
          updatedMappings.push({
            sourceField,
            targetField: bestMatchId
          });
        }
      }
    });
    
    onUpdateMappings(updatedMappings);
  };
  
  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(fieldMappings);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onUpdateMappings(items);
  };

  // Generate the sample data preview with limited rows
  const previewData = sampleData.slice(0, rowsLimit);
  
  // Generate a preview of how the data will be mapped
  const generateMappingPreview = () => {
    if (sampleData.length === 0) return [];
    
    // Create a mapping from source field to target field
    const fieldMap = fieldMappings.reduce((acc, mapping) => {
      if (mapping.sourceField && mapping.targetField) {
        acc[mapping.targetField] = mapping.sourceField;
      }
      return acc;
    }, {} as Record<string, string>);
    
    return targetFields
      .filter(tf => fieldMap[tf.id]) // Only include mapped fields
      .map(targetField => {
        const sourceField = fieldMap[targetField.id];
        const sampleValue = sampleData[0][sourceField];
        
        return {
          targetFieldId: targetField.id,
          targetFieldName: targetField.name,
          sourceField: sourceField,
          sampleValue: sampleValue !== undefined ? String(sampleValue) : "(empty)"
        };
      });
  };
  
  // Get filtered mappings
  const filteredMappings = getFilteredMappings();
  
  // Generate mapping preview data
  const mappingPreview = generateMappingPreview();
  
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Top controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowOnlyMapped(!showOnlyMapped)}>
            {showOnlyMapped ? 
              <>Show All</> : 
              <>Collapse Mapped</>
            }
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Jump to <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Field Categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterCategory('required')}>
                Required Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('unmapped')}>
                Unmapped Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('identification')}>
                Identification Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('pricing')}>
                Pricing Fields
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('inventory')}>
                Inventory Fields
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterCategory(null)}>
                Clear Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="ml-2 flex items-center">
            <Label htmlFor="collapse-unmapped" className="mr-2 text-sm">
              Hide Sidebar
            </Label>
            <Switch id="collapse-unmapped" />
          </div>
          
          <div className="ml-2 flex items-center">
            <Label htmlFor="collapse-unmapped" className="mr-2 text-sm">
              Collapse Unmapped
            </Label>
            <Switch 
              id="collapse-unmapped" 
              checked={collapseUnmapped}
              onCheckedChange={setCollapseUnmapped}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onPullSftpSample && (
            <Button variant="outline" size="sm" onClick={onPullSftpSample}>
              <Download className="mr-2 h-4 w-4" /> Pull Sample From SFTP
            </Button>
          )}
          
          <Button size="sm" onClick={autoMapFields}>
            Auto-Map Fields
          </Button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left panel - Field Mappings */}
        <div className="border rounded-md">
          <div className="border-b bg-slate-50 p-3 flex justify-between items-center">
            <div className="flex items-center">
              <h3 className="font-medium">Field Mappings</h3>
              <Badge variant="outline" className="ml-2 bg-blue-50">
                {mappedCount}/{fieldMappings.length} mapped
              </Badge>
              <Badge 
                variant={mappedRequiredFields.length === requiredFields.length ? "outline" : "destructive"} 
                className={mappedRequiredFields.length === requiredFields.length ? "ml-2 bg-green-50" : "ml-2"}
              >
                {mappedRequiredFields.length}/{requiredFields.length} required
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={addMapping}>
              <Plus className="h-4 w-4 mr-1" /> Add Field
            </Button>
          </div>
          
          {/* Search bar */}
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search fields..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Field mapping list */}
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="field-mappings">
                {(provided) => (
                  <div 
                    className="p-2 space-y-2" 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {filteredMappings.map((mapping, index) => {
                      const targetField = targetFields.find(tf => tf.id === mapping.targetField);
                      
                      return (
                        <Draggable
                          key={`mapping-${index}`}
                          draggableId={`mapping-${index}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`
                                flex items-center gap-2 p-2 rounded border bg-white
                                ${mapping.sourceField === hoveredField ? 'border-blue-300' : ''}
                                ${mapping.sourceField === selectedField ? 'border-blue-500 bg-blue-50' : ''}
                                ${snapshot.isDragging ? 'shadow-lg' : ''}
                              `}
                              onMouseEnter={() => setHoveredField(mapping.sourceField)}
                              onMouseLeave={() => setHoveredField(null)}
                              onClick={() => {
                                setSelectedField(mapping.sourceField);
                                scrollToField(mapping.sourceField);
                              }}
                            >
                              <div className="flex flex-col justify-center text-gray-400">
                                <ArrowUp className="h-3 w-3" />
                                <ArrowDown className="h-3 w-3" />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 flex-grow">
                                <Select
                                  value={mapping.sourceField || "select_source"}
                                  onValueChange={(val) => updateMapping(
                                    index, 
                                    'sourceField', 
                                    val === "select_source" ? "" : val
                                  )}
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
                                
                                <Select
                                  value={mapping.targetField || "select_target"}
                                  onValueChange={(val) => updateMapping(
                                    index, 
                                    'targetField',
                                    val === "select_target" ? "" : val
                                  )}
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
                              
                              <div className="flex items-center gap-1">
                                {targetField?.description && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-blue-500 cursor-help" />
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
                                
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => removeMapping(index)}
                                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
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
          </div>
        </div>
        
        {/* Right panel - Sample Data Preview */}
        <div className="space-y-4">
          {/* Sample Data Preview */}
          <Card>
            <CardHeader className="p-3 pb-0">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Sample Data Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Tabs defaultValue="enhanced" className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger 
                        value="enhanced" 
                        className="px-2 py-1 text-xs"
                        onClick={() => setActiveView("enhanced")}
                      >
                        Enhanced
                      </TabsTrigger>
                      <TabsTrigger 
                        value="simple" 
                        className="px-2 py-1 text-xs"
                        onClick={() => setActiveView("simple")}
                      >
                        Simple
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="flex items-center gap-1">
                    <Label htmlFor="rows-limit" className="text-xs">Show rows:</Label>
                    <Select 
                      value={String(rowsLimit)}
                      onValueChange={(val) => onChangeRowsLimit?.(Number(val))}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs">
                        <SelectValue placeholder="25" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Showing {rowsLimit} of {sampleData.length} rows
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                className="overflow-auto max-h-[300px]" 
                ref={previewTableRef}
              >
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 border-b font-medium text-left">#</th>
                      {sampleHeaders.map((header) => (
                        <th 
                          key={header} 
                          className={`
                            p-2 border-b font-medium text-left whitespace-nowrap
                            ${header === hoveredField ? 'bg-blue-100' : ''}
                            ${header === selectedField ? 'bg-blue-200' : ''}
                          `}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2 border-b text-slate-500">{rowIndex + 1}</td>
                        {sampleHeaders.map((header) => (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className={`
                              p-2 border-b truncate max-w-[200px]
                              ${header === hoveredField ? 'bg-blue-50' : ''}
                              ${header === selectedField ? 'bg-blue-100' : ''}
                            `}
                          >
                            {row[header] === null || row[header] === undefined ? 
                              <span className="text-slate-400 italic">null</span> : 
                              String(row[header])
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Live Mapping Preview */}
          <Card>
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-base">Live Mapping Preview</CardTitle>
              <p className="text-xs text-gray-500">How the first row will be imported</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {mappingPreview.length > 0 && (
                        <>
                          <th className="p-2 border-b font-medium text-left">Target Field</th>
                          <th className="p-2 border-b font-medium text-left">Sample Value</th>
                          <th className="p-2 border-b font-medium text-left">Source Column</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mappingPreview.length > 0 ? (
                      mappingPreview.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-2 border-b font-medium">
                            {item.targetFieldName}
                          </td>
                          <td className="p-2 border-b max-w-[200px] truncate">
                            {item.sampleValue}
                          </td>
                          <td className="p-2 border-b text-gray-600">
                            {item.sourceField}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No mappings configured yet. Map fields to see a preview.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}