import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Save, ArrowLeftRight, PanelLeftOpen, PanelRightOpen, Download, Upload, FileUp, Plus, Trash, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Define interfaces for our data structures
interface MappingTemplate {
  id: number;
  name: string;
  description: string | null;
  sourceType: string;
  mappings: Record<string, string>;
  transformations: any[];
  validationRules: ValidationRule[];
  createdAt: Date | null;
  updatedAt: Date | null;
  supplierId?: number | null;
  fileLabel?: string | null;
}

interface ValidationRule {
  field: string;
  rule: string;
  params?: any;
}

interface Supplier {
  id: number;
  name: string;
  code: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  active: boolean;
}

interface DataSource {
  id: number;
  name: string;
  type: string;
  active: boolean | null;
  supplierId: number | null;
  config: any;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

export default function MappingTemplateWorkspace() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const templateId = params.id ? parseInt(params.id) : null;
  const isEditMode = Boolean(templateId);
  
  // States for the form
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    id: 0,
    name: "",
    description: "",
    sourceType: "csv",
    mappings: {} as Record<string, string>,
    transformations: [] as any[],
    validationRules: [] as ValidationRule[],
    supplierId: null as number | null,
    fileLabel: null as string | null
  });
  
  // Sample data states
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([{ sourceField: "", targetField: "" }]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  
  // List of target fields for product mapping
  const targetFields = [
    { id: "sku", name: "SKU", required: true },
    { id: "product_name", name: "Product Name", required: true },
    { id: "description", name: "Description" },
    { id: "category", name: "Category" },
    { id: "manufacturer", name: "Manufacturer" },
    { id: "upc", name: "UPC" },
    { id: "mpn", name: "MPN" },
    { id: "price", name: "Price" },
    { id: "cost", name: "Cost" },
    { id: "weight", name: "Weight" },
    { id: "status", name: "Status" },
    { id: "stock_quantity", name: "Stock Quantity" },
    { id: "attributes", name: "Attributes" },
    { id: "images", name: "Images" }
  ];
  
  // Get all suppliers and data sources
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });
  
  const { data: dataSources = [] } = useQuery<DataSource[]>({
    queryKey: ['/api/data-sources'],
  });
  
  // Load template data if in edit mode
  useEffect(() => {
    if (isEditMode && templateId) {
      loadTemplateData(templateId);
    }
  }, [isEditMode, templateId]);
  
  // Convert mappings object to field mappings array when template is loaded
  useEffect(() => {
    if (templateForm.mappings && Object.keys(templateForm.mappings).length > 0) {
      const mappings = Object.entries(templateForm.mappings).map(([sourceField, targetField]) => ({
        sourceField,
        targetField: targetField as string
      }));
      
      setFieldMappings(mappings.length > 0 ? mappings : [{ sourceField: "", targetField: "" }]);
    }
  }, [templateForm.mappings]);
  
  // Function to load template data
  const loadTemplateData = async (id: number) => {
    try {
      const response = await fetch(`/api/mapping-templates/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load template");
      }
      
      const templateData = await response.json();
      setTemplateForm({
        id: templateData.id,
        name: templateData.name || "",
        description: templateData.description || "",
        sourceType: templateData.sourceType || "csv",
        mappings: templateData.mappings || {},
        transformations: templateData.transformations || [],
        validationRules: templateData.validationRules || [],
        supplierId: templateData.supplierId,
        fileLabel: templateData.fileLabel
      });
      
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        variant: "destructive",
        title: "Failed to load template",
        description: "There was an error loading the template. Please try again."
      });
    }
  };
  
  // Function to handle file upload for sample data
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadedFileName(file.name);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('config_json', JSON.stringify({
        has_header: true,
        delimiter: ",",
        encoding: "utf-8"
      }));
      
      const response = await fetch(`/api/sample-data-upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const data = await response.json();
      
      if (data.success && data.sample_data && data.sample_data.length > 0) {
        setSampleData(data.sample_data);
        setSampleHeaders(Object.keys(data.sample_data[0]));
        
        // Auto-map fields if headers match target fields
        const autoMappings = autoMapFields(Object.keys(data.sample_data[0]));
        if (autoMappings.length > 0) {
          setFieldMappings(autoMappings);
        }
        
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Sample Data",
          description: "Failed to parse sample data from the file."
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "There was an error uploading the file."
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Function to auto-map fields based on similar names
  const autoMapFields = (headers: string[]) => {
    const mappings: FieldMapping[] = [];
    const targetFieldMap = new Map(targetFields.map(field => [field.id.toLowerCase(), field.id]));
    
    // Create mappings for exact matches and close matches
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().replace(/[_-]/g, '');
      
      // Try exact match first
      if (targetFieldMap.has(normalizedHeader)) {
        mappings.push({
          sourceField: header,
          targetField: targetFieldMap.get(normalizedHeader)!
        });
        return;
      }
      
      // Try contains match
      for (const [targetKey, targetValue] of targetFieldMap.entries()) {
        if (normalizedHeader.includes(targetKey) || targetKey.includes(normalizedHeader)) {
          mappings.push({
            sourceField: header,
            targetField: targetValue
          });
          return;
        }
      }
    });
    
    // Add any unmapped source fields
    const mappedSourceFields = new Set(mappings.map(m => m.sourceField));
    headers.forEach(header => {
      if (!mappedSourceFields.has(header)) {
        mappings.push({
          sourceField: header,
          targetField: ""
        });
      }
    });
    
    return mappings;
  };
  
  // Function to pull sample data from SFTP
  const handlePullSftpSampleData = async (supplierId: number) => {
    if (!supplierId) {
      toast({
        variant: "destructive",
        title: "Supplier Required",
        description: "Please select a supplier first"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // First find the data source for this supplier
      const dataSource = dataSources.find(ds => ds.supplierId === supplierId && ds.type === "sftp");
      
      if (!dataSource) {
        toast({
          variant: "destructive",
          title: "No SFTP Data Source",
          description: "No SFTP data source found for this supplier"
        });
        return;
      }
      
      const response = await fetch(`/api/data-sources/${dataSource.id}/test-pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Failed to pull sample data');
      }
      
      const data = await response.json();
      
      if (data.success && data.sample_data && data.sample_data.length > 0) {
        setSampleData(data.sample_data);
        setSampleHeaders(Object.keys(data.sample_data[0]));
        setUploadedFileName(data.file_name || "sftp-sample.csv");
        
        // Auto-map fields if headers match target fields
        const autoMappings = autoMapFields(Object.keys(data.sample_data[0]));
        if (autoMappings.length > 0) {
          setFieldMappings(autoMappings);
        }
        
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Sample Data",
          description: data.message || "Failed to parse sample data from SFTP."
        });
      }
    } catch (error) {
      console.error('Error pulling SFTP data:', error);
      toast({
        variant: "destructive",
        title: "Pull Failed",
        description: "There was an error pulling data from SFTP."
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Function to update field mapping
  const updateFieldMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index][field] = value;
    setFieldMappings(newMappings);
  };
  
  // Function to add a new mapping row
  const addMappingRow = () => {
    setFieldMappings([...fieldMappings, { sourceField: "", targetField: "" }]);
  };
  
  // Function to remove a mapping row
  const removeMappingRow = (index: number) => {
    if (fieldMappings.length <= 1) return;
    const newMappings = fieldMappings.filter((_, i) => i !== index);
    setFieldMappings(newMappings);
  };
  
  // Convert field mappings to mappings object
  const getTemplatePayload = () => {
    // Convert field mappings array to mappings object
    const mappings: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappings[mapping.sourceField] = mapping.targetField;
      }
    });
    
    // Generate validation rules based on required fields
    const validationRules = targetFields
      .filter(field => field.required && Object.values(mappings).includes(field.id))
      .map(field => ({
        field: field.id,
        rule: "required"
      }));
    
    return {
      ...templateForm,
      mappings,
      validationRules
    };
  };
  
  // Save the template
  const saveTemplate = async () => {
    // Validate form
    if (!templateForm.name) {
      toast({
        variant: "destructive",
        title: "Name Required",
        description: "Please provide a name for the template."
      });
      return;
    }
    
    const payload = getTemplatePayload();
    setIsLoading(true);
    
    try {
      if (isEditMode) {
        // Update existing template
        await apiRequest(`/api/mapping-templates/${templateId}`, {
          method: 'PATCH',
          data: payload
        });
        
        toast({
          title: "Template Updated",
          description: "The template was updated successfully."
        });
      } else {
        // Create new template
        await apiRequest('/api/mapping-templates', {
          method: 'POST',
          data: payload
        });
        
        toast({
          title: "Template Created",
          description: "The template was created successfully."
        });
      }
      
      // Invalidate mapping templates query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      
      // Redirect back to the templates list
      navigate('/mapping-templates');
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "There was an error saving the template."
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get supplier name from supplier ID
  const getSupplierName = (supplierId: number | null) => {
    if (!supplierId) return "None";
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : "Unknown";
  };
  
  // Get unmapped required fields (for validation warning)
  const getUnmappedRequiredFields = () => {
    const mappedTargetFields = fieldMappings
      .filter(m => m.targetField)
      .map(m => m.targetField);
    
    return targetFields
      .filter(field => field.required && !mappedTargetFields.includes(field.id))
      .map(field => field.name);
  };
  
  // Filter field mappings based on showOnlyMapped setting
  const filteredFieldMappings = showOnlyMapped 
    ? fieldMappings.filter(m => m.sourceField && m.targetField)
    : fieldMappings;
  
  // Determine max preview rows based on expanded state
  const maxPreviewRows = expandedPreview ? 15 : 5;
  
  return (
    <div className="container py-4">
      <div className="flex items-center mb-6">
        <Button variant="outline" onClick={() => navigate('/mapping-templates')} className="mr-2">
          <ChevronLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">{isEditMode ? 'Edit' : 'Create'} Mapping Template</h1>
      </div>
      
      <div className="grid gap-6">
        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="general">General Information</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <Button
                disabled={isLoading} 
                onClick={saveTemplate}
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
          
          {/* General Information Tab */}
          <TabsContent value="general" className="mt-4">
            <Card>
              <CardContent className="py-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Template Name *</Label>
                      <Input 
                        id="name" 
                        value={templateForm.name} 
                        onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="sourceType">Source Type</Label>
                      <Select 
                        value={templateForm.sourceType} 
                        onValueChange={(value) => setTemplateForm({...templateForm, sourceType: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                          <SelectItem value="xml">XML</SelectItem>
                          <SelectItem value="sftp">SFTP</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                      id="description" 
                      value={templateForm.description} 
                      onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="supplier">Associated Supplier</Label>
                      <Select 
                        value={templateForm.supplierId?.toString() || ""}
                        onValueChange={(value) => setTemplateForm({
                          ...templateForm, 
                          supplierId: value ? parseInt(value) : null
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="fileLabel">File Label</Label>
                      <Input 
                        id="fileLabel" 
                        value={templateForm.fileLabel || ""} 
                        onChange={(e) => setTemplateForm({
                          ...templateForm, 
                          fileLabel: e.target.value || null
                        })}
                        placeholder="e.g., Inventory, Pricing, Products"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Field Mapping Tab */}
          <TabsContent value="mapping" className="mt-4">
            <div className="flex flex-col space-y-4">
              <Card>
                <CardContent className="py-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setShowSidebar(!showSidebar)}>
                        {showSidebar ? <PanelLeftOpen className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        {showSidebar ? "Hide Sidebar" : "Show Sidebar"}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => setExpandedPreview(!expandedPreview)}
                      >
                        {expandedPreview ? "Collapse Preview" : "Expand Preview"}
                      </Button>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Switch
                          id="show-mapped"
                          checked={showOnlyMapped}
                          onCheckedChange={setShowOnlyMapped}
                          className="ml-4"
                        />
                        <Label htmlFor="show-mapped">Show only mapped fields</Label>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {templateForm.sourceType === 'sftp' && templateForm.supplierId ? (
                        <Button 
                          variant="outline" 
                          onClick={() => handlePullSftpSampleData(templateForm.supplierId!)}
                          disabled={isUploading}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {isUploading ? "Loading..." : "Pull Sample From SFTP"}
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()} disabled={isUploading}>
                          <FileUp className="h-4 w-4 mr-2" />
                          {isUploading ? "Uploading..." : "Upload Sample File"}
                        </Button>
                      )}
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".csv,.xlsx,.xls,.json,.xml"
                        disabled={isUploading}
                      />
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (sampleHeaders.length > 0) {
                            const autoMappings = autoMapFields(sampleHeaders);
                            setFieldMappings(autoMappings);
                            toast({
                              title: "Auto-mapping Complete",
                              description: "Fields have been automatically mapped where possible"
                            });
                          }
                        }}
                        disabled={!sampleHeaders.length}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Auto-Map Fields
                      </Button>
                    </div>
                  </div>
                    
                  {uploadedFileName && (
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className="px-2 py-1">
                        Sample: {uploadedFileName}
                      </Badge>
                      
                      {templateForm.supplierId && (
                        <Badge variant="outline" className="px-2 py-1">
                          Supplier: {getSupplierName(templateForm.supplierId)}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="grid gap-6" style={{ gridTemplateColumns: showSidebar ? "350px 1fr" : "1fr" }}>
                    {/* Field Mapping Panel */}
                    {showSidebar && (
                      <div className="border rounded-md p-4 bg-slate-50">
                        <div className="font-medium mb-4 flex justify-between items-center">
                          <span>Field Mappings</span>
                          <Badge variant="outline" className="ml-2 bg-blue-50">
                            {fieldMappings.filter(m => m.sourceField && m.targetField).length} of {fieldMappings.length} mapped
                          </Badge>
                        </div>
                        
                        <div className="space-y-3 max-h-[650px] overflow-y-auto pr-2">
                          {filteredFieldMappings.map((mapping, index) => (
                            <div key={index} className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 bg-white p-2 rounded border">
                              <div>
                                <Select 
                                  value={mapping.sourceField}
                                  onValueChange={(value) => updateFieldMapping(index, 'sourceField', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Source Field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sampleHeaders.map((header) => (
                                      <SelectItem key={header} value={header}>
                                        {header}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                {mapping.sourceField && sampleData.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">
                                    Sample: {sampleData[0][mapping.sourceField] || "N/A"}
                                  </div>
                                )}
                              </div>
                              
                              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                              
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Select 
                                    value={mapping.targetField}
                                    onValueChange={(value) => updateFieldMapping(index, 'targetField', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Target Field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetFields.map((field) => (
                                        <SelectItem key={field.id} value={field.id}>
                                          {field.name}{field.required ? " *" : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeMappingRow(index)}
                                  disabled={fieldMappings.length <= 1}
                                  className="text-destructive"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          <Button variant="outline" onClick={addMappingRow} className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Add Mapping
                          </Button>
                        </div>
                        
                        {/* Show warning for required fields */}
                        {getUnmappedRequiredFields().length > 0 && (
                          <div className="mt-4 p-2 border border-yellow-300 bg-yellow-50 rounded-md">
                            <p className="text-sm font-medium text-yellow-800">Required fields not mapped:</p>
                            <ul className="text-sm text-yellow-700 list-disc list-inside">
                              {getUnmappedRequiredFields().map((field) => (
                                <li key={field}>{field}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Sample Data Preview */}
                    <div className="border rounded-md overflow-hidden">
                      {sampleData.length > 0 ? (
                        <div>
                          <div className="bg-slate-100 p-3 font-medium border-b flex justify-between items-center">
                            <span>Sample Data Preview</span>
                            <span className="text-xs text-muted-foreground">
                              Showing {Math.min(maxPreviewRows, sampleData.length)} of {sampleData.length} rows
                            </span>
                          </div>
                          
                          <div className="overflow-x-auto" style={{ maxHeight: expandedPreview ? '650px' : '350px' }}>
                            <table className="w-full">
                              <thead className="sticky top-0 bg-white border-b">
                                <tr>
                                  {sampleHeaders.map((header, i) => (
                                    <th key={i} className="text-left p-2 text-sm font-medium text-slate-700 whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="flex items-center gap-1">
                                          {header}
                                          {fieldMappings.some(m => m.sourceField === header && m.targetField) && (
                                            <Badge variant="secondary" className="ml-1 text-xs">
                                              {targetFields.find(f => f.id === fieldMappings.find(m => m.sourceField === header)?.targetField)?.name || "Mapped"}
                                            </Badge>
                                          )}
                                        </span>
                                        <span className="text-xs text-slate-500 font-normal">
                                          {sampleData[0] && typeof sampleData[0][header] === 'number' ? 'Number' : 
                                           sampleData[0] && sampleData[0][header] instanceof Date ? 'Date' : 'Text'}
                                        </span>
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sampleData.slice(0, maxPreviewRows).map((row, rowIndex) => (
                                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    {sampleHeaders.map((header, colIndex) => (
                                      <td key={colIndex} className="p-2 text-sm border-b border-r last:border-r-0 font-mono">
                                        {row[header] === null || row[header] === undefined 
                                          ? <span className="text-slate-400 italic">null</span> 
                                          : String(row[header])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {!expandedPreview && sampleData.length > maxPreviewRows && (
                            <div className="p-2 text-center border-t">
                              <Button variant="ghost" size="sm" onClick={() => setExpandedPreview(true)}>
                                Show More Rows
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p className="font-medium">No sample data available</p>
                          <p className="text-sm mt-1">Upload a sample file or pull data from SFTP to begin mapping</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Validation Rules Tab */}
          <TabsContent value="validation" className="mt-4">
            <Card>
              <CardContent className="py-4">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Validation Rules</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Rules are auto-generated based on field mappings. Required fields will be automatically validated.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {targetFields.filter(field => field.required).map((field) => (
                    <div key={field.id} className="flex items-center p-2 border rounded bg-slate-50">
                      <div className="flex-1">
                        <p className="font-medium">{field.name}</p>
                        <p className="text-sm text-muted-foreground">Validation: Required</p>
                      </div>
                      <Badge variant="secondary">
                        {fieldMappings.some(m => m.targetField === field.id) ? "Mapped" : "Not mapped"}
                      </Badge>
                    </div>
                  ))}
                  
                  {!targetFields.some(field => field.required) && (
                    <div className="text-center p-4 text-muted-foreground">
                      No validation rules have been configured.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}