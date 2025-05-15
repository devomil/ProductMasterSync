import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Save, ArrowLeftRight, PanelLeftOpen, PanelRightOpen, Download, Upload, FileUp, Plus, Trash, Wand2, ArrowDown, Minimize, Maximize, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MappingTemplate from "@/components/mapping/MappingTemplate";

// Mapping template component handles its own view toggle

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
  fileLabel?: string;
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
  const [_, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : null;
  const isEdit = !!id;
  
  // State for form
  const [templateForm, setTemplateForm] = useState<Partial<MappingTemplate>>({
    name: "",
    description: "",
    sourceType: "csv",
    mappings: {},
    transformations: [],
    validationRules: [],
    supplierId: null,
    fileLabel: ""
  });
  
  // State for sample data and mapping
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([{ sourceField: "", targetField: "" }]);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [collapseUnmapped, setCollapseUnmapped] = useState(false);
  const [selectedTab, setSelectedTab] = useState("info");
  const [isUploading, setIsUploading] = useState(false);
  const [rowCount, setRowCount] = useState(20);
  const [remotePaths, setRemotePaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  
  // List of all possible target fields for the mapping
  const targetFields = [
    { id: "sku", name: "SKU", required: true, description: "Unique product identifier" },
    { id: "product_name", name: "Product Name", required: true, description: "Full product name/title" },
    { id: "description", name: "Description", description: "Detailed product description" },
    { id: "manufacturer", name: "Manufacturer", description: "Product manufacturer/brand name" },
    { id: "mpn", name: "Manufacturer Part Number", description: "Manufacturer's part number" },
    { id: "category", name: "Category", description: "Product category" },
    { id: "subcategory", name: "Subcategory", description: "Product subcategory" },
    { id: "price", name: "Price", description: "Retail price" },
    { id: "cost", name: "Cost", description: "Wholesale cost" },
    { id: "upc", name: "UPC", description: "Universal Product Code" },
    { id: "ean", name: "EAN", description: "European Article Number" },
    { id: "isbn", name: "ISBN", description: "International Standard Book Number" },
    { id: "weight", name: "Weight", description: "Product weight" },
    { id: "weight_unit", name: "Weight Unit", description: "Unit of weight (lb, kg, etc)" },
    { id: "length", name: "Length", description: "Product length" },
    { id: "width", name: "Width", description: "Product width" },
    { id: "height", name: "Height", description: "Product height" },
    { id: "dimension_unit", name: "Dimension Unit", description: "Unit of dimensions (in, cm, etc)" },
    { id: "color", name: "Color", description: "Product color" },
    { id: "size", name: "Size", description: "Product size" },
    { id: "material", name: "Material", description: "Product material" },
    { id: "condition", name: "Condition", description: "Product condition (new, used, etc)" },
    { id: "status", name: "Status", description: "Product status (active, discontinued, etc)" },
    { id: "stock_quantity", name: "Stock Quantity", description: "Available inventory quantity" },
    { id: "min_order_quantity", name: "Min Order Quantity", description: "Minimum order quantity" },
    { id: "lead_time", name: "Lead Time", description: "Production or shipping lead time" },
    { id: "is_taxable", name: "Is Taxable", description: "Whether product is taxable" },
    { id: "tax_code", name: "Tax Code", description: "Tax classification code" },
    { id: "image_url", name: "Image URL", description: "Primary product image URL" },
    { id: "additional_image_urls", name: "Additional Image URLs", description: "Additional product image URLs (comma separated)" },
    { id: "warranty", name: "Warranty", description: "Product warranty information" },
    { id: "country_of_origin", name: "Country of Origin", description: "Country where product was manufactured" },
    { id: "keywords", name: "Keywords", description: "Search keywords/tags" },
    { id: "related_products", name: "Related Products", description: "Related product SKUs (comma separated)" },
    { id: "custom_field_1", name: "Custom Field 1", description: "Custom field for additional data" },
    { id: "custom_field_2", name: "Custom Field 2", description: "Custom field for additional data" },
    { id: "custom_field_3", name: "Custom Field 3", description: "Custom field for additional data" },
  ];
  
  // Fetch suppliers for the dropdown
  const { data: suppliers = [] } = useQuery({ 
    queryKey: ['/api/suppliers'],
    select: (data: any) => data as Supplier[]
  });
  
  // Fetch data sources
  const { data: dataSources = [] } = useQuery({ 
    queryKey: ['/api/data-sources'],
    select: (data: any) => data as DataSource[]
  });
  
  // Fetch template by ID if editing
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/mapping-templates', id],
    enabled: !!id,
    staleTime: Infinity,
    select: (data: any) => data as MappingTemplate
  });
  
  // Initialize form data when template is loaded
  useEffect(() => {
    if (templateData && isEdit) {
      setTemplateForm({
        ...templateData,
        // Convert to Date objects if needed
        createdAt: templateData.createdAt ? new Date(templateData.createdAt) : null,
        updatedAt: templateData.updatedAt ? new Date(templateData.updatedAt) : null,
      });
      
      // Convert mappings to field mappings array
      const mappingsArray = Object.entries(templateData.mappings).map(
        ([targetField, sourceField]) => ({
          sourceField: sourceField as string,
          targetField
        })
      );
      
      setFieldMappings(mappingsArray.length > 0 ? mappingsArray : [{ sourceField: "", targetField: "" }]);
      
      // If supplier is set and source type is SFTP, get remote paths
      if (templateData.supplierId && templateData.sourceType === 'sftp') {
        fetchRemotePaths(templateData.supplierId);
      }
    }
  }, [templateData, isEdit]);
  
  // Fetch remote paths for SFTP sources
  const fetchRemotePaths = async (supplierId: number) => {
    try {
      // Find the data source for this supplier
      const supplierDataSource = dataSources.find(ds => ds.supplierId === supplierId && ds.type === 'sftp');
      
      if (supplierDataSource) {
        const response = await fetch(`/api/data-sources/${supplierDataSource.id}/remote-paths`);
        if (response.ok) {
          const data = await response.json();
          setRemotePaths(data.paths || []);
          // If we have a fileLabel already set, select it
          if (templateForm.fileLabel) {
            setSelectedPath(templateForm.fileLabel);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching remote paths:", error);
      toast({
        title: "Error",
        description: "Failed to fetch remote file paths. Please check the SFTP connection.",
        variant: "destructive"
      });
    }
  };
  
  // Handle pulling SFTP sample data
  const handlePullSftpSampleData = async (supplierId: number) => {
    if (!selectedPath) {
      toast({
        title: "No file selected",
        description: "Please select a remote file path first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Find the data source for this supplier
      const supplierDataSource = dataSources.find(ds => ds.supplierId === supplierId && ds.type === 'sftp');
      
      if (!supplierDataSource) {
        throw new Error("No SFTP data source found for this supplier");
      }
      
      const fileConfig = {
        path: selectedPath,
        format: templateForm.sourceType || 'csv'
      };
      
      const response = await fetch(`/api/data-sources/${supplierDataSource.id}/pull-sample`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fileConfig)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pull sample data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.sample_data || data.sample_data.length === 0) {
        throw new Error("No data found in the selected file");
      }
      
      // Update state with sample data
      setSampleData(data.sample_data);
      setSampleHeaders(Object.keys(data.sample_data[0]));
      setTemplateForm(prev => ({
        ...prev,
        fileLabel: selectedPath
      }));
      
      // Generate initial mappings if none exist
      if (fieldMappings.length <= 1 && (!fieldMappings[0].sourceField || !fieldMappings[0].targetField)) {
        const autoMappings = autoMapFields(Object.keys(data.sample_data[0]));
        setFieldMappings(autoMappings);
      }
      
      // Auto-switch to the mapping tab
      setSelectedTab("mapping");
      
      toast({
        title: "Sample data loaded",
        description: `Loaded ${data.sample_data.length} rows of data from ${selectedPath}`,
      });
    } catch (error) {
      console.error("Error pulling sample data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to pull sample data",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };
  
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
      
      // Check for partial matches - iterate through entries safely
      const entries = Array.from(targetFieldMap.entries());
      for (const [targetKey, targetId] of entries) {
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
  
  // Handle file upload for sample data
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config_json', JSON.stringify({ 
      type: templateForm.sourceType || 'csv'
    }));
    
    try {
      const response = await fetch('/api/upload-sample', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setSampleData(data.sample_data);
      setSampleHeaders(Object.keys(data.sample_data[0]));
      
      // Generate initial mappings if none exist
      if (fieldMappings.length <= 1 && (!fieldMappings[0].sourceField || !fieldMappings[0].targetField)) {
        const autoMappings = autoMapFields(Object.keys(data.sample_data[0]));
        setFieldMappings(autoMappings);
      }
      
      // Auto-switch to the mapping tab
      setSelectedTab("mapping");
      
      toast({
        title: "File uploaded",
        description: `Uploaded ${file.name} and loaded ${data.sample_data.length} rows`,
      });
      
      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload and process file",
        variant: "destructive"
      });
      
      // Reset file input
      e.target.value = '';
    } finally {
      setIsUploading(false);
    }
  };
  
  // Save mapping template
  const handleSaveTemplate = async () => {
    // Validation
    if (!templateForm.name) {
      toast({
        title: "Validation error",
        description: "Template name is required",
        variant: "destructive"
      });
      return;
    }
    
    // Convert field mappings to mappings record
    const mappings: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappings[mapping.targetField] = mapping.sourceField;
      }
    });
    
    // Create validation rules for required fields
    const validationRules = targetFields
      .filter(field => field.required && Object.keys(mappings).includes(field.id))
      .map(field => ({ 
        field: field.id, 
        rule: "required" 
      }));
    
    const saveData = {
      ...templateForm,
      mappings,
      validationRules,
    };
    
    try {
      const url = isEdit 
        ? `/api/mapping-templates/${id}` 
        : '/api/mapping-templates';
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      });
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }
      
      const savedTemplate = await response.json();
      
      toast({
        title: "Success",
        description: isEdit 
          ? "Mapping template updated successfully" 
          : "Mapping template created successfully",
      });
      
      // Invalidate queries and redirect
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      navigate('/mapping-templates');
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save mapping template",
        variant: "destructive"
      });
    }
  };
  
  // Handle form field changes
  const handleInputChange = (field: string, value: any) => {
    setTemplateForm(prev => ({ ...prev, [field]: value }));
    
    // Special handling for supplierId changes
    if (field === 'supplierId' && value && templateForm.sourceType === 'sftp') {
      fetchRemotePaths(value);
    }
    
    // Special handling for sourceType changes
    if (field === 'sourceType' && value === 'sftp' && templateForm.supplierId) {
      fetchRemotePaths(templateForm.supplierId);
    }
  };
  
  return (
    <div className="container py-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/mapping-templates">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Mapping Templates
          </Link>
        </Button>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Mapping Template" : "Create Mapping Template"}
        </h1>
        
        <Button onClick={handleSaveTemplate}>
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
      </div>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="info">Template Info</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
        </TabsList>
        
        {/* Template Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={templateForm.name || ""}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label htmlFor="source-type">Source Type</Label>
                  <Select
                    value={templateForm.sourceType || ""}
                    onValueChange={(value) => handleInputChange("sourceType", value)}
                  >
                    <SelectTrigger id="source-type">
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                      <SelectItem value="sftp">SFTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label htmlFor="supplier">Supplier (Optional)</Label>
                  <Select
                    value={templateForm.supplierId?.toString() || "none"}
                    onValueChange={(value) => handleInputChange("supplierId", value && value !== "none" ? parseInt(value) : null)}
                  >
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {templateForm.sourceType === 'sftp' && templateForm.supplierId && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="file-path">Remote File Path</Label>
                    <Select
                      value={selectedPath}
                      onValueChange={setSelectedPath}
                    >
                      <SelectTrigger id="file-path">
                        <SelectValue placeholder="Select file path" />
                      </SelectTrigger>
                      <SelectContent>
                        {remotePaths.length > 0 ? (
                          remotePaths.map((path, index) => (
                            <SelectItem key={index} value={path}>
                              {path}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_files" disabled>
                            No files found. Check SFTP connection.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={templateForm.description || ""}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter a description for this template"
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Field Mapping Tab */}
        <TabsContent value="mapping" className="mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setExpandedPreview(!expandedPreview)}
                  >
                    {expandedPreview ? 
                      <><Minimize className="h-4 w-4 mr-2" /> Exit Fullscreen</> : 
                      <><Maximize className="h-4 w-4 mr-2" /> Fullscreen Mode</>
                    }
                  </Button>
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
                </div>
              </div>

              {/* Mapping interface */}
              {sampleData.length > 0 ? (
                <MappingTemplate
                  sampleData={sampleData}
                  sampleHeaders={sampleHeaders}
                  fieldMappings={fieldMappings}
                  targetFields={targetFields}
                  onUpdateMappings={setFieldMappings}
                  templateInfo={{
                    name: templateForm.name,
                    sourceType: templateForm.sourceType,
                    supplierName: suppliers.find(s => s.id === templateForm.supplierId)?.name,
                    filePath: templateForm.fileLabel || ""
                  }}
                  onPullSftpSample={
                    templateForm.sourceType === 'sftp' && templateForm.supplierId
                      ? () => handlePullSftpSampleData(templateForm.supplierId!)
                      : undefined
                  }
                  rowsLimit={rowCount}
                  onChangeRowsLimit={setRowCount}
                />
              ) : (
                <div className="p-8 text-center">
                  <div className="mb-4 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-lg font-medium">No sample data loaded</p>
                    <p className="text-sm">
                      Upload a sample file or pull data from SFTP to map fields
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}