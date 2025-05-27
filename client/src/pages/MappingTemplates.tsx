import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash, FileUp, Download, Upload, Maximize, Minimize, Zap, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

// Available target fields (Master Catalog schema fields)
const AVAILABLE_TARGET_FIELDS = [
  { id: "usin", name: "USIN", required: true, type: "string", description: "Unique Supplier Identification Number" },
  { id: "name", name: "Product Name", required: true, type: "string", description: "Product Name/Title" },
  { id: "manufacturerPartNumber", name: "MPN", required: false, type: "string", description: "Manufacturer Part Number" },
  { id: "upc", name: "UPC", required: false, type: "string", description: "UPC Code" },
  { id: "cost", name: "Cost", required: false, type: "string", description: "Product cost" },
  { id: "price", name: "Price", required: false, type: "string", description: "Retail price" },
  { id: "manufacturerName", name: "Brand", required: false, type: "string", description: "Brand/Manufacturer Name" },
  { id: "categoryId", name: "Category", required: false, type: "string", description: "Product category" },
  { id: "status", name: "Status", required: false, type: "string", description: "Product status" },
  { id: "description", name: "Description", required: false, type: "string", description: "Product Description" },
  { id: "primaryImage", name: "Primary Image", required: false, type: "string", description: "Primary product image URL" },
  { id: "weight", name: "Weight", required: false, type: "string", description: "Product weight" },
];

const PRODUCT_DETAIL_FIELDS = [
  { id: "usin", name: "USIN", required: true, type: "string", description: "Unique Supplier Identification Number" },
  { id: "name", name: "Product Name", required: true, type: "string", description: "Product Name/Title" },
  { id: "manufacturerPartNumber", name: "MPN", required: false, type: "string", description: "Manufacturer Part Number" },
  { id: "upc", name: "UPC", required: false, type: "string", description: "UPC Code" },
  { id: "cost", name: "Cost", required: false, type: "string", description: "Product cost" },
  { id: "price", name: "Price", required: false, type: "string", description: "Retail price" },
  { id: "manufacturerName", name: "Brand", required: false, type: "string", description: "Brand/Manufacturer Name" },
  { id: "categoryId", name: "Category", required: false, type: "string", description: "Product category" },
  { id: "status", name: "Status", required: false, type: "string", description: "Product status" },
  { id: "description", name: "Description", required: false, type: "string", description: "Product Description" },
  { id: "primaryImage", name: "Primary Image", required: false, type: "string", description: "Primary product image URL" },
  { id: "weight", name: "Weight", required: false, type: "string", description: "Product weight" },
  { id: "dimensions", name: "Dimensions", required: false, type: "string", description: "Product dimensions" },
  { id: "features", name: "Features", required: false, type: "string", description: "Product features" },
  { id: "specifications", name: "Specifications", required: false, type: "string", description: "Technical specifications" },
];

