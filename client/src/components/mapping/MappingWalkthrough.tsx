import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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
  master_catalog: [
    {
      id: 'usin',
      targetField: 'usin',
      required: true,
      description: 'Universal Supplier Item Number for internal tracking',
      example: '010342'
    },
    {
      id: 'name',
      targetField: 'name',
      required: true,
      description: 'Product Name',
      example: 'Marine Engine Oil Filter'
    },
    {
      id: 'description',
      targetField: 'description',
      required: true,
      description: 'Description',
      example: 'High-performance oil filter for marine engines...'
    },
    {
      id: 'upc',
      targetField: 'upc',
      required: true,
      description: 'UPC',
      example: '123456789012'
    },
    {
      id: 'manufacturer_part_number',
      targetField: 'manufacturerPartNumber',
      required: true,
      description: 'MPN',
      example: 'MPN-12345'
    },
    {
      id: 'manufacturer_name',
      targetField: 'manufacturerName',
      required: true,
      description: 'Brand',
      example: 'Mercury Marine'
    },
    {
      id: 'category',
      targetField: 'categoryName',
      required: false,
      description: 'Category',
      example: 'Marine Parts'
    },
    {
      id: 'cost',
      targetField: 'cost',
      required: false,
      description: 'Cost',
      example: '19.99'
    },
    {
      id: 'price',
      targetField: 'price',
      required: false,
      description: 'Price',
      example: '29.99'
    },
    {
      id: 'weight',
      targetField: 'weight',
      required: false,
      description: 'Weight',
      example: '2.5'
    }
  ],
  product_details: [
    {
      id: 'inventory_quantity',
      targetField: 'inventoryQuantity',
      required: false,
      description: 'Available stock quantity',
      example: '150'
    },
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
    },
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
    },
    {
      id: 'color',
      targetField: 'color',
      required: false,
      description: 'Product color',
      example: 'Black'
    },
    {
      id: 'material',
      targetField: 'material',
      required: false,
      description: 'Product material',
      example: 'Aluminum'
    }
  ]
};

const CATEGORY_ICONS = {
  master_catalog: Package,
  product_details: FileText
};

const CATEGORY_LABELS = {
  master_catalog: 'Master Catalog',
  product_details: 'Product Details Pages (50+ Fields)'
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
      console.log('Available source fields from CWR data:', fields);
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
            {/* Show available source fields */}
            {sourceFields.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-2">
                  Available fields from your CWR data ({sourceFields.length} fields):
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {sourceFields.slice(0, 10).map((field) => (
                    <span key={field} className="px-2 py-1 bg-white border border-blue-200 rounded text-blue-700 font-mono">
                      {field}
                    </span>
                  ))}
                  {sourceFields.length > 10 && (
                    <span className="px-2 py-1 text-blue-600">
                      +{sourceFields.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
            
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
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                    <div className="font-medium text-blue-800 mb-1">Sample values from your data:</div>
                    <div className="text-blue-700 font-mono text-xs">
                      {sampleData.slice(0, 4)
                        .map(row => row[currentMapping.sourceField])
                        .filter(val => val !== undefined && val !== null && val !== '')
                        .map(val => String(val).substring(0, 50) + (String(val).length > 50 ? '...' : ''))
                        .join(' • ') || 'No sample data available'}
                    </div>
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