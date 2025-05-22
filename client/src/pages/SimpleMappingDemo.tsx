import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Zap, Plus, X } from "lucide-react";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

export default function SimpleMappingDemo() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [templateName, setTemplateName] = useState("");

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

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a name for your mapping template.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Template Saved",
      description: `Mapping template "${templateName}" saved with ${mappings.length} field mappings.`
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

        {/* Template Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Mapping Interface */}
        <Card>
          <CardHeader>
            <CardTitle>Field Mapping</CardTitle>
            <div className="flex gap-2">
              <Button onClick={autoMapFields} className="bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-2" />
                Auto-Map Fields
              </Button>
              <Button variant="outline" onClick={addMapping}>
                <Plus className="w-4 h-4 mr-2" />
                Add Field Mapping
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button onClick={saveTemplate} className="w-full">
                Save Mapping Template
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}