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
import { Input } from "@/components/ui/input";
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
  Download,
  Puzzle,
  Calculator,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MappingField {
  id: string;
  sourceField: string;
  targetField: string;
  required: boolean;
  category: 'master_catalog' | 'inventory' | 'pricing' | 'shipping' | 'compliance' | 'promotions' | 'documentation' | 'catalog_extensions' | 'product_identifier' | 'availability_cost' | 'return_info';
  description: string;
  example?: string;
  computed?: {
    operation: 'SUM' | 'CONCAT' | 'FIRST_NON_EMPTY';
    sourceFields: string[];
  };
}

type ComputedOperation = 'SUM' | 'CONCAT' | 'FIRST_NON_EMPTY';

type DataSourcePurpose = 'catalog' | 'inventory_pricing' | 'order_fulfillment' | 'catalog_search' | 'returns' | 'general';

interface MappingWalkthroughProps {
  dataSourceId: string;
  dataSourceName?: string;
  sampleData: any[];
  purpose?: DataSourcePurpose;
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
      required: false,
      description: 'UPC (optional - use MPN for matching if unavailable)',
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

const CATEGORY_ICONS: Record<string, any> = {
  master_catalog: Package,
  inventory: Database,
  pricing: DollarSign,
  shipping: Target,
  compliance: CheckCircle,
  promotions: ArrowRight,
  documentation: FileText,
  catalog_extensions: Puzzle
};

const CATEGORY_LABELS: Record<string, string> = {
  master_catalog: 'Master Catalog',
  inventory: 'Inventory Tab Fields',
  pricing: 'Pricing Tab Fields',
  shipping: 'Shipping Tab Fields', 
  compliance: 'Compliance Tab Fields',
  promotions: 'Promotions Tab Fields',
  documentation: 'Documentation Tab Fields',
  catalog_extensions: 'Catalog Extensions'
};

const PURPOSE_FIELD_CONFIGS: Record<DataSourcePurpose, Record<string, Array<{ id: string; targetField: string; required: boolean; description: string; example?: string }>>> = {
  catalog: REQUIRED_MAPPINGS,
  general: REQUIRED_MAPPINGS,
  catalog_search: {},
  inventory_pricing: {
    product_identifier: [
      {
        id: 'manufacturer_part_number',
        targetField: 'manufacturerPartNumber',
        required: true,
        description: 'MPN — used to match against existing catalog products',
        example: 'MPN-12345'
      },
      {
        id: 'upc',
        targetField: 'upc',
        required: false,
        description: 'UPC — secondary identifier for matching',
        example: '123456789012'
      },
      {
        id: 'usin',
        targetField: 'usin',
        required: false,
        description: 'Universal Supplier Item Number (SKU)',
        example: '010342'
      }
    ],
    pricing: [
      {
        id: 'your_cost',
        targetField: 'yourCost',
        required: false,
        description: 'Supplier cost price',
        example: '19.99'
      },
      {
        id: 'cost',
        targetField: 'cost',
        required: false,
        description: 'Cost',
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
      }
    ],
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
        id: 'next_shipment_date_combined',
        targetField: 'nextShipmentDateCombined',
        required: false,
        description: 'Next expected shipment date',
        example: '2025-07-15'
      }
    ]
  },
  order_fulfillment: {
    product_identifier: [
      {
        id: 'manufacturer_part_number',
        targetField: 'manufacturerPartNumber',
        required: true,
        description: 'MPN — used to match against existing catalog products',
        example: 'MPN-12345'
      },
      {
        id: 'upc',
        targetField: 'upc',
        required: false,
        description: 'UPC — secondary identifier for matching',
        example: '123456789012'
      }
    ],
    availability_cost: [
      {
        id: 'cost',
        targetField: 'cost',
        required: false,
        description: 'Vendor cost for order processing',
        example: '19.99'
      },
      {
        id: 'quantity_available_combined',
        targetField: 'quantityAvailableCombined',
        required: false,
        description: 'Available quantity for fulfillment',
        example: '150'
      },
      {
        id: 'lead_time',
        targetField: 'leadTime',
        required: false,
        description: 'Fulfillment lead time in days',
        example: '3'
      }
    ]
  },
  returns: {
    product_identifier: [
      {
        id: 'manufacturer_part_number',
        targetField: 'manufacturerPartNumber',
        required: true,
        description: 'MPN — used to match against existing catalog products',
        example: 'MPN-12345'
      },
      {
        id: 'upc',
        targetField: 'upc',
        required: false,
        description: 'UPC — secondary identifier for matching',
        example: '123456789012'
      }
    ],
    return_info: [
      {
        id: 'return_status',
        targetField: 'returnStatus',
        required: false,
        description: 'Product return status',
        example: 'Returned'
      },
      {
        id: 'return_quantity',
        targetField: 'returnQuantity',
        required: false,
        description: 'Quantity being returned',
        example: '2'
      },
      {
        id: 'return_reason',
        targetField: 'returnReason',
        required: false,
        description: 'Reason for return',
        example: 'Defective'
      }
    ]
  }
};

