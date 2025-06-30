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
  FileText,
  Sparkles,
  Brain,
  Zap,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MappingField {
  id: string;
  sourceField: string;
  targetField: string;
  required: boolean;
  category: 'master_catalog' | 'inventory' | 'pricing' | 'shipping' | 'compliance' | 'promotions' | 'documentation';
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
  // Inventory Tab Fields
  inventory: [
    {
      id: 'quantity_available_combined',
      targetField: 'quantityAvailableCombined',
      required: false,
      description: 'Total available stock across all warehouses',
      example: '150'
    },
    {
      id: 'quantity_available_nj',
      targetField: 'quantityAvailableNj',
      required: false,
      description: 'Stock available in NJ warehouse',
      example: '75'
    },
    {
      id: 'quantity_available_fl',
      targetField: 'quantityAvailableFl',
      required: false,
      description: 'Stock available in FL warehouse',
      example: '75'
    },
    {
      id: 'quantity_backordered',
      targetField: 'quantityBackordered',
      required: false,
      description: 'Items on backorder',
      example: '25'
    },
    {
      id: 'quantity_committed',
      targetField: 'quantityCommitted',
      required: false,
      description: 'Stock committed to orders',
      example: '10'
    },
    {
      id: 'quantity_on_hand',
      targetField: 'quantityOnHand',
      required: false,
      description: 'Physical inventory count',
      example: '185'
    },
    {
      id: 'next_shipment_date_combined',
      targetField: 'nextShipmentDateCombined',
      required: false,
      description: 'Next expected shipment date',
      example: '2025-07-15'
    },
    {
      id: 'shipping_weight',
      targetField: 'shippingWeight',
      required: false,
      description: 'Product shipping weight',
      example: '2.5'
    },
    {
      id: 'case_quantity',
      targetField: 'caseQuantity',
      required: false,
      description: 'Units per case for bulk ordering',
      example: '12'
    }
  ],

  // Pricing Tab Fields  
  pricing: [
    {
      id: 'your_cost',
      targetField: 'yourCost',
      required: false,
      description: 'Supplier cost price',
      example: '19.99'
    },
    {
      id: 'list_price',
      targetField: 'listPrice',
      required: false,
      description: 'Manufacturer list price',
      example: '29.99'
    },
    {
      id: 'map_price',
      targetField: 'mapPrice',
      required: false,
      description: 'Minimum advertised price',
      example: '28.49'
    },
    {
      id: 'mrp_price',
      targetField: 'mrpPrice',
      required: false,
      description: 'Manufacturer suggested retail price',
      example: '35.99'
    },
    {
      id: 'core_cost',
      targetField: 'coreCost',
      required: false,
      description: 'Core exchange cost',
      example: '15.99'
    },
    {
      id: 'tariff_cost',
      targetField: 'tariffCost',
      required: false,
      description: 'Import tariff cost',
      example: '1.00'
    },
    {
      id: 'original_price_sale',
      targetField: 'originalPriceSale',
      required: false,
      description: 'Original price before sale',
      example: '29.99'
    }
  ],

  // Shipping Tab Fields
  shipping: [
    {
      id: 'box_height',
      targetField: 'boxHeight',
      required: false,
      description: 'Package height',
      example: '5'
    },
    {
      id: 'box_length',
      targetField: 'boxLength',
      required: false,
      description: 'Package length',
      example: '10'
    },
    {
      id: 'box_width',
      targetField: 'boxWidth',
      required: false,
      description: 'Package width',
      example: '8'
    },
    {
      id: 'drop_ships_direct',
      targetField: 'dropShipsDirect',
      required: false,
      description: 'Ships direct from vendor',
      example: 'Yes'
    },
    {
      id: 'truck_freight',
      targetField: 'truckFreight',
      required: false,
      description: 'Requires truck freight',
      example: 'No'
    },
    {
      id: 'oversized',
      targetField: 'oversized',
      required: false,
      description: 'Oversized shipping required',
      example: 'No'
    },
    {
      id: 'first_class_mail',
      targetField: 'firstClassMail',
      required: false,
      description: 'Can ship first class mail',
      example: 'Yes'
    },
    {
      id: 'country_of_origin',
      targetField: 'countryOfOrigin',
      required: false,
      description: 'Manufacturing country',
      example: 'USA'
    },
    {
      id: 'harmonization_code',
      targetField: 'harmonizationCode',
      required: false,
      description: 'HS tariff code',
      example: '8421.23.0000'
    }
  ],

  // Compliance Tab Fields
  compliance: [
    {
      id: 'hazardous_materials',
      targetField: 'hazardousMaterials',
      required: false,
      description: 'Contains hazardous materials',
      example: 'No'
    },
    {
      id: 'exportable',
      targetField: 'exportable',
      required: false,
      description: 'Can be exported internationally',
      example: 'Yes'
    },
    {
      id: 'remanufactured',
      targetField: 'remanufactured',
      required: false,
      description: 'Remanufactured product',
      example: 'No'
    },
    {
      id: 'google_merchant_category',
      targetField: 'googleMerchantCategory',
      required: false,
      description: 'Google Shopping category',
      example: 'Vehicles & Parts > Vehicle Parts & Accessories'
    },
    {
      id: 'prop65_warning',
      targetField: 'prop65Warning',
      required: false,
      description: 'California Prop 65 warning required',
      example: 'No'
    },
    {
      id: 'fcc_id',
      targetField: 'fccId',
      required: false,
      description: 'FCC equipment ID',
      example: 'ABC123DEF456'
    }
  ],

  // Promotions Tab Fields
  promotions: [
    {
      id: 'sale',
      targetField: 'sale',
      required: false,
      description: 'Currently on sale',
      example: 'Yes'
    },
    {
      id: 'sale_start_date',
      targetField: 'saleStartDate',
      required: false,
      description: 'Sale start date',
      example: '2025-07-01'
    },
    {
      id: 'sale_end_date',
      targetField: 'saleEndDate',
      required: false,
      description: 'Sale end date',
      example: '2025-07-31'
    },
    {
      id: 'closeout',
      targetField: 'closeout',
      required: false,
      description: 'Closeout item',
      example: 'No'
    },
    {
      id: 'rebate',
      targetField: 'rebate',
      required: false,
      description: 'Rebate available',
      example: 'Yes'
    },
    {
      id: 'rebate_description',
      targetField: 'rebateDescription',
      required: false,
      description: 'Rebate details',
      example: '$5 mail-in rebate'
    },
    {
      id: 'rebate_start_date',
      targetField: 'rebateStartDate',
      required: false,
      description: 'Rebate start date',
      example: '2025-07-01'
    },
    {
      id: 'rebate_end_date',
      targetField: 'rebateEndDate',
      required: false,
      description: 'Rebate end date',
      example: '2025-12-31'
    }
  ],

  // Documentation Tab Fields
  documentation: [
    {
      id: 'image_300x300',
      targetField: 'image300x300',
      required: false,
      description: 'Standard product image (300x300)',
      example: 'https://productimageserver.com/300x300/image.jpg'
    },
    {
      id: 'image_1000x1000',
      targetField: 'image1000x1000',
      required: false,
      description: 'High-resolution image (1000x1000)',
      example: 'https://productimageserver.com/1000x1000/image.jpg'
    },
    {
      id: 'product_manual_url',
      targetField: 'productManualUrl',
      required: false,
      description: 'Product manual PDF link',
      example: 'https://manuals.example.com/manual.pdf'
    },
    {
      id: 'installation_guide_url',
      targetField: 'installationGuideUrl',
      required: false,
      description: 'Installation guide link',
      example: 'https://guides.example.com/install.pdf'
    },
    {
      id: 'product_brochure_url',
      targetField: 'productBrochureUrl',
      required: false,
      description: 'Marketing brochure link',
      example: 'https://brochures.example.com/brochure.pdf'
    },
    {
      id: 'product_video_url',
      targetField: 'productVideoUrl',
      required: false,
      description: 'Product demonstration video',
      example: 'https://videos.example.com/demo.mp4'
    },
    {
      id: 'quick_specs',
      targetField: 'quickSpecs',
      required: false,
      description: 'Product specifications summary',
      example: 'Compatible with engines 2005-2020'
    },
    {
      id: 'accessories_by_sku',
      targetField: 'accessoriesBySku',
      required: false,
      description: 'Related accessories by SKU',
      example: 'ACC001,ACC002,ACC003'
    },
    {
      id: 'accessories_by_mfg',
      targetField: 'accessoriesByMfg',
      required: false,
      description: 'Related accessories by manufacturer part',
      example: 'MFG-ACC-001,MFG-ACC-002'
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
  inventory: Database,
  pricing: DollarSign,
  shipping: Target,
  compliance: CheckCircle,
  promotions: ArrowRight,
  documentation: FileText
};

const CATEGORY_LABELS = {
  master_catalog: 'Master Catalog',
  inventory: 'Inventory Tab Fields',
  pricing: 'Pricing Tab Fields',
  shipping: 'Shipping Tab Fields', 
  compliance: 'Compliance Tab Fields',
  promotions: 'Promotions Tab Fields',
  documentation: 'Documentation Tab Fields'
};

export function MappingWalkthrough({ dataSourceId, sampleData, onComplete, onCancel }: MappingWalkthroughProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [mappings, setMappings] = useState<Record<string, MappingField>>({});
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [isAIMapping, setIsAIMapping] = useState(false);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number>(0);

  const categories = Object.keys(REQUIRED_MAPPINGS) as Array<keyof typeof REQUIRED_MAPPINGS>;
  const currentCategory = categories[currentStep] as keyof typeof REQUIRED_MAPPINGS;
  const currentFields = REQUIRED_MAPPINGS[currentCategory];

  useEffect(() => {
    // Extract field names from sample data
    if (sampleData && sampleData.length > 0) {
      const fields = Object.keys(sampleData[0] || {});
      console.log('Available source fields from CWR data:', fields);
      setSourceFields(fields);
    }
    
    // Log comprehensive mapping categories for testing
    console.log('Enhanced mapping categories available:', Object.keys(REQUIRED_MAPPINGS));
    const totalFields = Object.values(REQUIRED_MAPPINGS).reduce((acc, fields) => acc + fields.length, 0);
    console.log('Total target fields across all categories:', totalFields);
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

  const handleAIAutoMap = async () => {
    setIsAIMapping(true);
    try {
      // Prepare target fields for current category
      const targetFields = currentFields.map(field => ({
        id: field.id,
        targetField: field.targetField,
        description: field.description,
        example: field.example || '',
        category: currentCategory
      }));

      const response = await apiRequest('POST', '/api/ai-mapping/auto-map', {
        sourceFields,
        targetFields
      });

      const data = await response.json();

      if (data.success) {
        setAiMappings(data.mappings);
        setAiConfidence(data.totalConfidence);

        toast({
          title: "AI Auto-Mapping Complete",
          description: `Found ${data.mappings.length} suggestions with ${Math.round(data.totalConfidence * 100)}% average confidence`
        });

        // Auto-apply high confidence mappings (>= 0.8)
        data.mappings.forEach((mapping: any) => {
          if (mapping.confidence >= 0.8) {
            const field = currentFields.find(f => f.targetField === mapping.targetField);
            if (field) {
              updateMapping(field.id, mapping.sourceField);
            }
          }
        });
      }
    } catch (error) {
      console.error('AI mapping error:', error);
      toast({
        title: "AI Mapping Failed",
        description: "Unable to generate AI suggestions. Please map fields manually.",
        variant: "destructive"
      });
    } finally {
      setIsAIMapping(false);
    }
  };

  const applyAISuggestion = (mapping: any) => {
    const field = currentFields.find(f => f.targetField === mapping.targetField);
    if (field) {
      updateMapping(field.id, mapping.sourceField);
      toast({
        title: "AI Suggestion Applied",
        description: `Mapped "${mapping.sourceField}" to "${mapping.targetField}"`
      });
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconComponent className="h-5 w-5" />
              {CATEGORY_LABELS[currentCategory]}
              <Badge variant={categoryStats.complete ? "default" : "secondary"}>
                {categoryStats.mapped}/{categoryStats.total} mapped
              </Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {aiConfidence > 0 && (
                <Badge variant="outline" className="text-blue-600">
                  <Brain className="h-3 w-3 mr-1" />
                  {Math.round(aiConfidence * 100)}% AI Confidence
                </Badge>
              )}
              
              <Button
                onClick={handleAIAutoMap}
                disabled={isAIMapping || sourceFields.length === 0}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {isAIMapping ? (
                  <>
                    <Zap className="h-4 w-4 mr-1 animate-pulse" />
                    AI Mapping...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Auto-Map
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {aiMappings.length > 0 && (
            <Alert className="mt-4">
              <Brain className="h-4 w-4" />
              <AlertDescription>
                AI found {aiMappings.length} mapping suggestions. High confidence mappings (≥80%) have been auto-applied.
                Review suggestions below and click to apply others.
              </AlertDescription>
            </Alert>
          )}
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

      {/* AI Suggestions */}
      {aiMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              AI Mapping Suggestions
              <Badge variant="secondary">{aiMappings.length} suggestions</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiMappings.map((suggestion: any, index: number) => {
              const isAlreadyMapped = Object.values(mappings).some(m => 
                m.sourceField === suggestion.sourceField && m.targetField === suggestion.targetField
              );
              const isHighConfidence = suggestion.confidence >= 0.8;
              const isMediumConfidence = suggestion.confidence >= 0.6;
              
              return (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 space-y-3 ${
                    isAlreadyMapped 
                      ? 'bg-green-50 border-green-200' 
                      : isHighConfidence 
                        ? 'bg-blue-50 border-blue-200'
                        : isMediumConfidence
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-mono text-blue-700">"{suggestion.sourceField}"</span>
                        <ArrowRight className="h-4 w-4 mx-2 inline text-gray-400" />
                        <span className="font-mono text-green-700">"{suggestion.targetField}"</span>
                      </div>
                      
                      <Badge 
                        variant={isHighConfidence ? "default" : isMediumConfidence ? "secondary" : "outline"}
                        className={`${
                          isHighConfidence 
                            ? 'bg-green-100 text-green-800' 
                            : isMediumConfidence
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isAlreadyMapped ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Applied
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => applyAISuggestion(suggestion)}
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {suggestion.reasoning && (
                    <div className="text-sm text-gray-600 bg-white/70 p-2 rounded border">
                      <span className="font-medium">AI Reasoning:</span> {suggestion.reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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