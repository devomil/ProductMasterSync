import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Target,
  Database,
  ShoppingCart,
  Package,
  DollarSign,
  Image,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MappingField {
  id: string;
  sourceField: string;
  targetField: string;
  required: boolean;
  category: 'identification' | 'product_info' | 'pricing' | 'inventory' | 'images' | 'specifications';
  description: string;
  example?: string;
}

interface MappingWalkthroughProps {
  dataSourceId: string;
  sampleData: any[];
  onComplete: (mappings: MappingField[]) => void;
  onCancel: () => void;
}

const REQUIRED_MAPPINGS = {
  identification: [
    {
      id: 'sku',
      targetField: 'sku',
      required: true,
      description: 'Unique product identifier',
      example: 'EDC010342'
    },
    {
      id: 'upc',
      targetField: 'upc',
      required: true,
      description: 'Universal Product Code for marketplace integration',
      example: '123456789012'
    },
    {
      id: 'manufacturer_part_number',
      targetField: 'manufacturerPartNumber',
      required: true,
      description: 'Manufacturer part number',
      example: 'MPN-12345'
    }
  ],
  product_info: [
    {
      id: 'name',
      targetField: 'name',
      required: true,
      description: 'Product display name',
      example: 'Marine Engine Oil Filter'
    },
    {
      id: 'description',
      targetField: 'description',
      required: true,
      description: 'Detailed product description',
      example: 'High-performance oil filter for marine engines...'
    },
    {
      id: 'manufacturer_name',
      targetField: 'manufacturerName',
      required: true,
      description: 'Brand or manufacturer name',
      example: 'Mercury Marine'
    }
  ],
  pricing: [
    {
      id: 'price',
      targetField: 'price',
      required: true,
      description: 'Retail selling price',
      example: '29.99'
    },
    {
      id: 'cost',
      targetField: 'cost',
      required: false,
      description: 'Supplier cost (for margin calculation)',
      example: '19.99'
    }
  ],
  inventory: [
    {
      id: 'inventory_quantity',
      targetField: 'inventoryQuantity',
      required: true,
      description: 'Available stock quantity',
      example: '150'
    },
    {
      id: 'weight',
      targetField: 'weight',
      required: false,
      description: 'Product weight for shipping',
      example: '2.5'
    }
  ],
  images: [
    {
      id: 'image_url',
      targetField: 'imageUrl',
      required: false,
      description: 'Primary product image URL',
      example: 'https://example.com/product.jpg'
    },
    {
      id: 'image_url_large',
      targetField: 'imageUrlLarge',
      required: false,
      description: 'High-resolution product image',
      example: 'https://example.com/product_large.jpg'
    }
  ],
  specifications: [
    {
      id: 'dimensions',
      targetField: 'dimensions',
      required: false,
      description: 'Product dimensions',
      example: '10x5x3 inches'
    },
    {
      id: 'case_quantity',
      targetField: 'caseQuantity',
      required: false,
      description: 'Units per case for bulk ordering',
      example: '12'
    }
  ]
};

const CATEGORY_ICONS = {
  identification: Target,
  product_info: Package,
  pricing: DollarSign,
  inventory: Database,
  images: Image,
  specifications: FileText
};

const CATEGORY_LABELS = {
  identification: 'Product Identification',
  product_info: 'Product Information',
  pricing: 'Pricing & Costs',
  inventory: 'Inventory & Stock',
  images: 'Images & Media',
  specifications: 'Specifications & Attributes'
};