const PURPOSE_CATEGORY_LABELS: Record<string, string> = {
  product_identifier: 'Product Identifier',
  availability_cost: 'Availability & Cost',
  return_info: 'Return Info'
};

const PURPOSE_CATEGORY_ICONS: Record<string, any> = {
  product_identifier: Target,
  availability_cost: DollarSign,
  return_info: FileText
};

const PURPOSE_LABELS: Record<DataSourcePurpose, string> = {
  catalog: 'Full Catalog',
  general: 'General',
  catalog_search: 'Catalog Search',
  inventory_pricing: 'Inventory & Pricing',
  order_fulfillment: 'Order Fulfillment',
  returns: 'Returns'
};

const PURPOSE_COLORS: Record<DataSourcePurpose, string> = {
  catalog: 'bg-blue-100 text-blue-800 border-blue-300',
  general: 'bg-gray-100 text-gray-800 border-gray-300',
  catalog_search: 'bg-purple-100 text-purple-800 border-purple-300',
  inventory_pricing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  order_fulfillment: 'bg-amber-100 text-amber-800 border-amber-300',
  returns: 'bg-red-100 text-red-800 border-red-300'
};

const PURPOSE_DESCRIPTIONS: Record<DataSourcePurpose, string> = {
  catalog: 'Map all fields to build complete product catalog entries.',
  general: 'Map all fields to build complete product catalog entries.',
  catalog_search: 'This data source uses API-based search and does not require field mapping.',
  inventory_pricing: 'Map fields to update stock levels and pricing for existing products. Only identifier, pricing, and stock fields are shown. Products must already exist in your catalog to receive updates.',
  order_fulfillment: 'Map the product identifier and cost fields so the system can look up vendor pricing during order processing.',
  returns: 'Map product identifiers and return information fields for processing product returns.'
};

const PURPOSE_HEADER_TITLES: Record<DataSourcePurpose, string> = {
  catalog: 'Field Mapping Walkthrough',
  general: 'Field Mapping Walkthrough',
  catalog_search: 'Catalog Search Source',
  inventory_pricing: 'Inventory & Pricing Mapping',
  order_fulfillment: 'Order Fulfillment Mapping',
  returns: 'Returns Mapping'
};

