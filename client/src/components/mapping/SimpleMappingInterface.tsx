import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  id: string;
}

interface Field {
  id: string;
  name: string;
  required?: boolean;
  description?: string;
  type?: string;
}

interface SimpleMappingInterfaceProps {
  sampleHeaders: string[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
}

export function SimpleMappingInterface({ sampleHeaders, onMappingsChange }: SimpleMappingInterfaceProps) {
  const { toast } = useToast();
  
  // Hardcoded target fields for reliability
  const targetFields: Field[] = [
    { id: "sku", name: "SKU", required: true, description: "Unique product identifier" },
    { id: "product_name", name: "Product Name", required: true, description: "Full product name/title" },
    { id: "category", name: "Category", description: "Product category" },
    { id: "price", name: "Price", description: "Retail price" },
    { id: "cost", name: "Cost", description: "Wholesale cost" },
    { id: "manufacturer", name: "Manufacturer", description: "Product manufacturer/brand name" },
    { id: "status", name: "Status", description: "Product status" },
    { id: "upc", name: "UPC", description: "Universal Product Code" },
  ];

  const [mappings, setMappings] = useState<FieldMapping[]>([]);

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: `mapping_${Date.now()}`,
      sourceField: '',
      targetField: ''
    };
    const updatedMappings = [...mappings, newMapping];
    setMappings(updatedMappings);
    onMappingsChange(updatedMappings);
    
    toast({
      title: "Mapping Added",
      description: "New field mapping row added.",
    });
  };

  const removeMapping = (id: string) => {
    const updatedMappings = mappings.filter(m => m.id !== id);
    setMappings(updatedMappings);
    onMappingsChange(updatedMappings);
    
    toast({
      title: "Mapping Removed",
      description: "Field mapping removed.",
    });
  };

  const updateMapping = (id: string, field: 'sourceField' | 'targetField', value: string) => {
    const updatedMappings = mappings.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    );
    setMappings(updatedMappings);
    onMappingsChange(updatedMappings);
  };

  const autoMapFields = () => {
    console.log("🚀 Auto-mapping with headers:", sampleHeaders);
    console.log("🚀 Auto-mapping with targets:", targetFields);
    
    const newMappings: FieldMapping[] = [];
    
    // Auto-mapping logic
    const mappingRules = [
      { target: 'sku', sources: ['sku', 'part number', 'item number', 'product id', 'cwr part number'] },
      { target: 'product_name', sources: ['title', 'name', 'product name', 'description', 'uppercase title'] },
      { target: 'upc', sources: ['upc', 'upc code', 'barcode', 'gtin'] },
      { target: 'price', sources: ['price', 'list price', 'retail price', 'msrp'] },
      { target: 'cost', sources: ['cost', 'your cost', 'wholesale price', 'dealer cost'] },
      { target: 'manufacturer', sources: ['manufacturer', 'brand', 'mfg', 'manufacturer name'] },
      { target: 'category', sources: ['category', 'category name', 'product category'] },
    ];

    mappingRules.forEach(rule => {
      const matchingHeader = sampleHeaders.find(header => 
        rule.sources.some(source => 
          header.toLowerCase().includes(source.toLowerCase())
        )
      );
      
      if (matchingHeader) {
        newMappings.push({
          id: `auto_${rule.target}_${Date.now()}`,
          sourceField: matchingHeader,
          targetField: rule.target
        });
      }
    });

    console.log("🚀 Created auto-mappings:", newMappings);
    
    setMappings(newMappings);
    onMappingsChange(newMappings);
    
    toast({
      title: "Auto-Mapping Complete",
      description: `Created ${newMappings.length} automatic field mappings.`,
    });
  };

  const requiredFields = targetFields.filter(f => f.required);
  const mappedTargets = new Set(mappings.map(m => m.targetField).filter(Boolean));
  const unmappedRequired = requiredFields.filter(f => !mappedTargets.has(f.id));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={addMapping} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Field Mapping
        </Button>
        <Button onClick={autoMapFields} variant="default" size="sm">
          <Zap className="w-4 h-4 mr-2" />
          Auto-Map Fields
        </Button>
      </div>

      {/* Unmapped Required Fields Warning */}
      {unmappedRequired.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-800">Required fields not mapped</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-orange-700">
              The following required fields are not mapped:
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {unmappedRequired.map(field => (
                <Badge key={field.id} variant="outline" className="text-orange-700 border-orange-300">
                  {field.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mappings List */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700">
          Field Mappings ({mappings.length})
        </div>
        
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
            <div className="text-sm">No field mappings yet</div>
            <div className="text-xs mt-1">Click "Add Field Mapping" or "Auto-Map Fields" to get started</div>
          </div>
        ) : (
          mappings.map((mapping) => (
            <Card key={mapping.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Source Field</label>
                    <Select 
                      value={mapping.sourceField} 
                      onValueChange={(value) => updateMapping(mapping.id, 'sourceField', value)}
                    >
                      <SelectTrigger>
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
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Target Field</label>
                      <Select 
                        value={mapping.targetField} 
                        onValueChange={(value) => updateMapping(mapping.id, 'targetField', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetFields.map(field => (
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

      {/* Summary */}
      {mappings.length > 0 && (
        <div className="text-xs text-gray-500 mt-4">
          {mappings.filter(m => m.sourceField && m.targetField).length} of {mappings.length} mappings complete
        </div>
      )}
    </div>
  );
}