export function MappingWalkthrough({ dataSourceId, sampleData, onComplete, onCancel }: MappingWalkthroughProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [mappings, setMappings] = useState<Record<string, MappingField>>({});
  const [sourceFields, setSourceFields] = useState<string[]>([]);

  const categories = Object.keys(REQUIRED_MAPPINGS) as Array<keyof typeof REQUIRED_MAPPINGS>;
  const currentCategory = categories[currentStep];
  const currentFields = REQUIRED_MAPPINGS[currentCategory];

  useEffect(() => {
    // Extract field names from sample data
    if (sampleData && sampleData.length > 0) {
      const fields = Object.keys(sampleData[0] || {});
      setSourceFields(fields);
    }
  }, [sampleData]);

  const updateMapping = (fieldId: string, sourceField: string) => {
    const targetField = currentFields.find(f => f.id === fieldId);
    if (targetField) {
      // Handle skipped fields by setting empty sourceField
      const actualSourceField = sourceField === "__SKIP__" ? "" : sourceField;
      
      setMappings(prev => ({
        ...prev,
        [fieldId]: {
          id: fieldId,
          sourceField: actualSourceField,
          targetField: targetField.targetField,
          required: targetField.required,
          category: currentCategory,
          description: targetField.description,
          example: targetField.example
        }
      }));
    }
  };

  const getCompletionStats = () => {
    const totalRequired = Object.values(REQUIRED_MAPPINGS)
      .flat()
      .filter(f => f.required).length;
    
    const mappedRequired = Object.values(mappings)
      .filter(m => m.required && m.sourceField).length;
    
    const totalOptional = Object.values(REQUIRED_MAPPINGS)
      .flat()
      .filter(f => !f.required).length;
    
    const mappedOptional = Object.values(mappings)
      .filter(m => !m.required && m.sourceField).length;

    return {
      totalRequired,
      mappedRequired,
      totalOptional,
      mappedOptional,
      requiredComplete: mappedRequired === totalRequired,
      overallProgress: Math.round(((mappedRequired + mappedOptional) / (totalRequired + totalOptional)) * 100)
    };
  };

  const getCurrentCategoryStats = () => {
    const categoryFields = currentFields;
    const mappedFields = categoryFields.filter(f => mappings[f.id]?.sourceField);
    const requiredFields = categoryFields.filter(f => f.required);
    const mappedRequired = requiredFields.filter(f => mappings[f.id]?.sourceField);
    
    return {
      total: categoryFields.length,
      mapped: mappedFields.length,
      required: requiredFields.length,
      mappedRequired: mappedRequired.length,
      complete: mappedRequired.length === requiredFields.length
    };
  };

  const canProceedToNext = () => {
    const stats = getCurrentCategoryStats();
    return stats.mappedRequired === stats.required;
  };

  const handleNext = () => {
    if (currentStep < categories.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete the mapping process
      const mappingArray = Object.values(mappings);
      onComplete(mappingArray);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const stats = getCompletionStats();
  const categoryStats = getCurrentCategoryStats();
  const IconComponent = CATEGORY_ICONS[currentCategory];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Field Mapping Walkthrough</h2>
        <p className="text-gray-600 mt-2">
          Map your supplier data fields to our master catalog structure for accurate product imports
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mapping Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{stats.overallProgress}%</span>
              </div>
              <Progress value={stats.overallProgress} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={stats.requiredComplete ? "default" : "destructive"}>
                  {stats.mappedRequired}/{stats.totalRequired}
                </Badge>
                <span>Required Fields</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {stats.mappedOptional}/{stats.totalOptional}
                </Badge>
                <span>Optional Fields</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Steps */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-2">
          {categories.map((category, index) => {
            const Icon = CATEGORY_ICONS[category];
            const isActive = index === currentStep;
            const isCompleted = index < currentStep || (index === currentStep && categoryStats.complete);
            
            return (
              <div key={category} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isCompleted 
                    ? 'bg-green-100 border-green-500 text-green-700' 
                    : isActive 
                      ? 'bg-blue-100 border-blue-500 text-blue-700' 
                      : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                {index < categories.length - 1 && (
                  <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="h-5 w-5" />
            {CATEGORY_LABELS[currentCategory]}
            <Badge variant={categoryStats.complete ? "default" : "secondary"}>
              {categoryStats.mapped}/{categoryStats.total} mapped
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentFields.map((field) => {
            const currentMapping = mappings[field.id];
            
            return (
              <div key={field.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{field.targetField}</h4>
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </div>
                  {currentMapping?.sourceField && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                
                <p className="text-sm text-gray-600">{field.description}</p>
                
                {field.example && (
                  <p className="text-xs text-gray-500">Example: {field.example}</p>
                )}
                
                <div>
                  <Label className="text-sm font-medium">Map to source field:</Label>
                  <Select
                    value={currentMapping?.sourceField || ""}
                    onValueChange={(value) => updateMapping(field.id, value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a field from your data..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__SKIP__">-- Skip this field --</SelectItem>
                      {sourceFields.map((sourceField) => (
                        <SelectItem key={sourceField} value={sourceField}>
                          {sourceField}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Show sample data preview */}
                {currentMapping?.sourceField && sampleData.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded text-xs">
                    <strong>Sample values:</strong> {
                      sampleData.slice(0, 3)
                        .map(row => row[currentMapping.sourceField])
                        .filter(val => val !== undefined && val !== null && val !== '')
                        .join(', ') || 'No sample data available'
                    }
                  </div>
                )}
              </div>
            );
          })}
          
          {!categoryStats.complete && categoryStats.required > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map all required fields to continue. Required fields are essential for product catalog functionality.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleNext}
            disabled={!canProceedToNext()}
            className="gap-2"
          >
            {currentStep === categories.length - 1 ? 'Complete Mapping' : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, className = "", ...props }: any) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  );
}