function humanizeFieldName(field: string): string {
  return field
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function suggestCategory(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (/asin|walmart|ebay|newegg|marketplace|listing/.test(lower)) return 'markets';
  if (/weight|height|length|width|dimension|size|color|material|spec/.test(lower)) return 'specifications';
  if (/hazard|compliance|cert|fcc|prop65|export/.test(lower)) return 'compliance';
  if (/supplier|vendor|warehouse|stock/.test(lower)) return 'supplier_info';
  return 'overview';
}

interface CustomFieldSelection {
  fieldName: string;
  displayName: string;
  fieldType: string;
  category: string;
  selected: boolean;
}

export function MappingWalkthrough({ dataSourceId, dataSourceName, sampleData, purpose = 'general', onComplete, onCancel }: MappingWalkthroughProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [mappings, setMappings] = useState<Record<string, MappingField>>({});
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [isAIMapping, setIsAIMapping] = useState(false);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSamplePulling, setIsSamplePulling] = useState(false);
  const [samplePullResult, setSamplePullResult] = useState<any>(null);
  const [isTestingMatch, setIsTestingMatch] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [showAllSourceFields, setShowAllSourceFields] = useState(false);
  const [customFieldSelections, setCustomFieldSelections] = useState<Record<string, CustomFieldSelection>>({});
  const [computedFields, setComputedFields] = useState<Record<string, { operation: ComputedOperation; sourceFields: string[] }>>({});
  const [computedFieldToggles, setComputedFieldToggles] = useState<Record<string, boolean>>({});

  const activePurpose = purpose || 'general';
  const purposeConfig = PURPOSE_FIELD_CONFIGS[activePurpose] || REQUIRED_MAPPINGS;
  const mappingCategories = Object.keys(purposeConfig) as string[];
  const categories = [...mappingCategories, 'catalog_extensions'];
  const isExtensionStep = currentStep === mappingCategories.length;
  const currentCategory = isExtensionStep ? 'catalog_extensions' : mappingCategories[currentStep];
  const currentFields = isExtensionStep ? [] : (purposeConfig[currentCategory] || []);

  const getUnmappedFields = () => {
    const mappedSourceFields = new Set(Object.values(mappings).map(m => m.sourceField).filter(Boolean));
    return sourceFields.filter(f => !mappedSourceFields.has(f));
  };

  useEffect(() => {
    // Extract field names from sample data
    if (sampleData && sampleData.length > 0) {
      const fields = Object.keys(sampleData[0] || {});
      console.log('Available source fields from supplier data:', fields);
      setSourceFields(fields);
    }
    
    // Log comprehensive mapping categories for testing
    console.log('Enhanced mapping categories available:', Object.keys(REQUIRED_MAPPINGS));
    const totalFields = Object.values(REQUIRED_MAPPINGS).reduce((acc, fields) => acc + fields.length, 0);
    console.log('Total target fields across all categories:', totalFields);
  }, [sampleData]);

  const getSamplePreview = (fieldName: string): string => {
    if (!sampleData || sampleData.length === 0) return '';
    for (const row of sampleData.slice(0, 5)) {
      const val = row[fieldName];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const str = String(val);
        return str.length > 40 ? str.substring(0, 37) + '...' : str;
      }
    }
    return '(empty)';
  };

  const computePreview = (operation: ComputedOperation, fields: string[]): string => {
    if (!sampleData || sampleData.length === 0 || fields.length === 0) return '';
    const results = sampleData.slice(0, 3).map(row => {
      if (operation === 'SUM') {
        const sum = fields.reduce((acc, f) => acc + (parseFloat(row[f]) || 0), 0);
        return String(sum);
      } else if (operation === 'CONCAT') {
        return fields.map(f => row[f] || '').filter(Boolean).join(' ');
      } else {
        for (const f of fields) {
          if (row[f] !== undefined && row[f] !== null && String(row[f]).trim() !== '') return String(row[f]);
        }
        return '';
      }
    });
    return results.filter(Boolean).join(' • ');
  };

  const toggleComputedField = (fieldId: string) => {
    setComputedFieldToggles(prev => {
      const next = { ...prev, [fieldId]: !prev[fieldId] };
      if (!next[fieldId]) {
        setComputedFields(prev2 => {
          const { [fieldId]: _, ...rest } = prev2;
          return rest;
        });
        setMappings(prev2 => {
          const { [fieldId]: _, ...rest } = prev2;
          return rest;
        });
      } else {
        setComputedFields(prev2 => ({
          ...prev2,
          [fieldId]: { operation: 'SUM' as ComputedOperation, sourceFields: [] }
        }));
      }
      return next;
    });
  };

  const updateComputedField = (fieldId: string, updates: Partial<{ operation: ComputedOperation; sourceFields: string[] }>) => {
    setComputedFields(prev => {
      const current = prev[fieldId] || { operation: 'SUM' as ComputedOperation, sourceFields: [] };
      const updated = { ...current, ...updates };
      return { ...prev, [fieldId]: updated };
    });
    const targetField = currentFields.find(f => f.id === fieldId);
    if (targetField) {
      const current = computedFields[fieldId] || { operation: 'SUM' as ComputedOperation, sourceFields: [] };
      const merged = { ...current, ...updates };
      if (merged.sourceFields.length > 0) {
        setMappings(prev => ({
          ...prev,
          [fieldId]: {
            id: fieldId,
            sourceField: '__COMPUTED__',
            targetField: targetField.targetField,
            required: targetField.required,
            category: currentCategory as MappingField['category'],
            description: targetField.description,
            example: targetField.example,
            computed: {
              operation: merged.operation,
              sourceFields: merged.sourceFields
            }
          }
        }));
      }
    }
  };

  const toggleComputedSourceField = (fieldId: string, sourceField: string) => {
    const current = computedFields[fieldId] || { operation: 'SUM' as ComputedOperation, sourceFields: [] };
    const exists = current.sourceFields.includes(sourceField);
    const newFields = exists
      ? current.sourceFields.filter(f => f !== sourceField)
      : [...current.sourceFields, sourceField];
    updateComputedField(fieldId, { sourceFields: newFields });
  };

  const updateMapping = (fieldId: string, sourceField: string) => {
    const targetField = currentFields.find(f => f.id === fieldId);
    if (targetField) {
      const actualSourceField = sourceField === "__SKIP__" ? "" : sourceField;
      
      setMappings(prev => ({
        ...prev,
        [fieldId]: {
          id: fieldId,
          sourceField: actualSourceField,
          targetField: targetField.targetField,
          required: targetField.required,
          category: currentCategory as MappingField['category'],
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
        targetFields,
        purpose: activePurpose,
        purposeContext: PURPOSE_DESCRIPTIONS[activePurpose]
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
    const allFields = Object.values(purposeConfig).flat();
    const totalRequired = allFields.filter(f => f.required).length;
    
    const mappedRequired = Object.values(mappings)
      .filter(m => m.required && m.sourceField).length;
    
    const totalOptional = allFields.filter(f => !f.required).length;
    
    const mappedOptional = Object.values(mappings)
      .filter(m => !m.required && m.sourceField).length;

    const total = totalRequired + totalOptional;
    return {
      totalRequired,
      mappedRequired,
      totalOptional,
      mappedOptional,
      requiredComplete: mappedRequired === totalRequired,
      overallProgress: total > 0 ? Math.round(((mappedRequired + mappedOptional) / total) * 100) : 0
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
    if (isExtensionStep) return true;
    const stats = getCurrentCategoryStats();
    return stats.mappedRequired === stats.required;
  };

  const initializeCustomFieldSelections = () => {
    const unmapped = getUnmappedFields();
    const existing = { ...customFieldSelections };
    unmapped.forEach(field => {
      if (!existing[field]) {
        existing[field] = {
          fieldName: field,
          displayName: humanizeFieldName(field),
          fieldType: 'text',
          category: suggestCategory(field),
          selected: false
        };
      }
    });
    setCustomFieldSelections(existing);
  };

  const handleNext = async () => {
    if (currentStep < categories.length - 1) {
      if (currentStep === mappingCategories.length - 1) {
        initializeCustomFieldSelections();
      }
      setCurrentStep(prev => prev + 1);
    } else {
      const selectedCustomFields = Object.values(customFieldSelections).filter(f => f.selected);
      for (const field of selectedCustomFields) {
        try {
          await apiRequest('POST', '/api/catalog/custom-fields', {
            fieldName: field.fieldName,
            displayName: field.displayName,
            fieldType: field.fieldType,
            category: field.category,
            sourceSupplier: dataSourceName || 'Unknown',
            description: `Custom field from ${dataSourceName || 'supplier'} data`
          });
        } catch (error) {
          console.error('Failed to save custom field:', field.fieldName, error);
        }
      }
      const mappingArray = Object.values(mappings);
      for (const field of selectedCustomFields) {
        mappingArray.push({
          id: `custom_${field.fieldName}`,
          sourceField: field.fieldName,
          targetField: `customFields.${field.fieldName}`,
          required: false,
          category: 'catalog_extensions',
          description: field.displayName,
        });
      }
      await onComplete(mappingArray);
      setIsComplete(true);
    }
  };

  const handleSamplePull = async () => {
    try {
      setIsSamplePulling(true);
      
      const response = await apiRequest('POST', `/api/datasources/${dataSourceId}/sample-pull-with-mapping`, {
        limit: 50
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSamplePullResult(result);
        toast({
          title: "Sample Pull Complete",
          description: `Successfully imported ${result.imported} products using your field mappings`
        });
      } else {
        toast({
          title: "Sample Pull Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Sample pull error:', error);
      toast({
        title: "Sample Pull Error",
        description: "Failed to pull sample data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSamplePulling(false);
    }
  };

  const handleTestInventoryMatch = async () => {
    try {
      setIsTestingMatch(true);
      
      const response = await apiRequest('POST', `/api/datasources/${dataSourceId}/test-inventory-match`, {
        limit: 50
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMatchResult(result);
        toast({
          title: "Match Test Complete",
          description: `${result.matched} of ${result.totalRecords} records matched existing products (${result.matchRate}%)`
        });
      } else {
        toast({
          title: "Match Test Failed",
          description: result.message || "Failed to test inventory match",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Test inventory match error:', error);
      toast({
        title: "Match Test Error",
        description: "Failed to test inventory match. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTestingMatch(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const stats = getCompletionStats();
  const categoryStats = getCurrentCategoryStats();
  const IconComponent = PURPOSE_CATEGORY_ICONS[currentCategory] || CATEGORY_ICONS[currentCategory];

  const isCatalogPurpose = activePurpose === 'catalog' || activePurpose === 'general';
  const isMatchTestPurpose = activePurpose === 'inventory_pricing' || activePurpose === 'order_fulfillment' || activePurpose === 'returns';

  const getMatchTestLabels = () => {
    if (activePurpose === 'inventory_pricing') {
      return {
        buttonLabel: 'Test Update Match',
        buttonLoadingLabel: 'Testing Match...',
        description: 'Test how many records from your feed match products already in your catalog.',
        icon: Database
      };
    }
    if (activePurpose === 'order_fulfillment') {
      return {
        buttonLabel: 'Verify Product Lookup',
        buttonLoadingLabel: 'Verifying...',
        description: 'Verify that products in this feed can be found in your catalog for order processing.',
        icon: ShoppingCart
      };
    }
    return {
      buttonLabel: 'Verify Product Match',
      buttonLoadingLabel: 'Verifying...',
      description: 'Verify that products in this feed can be matched to catalog entries for return processing.',
      icon: AlertCircle
    };
  };

  if (isComplete) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Field Mapping Complete!</h2>
          <p className="text-gray-600 mt-2">
            Your field mappings have been saved successfully. {isCatalogPurpose ? 'Ready to test with sample data.' : 'Ready to test your mappings.'}
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Mapping Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.mappedRequired}</div>
                <div className="text-sm text-green-700">Required Mapped</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.mappedOptional}</div>
                <div className="text-sm text-blue-700">Optional Mapped</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.overallProgress}%</div>
                <div className="text-sm text-purple-700">Overall Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isCatalogPurpose && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Test Your Mappings
              </CardTitle>
              <p className="text-sm text-gray-600">
                Pull 50 sample products using your saved field mappings to validate the import process.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!samplePullResult ? (
                <Button 
                  onClick={handleSamplePull}
                  disabled={isSamplePulling}
                  className="w-full"
                  size="lg"
                >
                  {isSamplePulling ? (
                    <>
                      <Zap className="h-4 w-4 mr-2 animate-pulse" />
                      Pulling Sample Data...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Sample Pull with Mapping (50 Products)
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Successfully imported {samplePullResult.imported} products using your field mappings!
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" onClick={() => window.location.href = '/products'}>
                      View Products in Catalog
                    </Button>
                    <Button variant="outline" onClick={handleSamplePull} disabled={isSamplePulling}>
                      Pull Another Sample
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isMatchTestPurpose && (() => {
          const labels = getMatchTestLabels();
          const MatchIcon = labels.icon;
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MatchIcon className="h-5 w-5" />
                  {labels.buttonLabel}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {labels.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!matchResult ? (
                  <Button 
                    onClick={handleTestInventoryMatch}
                    disabled={isTestingMatch}
                    className="w-full"
                    size="lg"
                  >
                    {isTestingMatch ? (
                      <>
                        <Zap className="h-4 w-4 mr-2 animate-pulse" />
                        {labels.buttonLoadingLabel}
                      </>
                    ) : (
                      <>
                        <Target className="h-4 w-4 mr-2" />
                        {labels.buttonLabel}
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{matchResult.totalRecords}</div>
                        <div className="text-sm text-blue-700">Total Records</div>
                      </div>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{matchResult.matched}</div>
                        <div className="text-sm text-green-700">Matched</div>
                      </div>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{matchResult.unmatched}</div>
                        <div className="text-sm text-red-700">Unmatched</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Match Rate</span>
                        <span className="font-bold">{matchResult.matchRate}%</span>
                      </div>
                      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${matchResult.matchRate}%` }}
                        />
                        <div 
                          className="h-full bg-red-400 transition-all duration-500"
                          style={{ width: `${100 - matchResult.matchRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="text-green-600">{matchResult.matched} matched</span>
                        <span className="text-red-600">{matchResult.unmatched} unmatched</span>
                      </div>
                    </div>

                    {matchResult.matchedProducts && matchResult.matchedProducts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Sample Matched Products (Current → New)</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Identifier</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {matchResult.matchedProducts.map((product: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-xs">{product.identifier}</td>
                                  <td className="px-3 py-2 text-xs truncate max-w-[200px]">{product.productName}</td>
                                  <td className="px-3 py-2 text-right text-xs">
                                    {product.currentPrice != null && product.newPrice != null ? (
                                      <span>
                                        <span className="text-gray-400 line-through">${product.currentPrice}</span>
                                        {' → '}
                                        <span className="text-green-600 font-medium">${product.newPrice}</span>
                                      </span>
                                    ) : product.currentPrice != null ? (
                                      <span>${product.currentPrice}</span>
                                    ) : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs">
                                    {product.currentQuantity != null && product.newQuantity != null ? (
                                      <span>
                                        <span className="text-gray-400">{product.currentQuantity}</span>
                                        {' → '}
                                        <span className="text-blue-600 font-medium">{product.newQuantity}</span>
                                      </span>
                                    ) : product.currentQuantity != null ? (
                                      <span>{product.currentQuantity}</span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {matchResult.unmatchedIdentifiers && matchResult.unmatchedIdentifiers.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Unmatched Identifiers</h4>
                        <div className="flex flex-wrap gap-1">
                          {matchResult.unmatchedIdentifiers.map((id: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <Button variant="outline" onClick={() => setMatchResult(null)}>
                        Run Again
                      </Button>
                      <Button variant="outline" onClick={onCancel}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <div className="flex justify-center">
          <Button onClick={onCancel} variant="outline">
            Close Walkthrough
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Purpose Badge & Header */}
      <div className="text-center space-y-3">
        {activePurpose !== 'general' && activePurpose !== 'catalog' && (
          <div className="flex justify-center">
            <Badge className={`text-sm px-3 py-1 ${PURPOSE_COLORS[activePurpose]}`}>
              {PURPOSE_LABELS[activePurpose]}
            </Badge>
          </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900">{PURPOSE_HEADER_TITLES[activePurpose]}</h2>
        <p className="text-gray-600 mt-2">
          {PURPOSE_DESCRIPTIONS[activePurpose]}
        </p>
      </div>

      {/* Purpose-specific guidance banner */}
      {activePurpose === 'inventory_pricing' && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <Database className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">
            You're mapping an inventory & pricing feed. Only identifier, pricing, and stock fields are shown. Products must already exist in your catalog to receive updates.
          </AlertDescription>
        </Alert>
      )}
      {activePurpose === 'order_fulfillment' && (
        <Alert className="border-amber-300 bg-amber-50">
          <ShoppingCart className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You're mapping an order fulfillment source. Map the product identifier and cost fields so the system can look up vendor pricing during order processing.
          </AlertDescription>
        </Alert>
      )}
      {activePurpose === 'returns' && (
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You're mapping a returns data source. Map identifiers and return details to process product returns efficiently.
          </AlertDescription>
        </Alert>
      )}

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
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-blue-800">
                    Source fields from {dataSourceName || 'your supplier'} ({sourceFields.length} fields):
                  </div>
                  {sourceFields.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllSourceFields(!showAllSourceFields)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 h-6 px-2"
                    >
                      {showAllSourceFields ? 'Show Less' : `Show All (${sourceFields.length})`}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {(showAllSourceFields ? sourceFields : sourceFields.slice(0, 10)).map((field) => (
                    <span key={field} className="px-2 py-1 bg-white border border-blue-200 rounded text-blue-700 font-mono">
                      {field}
                    </span>
                  ))}
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
            const Icon = PURPOSE_CATEGORY_ICONS[category] || CATEGORY_ICONS[category];
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
      {isExtensionStep ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              Catalog Extensions
              <Badge variant="secondary">
                {Object.values(customFieldSelections).filter(f => f.selected).length} selected
              </Badge>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              These supplier fields were not mapped to any standard catalog field. Select any you'd like to add as custom fields in your master catalog.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {getUnmappedFields().length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All source fields have been mapped. No unmapped fields to extend.
                </AlertDescription>
              </Alert>
            ) : (
              getUnmappedFields().map(field => {
                const selection = customFieldSelections[field] || {
                  fieldName: field,
                  displayName: humanizeFieldName(field),
                  fieldType: 'text',
                  category: suggestCategory(field),
                  selected: false
                };

                return (
                  <div key={field} className={`border rounded-lg p-4 space-y-3 ${selection.selected ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selection.selected}
                        onCheckedChange={(checked) => {
                          setCustomFieldSelections(prev => ({
                            ...prev,
                            [field]: { ...selection, selected: !!checked }
                          }));
                        }}
                      />
                      <div className="flex-1">
                        <h4 className="font-mono text-sm font-medium">{field}</h4>
                      </div>
                      {selection.selected && (
                        <Badge className="bg-purple-100 text-purple-800">Adding to Catalog</Badge>
                      )}
                    </div>

                    {sampleData.length > 0 && (
                      <div className="bg-white border border-gray-200 p-2 rounded text-xs">
                        <span className="font-medium text-gray-600">Sample values: </span>
                        <span className="font-mono text-gray-700">
                          {sampleData.slice(0, 4)
                            .map(row => row[field])
                            .filter(val => val !== undefined && val !== null && val !== '')
                            .map(val => String(val).substring(0, 40) + (String(val).length > 40 ? '...' : ''))
                            .join(' • ') || 'No values'}
                        </span>
                      </div>
                    )}

                    {selection.selected && (
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-purple-200">
                        <div>
                          <Label className="text-xs font-medium">Display Name</Label>
                          <Input
                            value={selection.displayName}
                            onChange={(e) => {
                              setCustomFieldSelections(prev => ({
                                ...prev,
                                [field]: { ...selection, displayName: e.target.value }
                              }));
                            }}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Tab Placement</Label>
                          <Select
                            value={selection.category}
                            onValueChange={(value) => {
                              setCustomFieldSelections(prev => ({
                                ...prev,
                                [field]: { ...selection, category: value }
                              }));
                            }}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="overview">Overview</SelectItem>
                              <SelectItem value="markets">Markets</SelectItem>
                              <SelectItem value="specifications">Specifications</SelectItem>
                              <SelectItem value="supplier_info">Supplier Info</SelectItem>
                              <SelectItem value="compliance">Compliance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Field Type</Label>
                          <Select
                            value={selection.fieldType}
                            onValueChange={(value) => {
                              setCustomFieldSelections(prev => ({
                                ...prev,
                                [field]: { ...selection, fieldType: value }
                              }));
                            }}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconComponent className="h-5 w-5" />
              {PURPOSE_CATEGORY_LABELS[currentCategory] || CATEGORY_LABELS[currentCategory]}
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
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm font-medium">Map to source field:</Label>
                    <button
                      type="button"
                      onClick={() => toggleComputedField(field.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                        computedFieldToggles[field.id]
                          ? 'bg-purple-100 border-purple-300 text-purple-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <Calculator className="h-3 w-3" />
                      Computed
                    </button>
                  </div>

                  {!computedFieldToggles[field.id] ? (
                    <>
                      <Select
                        value={currentMapping?.sourceField || ""}
                        onValueChange={(value) => updateMapping(field.id, value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={`Select a field from ${dataSourceName || 'your supplier'} data...`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__SKIP__">-- Skip this field --</SelectItem>
                          {sourceFields.map((sf) => {
                            const preview = getSamplePreview(sf);
                            return (
                              <SelectItem key={sf} value={sf}>
                                <div className="flex items-center gap-2 w-full">
                                  <span className="font-medium">{sf}</span>
                                  {preview && preview !== '(empty)' && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      → {preview}
                                    </span>
                                  )}
                                  {preview === '(empty)' && (
                                    <span className="text-xs text-gray-400 italic">empty</span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {currentMapping?.sourceField && currentMapping.sourceField !== '__COMPUTED__' && sampleData.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm mt-2">
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
                    </>
                  ) : (
                    <div className="mt-2 border border-purple-200 rounded-lg p-3 bg-purple-50/50 space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-purple-700">Operation</Label>
                        <Select
                          value={computedFields[field.id]?.operation || 'SUM'}
                          onValueChange={(value) => updateComputedField(field.id, { operation: value as ComputedOperation })}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUM">SUM — Add numeric values together</SelectItem>
                            <SelectItem value="CONCAT">CONCAT — Join text values</SelectItem>
                            <SelectItem value="FIRST_NON_EMPTY">FIRST NON-EMPTY — Use first available value</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-purple-700">Select source fields to combine:</Label>
                        <div className="mt-1 max-h-40 overflow-y-auto space-y-1 border rounded bg-white p-2">
                          {sourceFields.map((sf) => {
                            const isSelected = computedFields[field.id]?.sourceFields?.includes(sf) || false;
                            const preview = getSamplePreview(sf);
                            return (
                              <label
                                key={sf}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-50 ${
                                  isSelected ? 'bg-purple-50' : ''
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleComputedSourceField(field.id, sf)}
                                />
                                <span className="font-medium text-xs">{sf}</span>
                                {preview && preview !== '(empty)' && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">→ {preview}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {(computedFields[field.id]?.sourceFields?.length || 0) > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {computedFields[field.id].sourceFields.map((sf, i) => (
                              <Badge key={sf} variant="secondary" className="text-xs flex items-center gap-1">
                                {sf}
                                <button type="button" onClick={() => toggleComputedSourceField(field.id, sf)}>
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <div className="bg-green-50 border border-green-200 p-2 rounded text-xs">
                            <span className="font-medium text-green-800">Preview ({computedFields[field.id].operation}): </span>
                            <span className="text-green-700 font-mono">
                              {computePreview(computedFields[field.id].operation, computedFields[field.id].sourceFields)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
      )}

      {/* AI Suggestions */}
      {aiMappings.length > 0 && !isExtensionStep && (
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