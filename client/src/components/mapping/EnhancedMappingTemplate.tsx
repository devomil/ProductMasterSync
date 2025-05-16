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
import { ChevronLeft, ChevronDown, Save, ArrowUp, ArrowDown } from "lucide-react";
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b py-4 px-6 flex justify-between items-center">
        <div className="flex items-center">
          <Button variant="outline" size="sm" onClick={onBack} className="mr-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-semibold">Create Mapping Template</h1>
        </div>
        
        <Button onClick={onSave} className="bg-blue-500 hover:bg-blue-600">
          Save Template
        </Button>
      </div>
      
      {/* Controls */}
      <div className="border-b py-3 px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="hide-sidebar" 
              checked={hideSidebar} 
              onCheckedChange={(checked) => setHideSidebar(checked as boolean)} 
            />
            <Label htmlFor="hide-sidebar">Hide Sidebar</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox 
              id="collapse-unmapped" 
              checked={collapseUnmapped} 
              onCheckedChange={(checked) => setCollapseUnmapped(checked as boolean)} 
            />
            <Label htmlFor="collapse-unmapped">Collapse Unmapped Fields</Label>
          </div>
          
          {onPullSftpSample && (
            <Button variant="outline" size="sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Pull Sample From SFTP
            </Button>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-grow overflow-hidden">
        {/* Left panel - Mapping Fields */}
        {!hideSidebar && (
          <div className="w-[450px] border-r flex flex-col">
            <div className="flex border-b p-2">
              <Button
                variant="outline"
                size="sm"
                className={showAllFields ? "bg-white" : "bg-gray-100"}
                onClick={() => setShowAllFields(false)}
              >
                Collapse Mapped
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={!showAllFields ? "bg-white" : "bg-gray-100"}
                onClick={() => setShowAllFields(true)}
              >
                Show All
              </Button>
              
              <Select defaultValue="">
                <SelectTrigger className="ml-2 h-9 w-[120px]">
                  <div className="flex items-center">
                    Jump to <ChevronDown className="h-4 w-4 ml-1" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Fields</SelectItem>
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
            
            <div className="grid grid-cols-2 gap-2 px-8 py-2 border-b bg-gray-50 text-xs font-medium text-gray-600">
              <div>Source Fields</div>
              <div className="flex items-center justify-between">
                <span>Target Field</span>
                <ArrowUp className="h-3 w-3" />
              </div>
            </div>
            
            <div className="flex-grow overflow-auto p-2">
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
                                flex items-center gap-1 p-2 rounded border 
                                ${mapping.sourceField === hoveredField ? 'border-blue-300' : 'border-gray-200'}
                                ${mapping.sourceField === selectedField ? 'border-blue-500 bg-blue-50' : 'bg-white'}
                              `}
                              onMouseEnter={() => setHoveredField(mapping.sourceField)}
                              onMouseLeave={() => setHoveredField(null)}
                              onClick={() => {
                                setSelectedField(mapping.sourceField);
                                scrollToField(mapping.sourceField);
                              }}
                            >
                              <div className="cursor-grab px-1 text-gray-400 flex flex-col">
                                <ArrowUp className="h-3 w-3" />
                                <ArrowDown className="h-3 w-3" />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 flex-grow">
                                <Select 
                                  value={mapping.sourceField || "select_field"}
                                  onValueChange={(value) => 
                                    updateMapping(index, "sourceField", value === "select_field" ? "" : value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="select_field">Select field</SelectItem>
                                    {sampleHeaders.map(header => (
                                      <SelectItem key={header} value={header}>
                                        {header}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                <Select 
                                  value={mapping.targetField || "select_target"}
                                  onValueChange={(value) => 
                                    updateMapping(index, "targetField", value === "select_target" ? "" : value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Target" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="select_target">Select target</SelectItem>
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
        )}
        
        {/* Right panel - Preview */}
        <div className="flex-grow flex flex-col p-4 overflow-hidden">
          <div className="flex flex-col space-y-4">
            {/* Sample Data Preview */}
            <Card>
              <CardHeader className="p-4 pb-0 bg-white flex flex-row justify-between items-center">
                <CardTitle className="text-base">Sample Data Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Tabs defaultValue={enhancedView ? "enhanced" : "simple"}>
                    <TabsList>
                      <TabsTrigger 
                        value="enhanced"
                        onClick={() => setEnhancedView(true)}
                      >
                        Enhanced
                      </TabsTrigger>
                      <TabsTrigger 
                        value="simple"
                        onClick={() => setEnhancedView(false)}
                      >
                        Simple
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="flex items-center">
                    <span className="text-sm mr-2">Show</span>
                    <Select 
                      value={String(rowsToShow)}
                      onValueChange={(value) => setRowsToShow(Number(value))}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm ml-2">rows</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <div 
                  className="overflow-auto max-h-[300px]"
                  ref={previewTableRef}
                >
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {sampleHeaders.map(header => (
                          <th 
                            key={header}
                            className={`
                              p-2 border text-left font-medium text-gray-600 whitespace-nowrap
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
                                p-2 border text-gray-800 text-sm
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
              </CardContent>
            </Card>
            
            {/* Live Mapping Preview */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Live Mapping Preview</CardTitle>
                <p className="text-sm text-gray-500">How the first row will be imported</p>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 border text-left font-medium text-gray-600">Mfg. Part #</th>
                      <th className="p-2 border text-left font-medium text-gray-600">UPC</th>
                      <th className="p-2 border text-left font-medium text-gray-600">Your Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {mappingPreview.length > 0 ? (
                        <>
                          <td className="p-2 border">
                            {mappingPreview.find(m => m.targetName.includes('Part'))?.value || '—'}
                          </td>
                          <td className="p-2 border">
                            {mappingPreview.find(m => m.targetName.includes('UPC'))?.value || '—'}
                          </td>
                          <td className="p-2 border">
                            {mappingPreview.find(m => m.targetName.includes('Cost'))?.value || '—'}
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          Map fields to see a preview of how data will be imported
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}