import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { 
  Info as InfoIcon, 
  AlertTriangle as AlertTriangleIcon, 
  ChevronLeft, 
  ChevronDown, 
  ArrowUpDown, 
  ChevronRight, 
  Plus, 
  Database,
  View,
  Layers,
  LayoutGrid,
  Monitor,
  Image,
  FileText,
  Truck,
  Tag
} from "lucide-react";
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
  type?: string;
}

interface MappingWorkspaceProps {
  sampleData: any[];
  sampleHeaders: string[];
  catalogMappings: FieldMapping[];
  detailMappings: FieldMapping[];
  activeView: 'catalog' | 'detail';
  catalogFields: TargetField[];
  detailFields: TargetField[];
  onUpdateCatalogMappings: (mappings: FieldMapping[]) => void;
  onUpdateDetailMappings: (mappings: FieldMapping[]) => void;
  onToggleView: (view: 'catalog' | 'detail') => void;
  onAutoMap: () => void;
  onSave: () => void;
  onBack: () => void;
  templateInfo: {
    name?: string;
    supplierName?: string;
  };
  onPullSftpSample?: () => void;
}

export default function MappingWorkspace({
  sampleData,
  sampleHeaders,
  catalogMappings,
  detailMappings,
  activeView,
  catalogFields,
  detailFields,
  onUpdateCatalogMappings,
  onUpdateDetailMappings,
  onToggleView,
  onAutoMap,
  onSave,
  onBack,
  templateInfo,
  onPullSftpSample
}: MappingWorkspaceProps) {
  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [collapseUnmapped, setCollapseUnmapped] = useState(false);
  const [rowsToShow, setRowsToShow] = useState(25);
  const [enhancedView, setEnhancedView] = useState(true);
  
  // Reference for the data preview table for scrolling
  const previewTableRef = useRef<HTMLDivElement>(null);
  
  // Get current mappings and fields based on active view
  const currentMappings = activeView === 'catalog' ? catalogMappings || [] : detailMappings || [];
  const currentFields = activeView === 'catalog' ? catalogFields || [] : detailFields || [];
  
  // Stats
  const mappedFields = currentMappings?.filter(m => m?.sourceField && m?.targetField) || [];
  const requiredFields = currentFields?.filter(f => f?.required) || [];
  const mappedRequiredFields = requiredFields?.filter(rf => 
    currentMappings?.some(m => m?.targetField === rf?.id && m?.sourceField)
  ) || [];
  const unmappedRequiredFields = requiredFields?.filter(rf => 
    !currentMappings?.some(m => m?.targetField === rf?.id && m?.sourceField)
  ) || [];
  
  // Group detail fields by section for organized preview
  const detailFieldsBySection = detailFields.reduce((acc, field: any) => {
    const section = field.section || 'other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Get section names and icons for display
  const sectionIcons: Record<string, React.ReactNode> = {
    'overview': <FileText className="w-4 h-4" />,
    'specifications': <Database className="w-4 h-4" />,
    'gallery': <Image className="w-4 h-4" />,
    'supplier': <Truck className="w-4 h-4" />,
    'related': <Layers className="w-4 h-4" />,
    'seo': <Tag className="w-4 h-4" />,
    'custom': <Plus className="w-4 h-4" />,
    'other': <InfoIcon className="w-4 h-4" />
  };
  
  // Jump to field in sample data preview
  const scrollToField = (fieldName: string) => {
    if (!previewTableRef.current || !fieldName) return;
    
    const headerCells = previewTableRef.current.querySelectorAll('th');
    let targetIndex = -1;
    
    headerCells.forEach((cell, index) => {
      if (cell.textContent === fieldName) {
        targetIndex = index;
      }
    });
    
    if (targetIndex >= 0) {
      const targetCell = headerCells[targetIndex];
      const tableContainer = previewTableRef.current;
      
      if (targetCell) {
        tableContainer.scrollLeft = targetCell.offsetLeft - tableContainer.offsetWidth / 4;
      }
    }
  };

  // Function to update a mapping
  const updateMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    if (activeView === 'catalog') {
      const updatedMappings = [...catalogMappings];
      updatedMappings[index][field] = value;
      onUpdateCatalogMappings(updatedMappings);
    } else {
      const updatedMappings = [...detailMappings];
      updatedMappings[index][field] = value;
      onUpdateDetailMappings(updatedMappings);
    }
  };
  
  // Function to add a new mapping
  const addMapping = () => {
    if (activeView === 'catalog') {
      const updatedMappings = [...catalogMappings, { sourceField: "", targetField: "" }];
      onUpdateCatalogMappings(updatedMappings);
    } else {
      const updatedMappings = [...detailMappings, { sourceField: "", targetField: "" }];
      onUpdateDetailMappings(updatedMappings);
    }
  };
  
  // Function to remove a mapping
  const removeMapping = (index: number) => {
    if (activeView === 'catalog') {
      const updatedMappings = [...catalogMappings];
      updatedMappings.splice(index, 1);
      onUpdateCatalogMappings(updatedMappings);
    } else {
      const updatedMappings = [...detailMappings];
      updatedMappings.splice(index, 1);
      onUpdateDetailMappings(updatedMappings);
    }
  };
  
  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    if (activeView === 'catalog') {
      const items = Array.from(catalogMappings);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      onUpdateCatalogMappings(items);
    } else {
      const items = Array.from(detailMappings);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      onUpdateDetailMappings(items);
    }
  };

  // Filter mappings based on search and other filters
  const getFilteredMappings = () => {
    return (currentMappings || []).filter(mapping => {
      if (!mapping) return false;
      
      // If showing only mapped fields, filter out unmapped ones
      if (showOnlyMapped && (!mapping.sourceField || !mapping.targetField)) {
        return false;
      }
      
      // If collapsing unmapped fields and this is unmapped, filter it out
      if (collapseUnmapped && (!mapping.sourceField || !mapping.targetField)) {
        return false;
      }
      
      // Filter by search term
      if (searchTerm) {
        const sourceMatch = mapping.sourceField?.toLowerCase().includes(searchTerm.toLowerCase());
        const targetField = (currentFields || []).find(tf => tf?.id === mapping.targetField);
        const targetMatch = targetField?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return sourceMatch || targetMatch;
      }
      
      return true;
    });
  };

  // Generate live mapping preview
  const generateMappingPreview = () => {
    if (!sampleData || sampleData.length === 0) return [];
    
    // Create a lookup from target field ID to source field
    const mappingLookup = (currentMappings || []).reduce((acc, mapping) => {
      if (mapping?.sourceField && mapping?.targetField) {
        acc[mapping.targetField] = mapping.sourceField;
      }
      return acc;
    }, {} as Record<string, string>);
    
    // Get the first row of data for preview
    const firstRow = sampleData[0] || {};
    
    // Generate preview data for mapped fields
    return Object.entries(mappingLookup).map(([targetId, sourceField]) => {
      const targetField = (currentFields || []).find(tf => tf?.id === targetId);
      return {
        targetField,
        sourceField,
        sampleValue: firstRow[sourceField],
        section: (targetField as any)?.section || 'other'
      };
    });
  };
  
  // Generate a formatted PDP preview
  const generatePdpPreview = () => {
    if (activeView !== 'detail' || !sampleData || sampleData.length === 0) return null;
    
    // Create a mapping lookup from field ID to sample value
    const mappingLookup = {} as Record<string, any>;
    
    // Fill in mapped values from first row of sample data
    const firstRow = sampleData[0] || {};
    (detailMappings || []).forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingLookup[mapping.targetField] = firstRow[mapping.sourceField];
      }
    });
    
    // Return sections and values for the PDP preview
    return Object.entries(detailFieldsBySection).map(([section, fields]) => {
      const fieldsWithValues = fields.map(field => ({
        ...field,
        value: mappingLookup[field.id] || null,
        isMapped: !!mappingLookup[field.id]
      }));
      
      return {
        section,
        fields: fieldsWithValues,
        mappedCount: fieldsWithValues.filter(f => f.isMapped).length
      };
    }).filter(section => section.mappedCount > 0);
  };
  
  // Get filtered mappings and preview data
  const filteredMappings = getFilteredMappings();
  const displayData = sampleData?.slice(0, rowsToShow) || [];
  const mappingPreview = generateMappingPreview();
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={onBack} 
            className="text-sm h-8"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-semibold ml-2">
            {templateInfo.name ? `Edit: ${templateInfo.name}` : 'Create Mapping Template'}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          {onPullSftpSample && (
            <Button variant="outline" size="sm" onClick={onPullSftpSample}>
              Pull Sample From SFTP
            </Button>
          )}
          <Button onClick={onSave} className="bg-blue-500 hover:bg-blue-600">
            Save Template
          </Button>
        </div>
      </div>
      
      {/* Control bar */}
      <div className="flex flex-col gap-2 bg-slate-50 border-b">
        <div className="flex items-center gap-4 p-3">
          {/* View toggle - Master Catalog vs PDP */}
          <div className="flex-shrink-0">
            <div className="bg-white rounded-lg border shadow-sm flex items-center">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeView === 'catalog' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => onToggleView('catalog')}
              >
                <Database className="w-4 h-4 mr-2" />
                Master Catalog
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeView === 'detail' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => onToggleView('detail')}
              >
                <Monitor className="w-4 h-4 mr-2" />
                Product Detail Page
              </button>
            </div>
          </div>
          
          <Separator orientation="vertical" className="h-8" />
          
          <div className="flex items-center gap-2">
            <Switch 
              id="show-mapped" 
              checked={showOnlyMapped}
              onCheckedChange={setShowOnlyMapped}
            />
            <Label htmlFor="show-mapped" className="text-sm font-medium">
              Show only mapped fields
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="collapse-unmapped" 
              checked={collapseUnmapped}
              onCheckedChange={setCollapseUnmapped}
            />
            <Label htmlFor="collapse-unmapped" className="text-sm font-medium">
              Collapse unmapped fields
            </Label>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAutoMap}
            className="ml-auto"
          >
            Auto-Map Fields
          </Button>
        </div>
        
        {/* View information */}
        <div className="px-3 pb-3 flex items-center">
          <div className="flex-1">
            {activeView === 'catalog' ? (
              <p className="text-sm text-gray-500">
                <span className="font-medium">Master Catalog View:</span> Map fields to the master catalog database fields.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                <span className="font-medium">Product Detail Page View:</span> Map fields that will appear on the PDP for customers.
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Progress:</span>
            <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="text-sm text-gray-600">{progress}%</span>
          </div>
        </div>
      </div>
      
      {/* Main workspace */}
      <div className="flex flex-grow overflow-hidden">
        {/* Left pane - Field mappings */}
        <div className="w-[40%] border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-white flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h2 className="font-medium text-sm">Field Mappings</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50">
                  {mappedFields.length}/{currentMappings.length} mapped
                </Badge>
                <Badge 
                  variant={mappedRequiredFields.length === requiredFields.length ? "outline" : "destructive"} 
                  className={mappedRequiredFields.length === requiredFields.length ? "bg-green-50" : ""}
                >
                  {mappedRequiredFields.length}/{requiredFields.length} required
                </Badge>
              </div>
            </div>
            
            {/* View Selector Tabs */}
            <div className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="catalog" 
                  className={activeView === 'catalog' ? 'bg-blue-100' : ''}
                  onClick={() => onToggleView('catalog')}
                >
                  Master Catalog
                </TabsTrigger>
                <TabsTrigger 
                  value="detail" 
                  className={activeView === 'detail' ? 'bg-blue-100' : ''}
                  onClick={() => onToggleView('detail')}
                >
                  Product Detail
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          
          {/* Mappings area */}
          <div className="overflow-auto flex-grow">
            {/* Search and filter */}
            <div className="p-3 border-b">
              <div className="relative">
                <Input
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
            </div>
            
            {/* Mapping list */}
            <div className="p-3 space-y-2">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="mappings">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {filteredMappings.map((mapping, index) => {
                        const targetField = currentFields.find(tf => tf.id === mapping.targetField);
                        
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
                                  p-3 rounded border bg-white
                                  ${snapshot.isDragging ? 'shadow-md' : ''}
                                  ${mapping.sourceField === hoveredField ? 'border-blue-300' : ''}
                                  ${mapping.sourceField === selectedField ? 'border-blue-500 bg-blue-50' : ''}
                                  ${targetField?.required && !mapping.sourceField ? 'border-orange-300 bg-orange-50' : ''}
                                `}
                                onMouseEnter={() => setHoveredField(mapping.sourceField)}
                                onMouseLeave={() => setHoveredField(null)}
                                onClick={() => {
                                  setSelectedField(mapping.sourceField);
                                  scrollToField(mapping.sourceField);
                                }}
                              >
                                <div className="flex flex-col space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium flex items-center gap-1">
                                      {targetField?.required && (
                                        <span className="text-red-500">*</span>
                                      )}
                                      Field Mapping
                                    </div>
                                    <div className="flex items-center gap-1 cursor-grab text-gray-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <polyline points="19 12 12 19 5 12"></polyline>
                                      </svg>
                                    </div>
                                  </div>
                                
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs text-gray-500 mb-1 block">
                                        Source Field
                                      </Label>
                                      <Select
                                        value={mapping.sourceField || "select_source"}
                                        onValueChange={(val) => updateMapping(
                                          index, 
                                          'sourceField', 
                                          val === "select_source" ? "" : val
                                        )}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select source field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="select_source">
                                            Select source field
                                          </SelectItem>
                                          {sampleHeaders.map(header => (
                                            <SelectItem key={header} value={header}>
                                              {header}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
                                    <div>
                                      <Label className="text-xs text-gray-500 mb-1 block">
                                        Target Field
                                      </Label>
                                      <Select
                                        value={mapping.targetField || "select_target"}
                                        onValueChange={(val) => updateMapping(
                                          index, 
                                          'targetField', 
                                          val === "select_target" ? "" : val
                                        )}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select target field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="select_target">
                                            Select target field
                                          </SelectItem>
                                          {currentFields.map(field => (
                                            <SelectItem key={field.id} value={field.id}>
                                              {field.name}
                                              {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  
                                  {/* Sample value preview */}
                                  {mapping.sourceField && sampleData.length > 0 && (
                                    <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                                      <div className="font-medium mb-1">Sample Value:</div>
                                      <div className="font-mono overflow-x-auto whitespace-nowrap">
                                        {String(sampleData[0][mapping.sourceField] || "(empty)")}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Field description */}
                                  {targetField?.description && (
                                    <div className="mt-1 text-xs text-gray-500 flex items-start gap-1">
                                      <InfoIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      <span>{targetField.description}</span>
                                    </div>
                                  )}
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
              
              <Button 
                variant="outline" 
                className="w-full mt-2 text-sm"
                onClick={addMapping}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Field Mapping
              </Button>
            </div>
            
            {/* Unmapped required fields warning */}
            {unmappedRequiredFields.length > 0 && (
              <Alert variant="destructive" className="mx-3 mb-3">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertTitle>Required fields not mapped</AlertTitle>
                <AlertDescription>
                  The following required fields are not mapped:
                  <ul className="mt-1 ml-5 list-disc">
                    {unmappedRequiredFields.map(field => (
                      <li key={field.id}>{field.name}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
        
        {/* Right pane - Sample data preview */}
        <div className="w-[60%] flex flex-col overflow-hidden">
          {/* Sample data header */}
          <div className="p-3 bg-white border-b flex justify-between items-center">
            <h2 className="font-medium text-sm">Sample Data Preview</h2>
            <div className="flex items-center gap-3">
              <Tabs defaultValue="enhanced" className="h-8">
                <TabsList className="h-7">
                  <TabsTrigger 
                    value="enhanced" 
                    className="px-3 py-0 text-xs h-6"
                    onClick={() => setEnhancedView(true)}
                  >
                    Enhanced
                  </TabsTrigger>
                  <TabsTrigger 
                    value="simple" 
                    className="px-3 py-0 text-xs h-6"
                    onClick={() => setEnhancedView(false)}
                  >
                    Simple
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex items-center text-sm">
                <span className="mr-1">Show</span>
                <Select
                  value={rowsToShow.toString()}
                  onValueChange={(val) => setRowsToShow(Number(val))}
                >
                  <SelectTrigger className="h-7 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="ml-1">rows</span>
              </div>
            </div>
          </div>
          
          {/* Sample data table */}
          <div 
            className="flex-grow overflow-auto px-3 py-2"
            ref={previewTableRef}
          >
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="p-2 border font-medium text-left text-xs text-gray-500">
                    #
                  </th>
                  {sampleHeaders.map(header => (
                    <th 
                      key={header} 
                      className={`
                        p-2 border font-medium text-left text-xs text-gray-500 whitespace-nowrap
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
                    <td className="p-2 border text-gray-500 text-xs">
                      {rowIndex + 1}
                    </td>
                    {sampleHeaders.map(header => (
                      <td 
                        key={`${rowIndex}-${header}`} 
                        className={`
                          p-2 border text-sm truncate max-w-[200px]
                          ${header === hoveredField ? 'bg-blue-50' : ''} 
                          ${header === selectedField ? 'bg-blue-100' : ''}
                        `}
                        onMouseEnter={() => setHoveredField(header)}
                        onMouseLeave={() => setHoveredField(null)}
                        onClick={() => {
                          setSelectedField(header);
                          
                          // Find if this field is already mapped
                          const existingMapping = currentMappings?.find(m => m?.sourceField === header);
                          if (!existingMapping) {
                            // Add a new mapping for this field
                            if (activeView === 'catalog') {
                              const newMappings = [...(catalogMappings || []), { sourceField: header, targetField: "" }];
                              onUpdateCatalogMappings(newMappings);
                            } else {
                              const newMappings = [...(detailMappings || []), { sourceField: header, targetField: "" }];
                              onUpdateDetailMappings(newMappings);
                            }
                          }
                        }}
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
          
          {/* Live mapping preview */}
          {mappingPreview.length > 0 && (
            <div className="p-3 border-t">
              <h3 className="text-xs font-medium mb-2">Live Mapping Preview</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-1 font-medium text-left">Target Field</th>
                      <th className="border p-1 font-medium text-left">Sample Value</th>
                      <th className="border p-1 font-medium text-left">Source Field</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingPreview.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border p-1 font-medium">
                          {item.targetField?.name}
                          {item.targetField?.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="border p-1 max-w-[200px] truncate font-mono">
                          {item.sampleValue !== undefined && item.sampleValue !== null 
                            ? String(item.sampleValue)
                            : <span className="text-gray-400 italic">null</span>
                          }
                        </td>
                        <td className="border p-1 text-gray-600">
                          {item.sourceField}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}