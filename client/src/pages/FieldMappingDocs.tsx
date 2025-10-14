import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  FileText, 
  Image, 
  DollarSign, 
  Ruler, 
  Tag, 
  Layers,
  Database,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FieldDoc {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  description: string;
  category: string;
  example?: string;
  icon?: any;
}

export default function FieldMappingDocs() {
  
  const masterCatalogFields: FieldDoc[] = [
    // Identification Fields
    { 
      id: 'sku', 
      name: 'SKU', 
      type: 'string', 
      required: true, 
      description: 'Unique product identifier for internal use',
      category: 'Identification',
      example: 'ABC-12345',
      icon: Tag
    },
    { 
      id: 'upc', 
      name: 'UPC Code', 
      type: 'string', 
      required: false, 
      description: 'Universal Product Code for retail scanning',
      category: 'Identification',
      example: '012345678905',
      icon: Tag
    },
    { 
      id: 'mpn', 
      name: 'Manufacturer Part Number', 
      type: 'string', 
      required: false, 
      description: "Manufacturer's unique part number",
      category: 'Identification',
      example: 'MFG-987654',
      icon: Tag
    },
    { 
      id: 'ean', 
      name: 'EAN', 
      type: 'string', 
      required: false, 
      description: 'European Article Number (international barcode)',
      category: 'Identification',
      example: '5901234123457',
      icon: Tag
    },
    
    // Basic Information
    { 
      id: 'product_name', 
      name: 'Product Name', 
      type: 'string', 
      required: true, 
      description: 'Full product title or name',
      category: 'Basic Information',
      example: 'Premium Wireless Headphones',
      icon: Package
    },
    { 
      id: 'description', 
      name: 'Description', 
      type: 'text', 
      required: false, 
      description: 'Brief product description for catalog view',
      category: 'Basic Information',
      example: 'High-quality wireless headphones with noise cancellation',
      icon: FileText
    },
    { 
      id: 'manufacturer', 
      name: 'Manufacturer/Brand', 
      type: 'string', 
      required: false, 
      description: 'Product manufacturer or brand name',
      category: 'Basic Information',
      example: 'Sony',
      icon: Package
    },
    { 
      id: 'category', 
      name: 'Category', 
      type: 'string', 
      required: false, 
      description: 'Primary product category',
      category: 'Basic Information',
      example: 'Electronics > Audio > Headphones',
      icon: Layers
    },
    { 
      id: 'subcategory', 
      name: 'Subcategory', 
      type: 'string', 
      required: false, 
      description: 'Product subcategory for finer classification',
      category: 'Basic Information',
      example: 'Over-Ear Headphones',
      icon: Layers
    },
    
    // Pricing & Inventory
    { 
      id: 'price', 
      name: 'Price', 
      type: 'decimal', 
      required: false, 
      description: 'Retail selling price',
      category: 'Pricing & Inventory',
      example: '299.99',
      icon: DollarSign
    },
    { 
      id: 'cost', 
      name: 'Cost', 
      type: 'decimal', 
      required: false, 
      description: 'Wholesale or supplier cost',
      category: 'Pricing & Inventory',
      example: '150.00',
      icon: DollarSign
    },
    { 
      id: 'stock_quantity', 
      name: 'Stock Quantity', 
      type: 'integer', 
      required: false, 
      description: 'Available inventory quantity',
      category: 'Pricing & Inventory',
      example: '45',
      icon: Database
    },
    { 
      id: 'min_order_quantity', 
      name: 'Min Order Quantity', 
      type: 'integer', 
      required: false, 
      description: 'Minimum order quantity required',
      category: 'Pricing & Inventory',
      example: '1',
      icon: Database
    },
    { 
      id: 'status', 
      name: 'Status', 
      type: 'string', 
      required: false, 
      description: 'Product availability status',
      category: 'Pricing & Inventory',
      example: 'active, discontinued, out of stock',
      icon: CheckCircle
    },
    
    // Physical Attributes
    { 
      id: 'weight', 
      name: 'Weight', 
      type: 'decimal', 
      required: false, 
      description: 'Product weight',
      category: 'Physical Attributes',
      example: '0.75',
      icon: Ruler
    },
    { 
      id: 'weight_unit', 
      name: 'Weight Unit', 
      type: 'string', 
      required: false, 
      description: 'Unit of weight measurement',
      category: 'Physical Attributes',
      example: 'lb, kg, oz',
      icon: Ruler
    },
    { 
      id: 'length', 
      name: 'Length', 
      type: 'decimal', 
      required: false, 
      description: 'Product length',
      category: 'Physical Attributes',
      example: '8.5',
      icon: Ruler
    },
    { 
      id: 'width', 
      name: 'Width', 
      type: 'decimal', 
      required: false, 
      description: 'Product width',
      category: 'Physical Attributes',
      example: '7.2',
      icon: Ruler
    },
    { 
      id: 'height', 
      name: 'Height', 
      type: 'decimal', 
      required: false, 
      description: 'Product height',
      category: 'Physical Attributes',
      example: '3.1',
      icon: Ruler
    },
    { 
      id: 'dimension_unit', 
      name: 'Dimension Unit', 
      type: 'string', 
      required: false, 
      description: 'Unit of dimension measurement',
      category: 'Physical Attributes',
      example: 'in, cm, mm',
      icon: Ruler
    },
    { 
      id: 'color', 
      name: 'Color', 
      type: 'string', 
      required: false, 
      description: 'Product color or color variant',
      category: 'Physical Attributes',
      example: 'Black, Silver, Blue',
      icon: Package
    },
    { 
      id: 'size', 
      name: 'Size', 
      type: 'string', 
      required: false, 
      description: 'Product size (for apparel, etc.)',
      category: 'Physical Attributes',
      example: 'Small, Medium, Large, XL',
      icon: Package
    },
    { 
      id: 'material', 
      name: 'Material', 
      type: 'string', 
      required: false, 
      description: 'Primary material composition',
      category: 'Physical Attributes',
      example: 'Aluminum, Plastic, Leather',
      icon: Package
    },
    
    // Media
    { 
      id: 'primary_image', 
      name: 'Primary Image URL', 
      type: 'url', 
      required: false, 
      description: 'Main product image URL (300px recommended)',
      category: 'Media',
      example: 'https://example.com/images/product.jpg',
      icon: Image
    },
    { 
      id: 'additional_image_urls', 
      name: 'Additional Image URLs', 
      type: 'text', 
      required: false, 
      description: 'Additional product image URLs (comma separated)',
      category: 'Media',
      example: 'https://example.com/img1.jpg, https://example.com/img2.jpg',
      icon: Image
    },
    
    // Additional
    { 
      id: 'condition', 
      name: 'Condition', 
      type: 'string', 
      required: false, 
      description: 'Product condition',
      category: 'Additional',
      example: 'new, used, refurbished',
      icon: Info
    },
    { 
      id: 'country_of_origin', 
      name: 'Country of Origin', 
      type: 'string', 
      required: false, 
      description: 'Country where product was manufactured',
      category: 'Additional',
      example: 'USA, China, Germany',
      icon: Info
    },
    { 
      id: 'keywords', 
      name: 'Keywords', 
      type: 'text', 
      required: false, 
      description: 'Search keywords or tags (comma separated)',
      category: 'Additional',
      example: 'wireless, bluetooth, audio, headphones',
      icon: Tag
    },
  ];

  const productDetailFields: FieldDoc[] = [
    // Enhanced Media
    { 
      id: 'primary_image_url', 
      name: 'Primary Image URL', 
      type: 'url', 
      required: false, 
      description: 'Main product detail image URL (300-500px)',
      category: 'Enhanced Media',
      example: 'https://example.com/images/product-primary.jpg',
      icon: Image
    },
    { 
      id: 'large_image_url', 
      name: 'Large Image URL', 
      type: 'url', 
      required: false, 
      description: 'High-resolution product image (1000px+)',
      category: 'Enhanced Media',
      example: 'https://example.com/images/product-large.jpg',
      icon: Image
    },
    { 
      id: 'additional_images', 
      name: 'Additional Images', 
      type: 'array', 
      required: false, 
      description: 'Array or JSON of additional product image URLs',
      category: 'Enhanced Media',
      example: '["https://example.com/img1.jpg", "https://example.com/img2.jpg"]',
      icon: Image
    },
    
    // Detailed Information
    { 
      id: 'brand', 
      name: 'Brand', 
      type: 'string', 
      required: false, 
      description: 'Detailed brand information',
      category: 'Detailed Information',
      example: 'Sony Electronics',
      icon: Package
    },
    { 
      id: 'model', 
      name: 'Model', 
      type: 'string', 
      required: false, 
      description: 'Specific product model number or name',
      category: 'Detailed Information',
      example: 'WH-1000XM5',
      icon: Package
    },
    { 
      id: 'year', 
      name: 'Model Year', 
      type: 'string', 
      required: false, 
      description: 'Model year or release year',
      category: 'Detailed Information',
      example: '2024',
      icon: Package
    },
    { 
      id: 'features', 
      name: 'Features', 
      type: 'array/text', 
      required: false, 
      description: 'Product features and benefits (array or newline separated)',
      category: 'Detailed Information',
      example: '["Active Noise Cancellation", "30-hour battery", "Touch controls"]',
      icon: Layers
    },
    { 
      id: 'specifications', 
      name: 'Technical Specifications', 
      type: 'json/text', 
      required: false, 
      description: 'Detailed technical specifications',
      category: 'Detailed Information',
      example: '{"frequency": "4Hz-40kHz", "impedance": "48Ω", "bluetooth": "5.2"}',
      icon: FileText
    },
    
    // Support & Documentation
    { 
      id: 'warranty', 
      name: 'Warranty Information', 
      type: 'text', 
      required: false, 
      description: 'Warranty terms and coverage details',
      category: 'Support & Documentation',
      example: '1-year manufacturer warranty included',
      icon: FileText
    },
    { 
      id: 'manuals', 
      name: 'Product Manuals', 
      type: 'array/text', 
      required: false, 
      description: 'URLs to product manuals and documentation',
      category: 'Support & Documentation',
      example: '["https://example.com/manual.pdf", "https://example.com/quick-guide.pdf"]',
      icon: FileText
    },
    { 
      id: 'installation', 
      name: 'Installation Instructions', 
      type: 'text', 
      required: false, 
      description: 'Installation or setup instructions',
      category: 'Support & Documentation',
      example: 'Download app, turn on Bluetooth, pair device',
      icon: FileText
    },
    { 
      id: 'maintenance', 
      name: 'Maintenance Requirements', 
      type: 'text', 
      required: false, 
      description: 'Care and maintenance instructions',
      category: 'Support & Documentation',
      example: 'Clean with dry cloth, store in case when not in use',
      icon: FileText
    },
    
    // Compatibility & Related
    { 
      id: 'compatibility', 
      name: 'Compatibility', 
      type: 'array/text', 
      required: false, 
      description: 'Compatible devices or systems',
      category: 'Compatibility & Related',
      example: '["iOS 14+", "Android 8+", "Windows 10+", "macOS 11+"]',
      icon: Layers
    },
    { 
      id: 'accessories', 
      name: 'Accessories', 
      type: 'array/text', 
      required: false, 
      description: 'Compatible accessories and add-ons',
      category: 'Compatibility & Related',
      example: '["Carrying Case", "USB-C Cable", "3.5mm Audio Cable"]',
      icon: Layers
    },
    { 
      id: 'related_products', 
      name: 'Related Products', 
      type: 'array/text', 
      required: false, 
      description: 'Related product SKUs (comma separated)',
      category: 'Compatibility & Related',
      example: 'SKU-001, SKU-002, SKU-003',
      icon: Layers
    },
    
    // Quality & Compliance
    { 
      id: 'certifications', 
      name: 'Certifications', 
      type: 'array/text', 
      required: false, 
      description: 'Industry certifications and compliance',
      category: 'Quality & Compliance',
      example: '["FCC", "CE", "RoHS", "Energy Star"]',
      icon: Tag
    },
    { 
      id: 'origin_country', 
      name: 'Country of Origin', 
      type: 'string', 
      required: false, 
      description: 'Manufacturing country (detailed view)',
      category: 'Quality & Compliance',
      example: 'Made in Japan',
      icon: Info
    },
    { 
      id: 'is_taxable', 
      name: 'Is Taxable', 
      type: 'boolean', 
      required: false, 
      description: 'Whether product is subject to sales tax',
      category: 'Quality & Compliance',
      example: 'true, false',
      icon: DollarSign
    },
    { 
      id: 'tax_code', 
      name: 'Tax Code', 
      type: 'string', 
      required: false, 
      description: 'Tax classification code',
      category: 'Quality & Compliance',
      example: 'P0000000',
      icon: DollarSign
    },
    
    // Shipping & Logistics
    { 
      id: 'dimensions', 
      name: 'Package Dimensions', 
      type: 'string', 
      required: false, 
      description: 'Packaging dimensions and measurements',
      category: 'Shipping & Logistics',
      example: '10 x 8 x 4 inches',
      icon: Ruler
    },
    { 
      id: 'lead_time', 
      name: 'Lead Time', 
      type: 'string', 
      required: false, 
      description: 'Production or shipping lead time',
      category: 'Shipping & Logistics',
      example: '3-5 business days',
      icon: Info
    },
    
    // Custom Fields
    { 
      id: 'custom_field_1', 
      name: 'Custom Field 1', 
      type: 'text', 
      required: false, 
      description: 'Flexible custom field for additional data',
      category: 'Custom Fields',
      example: 'Any custom data',
      icon: Database
    },
    { 
      id: 'custom_field_2', 
      name: 'Custom Field 2', 
      type: 'text', 
      required: false, 
      description: 'Flexible custom field for additional data',
      category: 'Custom Fields',
      example: 'Any custom data',
      icon: Database
    },
    { 
      id: 'custom_field_3', 
      name: 'Custom Field 3', 
      type: 'text', 
      required: false, 
      description: 'Flexible custom field for additional data',
      category: 'Custom Fields',
      example: 'Any custom data',
      icon: Database
    },
  ];

  const groupFieldsByCategory = (fields: FieldDoc[]) => {
    return fields.reduce((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, FieldDoc[]>);
  };

  const catalogFieldsByCategory = groupFieldsByCategory(masterCatalogFields);
  const detailFieldsByCategory = groupFieldsByCategory(productDetailFields);

  const renderFieldTable = (fieldsByCategory: Record<string, FieldDoc[]>) => {
    return Object.entries(fieldsByCategory).map(([category, fields]) => {
      const IconComponent = fields[0]?.icon;
      return (
        <div key={category} className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {IconComponent && <IconComponent className="h-5 w-5" />}
            {category}
          </h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3 font-medium text-sm">Field Name</th>
                <th className="text-left p-3 font-medium text-sm">Type</th>
                <th className="text-left p-3 font-medium text-sm">Required</th>
                <th className="text-left p-3 font-medium text-sm">Description</th>
                <th className="text-left p-3 font-medium text-sm">Example</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono text-sm">{field.id}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">{field.type}</Badge>
                  </td>
                  <td className="p-3">
                    {field.required ? (
                      <Badge variant="default" className="bg-red-500 text-xs">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    )}
                  </td>
                  <td className="p-3 text-sm">{field.description}</td>
                  <td className="p-3 text-xs text-muted-foreground font-mono max-w-xs truncate">
                    {field.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      );
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Field Mapping Documentation</h1>
        <p className="text-muted-foreground">
          Complete reference guide for mapping supplier data to your master catalog and product detail pages
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>About Field Mapping</AlertTitle>
        <AlertDescription>
          Your system uses a two-tier mapping structure: <strong>Master Catalog</strong> fields for product listings and search, 
          and <strong>Product Details</strong> fields for comprehensive product information pages. Map supplier fields to the 
          appropriate target fields based on your data structure.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="catalog" className="text-base">
            <Package className="h-4 w-4 mr-2" />
            Master Catalog Fields
          </TabsTrigger>
          <TabsTrigger value="details" className="text-base">
            <FileText className="h-4 w-4 mr-2" />
            Product Detail Fields
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Master Catalog Fields
              </CardTitle>
              <CardDescription>
                Core fields used for product listings, search results, and catalog views. These fields are essential 
                for displaying products in grid/list views and enabling basic search and filtering functionality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900">Required Fields</AlertTitle>
                <AlertDescription className="text-blue-800">
                  At minimum, you must map <strong>SKU</strong> and <strong>Product Name</strong> to import products successfully. 
                  Other fields enhance your catalog but are optional.
                </AlertDescription>
              </Alert>
              
              {renderFieldTable(catalogFieldsByCategory)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Product Detail Fields
              </CardTitle>
              <CardDescription>
                Extended fields for comprehensive product detail pages. These fields provide rich product information, 
                specifications, media galleries, documentation, and enhanced customer experience data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Enhancing Product Pages</AlertTitle>
                <AlertDescription className="text-green-800">
                  Product detail fields are all optional but greatly enhance the customer experience. Map fields like 
                  specifications, features, manuals, and additional images to create rich, informative product pages.
                </AlertDescription>
              </Alert>
              
              {renderFieldTable(detailFieldsByCategory)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Field Type Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Data Types</h4>
              <ul className="space-y-1 text-sm">
                <li><Badge variant="outline" className="mr-2">string</Badge> Simple text value</li>
                <li><Badge variant="outline" className="mr-2">text</Badge> Longer text content</li>
                <li><Badge variant="outline" className="mr-2">decimal</Badge> Numeric with decimals (prices, weights)</li>
                <li><Badge variant="outline" className="mr-2">integer</Badge> Whole numbers (quantities)</li>
                <li><Badge variant="outline" className="mr-2">boolean</Badge> True/false values</li>
                <li><Badge variant="outline" className="mr-2">url</Badge> Web addresses for images/docs</li>
                <li><Badge variant="outline" className="mr-2">array</Badge> Multiple values (comma separated or JSON array)</li>
                <li><Badge variant="outline" className="mr-2">json</Badge> Complex structured data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Mapping Tips</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Use Auto Map to quickly match similar field names</li>
                <li>• Map required fields first to ensure data validation passes</li>
                <li>• Group related fields for better organization</li>
                <li>• Test mappings with sample data before bulk import</li>
                <li>• Use custom fields for supplier-specific attributes</li>
                <li>• Array fields accept comma-separated or JSON format</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