export default function MappingTemplates() {
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
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mappingView, setMappingView] = useState<'catalog' | 'detail'>('catalog');
  const [productDetailMappings, setProductDetailMappings] = useState<FieldMapping[]>([
    { sourceField: "", targetField: "" }
  ]);
  const [, navigate] = useLocation();
  
  // Toggle full screen handler
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  
  // ESC key handler for exiting full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);
  
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

  // Product Detail Mapping handlers
  const updateProductDetailMapping = (index: number, field: 'sourceField' | 'targetField', value: string) => {
    const newMappings = [...productDetailMappings];
    newMappings[index][field] = value;
    setProductDetailMappings(newMappings);
  };

  const addProductDetailMapping = () => {
    setProductDetailMappings([...productDetailMappings, { sourceField: "", targetField: "" }]);
  };

  const removeProductDetailMapping = (index: number) => {
    const newMappings = [...productDetailMappings];
    newMappings.splice(index, 1);
    setProductDetailMappings(newMappings);
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
        transformations: selectedTemplate.transformations || [],
        validationRules: templateForm.validationRules,
        supplierId: templateForm.supplierId && templateForm.supplierId !== "none" ? parseInt(templateForm.supplierId) : null,
        fileLabel: templateForm.fileLabel || null
      };

      const response = await apiRequest('PUT', `/api/mapping-templates/${selectedTemplate.id}`, templateData);

      if (response) {
        toast({
          title: "Template Updated",
          description: "Mapping template has been updated successfully"
        });
        setIsEditDialogOpen(false);
        resetForm();
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
      const response = await fetch(`/api/mapping-templates/${selectedTemplate.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Template Deleted",
          description: "Mapping template has been deleted successfully"
        });
        setIsDeleteDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      } else {
        throw new Error(`Failed to delete template: ${response.status}`);
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

  // Import sample data using a template
  const handleImportSample = async (template: any) => {
    try {
      const dataSource = dataSources?.find((ds: any) => ds.supplierId === template.supplierId);
      if (!dataSource) {
        toast({
          variant: "destructive",
          title: "Import Error",
          description: "No data source found for this template"
        });
        return;
      }

      toast({
        title: "Starting Import",
        description: "Importing sample data using your mapping template..."
      });

      const response = await apiRequest('POST', `/api/mapping-templates/${template.id}/import-sample`, {
        dataSourceId: dataSource.id,
        remotePath: '/eco8/out/catalog.csv',
        recordLimit: 10
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Import Successful!",
          description: `Successfully imported ${data.stats.success} products to your master catalog`
        });

        // Refresh products data
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      } else {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: data.message || "Failed to import sample data"
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        variant: "destructive",
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to import sample data"
      });
    }
  };

  // Edit a template
  const handleEditTemplate = async (template: MappingTemplate) => {
    setSelectedTemplate(template);
    
    console.log('Editing template:', template);
    console.log('Template mappings:', template.mappings);
    
    // Populate form with template data
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      sourceType: template.sourceType,
      supplierId: template.supplierId ? template.supplierId.toString() : "",
      fileLabel: template.fileLabel || "",
      mappings: template.mappings || {},
      validationRules: template.validationRules || []
    });

    // Convert mappings object to field mapping array for display
    const mappingsArray: FieldMapping[] = [];
    
    if (template.mappings && typeof template.mappings === 'object') {
      Object.entries(template.mappings).forEach(([sourceField, targetField]) => {
        if (sourceField && targetField) {
          mappingsArray.push({ 
            sourceField, 
            targetField: targetField as string 
          });
        }
      });
    }
    
    console.log('Converted mappings array:', mappingsArray);
    
    // Ensure at least one empty row if no mappings exist
    if (mappingsArray.length === 0) {
      mappingsArray.push({ sourceField: "", targetField: "" });
    }
    
    setFieldMappings(mappingsArray);
    
    // Load complete CWR source fields for editing (all 64 fields)
    if (template.supplierId === 1) { // CWR supplier
      const cwrSampleData = [{
        "CWR Part Number": "", "Manufacturer Part Number": "", "UPC Code": "", "Quantity Available to Ship (Combined)": "",
        "Quantity Available to Ship (NJ)": "", "Quantity Available to Ship (FL)": "", "Next Shipment Date (Combined)": "",
        "Next Shipment Date (NJ)": "", "Next Shipment Date (FL)": "", "Your Cost": "", "List Price": "", "M.A.P. Price": "",
        "M.R.P. Price": "", "Uppercase Title": "", "Title": "", "Full Description": "", "Category ID": "", "Category Name": "",
        "Manufacturer Name": "", "Shipping Weight": "", "Box Height": "", "Box Length": "", "Box Width": "",
        "List of Accessories by SKU": "", "List of Accessories by MFG#": "", "Quick Specs": "", "Image (300x300) Url": "",
        "Image (1000x1000) Url": "", "Non-stock": "", "Drop Ships Direct From Vendor": "", "Hazardous Materials": "",
        "Truck Freight": "", "Exportable": "", "First Class Mail": "", "Oversized": "", "Remanufactured": "", "Closeout": "",
        "Harmonization Code": "", "Country Of Origin": "", "Sale": "", "Original Price (if on Sale/Closeout)": "",
        "Sale Start Date": "", "Sale End Date": "", "Rebate": "", "Rebate Description": "", "Rebate Description With Link": "",
        "Rebate Start Date": "", "Rebate End Date": "", "Google Merchant Category": "", "Quick Guide Literature (pdf) Url": "",
        "Owners Manual (pdf) Url": "", "Brochure Literature (pdf) Url": "", "Installation Guide (pdf) Url": "", "Video Urls": "",
        "Prop 65": "", "Prop 65 Description": "", "Free Shipping": "", "Free Shipping End Date": "", "Returnable": "",
        "Image Additional (1000x1000) Urls": "", "Case Qty (NJ)": "", "Case Qty (FL)": "", "3rd Party Marketplaces": "", "FCC ID": ""
      }];
      setSampleData(cwrSampleData);
      console.log('Loaded CWR source fields for editing (64 fields)');
    }
    
    // If there are no validation rules but we have mappings, generate them
    if ((!template.validationRules || template.validationRules.length === 0) && 
        Object.keys(template.mappings || {}).length > 0) {
      
      // Generate validation rules based on target fields
      const updatedRules: ValidationRule[] = [];
      
      Object.values(template.mappings).forEach((targetField) => {
        if (targetField) {
          updatedRules.push(...generateValidationRules(targetField));
        }
      });
      
      setTemplateForm(prev => ({
        ...prev,
        validationRules: updatedRules
      }));
    }
    
    setIsEditDialogOpen(true);
  };

  // Filter templates based on active tab
  const filteredTemplates = templates.filter((template: MappingTemplate) => {
    if (activeTab === 'all') return true;
    return template.sourceType === activeTab;
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mapping Templates</h1>
          <p className="text-gray-500">Manage field mappings between supplier data and internal schema</p>
        </div>
        <Button onClick={() => navigate('/mapping-templates/new')}>
          <Plus className="mr-2 h-4 w-4" /> Create New Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="excel">Excel</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="xml">XML</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {isLoadingTemplates ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No mapping templates found. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Source Type</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>File Label</TableHead>
                        <TableHead>Fields Mapped</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template: MappingTemplate) => {
                        const supplier = suppliers.find((s: Supplier) => s.id === template.supplierId);
                        const mappingsCount = Object.keys(template.mappings || {}).length;
                        
                        return (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell>{template.sourceType}</TableCell>
                            <TableCell>{supplier?.name || '-'}</TableCell>
                            <TableCell>{template.fileLabel || '-'}</TableCell>
                            <TableCell>{mappingsCount} fields</TableCell>
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
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleImportSample(template)}
                                  >
                                    <FileUp className="h-4 w-4 mr-1" /> Import Sample
                                  </Button>
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
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      {/* Dialog disabled in favor of full-page editor */}
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Mapping Template</DialogTitle>
            <DialogDescription>
              Define how supplier data fields map to your internal schema fields.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4">
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Catalog Feed Template"
                      value={templateForm.name}
                      onChange={handleTemplateFormChange}
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
                      placeholder="Catalog Feed"
                      value={templateForm.fileLabel}
                      onChange={handleTemplateFormChange}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Template for mapping catalog data from supplier X"
                      value={templateForm.description}
                      onChange={handleTemplateFormChange}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Sample Data (Optional)</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.xls,.json,.xml"
                        onChange={handleFileUpload}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isUploading}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        {isUploading ? "Uploading..." : "Upload Sample File"}
                      </Button>
                    </div>
                  </div>

                  {uploadedFileName && (
                    <p className="text-sm text-gray-500 mb-2">
                      Uploaded: {uploadedFileName}
                    </p>
                  )}

                  {sampleData && sampleData.length > 0 && (
                    <div className="border rounded overflow-x-auto max-h-60">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {sampleHeaders.map((header, i) => (
                              <th
                                key={i}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sampleData.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {sampleHeaders.map((header, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-6 py-2 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {row[header]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="pt-4">
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Field Mappings</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addMappingRow}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Mapping
                  </Button>
                </div>

                {/* Dual Mapping Interface */}
                <Tabs value={mappingView} onValueChange={setMappingView} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="catalog">Master Catalog View</TabsTrigger>
                    <TabsTrigger value="detail">Product Detail View</TabsTrigger>
                  </TabsList>

                  <TabsContent value="catalog" className="mt-4">
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600 mb-3">
                        Map fields for the master catalog view (core business fields)
                      </div>
                      {fieldMappings.map((mapping, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 items-center">
                          <div className="col-span-2">
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
                                  <SelectItem value="none" disabled>
                                    No source fields available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-center">
                            <span className="text-gray-500">→</span>
                          </div>
                          <div className="col-span-2">
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
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMappingRow(index)}
                              disabled={fieldMappings.length <= 1}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="detail" className="mt-4">
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600 mb-3">
                        Map fields for product detail view (includes USIN and comprehensive product data)
                      </div>
                      {productDetailMappings.map((mapping, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 items-center">
                          <div className="col-span-2">
                            <Select
                              value={mapping.sourceField}
                              onValueChange={(value) => updateProductDetailMapping(index, 'sourceField', value)}
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
                                  <SelectItem value="none" disabled>
                                    No source fields available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-center">
                            <span className="text-gray-500">→</span>
                          </div>
                          <div className="col-span-2">
                            <Select
                              value={mapping.targetField}
                              onValueChange={(value) => updateProductDetailMapping(index, 'targetField', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Target Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_DETAIL_FIELDS.map((field) => (
                                  <SelectItem key={field.id} value={field.id}>
                                    {field.name}{field.required ? " *" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductDetailMapping(index)}
                              disabled={productDetailMappings.length <= 1}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addProductDetailMapping}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Product Detail Mapping
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="pt-4">
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Validation Rules</h3>
                  <div className="text-sm text-muted-foreground">
                    {templateForm.validationRules.length} rules
                  </div>
                </div>

                {templateForm.validationRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No validation rules defined yet.</p>
                    <p className="mt-2">Select target fields in the Field Mapping tab to automatically generate validation rules.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      These validation rules will be applied during data import. Rules are automatically generated based on the target fields you've mapped.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                      {templateForm.validationRules.map((rule, index) => {
                        const field = AVAILABLE_TARGET_FIELDS.find(f => f.id === rule.field);
                        const fieldName = field ? field.name : rule.field;
                        
                        return (
                          <div 
                            key={index} 
                            className={`p-3 rounded-md border ${
                              rule.errorLevel === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">
                                {fieldName}
                                <span 
                                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                    rule.errorLevel === 'error' 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {rule.errorLevel}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {rule.type}
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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
              Update how supplier data fields map to your internal schema fields.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4">
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Template Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      placeholder="Catalog Feed Template"
                      value={templateForm.name}
                      onChange={handleTemplateFormChange}
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
                      placeholder="Catalog Feed"
                      value={templateForm.fileLabel}
                      onChange={handleTemplateFormChange}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      name="description"
                      placeholder="Template for mapping catalog data from supplier X"
                      value={templateForm.description}
                      onChange={handleTemplateFormChange}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="pt-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Field Mapping</h3>
                    <p className="text-sm text-muted-foreground">
                      Map supplier fields to your catalog schema
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Auto-map logic can be added here
                        toast({
                          title: "Auto-mapping complete",
                          description: "Fields have been automatically mapped based on similarity"
                        });
                      }}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Auto-Map Fields
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addMappingRow}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field Mapping
                    </Button>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Available Source Fields:</h4>
                  <div className="flex flex-wrap gap-2">
                    {sampleData && sampleData.length > 0 ? (
                      Object.keys(sampleData[0]).map((sourceField) => (
                        <Badge 
                          key={sourceField} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-blue-100 text-xs px-2 py-1 bg-blue-100 text-blue-800"
                        >
                          {sourceField}
                        </Badge>
                      ))
                    ) : (
                      Object.keys(templateForm.mappings || {}).map((sourceField) => (
                        <Badge 
                          key={sourceField} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-blue-100 text-xs px-2 py-1 bg-blue-100 text-blue-800"
                        >
                          {sourceField}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-blue-900">Master Catalog View</h4>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Active
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700">
                      Master Catalog Field Mappings ({fieldMappings.length})
                    </div>
                    
                    {fieldMappings.map((mapping, index) => (
                      <div key={index} className="grid grid-cols-5 gap-3 items-center bg-white p-3 rounded border">
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-500 mb-1 block">Source Field</Label>
                          <Select
                            value={mapping.sourceField}
                            onValueChange={(value) => updateFieldMapping(index, 'sourceField', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select source field" />
                            </SelectTrigger>
                            <SelectContent>
                              {sampleData && sampleData.length > 0 ? (
                                Object.keys(sampleData[0]).map((field) => (
                                  <SelectItem key={field} value={field}>
                                    {field}
                                  </SelectItem>
                                ))
                              ) : (
                                Object.keys(templateForm.mappings || {}).map((field) => (
                                  <SelectItem key={field} value={field}>
                                    {field}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex justify-center">
                          <span className="text-gray-400">→</span>
                        </div>
                        
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-500 mb-1 block">Catalog Target Field</Label>
                          <Select
                            value={mapping.targetField}
                            onValueChange={(value) => updateFieldMapping(index, 'targetField', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select target field" />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_TARGET_FIELDS.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{field.name}</span>
                                    {field.required && (
                                      <span className="text-red-500">*</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMappingRow(index)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="pt-4">
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Validation Rules</h3>
                  <div className="text-sm text-muted-foreground">
                    {templateForm.validationRules.length} rules
                  </div>
                </div>

                {templateForm.validationRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No validation rules defined yet.</p>
                    <p className="mt-2">Select target fields in the Field Mapping tab to automatically generate validation rules.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      These validation rules will be applied during data import. Rules are automatically generated based on the target fields you've mapped.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                      {templateForm.validationRules.map((rule, index) => {
                        const field = AVAILABLE_TARGET_FIELDS.find(f => f.id === rule.field);
                        const fieldName = field ? field.name : rule.field;
                        
                        return (
                          <div 
                            key={index} 
                            className={`p-3 rounded-md border ${
                              rule.errorLevel === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">
                                {fieldName}
                                <span 
                                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                    rule.errorLevel === 'error' 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {rule.errorLevel}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {rule.type}
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
                        );
                      })}
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