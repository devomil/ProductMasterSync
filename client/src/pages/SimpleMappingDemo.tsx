import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Zap, Plus, X, Download, Upload, Save, Eye } from "lucide-react";
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

  const targetFields = [
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

  const autoMapFields = () => {
    const autoMappings: FieldMapping[] = [
      { id: "1", sourceField: "CWR Part Number", targetField: "sku" },
      { id: "2", sourceField: "Title", targetField: "product_name" },
      { id: "3", sourceField: "UPC Code", targetField: "upc" },
      { id: "4", sourceField: "Your Cost", targetField: "cost" },
      { id: "5", sourceField: "List Price", targetField: "price" },
      { id: "6", sourceField: "Manufacturer Name", targetField: "manufacturer" },
      { id: "7", sourceField: "Category Name", targetField: "category" }
    ];
    
    setMappings(autoMappings);
    toast({
      title: "Auto-Mapping Complete",
      description: `Created ${autoMappings.length} field mappings successfully!`
    });
  };

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: Date.now().toString(),
      sourceField: "",
      targetField: ""
    };
    setMappings([...mappings, newMapping]);
    toast({
      title: "Mapping Added",
      description: "New field mapping added. Configure the fields."
    });
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const loadSampleData = () => {
    setIsLoading(true);
    // Simulate loading CWR sample data
    setTimeout(() => {
      const mockSampleData = [
        {
          "CWR Part Number": "ABC123",
          "Title": "Premium Widget Pro",
          "UPC Code": "123456789012",
          "Your Cost": "$45.99",
          "List Price": "$89.99",
          "Manufacturer Name": "ACME Corp",
          "Category Name": "Electronics",
          "Description": "High-quality premium widget with advanced features",
          "Weight": "2.5 lbs",
          "Dimensions": "10x8x4 inches"
        },
        {
          "CWR Part Number": "DEF456",
          "Title": "Standard Widget",
          "UPC Code": "234567890123",
          "Your Cost": "$25.99",
          "List Price": "$49.99",
          "Manufacturer Name": "Widget Co",
          "Category Name": "Tools",
          "Description": "Reliable standard widget for everyday use",
          "Weight": "1.8 lbs",
          "Dimensions": "8x6x3 inches"
        }
      ];
      setSampleData(mockSampleData);
      setIsLoading(false);
      toast({
        title: "Sample Data Loaded",
        description: `Loaded ${mockSampleData.length} sample records from CWR supplier.`
      });
    }, 1500);
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

      await apiRequest("/api/mapping-templates", "POST", templateData);

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
                <div className="flex gap-2 mb-4">
                  <Button onClick={loadSampleData} disabled={isLoading}>
                    <Download className="w-4 h-4 mr-2" />
                    {isLoading ? "Loading..." : "Load CWR Sample Data"}
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
                    Field Mappings ({mappings.length})
                  </div>
                  
                  {mappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <div className="text-sm">No field mappings yet</div>
                      <div className="text-xs mt-1">Click "Auto-Map Fields" to create mappings automatically</div>
                    </div>
                  ) : (
                    mappings.map((mapping) => (
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
                                <label className="text-xs text-gray-500 mb-1 block">Target Field</label>
                                <div className="p-2 border rounded bg-green-50">
                                  <span className="text-sm font-medium">
                                    {targetFields.find(f => f.id === mapping.targetField)?.name || 'Not selected'}
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
                {mappings.length > 0 && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-green-800 font-medium">Mapping Summary</div>
                      <div className="text-sm text-green-700 mt-1">
                        ✅ {mappings.filter(m => m.sourceField && m.targetField).length} of {mappings.length} mappings complete
                      </div>
                      <div className="text-sm text-green-700">
                        ✅ Required fields: {targetFields.filter(f => f.required && mappings.some(m => m.targetField === f.id)).length} of {targetFields.filter(f => f.required).length} mapped
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