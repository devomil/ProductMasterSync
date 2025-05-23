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
import { ChevronLeft, Save, ArrowLeftRight, PanelLeftOpen, PanelRightOpen, Download, Upload, FileUp, Plus, Trash, Wand2, ArrowDown, Minimize, Maximize, Filter, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MappingWorkspace from "@/components/mapping/MappingWorkspace";
import { SimpleMappingInterface } from "@/components/mapping/SimpleMappingInterface";

// Mapping template component handles its own view toggle

interface MappingTemplateModel {
  id: number;
  name: string;
  description: string | null;
  sourceType: string;
  mappings: Record<string, string> | { catalog: Record<string, string>, detail: Record<string, string> };
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

// Define catalog field and detail field interfaces to match what we're using
interface CatalogField {
  id: string;
  name: string;
  description: string;
  required?: boolean;
  type?: string;
}

interface DetailField {
  id: string;
  name: string;
  description: string;
  view: string;
  section: string;
  required?: boolean;
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
  console.log("✅ New MappingTemplateWorkspace loaded with SimpleMappingInterface");
  console.log("MappingTemplateWorkspace component starting to render...");
  
  const [_, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const id = params.id ? parseInt(params.id) : null;
  const isEdit = !!id;
  
  // State for form
  const [templateForm, setTemplateForm] = useState<Partial<MappingTemplateModel>>({
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
  const [catalogMappings, setCatalogMappings] = useState<FieldMapping[]>([]);
  const [detailMappings, setDetailMappings] = useState<FieldMapping[]>([]);
  const [activeView, setActiveView] = useState<'catalog' | 'detail'>('catalog');
  const [forceUpdate, setForceUpdate] = useState(0); // Force re-render trigger
  
  // Fixed view toggle function that properly maintains state
  const handleViewToggle = (view: 'catalog' | 'detail') => {
    console.log(`Switching to ${view} view`);
    setActiveView(view);
  };
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [collapseUnmapped, setCollapseUnmapped] = useState(false);
  const [selectedTab, setSelectedTab] = useState("template-info");
  const [isUploading, setIsUploading] = useState(false);
  const [rowCount, setRowCount] = useState(20);
  const [remotePaths, setRemotePaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  
  // Define target fields for both catalog and detail views
  console.log("🔧 Defining catalogFields...");
  const catalogFields = [
    { id: "sku", name: "SKU", required: true, description: "Unique product identifier", type: "string" },
    { id: "product_name", name: "Product Name", required: true, description: "Full product name/title", type: "string" },
    { id: "category", name: "Category", description: "Product category", type: "string" },
    { id: "subcategory", name: "Subcategory", description: "Product subcategory", type: "string" },
    { id: "price", name: "Price", description: "Retail price", type: "number" },
    { id: "cost", name: "Cost", description: "Wholesale cost", type: "number" },
    { id: "manufacturer", name: "Manufacturer", description: "Product manufacturer/brand name", type: "string" },
    { id: "status", name: "Status", description: "Product status (active, discontinued, etc)", type: "string" },
    { id: "stock_quantity", name: "Stock Quantity", description: "Available inventory quantity", type: "number" },
    { id: "upc", name: "UPC", description: "Universal Product Code", type: "string" },
  ];
  
  console.log("DEBUG: catalogFields defined with length:", catalogFields.length);
  console.log("DEBUG: catalogFields content:", catalogFields.slice(0, 3));
  
  const detailFields = [
    // Basic Product Specification Section
    { id: "mpn", name: "Manufacturer Part Number", description: "Manufacturer's part number", view: "detail", section: "specifications" },
    { id: "description", name: "Description", description: "Detailed product description", view: "detail", section: "overview" },
    { id: "short_description", name: "Short Description", description: "Short summary for product listings", view: "detail", section: "overview" },
    { id: "features", name: "Features", description: "Bulleted list of product features", view: "detail", section: "overview" },
    { id: "ean", name: "EAN", description: "European Article Number", view: "detail", section: "specifications" },
    { id: "isbn", name: "ISBN", description: "International Standard Book Number", view: "detail", section: "specifications" },
    
    // Physical Attributes
    { id: "weight", name: "Weight", description: "Product weight", view: "detail", section: "specifications" },
    { id: "weight_unit", name: "Weight Unit", description: "Unit of weight (lb, kg, etc)", view: "detail", section: "specifications" },
    { id: "length", name: "Length", description: "Product length", view: "detail", section: "specifications" },
    { id: "width", name: "Width", description: "Product width", view: "detail", section: "specifications" },
    { id: "height", name: "Height", description: "Product height", view: "detail", section: "specifications" },
    { id: "dimension_unit", name: "Dimension Unit", description: "Unit of dimensions (in, cm, etc)", view: "detail", section: "specifications" },
    { id: "color", name: "Color", description: "Product color", view: "detail", section: "specifications" },
    { id: "size", name: "Size", description: "Product size", view: "detail", section: "specifications" },
    { id: "material", name: "Material", description: "Product material", view: "detail", section: "specifications" },
    { id: "condition", name: "Condition", description: "Product condition (new, used, etc)", view: "detail", section: "specifications" },
    
    // Supplier Info for PDP
    { id: "min_order_quantity", name: "Min Order Quantity", description: "Minimum order quantity", view: "detail", section: "supplier" },
    { id: "lead_time", name: "Lead Time", description: "Production or shipping lead time", view: "detail", section: "supplier" },
    { id: "shipping_weight", name: "Shipping Weight", description: "Weight for shipping calculations", view: "detail", section: "supplier" },
    { id: "shipping_dimensions", name: "Shipping Dimensions", description: "Dimensions for shipping calculations", view: "detail", section: "supplier" },
    { id: "shipping_cost", name: "Shipping Cost", description: "Base shipping cost from supplier", view: "detail", section: "supplier" },
    { id: "dropship_eligible", name: "Dropship Eligible", description: "Whether product is eligible for dropshipping", view: "detail", section: "supplier" },
    { id: "supplier_notes", name: "Supplier Notes", description: "Special notes from supplier about product", view: "detail", section: "supplier" },
    { id: "supplier_stock_levels", name: "Supplier Stock", description: "Current stock levels at supplier", view: "detail", section: "supplier" },
    { id: "supplier_warehouse_locations", name: "Warehouse Locations", description: "Warehouses where product is stocked", view: "detail", section: "supplier" },
    
    // Tax and Financial
    { id: "is_taxable", name: "Is Taxable", description: "Whether product is taxable", view: "detail", section: "specifications" },
    { id: "tax_code", name: "Tax Code", description: "Tax classification code", view: "detail", section: "specifications" },
    { id: "msrp", name: "MSRP", description: "Manufacturer's suggested retail price", view: "detail", section: "specifications" },
    { id: "map_price", name: "MAP Price", description: "Minimum advertised price", view: "detail", section: "specifications" },
    
    // Media Gallery
    { id: "image_url", name: "Primary Image URL", description: "Primary product image URL", view: "detail", section: "gallery" },
    { id: "additional_image_urls", name: "Additional Image URLs", description: "Additional product image URLs (comma separated)", view: "detail", section: "gallery" },
    { id: "video_url", name: "Video URL", description: "Product video URL", view: "detail", section: "gallery" },
    { id: "manual_url", name: "Manual URL", description: "Product manual/documentation URL", view: "detail", section: "gallery" },
    { id: "360_view_url", name: "360° View URL", description: "360-degree product view URL", view: "detail", section: "gallery" },
    { id: "thumbnail_url", name: "Thumbnail URL", description: "Small thumbnail image URL", view: "detail", section: "gallery" },
    
    // Additional Info
    { id: "warranty", name: "Warranty", description: "Product warranty information", view: "detail", section: "specifications" },
    { id: "country_of_origin", name: "Country of Origin", description: "Country where product was manufactured", view: "detail", section: "specifications" },
    { id: "keywords", name: "Keywords", description: "Search keywords/tags", view: "detail", section: "seo" },
    { id: "related_products", name: "Related Products", description: "Related product SKUs (comma separated)", view: "detail", section: "related" },
    { id: "upsell_products", name: "Upsell Products", description: "Upsell product SKUs (comma separated)", view: "detail", section: "related" },
    { id: "cross_sell_products", name: "Cross-sell Products", description: "Cross-sell product SKUs (comma separated)", view: "detail", section: "related" },
    
    // Technical Specifications
    { id: "technical_specs", name: "Technical Specifications", description: "Detailed technical specifications (JSON format)", view: "detail", section: "specifications" },
    { id: "compatibility", name: "Compatibility", description: "Compatible products or systems", view: "detail", section: "specifications" },
    { id: "certifications", name: "Certifications", description: "Product certifications (e.g., UL, CE)", view: "detail", section: "specifications" },
    
    // Custom Fields
    { id: "custom_field_1", name: "Custom Field 1", description: "Custom field for additional data", view: "detail", section: "custom" },
    { id: "custom_field_2", name: "Custom Field 2", description: "Custom field for additional data", view: "detail", section: "custom" },
    { id: "custom_field_3", name: "Custom Field 3", description: "Custom field for additional data", view: "detail", section: "custom" },
  ];
  
  // Debug logging right after field definitions
  console.log("DEBUG: detailFields defined with length:", detailFields.length);
  
  // Debug logging right before passing to component
  useEffect(() => {
    console.log("DEBUG: About to pass catalogFields:", catalogFields.length);
    console.log("DEBUG: About to pass detailFields:", detailFields.length);
  }, [catalogFields, detailFields]);
  
  // Combine for legacy code compatibility
  const targetFields = [...catalogFields, ...detailFields];
  
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
    select: (data: any) => data as MappingTemplateModel
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
      
      // Check if mappings is in new format (object with catalog/detail keys)
      // or old format (flat object of mappings)
      if (templateData.mappings && typeof templateData.mappings === 'object') {
        if ('catalog' in templateData.mappings && 'detail' in templateData.mappings) {
          // New format with separate catalog and detail mappings
          const catalogMappingsArray = Object.entries(templateData.mappings.catalog || {}).map(
            ([targetField, sourceField]) => ({
              sourceField: sourceField as string,
              targetField
            })
          );
          
          const detailMappingsArray = Object.entries(templateData.mappings.detail || {}).map(
            ([targetField, sourceField]) => ({
              sourceField: sourceField as string,
              targetField
            })
          );
          
          setCatalogMappings(catalogMappingsArray.length > 0 ? catalogMappingsArray : [{ sourceField: "", targetField: "" }]);
          setDetailMappings(detailMappingsArray.length > 0 ? detailMappingsArray : [{ sourceField: "", targetField: "" }]);
        } else {
          // Old format - treat all as catalog mappings and leave detail empty
          const mappingsArray = Object.entries(templateData.mappings).map(
            ([targetField, sourceField]) => ({
              sourceField: sourceField as string,
              targetField
            })
          );
          
          setCatalogMappings(mappingsArray.length > 0 ? mappingsArray : [{ sourceField: "", targetField: "" }]);
          setDetailMappings([{ sourceField: "", targetField: "" }]);
        }
      }
      
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
      
      console.log("SFTP pull response:", data);
      
      if (!data.sample_data || data.sample_data.length === 0) {
        throw new Error("No data found in the selected file");
      }
      
      // Update state with sample data
      console.log("Setting sample data:", data.sample_data);
      setSampleData(data.sample_data);
      setSampleHeaders(Object.keys(data.sample_data[0]));
      
      // Ensure we immediately switch to the mapping tab when data is loaded
      setSelectedTab("mapping");
      
      setTemplateForm(prev => ({
        ...prev,
        fileLabel: selectedPath
      }));
      
      // Generate initial mappings if none exist
      if (activeView === 'catalog') {
        if (catalogMappings.length <= 1 && (!catalogMappings[0].sourceField || !catalogMappings[0].targetField)) {
          const autoMappings = autoMapFields(Object.keys(data.sample_data[0]), 'catalog');
          setCatalogMappings(autoMappings);
        }
      } else {
        if (detailMappings.length <= 1 && (!detailMappings[0].sourceField || !detailMappings[0].targetField)) {
          const autoMappings = autoMapFields(Object.keys(data.sample_data[0]), 'detail');
          setDetailMappings(autoMappings);
        }
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
  const autoMapFields = (headers: string[], view: 'catalog' | 'detail' = 'catalog') => {
    const fields = view === 'catalog' ? catalogFields : detailFields;
    const targetFieldMap = new Map(fields.map(field => [field.id.toLowerCase(), field.id]));
    
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
      
      // Special cases for CWR catalog fields
      if (view === 'catalog') {
        if (header === 'CWR Part Number') {
          initialMappings[index].targetField = 'sku';
        } else if (header === 'Title' || header === 'Uppercase Title') {
          initialMappings[index].targetField = 'product_name';
        } else if (header === 'Manufacturer Name') {
          initialMappings[index].targetField = 'manufacturer';
        } else if (header === 'Category Name') {
          initialMappings[index].targetField = 'category';
        } else if (header === 'Your Cost') {
          initialMappings[index].targetField = 'cost';
        } else if (header === 'List Price') {
          initialMappings[index].targetField = 'price';
        } else if (header === 'UPC Code') {
          initialMappings[index].targetField = 'upc';
        } else if (header === 'Full Description') {
          initialMappings[index].targetField = 'description';
        } else if (header === 'Quantity Available to Ship (Combined)') {
          initialMappings[index].targetField = 'stock_quantity';
        } else if (headerLower.includes('qty') || headerLower.includes('quantity') || headerLower.includes('stock')) {
          initialMappings[index].targetField = 'stock_quantity';
        } else if (headerLower.includes('barcode')) {
          initialMappings[index].targetField = 'upc';
        }
      }
      
      // Special cases for CWR detail fields
      if (view === 'detail') {
        if (header === 'Manufacturer Part Number') {
          initialMappings[index].targetField = 'mpn';
        } else if (header === 'Full Description') {
          initialMappings[index].targetField = 'description';
        } else if (header === 'Image (300x300) Url' || header === 'Image (1000x1000) Url') {
          initialMappings[index].targetField = 'image_url';
        } else if (header === 'Shipping Weight') {
          initialMappings[index].targetField = 'weight';
        } else if (header === 'Box Height' || header === 'Box Length' || header === 'Box Width') {
          initialMappings[index].targetField = 'dimensions';
        } else if (header === 'Harmonization Code') {
          initialMappings[index].targetField = 'harmonization_code';
        } else if (header === 'Country Of Origin') {
          initialMappings[index].targetField = 'country_of_origin';
        } else if (header === 'Quick Guide Literature (pdf) Url' || header === 'Owners Manual (pdf) Url') {
          initialMappings[index].targetField = 'manual_url';
        } else if (header === 'Prop 65 Description') {
          initialMappings[index].targetField = 'prop65_warning';
        } else if (header === 'Google Merchant Category') {
          initialMappings[index].targetField = 'google_category';
        }
      }
    });
    
    return initialMappings;
  };
  
  // Handle file upload for sample data
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify({
      format: templateForm.sourceType || 'csv'
    }));
    
    setIsUploading(true);
    
    try {
      const response = await fetch('/api/mapping-templates/upload-sample', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.sample_data || data.sample_data.length === 0) {
        throw new Error("No data could be parsed from the file");
      }
      
      // Update state with sample data
      setSampleData(data.sample_data);
      setSampleHeaders(Object.keys(data.sample_data[0]));
      
      // Generate initial mappings if none exist
      if (activeView === 'catalog') {
        if (catalogMappings.length <= 1 && (!catalogMappings[0].sourceField || !catalogMappings[0].targetField)) {
          const autoMappings = autoMapFields(Object.keys(data.sample_data[0]), 'catalog');
          setCatalogMappings(autoMappings);
        }
      } else {
        if (detailMappings.length <= 1 && (!detailMappings[0].sourceField || !detailMappings[0].targetField)) {
          const autoMappings = autoMapFields(Object.keys(data.sample_data[0]), 'detail');
          setDetailMappings(autoMappings);
        }
      }
      
      // Auto-switch to the mapping tab
      setSelectedTab("mapping");
      
      toast({
        title: "Sample data loaded",
        description: `Loaded ${data.sample_data.length} rows of data from ${file.name}`,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload and process file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle saving the template
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
    
    // Convert catalog mappings to record
    const catalogMappingsRecord: Record<string, string> = {};
    catalogMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        catalogMappingsRecord[mapping.targetField] = mapping.sourceField;
      }
    });
    
    // Convert detail mappings to record
    const detailMappingsRecord: Record<string, string> = {};
    detailMappings.forEach(mapping => {
      if (mapping.sourceField && mapping.targetField) {
        detailMappingsRecord[mapping.targetField] = mapping.sourceField;
      }
    });
    
    // Create combined mappings object with both views
    const mappings = {
      catalog: catalogMappingsRecord,
      detail: detailMappingsRecord
    };
    
    // Create validation rules for required fields
    const catalogRequiredFields = catalogFields
      .filter(field => {
        // Check if field has required property and it's true
        // And check if field is included in mappings
        return (field.required === true) && Object.keys(catalogMappingsRecord).includes(field.id);
      })
      .map(field => ({ 
        field: field.id, 
        rule: "required" 
      }));
      
    const detailRequiredFields = detailFields
      .filter(field => {
        // Check if field is included in mappings
        const isMapped = Object.keys(detailMappingsRecord).includes(field.id);
        // For detail fields we need to check the required property safely
        return isMapped;
      })
      .map(field => ({ 
        field: field.id, 
        rule: "required" 
      }));
    
    const validationRules = [...catalogRequiredFields, ...detailRequiredFields];
    
    // Prepare template data for API
    const templateData = {
      ...templateForm,
      mappings,
      validationRules,
      // Always provide these fields for consistency
      transformations: templateForm.transformations || [],
    };
    
    try {
      if (isEdit) {
        // Update existing template
        await apiRequest(`/api/mapping-templates/${id}`, 'PATCH', templateData);
        
        toast({
          title: "Success",
          description: "Mapping template updated successfully",
        });
      } else {
        // Create new template
        await apiRequest('/api/mapping-templates', 'POST', templateData);
        
        toast({
          title: "Success",
          description: "Mapping template created successfully",
        });
      }
      
      // Navigate back to template list
      navigate("/mapping-templates");
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save mapping template. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Handle SFTP test pull
  const handleSftpTestPull = async () => {
    if (!templateForm.supplierId) {
      toast({
        title: "No supplier selected",
        description: "Please select a supplier first.",
        variant: "destructive"
      });
      return;
    }
    
    await handlePullSftpSampleData(templateForm.supplierId);
  };
  
  // Handle supplier selection change
  const handleSupplierChange = async (supplierId: string) => {
    const id = parseInt(supplierId);
    setTemplateForm(prev => ({ ...prev, supplierId: id || null }));
    
    // If SFTP source type, fetch remote paths
    if (templateForm.sourceType === 'sftp' && id) {
      await fetchRemotePaths(id);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/mapping-templates')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Templates
          </Button>
          <h1 className="text-xl font-semibold ml-2">
            {isEdit ? `Edit Template: ${templateForm.name}` : 'Create Mapping Template'}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleSaveTemplate}>
            <Save className="w-4 h-4 mr-1" /> Save Template
          </Button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-grow p-4 bg-slate-50">
        <Tabs 
          value={selectedTab} 
          onValueChange={setSelectedTab}
          className="space-y-4"
        >
          <TabsList className="w-full bg-white border">
            <TabsTrigger value="template-info" className="flex-1">
              Template Info
            </TabsTrigger>
            <TabsTrigger value="sample-data" className="flex-1">
              Sample Data
            </TabsTrigger>
            <TabsTrigger 
              value="mapping" 
              className="flex-1"
              disabled={sampleData.length === 0}
            >
              Field Mapping
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="template-info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input 
                      id="name" 
                      value={templateForm.name} 
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Supplier Catalog Import"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Source Type</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant={templateForm.sourceType === 'csv' ? 'default' : 'outline'}
                        onClick={() => setTemplateForm(prev => ({ ...prev, sourceType: 'csv' }))}
                        className="flex-1"
                      >
                        CSV
                      </Button>
                      <Button 
                        type="button" 
                        variant={templateForm.sourceType === 'excel' ? 'default' : 'outline'}
                        onClick={() => setTemplateForm(prev => ({ ...prev, sourceType: 'excel' }))}
                        className="flex-1"
                      >
                        EXCEL
                      </Button>
                      <Button 
                        type="button" 
                        variant={templateForm.sourceType === 'sftp' ? 'default' : 'outline'}
                        onClick={() => setTemplateForm(prev => ({ ...prev, sourceType: 'sftp' }))}
                        className="flex-1"
                      >
                        SFTP
                      </Button>
                      <Button 
                        type="button" 
                        variant={templateForm.sourceType === 'api' ? 'default' : 'outline'}
                        onClick={() => setTemplateForm(prev => ({ ...prev, sourceType: 'api' }))}
                        className="flex-1"
                      >
                        API
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={templateForm.description || ''} 
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the purpose of this mapping template"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier (Optional)</Label>
                  <Select 
                    value={templateForm.supplierId?.toString() || ''} 
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Link to a supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Generic Template)</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name} ({supplier.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {templateForm.sourceType === 'sftp' && templateForm.supplierId && (
                  <div className="space-y-2">
                    <Label htmlFor="remotePath">Remote File Path</Label>
                    <Input 
                      id="remotePath"
                      value={selectedPath}
                      onChange={(e) => setSelectedPath(e.target.value)}
                      placeholder="/eco8/out/catalog.csv"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the full path to your file on the SFTP server
                    </p>
                  </div>
                )}
                
                <div className="border rounded p-4 mt-6 bg-white">
                  <h3 className="text-md font-medium mb-3">Sample Data Source</h3>
                  
                  <div className="space-y-4">
                    {templateForm.sourceType === 'sftp' && templateForm.supplierId ? (
                      <div className="flex flex-col space-y-2">
                        <p className="text-sm text-gray-600">
                          Pull sample data directly from the supplier's SFTP server.
                        </p>
                        <Button
                          onClick={handleSftpTestPull}
                          disabled={isUploading || !templateForm.supplierId || !selectedPath}
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {isUploading ? "Loading..." : "Pull Sample Data from SFTP"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-2">
                        <p className="text-sm text-gray-600">
                          Upload a sample file to create your field mappings.
                        </p>
                        <div className="flex items-center justify-center w-full">
                          <label 
                            htmlFor="file-upload"
                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-3 text-gray-400" />
                              <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500">
                                {templateForm.sourceType === 'csv' && 'CSV file (.csv)'}
                                {templateForm.sourceType === 'excel' && 'Excel file (.xlsx, .xls)'}
                                {templateForm.sourceType === 'json' && 'JSON file (.json)'}
                                {templateForm.sourceType === 'xml' && 'XML file (.xml)'}
                              </p>
                            </div>
                            <input 
                              id="file-upload" 
                              type="file" 
                              className="hidden"
                              onChange={handleFileUpload}
                              disabled={isUploading}
                              accept={
                                templateForm.sourceType === 'csv' ? '.csv' :
                                templateForm.sourceType === 'excel' ? '.xlsx,.xls' :
                                templateForm.sourceType === 'json' ? '.json' :
                                templateForm.sourceType === 'xml' ? '.xml' : ''
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    
                    {sampleData.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Sample Data Loaded</span>
                          <Badge variant="outline" className="bg-green-50">
                            {sampleData.length} records
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            {sampleHeaders.length} columns detected
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTab("mapping")}
                          >
                            Continue to Mapping
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="sample-data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sample Data</CardTitle>
                <p className="text-sm text-gray-600">Load sample data from your source to preview fields and create mappings</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {templateForm.sourceType === 'sftp' && templateForm.supplierId ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={handleSftpTestPull}
                        disabled={isUploading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isUploading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Load Data from Source
                          </>
                        )}
                      </Button>
                      {sampleData.length > 0 && (
                        <Badge variant="secondary" className="bg-green-50 text-green-700">
                          {sampleData.length} records loaded
                        </Badge>
                      )}
                    </div>
                    
                    {sampleData.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Sample Data Preview</h4>
                          <Badge variant="secondary">{sampleData.length} records</Badge>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(sampleData[0]).slice(0, 12).map((key) => (
                                  <th key={key} className="text-left px-2 py-1 font-medium border-b text-xs">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sampleData.map((row, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  {Object.values(row).slice(0, 12).map((value, cellIdx) => (
                                    <td key={cellIdx} className="px-2 py-1 border-b text-xs">
                                      <div className="truncate max-w-20">
                                        {String(value)}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="p-2 bg-gray-50 text-xs text-gray-600">
                            Showing first 12 of {Object.keys(sampleData[0]).length} total fields
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTab("mapping")}
                          >
                            Continue to Field Mapping →
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                    <div className="text-sm">Please configure supplier and source type in Template Info first</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="mapping" className="space-y-4">
            {sampleData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      console.log("🚀 Creating auto-mappings with real sample headers:", sampleHeaders);
                      
                      const currentFields = activeView === 'catalog' ? catalogFields : detailFields;
                      const autoMappings = autoMapFields(sampleHeaders, activeView);
                      
                      if (activeView === 'catalog') {
                        setCatalogMappings(autoMappings);
                      } else {
                        setDetailMappings(autoMappings);
                      }
                      
                      const mappedCount = autoMappings.filter(m => m.targetField).length;
                      
                      toast({
                        title: "Smart Auto-Mapping Complete",
                        description: `Created ${mappedCount} intelligent mappings based on your actual CWR data fields for ${activeView === 'catalog' ? 'Master Catalog' : 'Product Detail'} view!`
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Auto-Map Fields
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const newMapping = {
                        sourceField: "",
                        targetField: "",
                        confidence: 0.5
                      };
                      setCatalogMappings([...catalogMappings, newMapping]);
                      toast({
                        title: "Mapping Added",
                        description: "New field mapping added."
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field Mapping
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">
                    Field Mappings ({catalogMappings.length})
                  </div>
                  
                  {catalogMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <div className="text-sm">No field mappings yet</div>
                      <div className="text-xs mt-1">Click "Auto-Map Fields" to get started</div>
                    </div>
                  ) : (
                    catalogMappings.map((mapping, index) => (
                      <Card key={index} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Source Field</label>
                              <div className="p-2 border rounded bg-blue-50">
                                <span className="text-sm font-medium">{mapping.sourceField || 'Not mapped'}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Target Field</label>
                              <div className="p-2 border rounded bg-green-50">
                                <span className="text-sm font-medium">{mapping.targetField || 'Not mapped'}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
                
                {/* Required fields warning */}
                {catalogMappings.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-orange-800 font-medium">Mapping Summary</div>
                      <div className="text-sm text-orange-700 mt-1">
                        {catalogMappings.filter(m => m.sourceField && m.targetField).length} of {catalogMappings.length} mappings complete
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 flex flex-col items-center justify-center">
                  <div className="text-center space-y-4">
                    <Wand2 className="w-16 h-16 text-gray-300 mx-auto" />
                    <h3 className="text-xl font-medium">No Sample Data</h3>
                    <p className="text-gray-600 max-w-md">
                      Please upload a sample file or pull sample data from SFTP to start mapping fields.
                    </p>
                    <Button onClick={() => setSelectedTab("template-info")}>
                      Go to Template Info
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}