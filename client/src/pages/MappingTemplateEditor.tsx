import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Upload, Download, Save } from "lucide-react";
import MappingWorkspace from "@/components/mapping/MappingWorkspace";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface MappingTemplate {
  id: number;
  name: string;
  description: string | null;
  sourceType: string;
  mappings: Record<string, string>;
  validationRules: any[];
  supplierId?: number | null;
  fileLabel?: string | null;
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
}

export default function MappingTemplateEditor() {
  const [_, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : null;
  const isEdit = !!id;
  
  // Basic state
  const [activeTab, setActiveTab] = useState<string>("info");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  
  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    sourceType: "csv",
    supplierId: "",
    fileLabel: ""
  });
  
  // Sample data and mapping state
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { sourceField: "", targetField: "" }
  ]);
  
  // Target fields definition
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
  
  // Fetch template if editing
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/mapping-templates', id],
    enabled: !!id,
    select: (data: any) => data as MappingTemplate
  });
  
  // Initialize form data when template is loaded for editing
  useEffect(() => {
    if (templateData && isEdit) {
      setTemplateForm({
        name: templateData.name,
        description: templateData.description || "",
        sourceType: templateData.sourceType,
        supplierId: templateData.supplierId ? String(templateData.supplierId) : "",
        fileLabel: templateData.fileLabel || ""
      });
      
      // Convert mappings to field mappings array
      const mappingsArray = Object.entries(templateData.mappings).map(
        ([targetField, sourceField]) => ({
          sourceField: sourceField as string,
          targetField
        })
      );
      
      setFieldMappings(mappingsArray.length > 0 ? mappingsArray : [{ sourceField: "", targetField: "" }]);
      
      // If supplier is set and source type is SFTP, fetch remote paths
      if (templateData.supplierId && templateData.sourceType === 'sftp') {
        fetchRemotePaths(templateData.supplierId);
      }
    }
  }, [templateData, isEdit]);
  
  // Handle form field changes 
  const handleTemplateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTemplateForm({ ...templateForm, [name]: value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setTemplateForm({ ...templateForm, [name]: value });
    
    // If supplier changed, reset remote paths and fetch new ones if needed
    if (name === 'supplierId') {
      // Clear remote paths when supplier changes
      setRemotePaths([]);
      setSelectedPath('');
      
      if (value && templateForm.sourceType === 'sftp') {
        fetchRemotePaths(parseInt(value));
      }
    }
    
    // If source type changed to SFTP, fetch remote paths for the selected supplier
    if (name === 'sourceType' && value === 'sftp' && templateForm.supplierId) {
      setRemotePaths([]);
      setSelectedPath('');
      fetchRemotePaths(parseInt(templateForm.supplierId));
    }
  };
  
  // State for remote paths
  const [remotePaths, setRemotePaths] = useState<string[]>([]);

  // Fetch remote paths for SFTP sources
  const fetchRemotePaths = async (supplierId: number) => {
    try {
      // Find the data source for this supplier
      const supplierDataSource = dataSources.find(ds => ds.supplierId === supplierId && ds.type === 'sftp');
      
      if (supplierDataSource) {
        // Try to get configured paths directly from the data source
        const configuredPaths: string[] = [];
        
        // Check if data source has config with remote_paths
        if (supplierDataSource.config && typeof supplierDataSource.config === 'object') {
          const config = supplierDataSource.config as any;
          
          // Get paths from remote_paths array
          if (Array.isArray(config.remote_paths)) {
            config.remote_paths.forEach((pathObj: any) => {
              if (pathObj.path) configuredPaths.push(pathObj.path);
            });
          }
          
          // Also check for a single path
          if (config.path && typeof config.path === 'string') {
            configuredPaths.push(config.path);
          }
        }
        
        // If we found configured paths, use them
        if (configuredPaths.length > 0) {
          console.log("Using configured paths:", configuredPaths);
          setRemotePaths(configuredPaths);
          
          // Set selected path if we have a fileLabel or use the first path
          if (templateForm.fileLabel) {
            setSelectedPath(templateForm.fileLabel);
          } else if (configuredPaths.length > 0) {
            setSelectedPath(configuredPaths[0]);
          }
        } 
        // Otherwise try to fetch paths from the server
        else {
          const response = await fetch(`/api/data-sources/${supplierDataSource.id}/remote-paths`);
          if (response.ok) {
            const data = await response.json();
            console.log("Remote paths:", data);
            
            if (data.paths && Array.isArray(data.paths)) {
              // Extract paths from the response
              const paths = data.paths.map((item: any) => 
                typeof item === 'string' ? item : item.path || ''
              ).filter(Boolean);
              
              setRemotePaths(paths);
              
              // Set selected path if we have a fileLabel or use the first path
              if (templateForm.fileLabel) {
                setSelectedPath(templateForm.fileLabel);
              } else if (paths.length > 0) {
                setSelectedPath(paths[0]);
              }
            }
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
      setActiveTab("mapping");
      
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
  
  // Pull SFTP sample data
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
      setActiveTab("mapping");
      
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
  
  // Save the mapping template
  const handleSaveTemplate = async () => {
    // Validation
    if (!templateForm.name) {
      toast({
        title: "Validation error",
        description: "Template name is required",
        variant: "destructive"
      });
      setActiveTab("info");
      return;
    }
    
    // Convert field mappings to mappings record
    const mappings: Record<string, string> = {};
    fieldMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappings[mapping.targetField] = mapping.sourceField;
      }
    });
    
    if (Object.keys(mappings).length === 0) {
      toast({
        title: "Validation error",
        description: "At least one field mapping is required",
        variant: "destructive"
      });
      setActiveTab("mapping");
      return;
    }
    
    try {
      const templateData = {
        name: templateForm.name,
        description: templateForm.description,
        sourceType: templateForm.sourceType,
        mappings,
        supplierId: templateForm.supplierId ? parseInt(templateForm.supplierId) : null,
        fileLabel: templateForm.fileLabel || null,
        validationRules: []
      };
      
      if (isEdit) {
        // Update existing template
        await apiRequest('PUT', `/api/mapping-templates/${id}`, templateData);
        
        toast({
          title: "Success",
          description: "Mapping template updated successfully"
        });
      } else {
        // Create new template
        await apiRequest('POST', '/api/mapping-templates', templateData);
        
        toast({
          title: "Success",
          description: "Mapping template created successfully"
        });
      }
      
      // Invalidate queries and navigate back to templates list
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      navigate('/mapping-templates');
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save mapping template",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/mapping-templates")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
          <h1 className="text-2xl font-bold">
            {isEdit ? `Edit Template: ${templateForm.name}` : "Create Mapping Template"}
          </h1>
        </div>
        <Button onClick={handleSaveTemplate}>
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="info">Template Info</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
        </TabsList>
        
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={templateForm.name}
                      onChange={handleTemplateFormChange}
                      placeholder="Enter template name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sourceType">Source Type</Label>
                    <Select
                      value={templateForm.sourceType}
                      onValueChange={(value) => handleSelectChange("sourceType", value)}
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplierId">Supplier (Optional)</Label>
                    <Select
                      value={templateForm.supplierId}
                      onValueChange={(value) => handleSelectChange("supplierId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {suppliers.map((supplier: Supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fileLabel">File Path/Label (Optional)</Label>
                    
                    {/* When SFTP is selected and we have remote paths, show dropdown */}
                    {templateForm.sourceType === 'sftp' && remotePaths.length > 0 ? (
                      <Select
                        value={templateForm.fileLabel || ''}
                        onValueChange={(value) => {
                          setTemplateForm(prev => ({ ...prev, fileLabel: value }));
                          setSelectedPath(value); // Keep both in sync
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a remote file" />
                        </SelectTrigger>
                        <SelectContent>
                          {remotePaths.map((path) => (
                            <SelectItem key={path} value={path}>
                              {path}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Regular input for other source types
                      <Input
                        id="fileLabel"
                        name="fileLabel"
                        value={templateForm.fileLabel}
                        onChange={handleTemplateFormChange}
                        placeholder="Enter file path or label"
                      />
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={templateForm.description}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter template description"
                    rows={4}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-6">
                <Button variant="outline" type="button" onClick={() => setActiveTab("mapping")}>
                  Continue to Field Mapping
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Load Sample Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* File upload option */}
                <div className="flex gap-4">
                  <label htmlFor="sampleFile" className="cursor-pointer">
                    <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
                      <Upload className="h-4 w-4" />
                      <span>Upload Sample File</span>
                    </div>
                    <input
                      type="file"
                      id="sampleFile"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".csv,.xls,.xlsx,.json"
                      disabled={isUploading}
                    />
                  </label>
                </div>
                
                {/* SFTP options - always show this section */}
                <div className="mt-2 border rounded-md p-4">
                  <h3 className="font-medium mb-2">SFTP Options</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2">
                      <Label>Remote File Path</Label>
                      {remotePaths.length > 0 ? (
                        <div className="space-y-2">
                          <Select
                            value={selectedPath}
                            onValueChange={setSelectedPath}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a remote file" />
                            </SelectTrigger>
                            <SelectContent>
                              {remotePaths.map((path) => (
                                <SelectItem key={path} value={path}>
                                  {path}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex justify-end">
                            <Button 
                              onClick={() => {
                                const supplierId = templateForm.supplierId 
                                  ? parseInt(templateForm.supplierId) 
                                  : suppliers.length > 0 ? suppliers[0].id : null;
                                  
                                if (supplierId) {
                                  handlePullSftpSampleData(supplierId);
                                } else {
                                  toast({
                                    title: "No supplier selected",
                                    description: "Please select a supplier to pull SFTP data",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              disabled={isUploading || !selectedPath}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Pull Sample
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="/path/to/data.csv" 
                              value={selectedPath}
                              onChange={(e) => setSelectedPath(e.target.value)}
                            />
                            <Button 
                              onClick={() => {
                                const supplierId = templateForm.supplierId 
                                  ? parseInt(templateForm.supplierId) 
                                  : suppliers.length > 0 ? suppliers[0].id : null;
                                  
                                if (supplierId) {
                                  handlePullSftpSampleData(supplierId);
                                } else {
                                  toast({
                                    title: "No supplier selected",
                                    description: "Please select a supplier to pull SFTP data",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              disabled={isUploading || !selectedPath}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Pull Sample
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {templateForm.supplierId ? 
                              "No remote paths found. Enter a path manually." : 
                              "Select a supplier to view available remote paths."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Sample data status message */}
                {isUploading && (
                  <div className="mt-2">
                    <p className="text-sm text-blue-600">
                      Loading sample data...
                    </p>
                  </div>
                )}
                
                {sampleData.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-green-600 mb-2">
                      ✓ Loaded {sampleData.length} records with {sampleHeaders.length} fields
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("mapping")}
                    >
                      Proceed to Mapping
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mapping" className="h-[calc(100vh-220px)]">
          {sampleData.length > 0 ? (
            <MappingWorkspace
              sampleData={sampleData}
              sampleHeaders={sampleHeaders}
              fieldMappings={fieldMappings}
              targetFields={targetFields}
              onUpdateMappings={setFieldMappings}
              onAutoMap={() => {
                const autoMappings = autoMapFields(sampleHeaders);
                setFieldMappings(autoMappings);
              }}
              onSave={handleSaveTemplate}
              onBack={() => setActiveTab("info")}
              templateInfo={{
                name: templateForm.name,
                supplierName: suppliers.find(s => s.id === parseInt(templateForm.supplierId))?.name
              }}
              onPullSftpSample={
                templateForm.sourceType === 'sftp' && templateForm.supplierId
                  ? () => handlePullSftpSampleData(parseInt(templateForm.supplierId))
                  : undefined
              }
            />
          ) : (
            <div className="p-8 text-center h-full flex flex-col items-center justify-center">
              <div className="mb-4 text-muted-foreground">
                <Upload className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-lg font-medium">No sample data loaded</p>
                <p className="text-sm">
                  Please upload a sample file or pull data from SFTP to map fields
                </p>
              </div>
              <div className="flex gap-4 mt-4">
                <label htmlFor="mappingSampleFile" className="cursor-pointer">
                  <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
                    <Upload className="h-4 w-4" />
                    <span>Upload Sample File</span>
                  </div>
                  <input
                    type="file"
                    id="mappingSampleFile"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".csv,.xls,.xlsx,.json"
                    disabled={isUploading}
                  />
                </label>
                
                {templateForm.supplierId && templateForm.sourceType === 'sftp' && (
                  <Button 
                    onClick={() => handlePullSftpSampleData(parseInt(templateForm.supplierId!))}
                    disabled={isUploading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Pull Sample From SFTP
                  </Button>
                )}
                
                <Button variant="outline" onClick={() => setActiveTab("info")}>
                  Back to Template Info
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}