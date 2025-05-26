import { useState } from "react";
import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Zap, Plus, X, Download, Upload, Save, Eye, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { LoadingAnimation, ButtonSpinner, SuccessAnimation } from "@/components/ui/loading-animations";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

interface DataSource {
  id: number;
  name: string;
  type: string;
}

export default function MappingTemplateWorkspace() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [sourceType, setSourceType] = useState("csv");
  const [isLoading, setIsLoading] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("info");
  const [mappingTarget, setMappingTarget] = useState("catalog");
  const [productDetailMappings, setProductDetailMappings] = useState<FieldMapping[]>([]);
  const [availableDataSources, setAvailableDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [loadingState, setLoadingState] = useState<'idle' | 'data-loading' | 'auto-mapping' | 'saving'>('idle');
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  // Get sample headers from loaded data
  const sampleHeaders = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

  const catalogFields = [
    { id: "sku", name: "SKU", required: true },
    { id: "product_name", name: "Product Name", required: true },
    { id: "upc", name: "UPC", required: false },
    { id: "cost", name: "Cost", required: false },
    { id: "price", name: "Price", required: false },
    { id: "brand", name: "Brand", required: false },
    { id: "category", name: "Category", required: false },
    { id: "status", name: "Status", required: false },
    { id: "description", name: "Description", required: false },
    { id: "primary_image", name: "Primary Image", required: false },
    { id: "weight", name: "Weight", required: false }
  ];

  const productDetailFields = [
    // Core Product Information
    { id: "detailed_description", name: "Detailed Description", required: false },
    { id: "full_description", name: "Full Description", required: false },
    { id: "uppercase_title", name: "Uppercase Title", required: false },
    { id: "manufacturer_part_number", name: "Manufacturer Part Number", required: false },
    { id: "specifications", name: "Specifications", required: false },
    { id: "features", name: "Features", required: false },
    { id: "quick_specs", name: "Quick Specs", required: false },
    
    // Physical Properties
    { id: "dimensions", name: "Dimensions", required: false },
    { id: "weight_detailed", name: "Weight (Detailed)", required: false },
    { id: "shipping_weight", name: "Shipping Weight", required: false },
    { id: "box_height", name: "Box Height", required: false },
    { id: "box_length", name: "Box Length", required: false },
    { id: "box_width", name: "Box Width", required: false },
    
    // Pricing & Availability
    { id: "list_price", name: "List Price", required: false },
    { id: "map_price", name: "MAP Price", required: false },
    { id: "mrp_price", name: "MRP Price", required: false },
    { id: "quantity_available_combined", name: "Quantity Available (Combined)", required: false },
    { id: "quantity_available_nj", name: "Quantity Available (NJ)", required: false },
    { id: "quantity_available_fl", name: "Quantity Available (FL)", required: false },
    { id: "next_shipment_date_combined", name: "Next Shipment Date (Combined)", required: false },
    { id: "next_shipment_date_nj", name: "Next Shipment Date (NJ)", required: false },
    { id: "next_shipment_date_fl", name: "Next Shipment Date (FL)", required: false },
    
    // Product Flags & Classifications
    { id: "non_stock", name: "Non-Stock", required: false },
    { id: "drop_ships_direct", name: "Drop Ships Direct", required: false },
    { id: "hazardous_materials", name: "Hazardous Materials", required: false },
    { id: "truck_freight", name: "Truck Freight", required: false },
    { id: "exportable", name: "Exportable", required: false },
    { id: "first_class_mail", name: "First Class Mail", required: false },
    { id: "oversized", name: "Oversized", required: false },
    { id: "remanufactured", name: "Remanufactured", required: false },
    { id: "closeout", name: "Closeout", required: false },
    { id: "sale", name: "Sale", required: false },
    { id: "rebate", name: "Rebate", required: false },
    { id: "free_shipping", name: "Free Shipping", required: false },
    { id: "returnable", name: "Returnable", required: false },
    
    // Media & Documentation
    { id: "image_300x300", name: "Image (300x300)", required: false },
    { id: "image_1000x1000", name: "Image (1000x1000)", required: false },
    { id: "image_additional", name: "Additional Images", required: false },
    { id: "quick_guide_pdf", name: "Quick Guide PDF", required: false },
    { id: "owners_manual_pdf", name: "Owners Manual PDF", required: false },
    { id: "brochure_pdf", name: "Brochure PDF", required: false },
    { id: "installation_guide_pdf", name: "Installation Guide PDF", required: false },
    { id: "video_urls", name: "Video URLs", required: false },
    
    // Compliance & Legal
    { id: "prop_65", name: "Prop 65", required: false },
    { id: "prop_65_description", name: "Prop 65 Description", required: false },
    { id: "harmonization_code", name: "Harmonization Code", required: false },
    { id: "country_of_origin", name: "Country of Origin", required: false },
    { id: "fcc_id", name: "FCC ID", required: false },
    
    // Sales & Marketing
    { id: "google_merchant_category", name: "Google Merchant Category", required: false },
    { id: "sale_start_date", name: "Sale Start Date", required: false },
    { id: "sale_end_date", name: "Sale End Date", required: false },
    { id: "original_price", name: "Original Price (Sale/Closeout)", required: false },
    { id: "rebate_description", name: "Rebate Description", required: false },
    { id: "rebate_start_date", name: "Rebate Start Date", required: false },
    { id: "rebate_end_date", name: "Rebate End Date", required: false },
    { id: "free_shipping_end_date", name: "Free Shipping End Date", required: false },
    
    // Inventory & Fulfillment
    { id: "case_qty_nj", name: "Case Qty (NJ)", required: false },
    { id: "case_qty_fl", name: "Case Qty (FL)", required: false },
    { id: "third_party_marketplaces", name: "3rd Party Marketplaces", required: false },
    
    // Accessories & Related
    { id: "accessories_by_sku", name: "Accessories by SKU", required: false },
    { id: "accessories_by_mfg", name: "Accessories by MFG#", required: false },
    
    // Additional Properties
    { id: "material", name: "Material", required: false },
    { id: "color", name: "Color", required: false },
    { id: "package_contents", name: "Package Contents", required: false },
    { id: "installation_notes", name: "Installation Notes", required: false },
    { id: "warranty", name: "Warranty", required: false }
  ];

  const getCurrentMappings = () => {
    return mappingTarget === "catalog" ? mappings : productDetailMappings;
  };

  const getCurrentTargetFields = () => {
    return mappingTarget === "catalog" ? catalogFields : productDetailFields;
  };

  const loadDataSources = async () => {
    try {
      const response = await apiRequest("GET", "/api/data-sources");
      if (response.ok) {
        const dataSources = await response.json();
        setAvailableDataSources(dataSources);
        if (dataSources.length > 0) {
          setSelectedDataSource(dataSources[0]);
          loadAvailableFiles(dataSources[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load data sources:", error);
    }
  };

  const loadAvailableFiles = async (dataSourceId: number) => {
    try {
      const response = await apiRequest("GET", `/api/data-sources/${dataSourceId}/files`);
      if (response.ok) {
        const result = await response.json();
        setAvailableFiles(result.files || []);
        if (result.files && result.files.length > 0) {
          setSelectedFile(result.files.find(f => f.includes('catalog')) || result.files[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load files:", error);
      setAvailableFiles(["/eco8/out/catalog.csv", "/eco8/out/inventory.csv"]);
      setSelectedFile("/eco8/out/catalog.csv");
    }
  };

  const loadSampleData = async () => {
    setLoadingState('data-loading');
    try {
      if (!selectedDataSource || !selectedFile) {
        throw new Error("Please select a data source and file");
      }

      console.log(`Attempting to pull real data from ${selectedDataSource.name} at path: ${selectedFile}`);
      
      const response = await apiRequest("POST", `/api/test-pull/${selectedDataSource.id}`, {
        limit: 10,
        path: selectedFile
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("Real data pull result:", result);
        
        if (result.sample_data && result.sample_data.length > 0) {
          setSampleData(result.sample_data);
          setShowSuccess(`Successfully loaded ${result.sample_data.length} authentic records from ${selectedFile}!`);
          setTimeout(() => setShowSuccess(null), 3000);
        } else {
          throw new Error("No sample data returned from source");
        }
      } else {
        const errorData = await response.json();
        console.error("SFTP connection failed:", errorData);
        throw new Error("Unable to connect to data source");
      }
    } catch (error) {
      console.error("Data load error:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unable to load data from selected source.",
        variant: "destructive"
      });
    } finally {
      setLoadingState('idle');
    }
  };

  React.useEffect(() => {
    loadDataSources();
  }, []);

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: `mapping-${Date.now()}`,
      sourceField: "",
      targetField: ""
    };

    if (mappingTarget === "catalog") {
      setMappings([...mappings, newMapping]);
    } else {
      setProductDetailMappings([...productDetailMappings, newMapping]);
    }
  };

  const removeMapping = (id: string) => {
    if (mappingTarget === "catalog") {
      setMappings(mappings.filter(m => m.id !== id));
    } else {
      setProductDetailMappings(productDetailMappings.filter(m => m.id !== id));
    }
  };

  const updateMapping = (id: string, field: 'sourceField' | 'targetField', value: string) => {
    if (mappingTarget === "catalog") {
      setMappings(mappings.map(m => m.id === id ? { ...m, [field]: value } : m));
    } else {
      setProductDetailMappings(productDetailMappings.map(m => m.id === id ? { ...m, [field]: value } : m));
    }
  };

  const autoMapFields = async () => {
    if (sampleHeaders.length === 0) {
      toast({
        title: "No Sample Data",
        description: "Please load sample data first to enable auto-mapping.",
        variant: "destructive"
      });
      return;
    }

    setLoadingState('auto-mapping');
    
    // Add a small delay to show the animation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const targetFields = getCurrentTargetFields();
    const newMappings: FieldMapping[] = [];

    for (const field of targetFields) {
      const bestMatch = sampleHeaders.find(header => {
        const headerLower = header.toLowerCase();
        const fieldLower = field.id.toLowerCase();
        
        // Exact matches
        if (headerLower === fieldLower) return true;
        if (headerLower.includes(fieldLower)) return true;
        if (fieldLower.includes(headerLower)) return true;
        
        // Smart field mapping for CWR data
        if (field.id === 'sku' && (headerLower.includes('sku') || headerLower.includes('part number'))) return true;
        if (field.id === 'product_name' && (headerLower.includes('name') || headerLower.includes('title'))) return true;
        if (field.id === 'price' && headerLower.includes('price')) return true;
        if (field.id === 'cost' && headerLower.includes('cost')) return true;
        if (field.id === 'brand' && (headerLower.includes('mfg') || headerLower.includes('brand') || headerLower.includes('manufacturer'))) return true;
        if (field.id === 'primary_image' && (headerLower.includes('image') || headerLower.includes('photo') || headerLower.includes('picture'))) return true;
        if (field.id === 'upc' && headerLower.includes('upc')) return true;
        if (field.id === 'category' && headerLower.includes('category')) return true;
        if (field.id === 'description' && headerLower.includes('description')) return true;
        if (field.id === 'weight' && headerLower.includes('weight')) return true;
        
        // Product Detail specific mappings
        if (field.id === 'manufacturer_part_number' && headerLower.includes('manufacturer part number')) return true;
        if (field.id === 'full_description' && headerLower.includes('full description')) return true;
        if (field.id === 'uppercase_title' && headerLower.includes('uppercase title')) return true;
        if (field.id === 'shipping_weight' && headerLower.includes('shipping weight')) return true;
        if (field.id === 'box_height' && headerLower.includes('box height')) return true;
        if (field.id === 'box_length' && headerLower.includes('box length')) return true;
        if (field.id === 'box_width' && headerLower.includes('box width')) return true;
        if (field.id === 'list_price' && headerLower.includes('list price')) return true;
        if (field.id === 'map_price' && headerLower.includes('m.a.p')) return true;
        if (field.id === 'mrp_price' && headerLower.includes('m.r.p')) return true;
        if (field.id === 'quantity_available_combined' && headerLower.includes('quantity available to ship (combined)')) return true;
        if (field.id === 'quantity_available_nj' && headerLower.includes('quantity available to ship (nj)')) return true;
        if (field.id === 'quantity_available_fl' && headerLower.includes('quantity available to ship (fl)')) return true;
        if (field.id === 'next_shipment_date_combined' && headerLower.includes('next shipment date (combined)')) return true;
        if (field.id === 'next_shipment_date_nj' && headerLower.includes('next shipment date (nj)')) return true;
        if (field.id === 'next_shipment_date_fl' && headerLower.includes('next shipment date (fl)')) return true;
        if (field.id === 'non_stock' && headerLower.includes('non-stock')) return true;
        if (field.id === 'drop_ships_direct' && headerLower.includes('drop ships direct')) return true;
        if (field.id === 'hazardous_materials' && headerLower.includes('hazardous materials')) return true;
        if (field.id === 'truck_freight' && headerLower.includes('truck freight')) return true;
        if (field.id === 'exportable' && headerLower.includes('exportable')) return true;
        if (field.id === 'first_class_mail' && headerLower.includes('first class mail')) return true;
        if (field.id === 'oversized' && headerLower.includes('oversized')) return true;
        if (field.id === 'remanufactured' && headerLower.includes('remanufactured')) return true;
        if (field.id === 'closeout' && headerLower.includes('closeout')) return true;
        if (field.id === 'sale' && headerLower.includes('sale') && !headerLower.includes('wholesale')) return true;
        if (field.id === 'rebate' && headerLower.includes('rebate')) return true;
        if (field.id === 'free_shipping' && headerLower.includes('free shipping')) return true;
        if (field.id === 'returnable' && headerLower.includes('returnable')) return true;
        if (field.id === 'image_300x300' && headerLower.includes('image (300x300)')) return true;
        if (field.id === 'image_1000x1000' && headerLower.includes('image (1000x1000)')) return true;
        if (field.id === 'image_additional' && headerLower.includes('image additional')) return true;
        if (field.id === 'quick_guide_pdf' && headerLower.includes('quick guide')) return true;
        if (field.id === 'owners_manual_pdf' && headerLower.includes('owners manual')) return true;
        if (field.id === 'brochure_pdf' && headerLower.includes('brochure')) return true;
        if (field.id === 'installation_guide_pdf' && headerLower.includes('installation guide')) return true;
        if (field.id === 'video_urls' && headerLower.includes('video urls')) return true;
        if (field.id === 'prop_65' && headerLower.includes('prop 65') && !headerLower.includes('description')) return true;
        if (field.id === 'prop_65_description' && headerLower.includes('prop 65 description')) return true;
        if (field.id === 'harmonization_code' && headerLower.includes('harmonization code')) return true;
        if (field.id === 'country_of_origin' && headerLower.includes('country of origin')) return true;
        if (field.id === 'fcc_id' && headerLower.includes('fcc id')) return true;
        if (field.id === 'google_merchant_category' && headerLower.includes('google merchant category')) return true;
        if (field.id === 'sale_start_date' && headerLower.includes('sale start date')) return true;
        if (field.id === 'sale_end_date' && headerLower.includes('sale end date')) return true;
        if (field.id === 'original_price' && headerLower.includes('original price')) return true;
        if (field.id === 'rebate_description' && headerLower.includes('rebate description') && !headerLower.includes('link')) return true;
        if (field.id === 'rebate_start_date' && headerLower.includes('rebate start date')) return true;
        if (field.id === 'rebate_end_date' && headerLower.includes('rebate end date')) return true;
        if (field.id === 'free_shipping_end_date' && headerLower.includes('free shipping end date')) return true;
        if (field.id === 'case_qty_nj' && headerLower.includes('case qty (nj)')) return true;
        if (field.id === 'case_qty_fl' && headerLower.includes('case qty (fl)')) return true;
        if (field.id === 'third_party_marketplaces' && headerLower.includes('3rd party marketplaces')) return true;
        if (field.id === 'accessories_by_sku' && headerLower.includes('accessories by sku')) return true;
        if (field.id === 'accessories_by_mfg' && headerLower.includes('accessories by mfg')) return true;
        if (field.id === 'quick_specs' && headerLower.includes('quick specs')) return true;
        
        return false;
      });

      if (bestMatch) {
        newMappings.push({
          id: `mapping-${field.id}-${Date.now()}`,
          sourceField: bestMatch,
          targetField: field.id
        });
      }
    }

    if (mappingTarget === "catalog") {
      setMappings(newMappings);
    } else {
      setProductDetailMappings(newMappings);
    }

    setLoadingState('idle');
    setShowSuccess(`🎯 Auto-mapping complete! Successfully mapped ${newMappings.length} fields automatically.`);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a name for your mapping template.",
        variant: "destructive"
      });
      return;
    }

    setLoadingState('saving');
    try {
      const mappingRecord = mappings.reduce((acc, mapping) => {
        if (mapping.sourceField && mapping.targetField) {
          acc[mapping.sourceField] = mapping.targetField;
        }
        return acc;
      }, {} as Record<string, string>);

      const templateData = {
        name: templateName,
        description: templateDescription,
        sourceType,
        mappings: mappingRecord,
        transformations: [],
        validationRules: [],
        supplierId: null,
        fileLabel: null
      };

      await apiRequest("POST", "/api/mapping-templates", templateData);

      setShowSuccess(`✨ Template "${templateName}" saved successfully with ${mappings.length} field mappings!`);
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the mapping template. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingState('idle');
    }
  };

  const previewMapping = () => {
    if (sampleData.length === 0) {
      toast({
        title: "No Sample Data",
        description: "Please load sample data first to preview the mapping.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Mapping Preview",
      description: `Preview shows how ${mappings.length} field mappings transform ${sampleData.length} sample records.`
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/mapping-templates">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create Mapping Template</h1>
          <div className="ml-auto">
            <Button onClick={saveTemplate} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Card className="max-w-6xl mx-auto">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Template Info</TabsTrigger>
                <TabsTrigger value="data">Sample Data</TabsTrigger>
                <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. CWR Product Catalog Import"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Source Type</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant={sourceType === 'csv' ? 'default' : 'outline'}
                        onClick={() => setSourceType('csv')}
                        className="flex-1"
                      >
                        CSV
                      </Button>
                      <Button 
                        type="button" 
                        variant={sourceType === 'excel' ? 'default' : 'outline'}
                        onClick={() => setSourceType('excel')}
                        className="flex-1"
                      >
                        EXCEL
                      </Button>
                      <Button 
                        type="button" 
                        variant={sourceType === 'sftp' ? 'default' : 'outline'}
                        onClick={() => setSourceType('sftp')}
                        className="flex-1"
                      >
                        SFTP
                      </Button>
                      <Button 
                        type="button" 
                        variant={sourceType === 'api' ? 'default' : 'outline'}
                        onClick={() => setSourceType('api')}
                        className="flex-1"
                      >
                        API
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Describe the purpose and scope of this mapping template..."
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="data" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Data Source</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 p-2 border rounded bg-gray-50">
                        <span className="text-sm font-medium">
                          {selectedDataSource ? selectedDataSource.name : "No data source selected"}
                        </span>
                        <div className="text-xs text-gray-500">
                          {selectedDataSource ? `Type: ${selectedDataSource.type.toUpperCase()}` : ""}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={loadDataSources}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>File Path</Label>
                    <div className="space-y-2">
                      <Input
                        value={selectedFile}
                        onChange={(e) => setSelectedFile(e.target.value)}
                        placeholder="Enter full path (e.g., /eco8/out/catalog.csv)"
                        className="w-full"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {availableFiles.length > 0 ? (
                          availableFiles.map(file => (
                            <Button
                              key={file}
                              variant={selectedFile === file ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedFile(file)}
                            >
                              {file.split('/').pop()}
                            </Button>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 p-2">Common paths shown below</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <Button 
                    onClick={loadSampleData} 
                    disabled={loadingState !== 'idle' || !selectedDataSource || !selectedFile}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loadingState === 'data-loading' ? (
                      <ButtonSpinner />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {loadingState === 'data-loading' ? "Loading..." : "Load Data from Source"}
                  </Button>
                  <Button variant="outline" disabled>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                </div>

                {/* Show loading animation */}
                {loadingState === 'data-loading' && (
                  <div className="mb-6">
                    <LoadingAnimation 
                      type="data-loading" 
                      message={`Pulling real data from ${selectedDataSource?.name} at ${selectedFile}`}
                    />
                  </div>
                )}

                {/* Show success message */}
                {showSuccess && loadingState === 'idle' && (
                  <div className="mb-4">
                    <SuccessAnimation message={showSuccess} />
                  </div>
                )}

                {sampleData.length > 0 ? (
                  <div className="space-y-4">
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
                        onClick={() => setActiveTab("mapping")}
                      >
                        Continue to Field Mapping →
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                    <div className="text-sm">No sample data loaded yet</div>
                    <div className="text-xs mt-1">Load data from a source to preview fields</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4 mt-4">
                {sampleHeaders.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex gap-2">
                      <Button 
                        variant={mappingTarget === "catalog" ? "default" : "outline"}
                        onClick={() => setMappingTarget("catalog")}
                        className="flex-1"
                      >
                        Master Catalog View
                      </Button>
                      <Button 
                        variant={mappingTarget === "product_detail" ? "default" : "outline"}
                        onClick={() => setMappingTarget("product_detail")}
                        className="flex-1"
                      >
                        Product Detail View
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={autoMapFields} 
                        disabled={loadingState !== 'idle'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loadingState === 'auto-mapping' ? (
                          <ButtonSpinner />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        {loadingState === 'auto-mapping' ? "Mapping..." : "Auto-Map Fields"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={addMapping}
                        disabled={loadingState !== 'idle'}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Field Mapping
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={previewMapping}
                        disabled={loadingState !== 'idle'}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Mapping
                      </Button>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Available Source Fields:</h4>
                      <div className="flex flex-wrap gap-2">
                        {sampleHeaders.map(header => (
                          <span key={header} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                            {header}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Show auto-mapping animation */}
                    {loadingState === 'auto-mapping' && (
                      <div className="my-6">
                        <LoadingAnimation 
                          type="auto-mapping" 
                          message="Analyzing your CWR fields and creating intelligent mappings..."
                        />
                      </div>
                    )}

                    {/* Show success message for auto-mapping */}
                    {showSuccess && loadingState === 'idle' && activeTab === 'mapping' && (
                      <div className="mb-4">
                        <SuccessAnimation message={showSuccess} />
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-700">
                        {mappingTarget === "catalog" ? "Master Catalog" : "Product Detail"} Field Mappings ({getCurrentMappings().length})
                      </div>
                      
                      {getCurrentMappings().length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                          <div className="text-sm">No field mappings yet</div>
                          <div className="text-xs mt-1">Click "Auto-Map Fields" to create mappings automatically</div>
                        </div>
                      ) : (
                        getCurrentMappings().map((mapping) => (
                          <Card key={mapping.id} className="border border-gray-200">
                            <CardContent className="p-4">
                              <div className="grid grid-cols-3 gap-4 items-center">
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">Source Field</label>
                                  <Select
                                    value={mapping.sourceField}
                                    onValueChange={(value) => updateMapping(mapping.id, 'sourceField', value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select source field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sampleHeaders.map(header => (
                                        <SelectItem key={header} value={header}>
                                          {header}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="text-center">
                                  <span className="text-gray-400">→</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">
                                      {mappingTarget === "catalog" ? "Catalog" : "Product Detail"} Target Field
                                    </label>
                                    <Select
                                      value={mapping.targetField}
                                      onValueChange={(value) => updateMapping(mapping.id, 'targetField', value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select target field" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getCurrentTargetFields().map(field => (
                                          <SelectItem key={field.id} value={field.id}>
                                            {field.name} {field.required && <span className="text-red-500">*</span>}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="pt-6">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => removeMapping(mapping.id)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>

                    {(mappings.length > 0 || productDetailMappings.length > 0) && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="text-sm text-green-800 font-medium">Mapping Summary</div>
                          <div className="text-sm text-green-700 mt-1">
                            ✅ Catalog: {mappings.filter(m => m.sourceField && m.targetField).length} mappings
                          </div>
                          <div className="text-sm text-green-700">
                            ✅ Product Detail: {productDetailMappings.filter(m => m.sourceField && m.targetField).length} mappings
                          </div>
                          <div className="text-sm text-green-700">
                            ✅ Total: {mappings.length + productDetailMappings.length} field mappings configured
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="pt-4 border-t">
                      <Button onClick={saveTemplate} disabled={isLoading} className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        {isLoading ? "Saving..." : "Save Mapping Template"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                    <div className="text-sm">No sample data available for mapping</div>
                    <div className="text-xs mt-1">Please load sample data from the Sample Data tab first</div>
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={() => setActiveTab("data")}
                    >
                      Go to Sample Data
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}