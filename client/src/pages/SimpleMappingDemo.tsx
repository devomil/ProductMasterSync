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
import { apiRequest } from "@/lib/queryClient";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

export default function SimpleMappingDemo() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [sourceType, setSourceType] = useState("csv");
  const [isLoading, setIsLoading] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("mapping");
  const [mappingTarget, setMappingTarget] = useState("catalog"); // "catalog" or "product_detail"
  const [productDetailMappings, setProductDetailMappings] = useState<FieldMapping[]>([]);

  // Sample headers from CWR data
  const sampleHeaders = [
    "CWR Part Number",
    "Title", 
    "UPC Code",
    "Your Cost",
    "List Price",
    "Manufacturer Name",
    "Category Name",
    "Description",
    "Weight",
    "Dimensions"
  ];

  const catalogFields = [
    { id: "sku", name: "SKU", required: true },
    { id: "product_name", name: "Product Name", required: true },
    { id: "upc", name: "UPC", required: false },
    { id: "cost", name: "Cost", required: false },
    { id: "price", name: "Price", required: false },
    { id: "manufacturer", name: "Manufacturer", required: false },
    { id: "category", name: "Category", required: false },
    { id: "description", name: "Description", required: false },
    { id: "weight", name: "Weight", required: false },
    { id: "dimensions", name: "Dimensions", required: false }
  ];

  const productDetailFields = [
    { id: "detailed_description", name: "Detailed Description", required: false },
    { id: "specifications", name: "Specifications", required: false },
    { id: "features", name: "Features", required: false },
    { id: "warranty_info", name: "Warranty Information", required: false },
    { id: "installation_guide", name: "Installation Guide", required: false },
    { id: "compatibility", name: "Compatibility", required: false },
    { id: "material", name: "Material", required: false },
    { id: "color", name: "Color", required: false },
    { id: "brand_details", name: "Brand Details", required: false },
    { id: "model_number", name: "Model Number", required: false },
    { id: "part_number", name: "Part Number", required: false },
    { id: "technical_specs", name: "Technical Specifications", required: false },
    { id: "safety_warnings", name: "Safety Warnings", required: false },
    { id: "certifications", name: "Certifications", required: false },
    { id: "country_of_origin", name: "Country of Origin", required: false }
  ];

  const getCurrentTargetFields = () => {
    return mappingTarget === "catalog" ? catalogFields : productDetailFields;
  };

  const getCurrentMappings = () => {
    return mappingTarget === "catalog" ? mappings : productDetailMappings;
  };

  const setCurrentMappings = (newMappings: FieldMapping[]) => {
    if (mappingTarget === "catalog") {
      setMappings(newMappings);
    } else {
      setProductDetailMappings(newMappings);
    }
  };

  const autoMapFields = () => {
    const currentTargetFields = getCurrentTargetFields();
    
    let autoMappings: FieldMapping[] = [];
    
    if (mappingTarget === "catalog") {
      autoMappings = [
        { id: "1", sourceField: "CWR Part Number", targetField: "sku" },
        { id: "2", sourceField: "Title", targetField: "product_name" },
        { id: "3", sourceField: "UPC Code", targetField: "upc" },
        { id: "4", sourceField: "Your Cost", targetField: "cost" },
        { id: "5", sourceField: "List Price", targetField: "price" },
        { id: "6", sourceField: "Manufacturer Name", targetField: "manufacturer" },
        { id: "7", sourceField: "Category Name", targetField: "category" }
      ];
    } else {
      // Product detail mappings
      autoMappings = [
        { id: "pd1", sourceField: "Description", targetField: "detailed_description" },
        { id: "pd2", sourceField: "Weight", targetField: "specifications" },
        { id: "pd3", sourceField: "Dimensions", targetField: "technical_specs" },
        { id: "pd4", sourceField: "Manufacturer Name", targetField: "brand_details" },
        { id: "pd5", sourceField: "CWR Part Number", targetField: "part_number" }
      ];
    }
    
    setCurrentMappings(autoMappings);
    toast({
      title: "Auto-Mapping Complete",
      description: `Created ${autoMappings.length} ${mappingTarget === "catalog" ? "catalog" : "product detail"} field mappings!`
    });
  };

  const addMapping = () => {
    const currentMappings = getCurrentMappings();
    const newMapping: FieldMapping = {
      id: Date.now().toString(),
      sourceField: "",
      targetField: ""
    };
    setCurrentMappings([...currentMappings, newMapping]);
    toast({
      title: "Mapping Added",
      description: "New field mapping added. Configure the fields."
    });
  };

  const removeMapping = (id: string) => {
    const currentMappings = getCurrentMappings();
    setCurrentMappings(currentMappings.filter(m => m.id !== id));
  };

  const [availableDataSources, setAvailableDataSources] = useState<any[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<any>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");

  const loadDataSources = async () => {
    try {
      const response = await fetch("/api/data-sources");
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
      // Set actual available file paths if API fails
      setAvailableFiles(["/eco8/out/catalog.csv", "/eco8/out/inventory.csv"]);
      setSelectedFile("/eco8/out/catalog.csv");
    }
  };

  const loadSampleData = async () => {
    setIsLoading(true);
    try {
      if (!selectedDataSource || !selectedFile) {
        throw new Error("Please select a data source and file");
      }

      // Use the data source test-pull endpoint with selected file
      const response = await apiRequest("POST", `/api/test-pull/${selectedDataSource.id}`, {
        limit: 10,
        path: selectedFile
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.sample_data && result.sample_data.length > 0) {
          setSampleData(result.sample_data);
          toast({
            title: "Data Loaded Successfully",
            description: `Loaded ${result.sample_data.length} records from ${selectedFile}.`
          });
        } else {
          throw new Error("No sample data returned");
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Connection failed");
      }
    } catch (error) {
      console.error("Data load error:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unable to load data from selected source.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load data sources on component mount
  React.useEffect(() => {
    loadDataSources();
  }, []);

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a name for your mapping template.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Convert mappings to the expected format
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

      toast({
        title: "Template Saved Successfully",
        description: `Mapping template "${templateName}" saved with ${mappings.length} field mappings.`
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the mapping template. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Templates
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Working Mapping Interface Demo</h1>
        </div>

        {/* Enhanced Interface with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Mapping Template Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Template Info</TabsTrigger>
                <TabsTrigger value="data">Sample Data</TabsTrigger>
                <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., CWR Product Catalog Import"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-type">Source Type</Label>
                    <div className="flex gap-2">
                      {["csv", "excel", "sftp", "api"].map(type => (
                        <Button
                          key={type}
                          variant={sourceType === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceType(type)}
                        >
                          {type.toUpperCase()}
                        </Button>
                      ))}
                    </div>
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
              </TabsContent>

              <TabsContent value="data" className="space-y-4 mt-4">
                {/* Data Source Selection */}
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
                    disabled={isLoading || !selectedDataSource || !selectedFile}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isLoading ? "Loading..." : "Load Data from Source"}
                  </Button>
                  <Button variant="outline" disabled>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                </div>

                {sampleData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Sample Data Preview</h4>
                      <Badge variant="secondary">{sampleData.length} records</Badge>
                    </div>
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-auto">
                      <div className="text-xs font-mono">
                        <div className="grid grid-cols-4 gap-2 mb-2 font-semibold">
                          <div>SKU</div>
                          <div>Title</div>
                          <div>Price</div>
                          <div>Category</div>
                        </div>
                        {sampleData.slice(0, 3).map((row, idx) => (
                          <div key={idx} className="grid grid-cols-4 gap-2 py-1 border-t">
                            <div className="truncate">{row["CWR Part Number"]}</div>
                            <div className="truncate">{row["Title"]}</div>
                            <div className="truncate">{row["List Price"]}</div>
                            <div className="truncate">{row["Category Name"]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                    <div className="text-sm">No sample data loaded</div>
                    <div className="text-xs mt-1">Click "Load CWR Sample Data" to get started</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4 mt-4">
                {/* Mapping Target Selector */}
                <div className="flex gap-2 mb-4">
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <Button
                      variant={mappingTarget === "catalog" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMappingTarget("catalog")}
                    >
                      Master Catalog View
                    </Button>
                    <Button
                      variant={mappingTarget === "product_detail" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMappingTarget("product_detail")}
                    >
                      Product Detail View
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <Button onClick={autoMapFields} className="bg-blue-600 hover:bg-blue-700">
                    <Zap className="w-4 h-4 mr-2" />
                    Auto-Map Fields
                  </Button>
                  <Button variant="outline" onClick={addMapping}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field Mapping
                  </Button>
                  <Button variant="outline" onClick={previewMapping} disabled={sampleData.length === 0}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Mapping
                  </Button>
                </div>

                {/* Sample Data Preview */}
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

                {/* Mappings */}
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
                              <div className="p-2 border rounded bg-blue-50">
                                <span className="text-sm font-medium">{mapping.sourceField || 'Not selected'}</span>
                              </div>
                            </div>
                            <div className="text-center">
                              <span className="text-gray-400">→</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">
                                  {mappingTarget === "catalog" ? "Catalog" : "Product Detail"} Target Field
                                </label>
                                <div className="p-2 border rounded bg-green-50">
                                  <span className="text-sm font-medium">
                                    {getCurrentTargetFields().find(f => f.id === mapping.targetField)?.name || 'Not selected'}
                                  </span>
                                </div>
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

                {/* Summary */}
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

                {/* Save Button */}
                <div className="pt-4 border-t">
                  <Button onClick={saveTemplate} disabled={isLoading} className="w-full">
                    <Save className="w-4 h-4 mr-2" />
                    {isLoading ? "Saving..." : "Save Mapping Template"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}