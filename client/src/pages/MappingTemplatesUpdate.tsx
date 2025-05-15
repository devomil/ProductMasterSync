import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash, FileUp, Download, Upload } from "lucide-react";
import { useDataSourceActions } from "../hooks/useDataSourceActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ValidationRule } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
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

interface Supplier {
  id: number;
  name: string;
  code: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  active: boolean;
}

interface RemotePathItem {
  path: string;
  label?: string;
  type?: 'file' | 'directory';
  fileType?: string;
}

interface DataSource {
  id: number;
  name: string;
  type: "csv" | "excel" | "json" | "xml" | "edi_x12" | "edifact" | "api" | "sftp" | "ftp" | "manual";
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

// Using ValidationRule interface from shared schema

// Available target fields (internal schema fields)
const AVAILABLE_TARGET_FIELDS = [
  { id: "sku", name: "SKU", required: true, type: "string", description: "Unique product identifier" },
  { id: "name", name: "Product Name", required: true, type: "string", description: "Primary product name" },
  { id: "description", name: "Description", required: false, type: "string", description: "Detailed product description" },
  { id: "manufacturerPartNumber", name: "Manufacturer Part Number", required: false, type: "string", description: "Manufacturer's part number" },
  { id: "upc", name: "UPC", required: false, type: "string", description: "Universal Product Code" },
  { id: "price", name: "Price", required: false, type: "float", description: "Retail price", defaultValue: "0.00" },
  { id: "cost", name: "Cost", required: false, type: "float", description: "Product cost", defaultValue: "0.00" },
  { id: "weight", name: "Weight", required: false, type: "float", description: "Product weight", defaultValue: "0.00" },
  { id: "dimensions", name: "Dimensions", required: false, type: "string", description: "Product dimensions (LxWxH)" },
  { id: "manufacturerName", name: "Manufacturer Name", required: false, type: "string", description: "Name of manufacturer" },
  { id: "status", name: "Status", required: false, type: "string", description: "Product status (active, inactive, etc.)", defaultValue: "active" },
  { id: "categoryId", name: "Category ID", required: false, type: "integer", description: "ID of product category" },
  { id: "inventoryQuantity", name: "Inventory Quantity", required: false, type: "integer", description: "Current stock quantity", defaultValue: "0" },
  { id: "isRemanufactured", name: "Is Remanufactured", required: false, type: "boolean", description: "Whether product is remanufactured", defaultValue: "false" },
  { id: "isCloseout", name: "Is Closeout", required: false, type: "boolean", description: "Whether product is closeout", defaultValue: "false" },
  { id: "isOnSale", name: "Is On Sale", required: false, type: "boolean", description: "Whether product is on sale", defaultValue: "false" },
  { id: "hasFreeShipping", name: "Has Free Shipping", required: false, type: "boolean", description: "Whether product has free shipping", defaultValue: "false" },
  { id: "hasRebate", name: "Has Rebate", required: false, type: "boolean", description: "Whether product has a rebate", defaultValue: "false" },
];

export default function MappingTemplatesUpdate() {
  // State for template list
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showProcessSftpDialog, setShowProcessSftpDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MappingTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [isValidationViewOpen, setIsValidationViewOpen] = useState(false);
  const [selectedRemotePath, setSelectedRemotePath] = useState("");
  const [deleteAfterProcessing, setDeleteAfterProcessing] = useState(false);
  
  // Get data source actions hook
  const { handleProcessSftpIngestion, isProcessingIngestion } = useDataSourceActions();

  // State for template form
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    sourceType: "csv",
    supplierId: "",
    fileLabel: "",
    mappings: {} as Record<string, string>,
    validationRules: [] as ValidationRule[]
  });

  // State for field mapping
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { sourceField: "", targetField: "" }
  ]);

  // State for file upload
  const [sampleData, setSampleData] = useState<any[] | null>(null);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Queries
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/mapping-templates'],
    select: (data) => data || []
  });

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/suppliers'],
    select: (data) => data || []
  });

  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ['/api/data-sources'],
    select: (data) => data || []
  });

  // Functions to handle form state
  const handleTemplateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTemplateForm({ ...templateForm, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === "supplierId" && value === "none") {
      setTemplateForm({ ...templateForm, [name]: "" });
    } else {
      setTemplateForm({ ...templateForm, [name]: value });
    }
  };

  // Add a new field mapping row
  const addMappingRow = () => {
    setFieldMappings([...fieldMappings, { sourceField: "", targetField: "" }]);
  };

  // Generate validation rules based on target field properties
  const generateValidationRules = (targetField: string): ValidationRule[] => {
    const fieldConfig = AVAILABLE_TARGET_FIELDS.find(field => field.id === targetField);
    
    if (!fieldConfig) return [];
    
    const rules: ValidationRule[] = [];
    
    // Required field validation
    if (fieldConfig.required) {
      rules.push({
        field: targetField,
        type: "required",
        message: `${fieldConfig.name} is required`,
        errorLevel: "error"
      });
    }
    
    // Type validation
    rules.push({
      field: targetField,
      type: "type",
      value: fieldConfig.type,
      message: `${fieldConfig.name} must be a valid ${fieldConfig.type}`,
      errorLevel: fieldConfig.required ? "error" : "warning",
      defaultValue: fieldConfig.defaultValue
    });
    
    // Default value rule for optional fields
    if (!fieldConfig.required && fieldConfig.defaultValue !== undefined) {
      rules.push({
        field: targetField,
        type: "custom",
        value: "setDefaultIfMissing",
        message: `Using default value (${fieldConfig.defaultValue}) for ${fieldConfig.name} if not provided`,
        errorLevel: "warning",
        defaultValue: fieldConfig.defaultValue
      });
    }
    
    return rules;
  };

  // Update a field mapping
  const updateFieldMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index][field] = value;
    setFieldMappings(newMappings);
    
    // If we're changing the target field, generate validation rules
    let updatedValidationRules = [...templateForm.validationRules];
    if (field === 'targetField' && value) {
      // Remove existing rules for this target field
      updatedValidationRules = updatedValidationRules.filter(
        rule => rule.field !== value
      );
      
      // Add new rules
      updatedValidationRules = [
        ...updatedValidationRules,
        ...generateValidationRules(value)
      ];
    }
    
    // Update the mappings object
    const mappingsObject: Record<string, string> = {};
    newMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        mappingsObject[mapping.sourceField] = mapping.targetField;
      }
    });
    
    setTemplateForm({ 
      ...templateForm, 
      mappings: mappingsObject,
      validationRules: updatedValidationRules
    });
  };

  // Remove a field mapping row
  const removeMappingRow = (index: number) => {
    if (fieldMappings.length > 1) {
      const newMappings = fieldMappings.filter((_, i) => i !== index);
      setFieldMappings(newMappings);
      
      // Update the mappings object
      const mappingsObject: Record<string, string> = {};
      newMappings.forEach(mapping => {
        if (mapping.sourceField && mapping.targetField) {
          mappingsObject[mapping.sourceField] = mapping.targetField;
        }
      });
      setTemplateForm({ ...templateForm, mappings: mappingsObject });
    }
  };

  // Reset form
  const resetForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      sourceType: "csv",
      supplierId: "",
      fileLabel: "",
      mappings: {},
      validationRules: []
    });
    setFieldMappings([{ sourceField: "", targetField: "" }]);
    setSampleData(null);
    setSampleHeaders([]);
    setUploadedFileName("");
  };
  
  // Find data source for a template
  const findDataSourceForTemplate = (template: MappingTemplate) => {
    if (!template.supplierId) return null;
    
    return dataSources.find((ds: DataSource) => 
      ds.supplierId === template.supplierId && ds.type === 'sftp'
    );
  };
  
  // Handle processing SFTP ingestion
  const handleProcessSftp = async () => {
    if (!selectedTemplate) return;
    
    const dataSource = findDataSourceForTemplate(selectedTemplate);
    if (!dataSource) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No SFTP data source found for this template's supplier"
      });
      return;
    }
    
    try {
      setIsProcessingIngestion(true);
      const result = await handleProcessSftpIngestion(
        dataSource,
        selectedTemplate.id,
        selectedRemotePath,
        deleteAfterProcessing
      );
      
      setShowProcessSftpDialog(false);
      
      // Invalidate imports cache to show the new import
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      
      // The toast is already shown in handleProcessSftpIngestion
    } catch (error) {
      console.error("Error processing SFTP ingestion:", error);
      // Error toast is already shown in handleProcessSftpIngestion
    } finally {
      setIsProcessingIngestion(false);
    }
  };

  // Handle file upload for sample data
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadedFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/mapping-templates/sample-upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      
      if (data.success) {
        setSampleData(data.records.slice(0, 10)); // Show first 10 records
        setSampleHeaders(data.headers || []);
        
        // Auto-populate source fields if we have headers
        if (data.headers && data.headers.length) {
          const initialMappings = data.headers.map((header: string) => ({
            sourceField: header,
            targetField: ""
          }));
          setFieldMappings(initialMappings);
        }
        
        toast({
          title: "File Uploaded",
          description: `Successfully processed ${data.records.length} records from ${file.name}`
        });
      } else {
        toast({
          variant: "destructive",
          title: "Upload Error",
          description: data.message || "Failed to process file"
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Create a new template
  const handleCreateTemplate = async () => {
    try {
      // Validate form
      if (!templateForm.name) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Template name is required"
        });
        return;
      }

      if (Object.keys(templateForm.mappings).length === 0) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "At least one field mapping is required"
        });
        return;
      }

      // Prepare data for submission
      const templateData = {
        name: templateForm.name,
        description: templateForm.description,
        sourceType: templateForm.sourceType,
        mappings: templateForm.mappings,
        transformations: [],
        validationRules: templateForm.validationRules,
        supplierId: templateForm.supplierId && templateForm.supplierId !== "none" ? parseInt(templateForm.supplierId) : null,
        fileLabel: templateForm.fileLabel || null
      };

      const response = await apiRequest('/api/mapping-templates', {
        method: 'POST',
        data: templateData
      });

      if (response) {
        toast({
          title: "Template Created",
          description: "Mapping template has been created successfully"
        });
        setIsCreateDialogOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create template"
      });
    }
  };

  // Update an existing template
  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      // Validate form
      if (!templateForm.name) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Template name is required"
        });
        return;
      }

      if (Object.keys(templateForm.mappings).length === 0) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "At least one field mapping is required"
        });
        return;
      }

      // Prepare data for submission
      const templateData = {
        name: templateForm.name,
        description: templateForm.description,
        sourceType: templateForm.sourceType,
        mappings: templateForm.mappings,
        transformations: [],
        validationRules: templateForm.validationRules,
        supplierId: templateForm.supplierId && templateForm.supplierId !== "none" ? parseInt(templateForm.supplierId) : null,
        fileLabel: templateForm.fileLabel || null
      };

      const response = await apiRequest(`/api/mapping-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        data: templateData
      });

      if (response) {
        toast({
          title: "Template Updated",
          description: "Mapping template has been updated successfully"
        });
        setIsEditDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      }
    } catch (error) {
      console.error("Error updating template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update template"
      });
    }
  };

  // Delete a template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await apiRequest(`/api/mapping-templates/${selectedTemplate.id}`, {
        method: 'DELETE'
      });

      if (response) {
        toast({
          title: "Template Deleted",
          description: "Mapping template has been deleted successfully"
        });
        setIsDeleteDialogOpen(false);
        setSelectedTemplate(null);
        queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete template"
      });
    }
  };

  // Handle edit template button click
  const handleEditTemplate = (template: MappingTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      sourceType: template.sourceType,
      supplierId: template.supplierId ? template.supplierId.toString() : "",
      fileLabel: template.fileLabel || "",
      mappings: template.mappings,
      validationRules: template.validationRules || []
    });
    
    // Convert mappings to field mapping array
    const newFieldMappings: FieldMapping[] = [];
    Object.entries(template.mappings).forEach(([sourceField, targetField]) => {
      newFieldMappings.push({ sourceField, targetField });
    });
    
    if (newFieldMappings.length === 0) {
      newFieldMappings.push({ sourceField: "", targetField: "" });
    }
    
    setFieldMappings(newFieldMappings);
    setIsEditDialogOpen(true);
  };

  // Filter templates by source type
  const filteredTemplates = templates.filter((template: MappingTemplate) => {
    if (activeTab === 'all') return true;
    return template.sourceType === activeTab;
  });

  // Used to select the tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mapping Templates</h1>
          <p className="text-muted-foreground">
            Manage your data mapping templates for various data sources
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Template
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="excel">Excel</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="xml">XML</TabsTrigger>
          <TabsTrigger value="sftp">SFTP</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="p-6">
              {isLoadingTemplates ? (
                <div className="flex justify-center p-6">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div>
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No mapping templates found.</p>
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="mt-4"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create Template
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Source Type</TableHead>
                          <TableHead>Fields</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTemplates.map((template: MappingTemplate) => {
                          const supplier = suppliers.find((s: Supplier) => s.id === template.supplierId);
                          return (
                            <TableRow key={template.id}>
                              <TableCell className="font-medium">{template.name}</TableCell>
                              <TableCell>{template.sourceType}</TableCell>
                              <TableCell>{Object.keys(template.mappings).length}</TableCell>
                              <TableCell>
                                {supplier ? supplier.name : 'Any Supplier'}
                              </TableCell>
                              <TableCell>
                                {template.updatedAt 
                                  ? new Date(template.updatedAt).toLocaleDateString() 
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTemplate(template)}
                                >
                                  <Edit className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash className="h-4 w-4 mr-1" /> Delete
                                </Button>
                                {template.sourceType === 'sftp' && supplier && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTemplate(template);
                                      setShowProcessSftpDialog(true);
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-1" /> Process SFTP
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Mapping Template</DialogTitle>
            <DialogDescription>
              Define how source data fields map to your internal schema fields.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={templateForm.name}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter template name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={templateForm.description}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter template description"
                    rows={3}
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
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="sftp">SFTP</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierId">Supplier (Optional)</Label>
                  <Select 
                    value={templateForm.supplierId} 
                    onValueChange={(value) => handleSelectChange("supplierId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Supplier</SelectItem>
                      {suppliers.map((supplier: Supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fileLabel">File Label (Optional)</Label>
                  <Input
                    id="fileLabel"
                    name="fileLabel"
                    value={templateForm.fileLabel}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter label for this file type"
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps identify the purpose of this template, e.g., "Product Catalog", "Inventory", etc.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="mapping" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Field Mappings</h3>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                      <FileUp className="h-4 w-4 mr-2" />
                      {isUploading ? "Uploading..." : "Upload Sample File"}
                    </Button>
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
                
                {uploadedFileName && (
                  <div className="text-sm text-muted-foreground mb-2">
                    Sample file: {uploadedFileName}
                  </div>
                )}
                
                {sampleData && sampleData.length > 0 && (
                  <div className="border rounded-md overflow-x-auto mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(sampleData[0]).map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleData.map((row, index) => (
                          <TableRow key={index}>
                            {Object.values(row).map((value: any, i) => (
                              <TableCell key={i}>{value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <div className="space-y-2">
                  {fieldMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Select 
                        value={mapping.sourceField}
                        onValueChange={(value) => updateFieldMapping(index, 'sourceField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Source Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {sampleHeaders.length > 0 ? (
                            sampleHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              Upload a sample file or enter manually
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      
                      <span>→</span>
                      
                      <Select 
                        value={mapping.targetField}
                        onValueChange={(value) => updateFieldMapping(index, 'targetField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Target Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_TARGET_FIELDS.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}{field.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMappingRow(index)}
                        disabled={fieldMappings.length <= 1}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button variant="outline" onClick={addMappingRow}>
                    <Plus className="h-4 w-4 mr-2" /> Add Mapping
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="validation" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Validation Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Rules are auto-generated based on field mappings
                  </p>
                </div>
                
                {templateForm.validationRules.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p>No validation rules defined yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Rules will be created automatically when you map fields.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {templateForm.validationRules.map((rule, index) => (
                        <div key={index} className="border rounded-md p-3 bg-card">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {AVAILABLE_TARGET_FIELDS.find(f => f.id === rule.field)?.name || rule.field}
                            </div>
                            <div className="flex items-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                rule.errorLevel === 'error' 
                                  ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {rule.errorLevel === 'error' ? 'Required' : 'Warning'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-sm">
                            {rule.message}
                          </div>
                          {rule.defaultValue !== undefined && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Default: {rule.defaultValue}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Mapping Template</DialogTitle>
            <DialogDescription>
              Update your mapping template settings.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Template Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={templateForm.name}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter template name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (Optional)</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    value={templateForm.description}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter template description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-sourceType">Source Type</Label>
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
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="sftp">SFTP</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-supplierId">Supplier (Optional)</Label>
                  <Select 
                    value={templateForm.supplierId} 
                    onValueChange={(value) => handleSelectChange("supplierId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Supplier</SelectItem>
                      {suppliers.map((supplier: Supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-fileLabel">File Label (Optional)</Label>
                  <Input
                    id="edit-fileLabel"
                    name="fileLabel"
                    value={templateForm.fileLabel || ""}
                    onChange={handleTemplateFormChange}
                    placeholder="Enter label for this file type"
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps identify the purpose of this template, e.g., "Product Catalog", "Inventory", etc.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="mapping" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Field Mappings</h3>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={() => document.getElementById('edit-file-upload')?.click()}>
                      <FileUp className="h-4 w-4 mr-2" />
                      {isUploading ? "Uploading..." : "Upload Sample File"}
                    </Button>
                    <input
                      id="edit-file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".csv,.xlsx,.xls,.json,.xml"
                      disabled={isUploading}
                    />
                  </div>
                </div>
                
                {uploadedFileName && (
                  <div className="text-sm text-muted-foreground mb-2">
                    Sample file: {uploadedFileName}
                  </div>
                )}
                
                {sampleData && sampleData.length > 0 && (
                  <div className="border rounded-md overflow-x-auto mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(sampleData[0]).map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleData.map((row, index) => (
                          <TableRow key={index}>
                            {Object.values(row).map((value: any, i) => (
                              <TableCell key={i}>{value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <div className="space-y-2">
                  {fieldMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={mapping.sourceField}
                        onChange={(e) => updateFieldMapping(index, 'sourceField', e.target.value)}
                        placeholder="Source Field"
                      />
                      
                      <span>→</span>
                      
                      <Select 
                        value={mapping.targetField}
                        onValueChange={(value) => updateFieldMapping(index, 'targetField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Target Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_TARGET_FIELDS.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}{field.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMappingRow(index)}
                        disabled={fieldMappings.length <= 1}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button variant="outline" onClick={addMappingRow}>
                    <Plus className="h-4 w-4 mr-2" /> Add Mapping
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="validation" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Validation Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Rules are auto-generated based on field mappings
                  </p>
                </div>
                
                {templateForm.validationRules.length === 0 ? (
                  <div className="bg-muted p-4 rounded-md text-center">
                    <p>No validation rules defined yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Rules will be created automatically when you map fields.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {templateForm.validationRules.map((rule, index) => (
                        <div key={index} className="border rounded-md p-3 bg-card">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {AVAILABLE_TARGET_FIELDS.find(f => f.id === rule.field)?.name || rule.field}
                            </div>
                            <div className="flex items-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                rule.errorLevel === 'error' 
                                  ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {rule.errorLevel === 'error' ? 'Required' : 'Warning'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-sm">
                            {rule.message}
                          </div>
                          {rule.defaultValue !== undefined && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Default: {rule.defaultValue}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate}>
              Update Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the mapping template "{selectedTemplate?.name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Process SFTP Dialog */}
      <Dialog open={showProcessSftpDialog} onOpenChange={setShowProcessSftpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process SFTP Data</DialogTitle>
            <DialogDescription>
              Configure SFTP ingestion for template "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {(() => {
              const dataSource = selectedTemplate ? findDataSourceForTemplate(selectedTemplate) : null;
              
              if (!dataSource) {
                return (
                  <div className="text-destructive">
                    No SFTP data source found for this template's supplier.
                  </div>
                );
              }
              
              // Get remote paths from the data source config
              const remotePaths = dataSource.config?.remote_paths || [];
              
              return (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="remotePath">Select Remote Path</Label>
                    <Select
                      value={selectedRemotePath}
                      onValueChange={setSelectedRemotePath}
                    >
                      <SelectTrigger id="remotePath">
                        <SelectValue placeholder="Select a remote path" />
                      </SelectTrigger>
                      <SelectContent>
                        {remotePaths.map((pathItem: RemotePathItem, index: number) => (
                          <SelectItem key={index} value={pathItem.path}>
                            {pathItem.label || pathItem.path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="deleteAfterProcessing"
                      checked={deleteAfterProcessing}
                      onCheckedChange={setDeleteAfterProcessing}
                    />
                    <Label htmlFor="deleteAfterProcessing">Delete file after processing</Label>
                  </div>
                </>
              );
            })()}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessSftpDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProcessSftp} 
              disabled={!selectedRemotePath || isProcessingIngestion}
            >
              {isProcessingIngestion ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></div>
                  Processing...
                </>
              ) : (
                <>Start Processing</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}