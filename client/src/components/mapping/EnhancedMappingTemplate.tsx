import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

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

interface EnhancedMappingTemplateProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  targetFields: TargetField[];
  onUpdateMappings: (mappings: FieldMapping[]) => void;
  onAutoMap: () => void;
  onSave: () => void;
  onBack: () => void;
  templateInfo: {
    name?: string;
    supplierName?: string;
  };
  onPullSftpSample?: () => void;
}

export default function EnhancedMappingTemplate({
  sampleData,
  sampleHeaders,
  fieldMappings,
  targetFields,
  onUpdateMappings,
  onAutoMap,
  onSave,
  onBack,
  templateInfo,
  onPullSftpSample
}: EnhancedMappingTemplateProps) {
  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [showAllFields, setShowAllFields] = useState(true);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [collapseUnmapped, setCollapseUnmapped] = useState(false);
  const [rowsToShow, setRowsToShow] = useState(25);
  const [enhancedView, setEnhancedView] = useState(true);
  
  // Sample data preview state
  const previewTableRef = useRef<HTMLDivElement>(null);
  
  // Generate mapping preview (how data will be imported)
  const generateMappingPreview = () => {
    if (sampleData.length === 0) return [];
    
    // Create mappings from target to source
    const mappingMap = new Map();
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingMap.set(mapping.targetField, mapping.sourceField);
      }
    });
    
    // Get the first row of data as sample
    const firstRow = sampleData[0];
    
    // Generate preview data
    return Array.from(mappingMap.entries()).map(([targetId, sourceField]) => {
      const targetField = targetFields.find(tf => tf.id === targetId);
      return {
        targetName: targetField?.name || targetId,
        sourceField: sourceField as string,
        value: firstRow[sourceField as string]
      };
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
  
  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(fieldMappings);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onUpdateMappings(items);
  };

  // Filter mappings by search term and display settings
  const getFilteredMappings = () => {
    return fieldMappings.filter(mapping => {
      // If we're only showing mapped fields, filter out unmapped ones
      if (!showAllFields && (!mapping.sourceField || !mapping.targetField)) {
        return false;
      }
      
      // Apply search term if any
      if (searchTerm) {
        const sourceMatch = mapping.sourceField?.toLowerCase().includes(searchTerm.toLowerCase());
        const targetField = targetFields.find(tf => tf.id === mapping.targetField);
        const targetMatch = targetField?.name.toLowerCase().includes(searchTerm.toLowerCase());
        return sourceMatch || targetMatch;
      }
      
      return true;
    });
  };

  // Get data to display
  const filteredMappings = getFilteredMappings();
  const displayData = sampleData.slice(0, rowsToShow);
  const mappingPreview = generateMappingPreview();
  
  return (
    <div className="flex flex-col w-full">
      {/* Header area */}
      <div className="flex justify-between items-center border-b p-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-xl font-semibold">Create Mapping Template</h1>
        <Button onClick={onSave} className="bg-blue.500">Save Template</Button>
      </div>
      
      {/* Control area */}
      <div className="flex gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Checkbox id="hide-sidebar" checked={hideSidebar} onCheckedChange={(checked) => setHideSidebar(checked as boolean)} />
          <Label htmlFor="hide-sidebar" className="text-sm">Hide Sidebar</Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox id="collapse-unmapped" checked={collapseUnmapped} onCheckedChange={(checked) => setCollapseUnmapped(checked as boolean)} />
          <Label htmlFor="collapse-unmapped" className="text-sm">Collapse Unmapped Fields</Label>
        </div>
        
        {onPullSftpSample && (
          <Button variant="outline" onClick={onPullSftpSample} className="ml-auto flex items-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="8 17 12 21 16 17"></polyline>
              <line x1="12" y1="12" x2="12" y2="21"></line>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
            </svg>
            Pull Sample From SFTP
          </Button>
        )}
      </div>
      
      {/* Main content */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {/* Left column - Field mapping */}
        <div className="border rounded-md">
          <div className="flex border-b p-2">
            <Button variant="outline" size="sm" className={showAllFields ? "" : "bg-gray-100"} onClick={() => setShowAllFields(false)}>
              Collapse Mapped
            </Button>
            <Button variant="outline" size="sm" className={!showAllFields ? "" : "bg-gray-100"} onClick={() => setShowAllFields(true)}>
              Show All
            </Button>
            
            <Select>
              <SelectTrigger className="ml-auto w-28 h-9">
                <div className="flex items-center">
                  Jump to <ChevronDown className="ml-1 h-4 w-4" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required Fields</SelectItem>
                <SelectItem value="unmapped">Unmapped Fields</SelectItem>
                <SelectItem value="identification">Identification Fields</SelectItem>
                <SelectItem value="pricing">Pricing Fields</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="p-2 border-b">
            <Input 
              placeholder="Source Fields" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2 p-2 border-b bg-gray-50 text-sm font-medium">
            <div>Source Fields</div>
            <div className="flex items-center justify-between">
              <span>Target Field</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </div>
          </div>
          
          <div className="p-2 overflow-auto max-h-[400px]">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="mappings">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {filteredMappings.map((mapping, index) => (
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
                              flex items-center p-2 border rounded
                              ${mapping.sourceField === hoveredField ? 'border-blue-400' : ''}
                              ${mapping.sourceField === selectedField ? 'border-blue-600 bg-blue-50' : ''}
                              ${snapshot.isDragging ? 'shadow-md' : ''}
                            `}
                            onClick={() => {
                              setSelectedField(mapping.sourceField);
                              scrollToField(mapping.sourceField);
                            }}
                            onMouseEnter={() => setHoveredField(mapping.sourceField)}
                            onMouseLeave={() => setHoveredField(null)}
                          >
                            <div className="grid grid-cols-2 gap-2 w-full">
                              <Select
                                value={mapping.sourceField || "select_field"}
                                onValueChange={(val) => updateMapping(
                                  index, 
                                  'sourceField', 
                                  val === "select_field" ? "" : val
                                )}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="select_field">Select source field</SelectItem>
                                  {sampleHeaders.map(header => (
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
                                  <SelectValue placeholder="Target" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="select_target">Select target field</SelectItem>
                                  {targetFields.map(field => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.name}{field.required ? ' *' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
        
        {/* Right column - Preview */}
        <div className="space-y-4">
          {/* Sample Data Preview */}
          <div className="border rounded-md">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50">
              <h3 className="font-medium">Sample Data Preview</h3>
              
              <div className="flex items-center gap-4">
                <Tabs defaultValue="enhanced" className="h-8">
                  <TabsList className="h-8">
                    <TabsTrigger value="enhanced" className="text-xs px-3 py-1">
                      Enhanced
                    </TabsTrigger>
                    <TabsTrigger value="simple" className="text-xs px-3 py-1">
                      Simple
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="flex items-center">
                  <span className="text-sm">Show</span>
                  <Select
                    value={rowsToShow.toString()}
                    onValueChange={(val) => setRowsToShow(Number(val))}
                  >
                    <SelectTrigger className="mx-2 w-16 h-8 border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm">rows</span>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto max-h-[300px]" ref={previewTableRef}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    {sampleHeaders.map(header => (
                      <th 
                        key={header}
                        className={`
                          border p-2 font-medium text-left
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
                  {displayData.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {sampleHeaders.map(header => (
                        <td 
                          key={`${rowIndex}-${header}`}
                          className={`
                            border p-2 text-sm
                            ${header === hoveredField ? 'bg-blue-50' : ''}
                            ${header === selectedField ? 'bg-blue-100' : ''}
                          `}
                        >
                          {row[header] !== undefined && row[header] !== null 
                            ? String(row[header]) 
                            : <span className="text-gray-400 italic">null</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Live Mapping Preview */}
          <div className="border rounded-md">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="font-medium">Live Mapping Preview</h3>
              <p className="text-xs text-gray-500">How the first row will be imported</p>
            </div>
            
            <div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 font-medium text-left">Mfg. Part #</th>
                    <th className="border p-2 font-medium text-left">UPC</th>
                    <th className="border p-2 font-medium text-left">Your Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {mappingPreview.length > 0 ? (
                      <>
                        <td className="border p-2">
                          {mappingPreview.find(m => m.targetName.includes('Part'))?.value || '—'}
                        </td>
                        <td className="border p-2">
                          {mappingPreview.find(m => m.targetName.includes('UPC'))?.value || '—'}
                        </td>
                        <td className="border p-2">
                          {mappingPreview.find(m => m.targetName.includes('Cost'))?.value || '—'}
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="p-4 text-center text-gray-500">
                        Map fields to see preview
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}