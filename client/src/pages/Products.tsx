import { useState, useReducer } from "react";
import { Link } from "wouter";
import { 
  Package2, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Download,
  Upload,
  X,
  Check,
  Tag,
  Barcode,
  AlignLeft,
  LayoutGrid,
  Factory,
  Truck,
  BadgePercent,
  ShoppingBag,
  Mail,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Warehouse
} from "lucide-react";
import { 
  useProducts, 
  ProductSearchFilters, 
  SearchType, 
  InventoryStatusType 
} from "@/hooks/useProducts";

// Helper function to clean HTML tags from descriptions
const cleanHtmlTags = (htmlString: string): string => {
  if (!htmlString) return '';
  return htmlString
    .replace(/<p><strong>/gi, '')
    .replace(/<\/strong><\/p><p>/gi, ' ')
    .replace(/<\/strong><\/p>/gi, '')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, ' ')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper function to remove EDC prefix from SKU
const removeEdcPrefix = (sku: string): string => {
  if (!sku) return '';
  return sku.replace(/^EDC/i, '');
};
import { useCategories } from "@/hooks/useCategories";
import { useMappingTemplates } from "@/hooks/useMappingTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FulfillmentDrawer } from "@/components/products/FulfillmentDrawer";
// import { AmazonMarketData } from "@/components/products/AmazonMarketData";

// Search filter schema
const searchFilterSchema = z.object({
  searchType: z.enum(['all', 'sku', 'mfgPart', 'upc', 'title', 'description', 'category', 'manufacturer']),
  query: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.string().optional(),
  supplier: z.string().optional(),
  isRemanufactured: z.boolean().optional(),
  isCloseout: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  hasRebate: z.boolean().optional(),
  hasFreeShipping: z.boolean().optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  inventoryStatus: z.enum(['all', 'inStock', 'lowStock', 'outOfStock']).optional(),
});

// Product Flag Component
interface ProductFlagProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}

const ProductFlag = ({ active, icon, label }: ProductFlagProps) => {
  return active ? (
    <Badge 
      variant="outline" 
      className={`gap-1 ${active ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
    >
      {icon}
      {label}
    </Badge>
  ) : null;
};

// Define action types for filter state reducer
type FilterAction = 
  | { type: 'SET_FILTER'; field: keyof ProductSearchFilters; value: any }
  | { type: 'RESET_FILTERS' }
  | { type: 'APPLY_FILTERS'; filters: ProductSearchFilters };

// Reducer for managing filter state
const filterReducer = (state: ProductSearchFilters, action: FilterAction): ProductSearchFilters => {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.field]: action.value };
    case 'RESET_FILTERS':
      return {
        searchType: 'all',
        query: '',
        category: '',
        status: '',
        supplier: '',
        manufacturer: '',
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: false,
        hasRebate: false,
        hasFreeShipping: false,
        inventoryStatus: 'all',
      };
    case 'APPLY_FILTERS':
      return { ...action.filters };
    default:
      return state;
  }
};

// Main component
const Products = () => {
  // State for basic and advanced search
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // State for view options
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [showFullDescriptions, setShowFullDescriptions] = useState(false);
  
  // State for product drawers
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string, upc: string | null} | null>(null);
  const [fulfillmentDrawerOpen, setFulfillmentDrawerOpen] = useState(false);
  const [amazonDataDrawerOpen, setAmazonDataDrawerOpen] = useState(false);
  
  // Load mapping templates to get CWR template columns
  const { data: mappingTemplates } = useMappingTemplates();
  
  // Filter state using reducer
  const [filters, dispatchFilters] = useReducer(filterReducer, {
    searchType: 'all' as SearchType,
    query: '',
    category: '',
    status: '',
    supplier: '',
    manufacturer: '',
    inventoryStatus: 'all' as InventoryStatusType,
    isRemanufactured: false,
    isCloseout: false,
    isOnSale: false,
    hasRebate: false,
    hasFreeShipping: false,
  });

  // Form for advanced search dialog
  const form = useForm({
    resolver: zodResolver(searchFilterSchema),
    defaultValues: {
      searchType: 'all',
      query: '',
      category: '',
      status: '',
      supplier: '',
      manufacturer: '',
      isRemanufactured: false,
      isCloseout: false,
      isOnSale: false,
      hasRebate: false,
      hasFreeShipping: false,
      inventoryStatus: 'all' as const,
    },
  });

  // Get products data from API with server-side search
  const { products, pagination, isLoading } = useProducts(currentPage, itemsPerPage, searchQuery);
  
  // Get categories data
  const { categories, isLoading: categoriesLoading } = useCategories();
  
  // Get CWR mapping template to determine dynamic columns
  const cwrTemplate = mappingTemplates?.find(t => t.name === 'CWR');
  
  // Define the desired column order for CWR - EDC first, then USIN, then UPC
  const desiredColumnOrder = ['sku', 'usin', 'upc', 'cost', 'price', 'category', 'weight', 'product_name', 'description', 'brand', 'primary_image', 'mpn'];
  
  // Get dynamic columns in the correct order: EDC (sku), USIN, UPC, then others
  let dynamicColumns = [];
  if (cwrTemplate?.mappings) {
    // Always start with EDC (sku) - this is application-generated
    dynamicColumns = ['sku'];
    
    // Add USIN if it exists in mapping (CWR Part Number maps to usin)
    if (Object.values(cwrTemplate.mappings).includes('usin')) {
      dynamicColumns.push('usin');
    }
    
    // Add remaining columns in desired order if they exist in mapping
    desiredColumnOrder.slice(2).forEach(field => {
      if (Object.values(cwrTemplate.mappings).includes(field)) {
        dynamicColumns.push(field);
      }
    });
  }
  
  // Define column mapping for display names with correct CWR order
  const columnDisplayNames: Record<string, string> = {
    sku: 'EDC',  // First column should be EDC (which maps to SKU)
    usin: 'USIN', // Second column
    upc: 'UPC',   // Third column
    cost: 'Cost',
    price: 'Price',
    category: 'Category',
    weight: 'Weight',
    product_name: 'Product Name',
    description: 'Description',
    brand: 'Brand',
    primary_image: 'Image',
    mpn: 'MPN'
  };
  
  // Helper function to get column width classes based on view mode
  const getColumnWidthClass = (field: string): string => {
    if (viewMode === 'compact') {
      return field === 'sku' ? 'w-[80px]' :
             field === 'product_name' ? 'w-[200px]' :
             field === 'description' ? 'w-[250px]' :
             field === 'upc' ? 'w-[100px]' :
             'w-[80px]';
    } else if (viewMode === 'spacious') {
      return field === 'sku' ? 'w-[140px]' :
             field === 'product_name' ? 'w-[350px]' :
             field === 'description' ? 'w-[500px]' :
             field === 'upc' ? 'w-[160px]' :
             'w-[140px]';
    } else { // comfortable (default)
      return field === 'sku' ? 'w-[120px]' :
             field === 'product_name' ? 'w-[280px]' :
             field === 'description' ? 'w-[300px]' :
             field === 'upc' ? 'w-[140px]' :
             'w-[120px]';
    }
  };

  // Helper function to get product field value
  const getProductValue = (product: any, field: string): string => {
    const fieldMap: Record<string, string> = {
      sku: removeEdcPrefix(product.sku),  // Remove EDC prefix from SKU display
      usin: product.usin || product.cwrPartNumber || '-',  // USIN field from CWR Part Number
      upc: product.upc || '-',
      cost: product.cost ? `$${parseFloat(product.cost).toFixed(2)}` : '-',
      price: product.price ? `$${parseFloat(product.price).toFixed(2)}` : '-',
      category: product.categoryName || '-',
      weight: product.weight ? `${product.weight} lbs` : '-',
      product_name: product.name || '-',
      description: cleanHtmlTags(product.description || '') || '-',  // Clean HTML tags from description
      brand: product.manufacturerName || '-',
      primary_image: product.primaryImageUrl || '-',
      mpn: product.manufacturerPartNumber || '-'
    };
    
    return fieldMap[field] || product[field] || '-';
  };

  // Helper function to check if any meaningful filters are applied
  const hasActiveFilters = () => {
    return filters.query || 
           (filters.category && filters.category !== '') ||
           (filters.supplier && filters.supplier !== '') ||
           (filters.manufacturer && filters.manufacturer !== '') ||
           (filters.inventoryStatus && filters.inventoryStatus !== 'all') ||
           filters.isRemanufactured || filters.isCloseout || filters.isOnSale || 
           filters.hasRebate || filters.hasFreeShipping;
  };

  // Filtering logic - only for advanced filters (search is now server-side)
  const filteredProducts = products.filter(product => {
    // Advanced filtering (client-side)
    if (hasActiveFilters()) {
      let matches = true;

      // Text search based on searchType
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const normalizedQuery = query.replace(/\s+/g, '');
        const normalizedSku = product.sku.toLowerCase().replace(/\s+/g, '');
        const normalizedUpc = (product.upc || '').toLowerCase().replace(/\s+/g, '');
        const normalizedMfgPart = (product.manufacturerPartNumber || '').toLowerCase().replace(/\s+/g, '');
        
        switch (filters.searchType) {
          case 'sku':
            matches = matches && (normalizedSku.includes(normalizedQuery) || product.sku.toLowerCase().includes(query));
            break;
          case 'mfgPart':
            matches = matches && (normalizedMfgPart.includes(normalizedQuery) || (product.manufacturerPartNumber?.toLowerCase().includes(query) || false));
            break;
          case 'upc':
            matches = matches && (normalizedUpc.includes(normalizedQuery) || (product.upc?.toLowerCase().includes(query) || false));
            break;
          case 'title':
            matches = matches && product.name.toLowerCase().includes(query);
            break;
          case 'description':
            matches = matches && (product.description?.toLowerCase().includes(query) || false);
            break;
          case 'category':
            // This would need to match category name if available
            matches = matches && (product.categoryId?.toString() === filters.category || false);
            break;
          case 'manufacturer':
            matches = matches && (product.manufacturerName?.toLowerCase().includes(query) || false);
            break;
          case 'all':
            matches = matches && (
              normalizedSku.includes(normalizedQuery) ||
              product.sku.toLowerCase().includes(query) ||
              normalizedMfgPart.includes(normalizedQuery) ||
              (product.manufacturerPartNumber?.toLowerCase().includes(query) || false) ||
              normalizedUpc.includes(normalizedQuery) ||
              (product.upc?.toLowerCase().includes(query) || false) ||
              product.name.toLowerCase().includes(query) ||
              (product.description?.toLowerCase().includes(query) || false) ||
              (product.manufacturerName?.toLowerCase().includes(query) || false)
            );
            break;
        }
      }

      // Category filter
      if (filters.category && filters.category !== 'all_categories') {
        // For demonstration purposes - match the category name
        const category = product.categoryName || '';
        matches = matches && category === filters.category;
      }

      // Status filter
      if (filters.status && filters.status !== 'all_statuses') {
        matches = matches && product.status === filters.status;
      }
      
      // Supplier filter
      if (filters.supplier && filters.supplier !== 'all_suppliers') {
        // This would check against supplier name in a real implementation
        // Here we're simulating by reusing existing data
        matches = matches && product.supplier === filters.supplier;
      }
      
      // Manufacturer filter
      if (filters.manufacturer && filters.manufacturer !== 'all_manufacturers') {
        matches = matches && product.manufacturerName === filters.manufacturer;
      }

      // Special flags
      if (filters.isRemanufactured) matches = matches && (product.isRemanufactured || false);
      if (filters.isCloseout) matches = matches && (product.isCloseout || false);
      if (filters.isOnSale) matches = matches && (product.isOnSale || false);
      if (filters.hasRebate) matches = matches && (product.hasRebate || false);
      if (filters.hasFreeShipping) matches = matches && (product.hasFreeShipping || false);

      // Inventory status
      if (filters.inventoryStatus !== 'all') {
        const qty = product.inventoryQuantity || 0;
        const threshold = product.reorderThreshold || 5;

        switch (filters.inventoryStatus) {
          case 'inStock':
            matches = matches && qty > threshold;
            break;
          case 'lowStock':
            matches = matches && qty > 0 && qty <= threshold;
            break;
          case 'outOfStock':
            matches = matches && qty <= 0;
            break;
        }
      }

      return matches;
    }

    return true;
  });

  const onSubmitSearch = (data: any) => {
    dispatchFilters({
      type: 'APPLY_FILTERS',
      filters: {
        searchType: data.searchType as SearchType,
        query: data.query || "",
        category: data.category || "",
        status: data.status || "",
        supplier: data.supplier || "",
        isRemanufactured: data.isRemanufactured || false,
        isCloseout: data.isCloseout || false,
        isOnSale: data.isOnSale || false,
        hasRebate: data.hasRebate || false,
        hasFreeShipping: data.hasFreeShipping || false,
        priceMin: data.priceMin,
        priceMax: data.priceMax,
        inventoryStatus: data.inventoryStatus as InventoryStatusType || "all"
      }
    });
    setIsAdvancedSearchOpen(false);
  };

  const resetFilters = () => {
    const defaultFilters = {
      searchType: 'all' as SearchType,
      query: '',
      category: '',
      status: '',
      supplier: '',
      isRemanufactured: false,
      isCloseout: false,
      isOnSale: false,
      hasRebate: false,
      hasFreeShipping: false,
      inventoryStatus: 'all' as InventoryStatusType,
    };
    dispatchFilters({ type: 'RESET_FILTERS' });
    form.reset(defaultFilters);
    setSearchQuery("");
  };

  const getSpecialFlagComponents = (product: any) => {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        <ProductFlag 
          active={product.isRemanufactured || false} 
          icon={<Gauge className="h-3 w-3" />} 
          label="Remanufactured" 
        />
        <ProductFlag 
          active={product.isCloseout || false} 
          icon={<Tag className="h-3 w-3" />} 
          label="Closeout" 
        />
        <ProductFlag 
          active={product.isOnSale || false} 
          icon={<ShoppingBag className="h-3 w-3" />} 
          label="Sale" 
        />
        <ProductFlag 
          active={product.hasRebate || false} 
          icon={<BadgePercent className="h-3 w-3" />} 
          label="Rebate" 
        />
        <ProductFlag 
          active={product.hasFreeShipping || false} 
          icon={<Truck className="h-3 w-3" />} 
          label="Free Shipping" 
        />
      </div>
    );
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Master Catalog</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="space-y-4">
          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!hasActiveFilters() ? "default" : "outline"}
              size="sm"
              onClick={() => {
                dispatchFilters({ type: 'RESET_FILTERS' });
                setSearchQuery('');
              }}
              className="h-8"
            >
              All Products
            </Button>
            
            <Button
              variant={filters.inventoryStatus === 'inStock' ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'inventoryStatus',
                value: filters.inventoryStatus === 'inStock' ? 'all' : 'inStock'
              })}
              className="h-8"
            >
              In Stock
            </Button>
            
            <Button
              variant={filters.isOnSale ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'isOnSale',
                value: !filters.isOnSale
              })}
              className="h-8"
            >
              <Tag className="mr-1 h-3 w-3" />
              On Sale
            </Button>
            
            <Button
              variant={filters.hasRebate ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'hasRebate',
                value: !filters.hasRebate
              })}
              className="h-8"
            >
              <BadgePercent className="mr-1 h-3 w-3" />
              Has Rebate
            </Button>
            
            <Button
              variant={filters.hasFreeShipping ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'hasFreeShipping',
                value: !filters.hasFreeShipping
              })}
              className="h-8"
            >
              <Truck className="mr-1 h-3 w-3" />
              Free Shipping
            </Button>
            
            <Button
              variant={filters.isCloseout ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'isCloseout',
                value: !filters.isCloseout
              })}
              className="h-8"
            >
              <Package2 className="mr-1 h-3 w-3" />
              Closeout
            </Button>
            
            <Button
              variant={filters.isRemanufactured ? "default" : "outline"}
              size="sm"
              onClick={() => dispatchFilters({
                type: 'SET_FILTER',
                field: 'isRemanufactured',
                value: !filters.isRemanufactured
              })}
              className="h-8"
            >
              <Gauge className="mr-1 h-3 w-3" />
              Remanufactured
            </Button>
          </div>

          {/* Search bar and basic controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <Input 
                type="search" 
                placeholder="Search products..."
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* View Options */}
              <div className="flex items-center space-x-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'compact' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('compact')}
                  className="h-7 px-2"
                  title="Compact View"
                >
                  <LayoutGrid className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === 'comfortable' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('comfortable')}
                  className="h-7 px-2"
                  title="Comfortable View"
                >
                  <AlignLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === 'spacious' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('spacious')}
                  className="h-7 px-2"
                  title="Spacious View"
                >
                  <Package2 className="h-3 w-3" />
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsAdvancedSearchOpen(true)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Advanced Search
              </Button>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {Object.values(filters).some(v => v && v !== '' && v !== 'all') && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3">
              <h4 className="text-sm font-medium mb-2">Active Filters:</h4>
              <div className="flex flex-wrap gap-2">
                {filters.category && (
                  <Badge variant="outline" className="bg-white">
                    Category: {filters.category}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 ml-1"
                      onClick={() => dispatchFilters({
                        type: 'SET_FILTER',
                        field: 'category',
                        value: ''
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {filters.status && (
                  <Badge variant="outline" className="bg-white">
                    Status: {filters.status}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 ml-1"
                      onClick={() => dispatchFilters({
                        type: 'SET_FILTER',
                        field: 'status',
                        value: ''
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                {filters.supplier && (
                  <Badge variant="outline" className="bg-white">
                    Supplier: {filters.supplier}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 ml-1"
                      onClick={() => dispatchFilters({
                        type: 'SET_FILTER',
                        field: 'supplier',
                        value: ''
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Quick filter dropdowns */}
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:w-auto">
              <Select 
                value={filters.category || ""} 
                onValueChange={(value) => dispatchFilters({
                  type: 'SET_FILTER',
                  field: 'category',
                  value
                })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_categories">All Categories</SelectItem>
                  {categories.slice(1).map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-auto">
              <Select 
                value={filters.status || ""} 
                onValueChange={(value) => dispatchFilters({
                  type: 'SET_FILTER',
                  field: 'status',
                  value
                })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-auto">
              <Select 
                value={filters.supplier || ""} 
                onValueChange={(value) => dispatchFilters({
                  type: 'SET_FILTER',
                  field: 'supplier',
                  value
                })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_suppliers">All Suppliers</SelectItem>
                  <SelectItem value="ABC Trading Co.">ABC Trading Co.</SelectItem>
                  <SelectItem value="XYZ Supplies Inc.">XYZ Supplies Inc.</SelectItem>
                  <SelectItem value="Global Supplies Ltd.">Global Supplies Ltd.</SelectItem>
                  <SelectItem value="West Coast Distributors">West Coast Distributors</SelectItem>
                  <SelectItem value="Eastern Merchandise Group">Eastern Merchandise Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-auto">
              <Select 
                value={filters.manufacturer || ""} 
                onValueChange={(value) => dispatchFilters({
                  type: 'SET_FILTER',
                  field: 'manufacturer',
                  value
                })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_manufacturers">All Manufacturers</SelectItem>
                  <SelectItem value="TechVision">TechVision</SelectItem>
                  <SelectItem value="OfficeMax">OfficeMax</SelectItem>
                  <SelectItem value="AudioTech">AudioTech</SelectItem>
                  <SelectItem value="WoodWorks">WoodWorks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
              <Table className={`min-w-full ${
                viewMode === 'compact' ? 'table-fixed' : 
                viewMode === 'spacious' ? 'table-auto' : 
                'table-auto'
              }`}>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
                  <TableRow>
                    {/* Render dynamic columns based on CWR mapping template */}
                    {dynamicColumns.length > 0 ? (
                      dynamicColumns.map((field, index) => (
                        <TableHead key={field} className={`text-sm font-medium whitespace-nowrap px-4 py-3 ${getColumnWidthClass(field)}`}>
                          {columnDisplayNames[field] || field.charAt(0).toUpperCase() + field.slice(1)}
                        </TableHead>
                      ))
                    ) : (
                      // Fallback to default columns if no mapping template
                      <>
                        <TableHead className="w-[120px] text-sm font-medium whitespace-nowrap px-4 py-3">EDC</TableHead>
                        <TableHead className="w-[280px] text-sm font-medium whitespace-nowrap px-4 py-3">Product Name</TableHead>
                        <TableHead className="w-[400px] text-sm font-medium whitespace-nowrap px-4 py-3">Description</TableHead>
                        <TableHead className="w-[140px] text-sm font-medium whitespace-nowrap px-4 py-3">UPC</TableHead>
                        <TableHead className="w-[120px] text-sm font-medium whitespace-nowrap px-4 py-3">MPN</TableHead>
                        <TableHead className="w-[160px] text-sm font-medium whitespace-nowrap px-4 py-3">Brand</TableHead>
                        <TableHead className="w-[200px] text-sm font-medium whitespace-nowrap px-4 py-3">Category</TableHead>
                        <TableHead className="w-[100px] text-sm font-medium whitespace-nowrap px-4 py-3">Cost</TableHead>
                        <TableHead className="w-[100px] text-sm font-medium whitespace-nowrap px-4 py-3">Price</TableHead>
                        <TableHead className="w-[120px] text-sm font-medium whitespace-nowrap px-4 py-3">Weight</TableHead>
                      </>
                    )}
                    <TableHead className="w-[180px] text-sm font-medium whitespace-nowrap px-4 py-3">Amazon ASINs</TableHead>
                    <TableHead className="w-[100px] text-sm font-medium whitespace-nowrap px-4 py-3">Status</TableHead>
                    <TableHead className="w-[100px] text-right text-sm font-medium whitespace-nowrap px-4 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  filteredProducts.map((product, index) => (
                    <TableRow key={`${product.id}-${index}`} className={`
                      ${viewMode === 'compact' ? 'h-10' : 
                        viewMode === 'spacious' ? 'h-16' : 
                        'h-12'
                      }
                    `}>
                      {/* Render dynamic columns based on CWR mapping template */}
                      {dynamicColumns.length > 0 ? (
                        dynamicColumns.map((field, fieldIndex) => (
                          <TableCell key={field} className={`text-sm ${getColumnWidthClass(field)} ${
                            viewMode === 'compact' ? 'px-2 py-1' : 
                            viewMode === 'spacious' ? 'px-6 py-4' : 
                            'px-4 py-3'
                          } ${field === 'sku' ? 'font-medium' : ''}`}>
                            {field === 'sku' ? (
                              <Link href={`/products/${product.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                {getProductValue(product, field)}
                              </Link>
                            ) : field === 'product_name' ? (
                              <div className={getColumnWidthClass(field)}>
                                <Link href={`/products/${product.id}`} className="font-medium text-sm leading-5 text-blue-600 hover:text-blue-800 hover:underline block truncate">
                                  {getProductValue(product, field)}
                                </Link>
                                {getSpecialFlagComponents(product)}
                              </div>
                            ) : field === 'description' ? (
                              <div 
                                className={`text-sm text-gray-600 ${getColumnWidthClass(field)} overflow-hidden`}
                                title={getProductValue(product, field)}
                              >
                                <div className={`leading-tight ${viewMode === 'compact' ? 'line-clamp-2' : 'line-clamp-3'}`}>
                                  {cleanHtmlTags(getProductValue(product, field) || '')}
                                </div>
                              </div>
                            ) : field === 'primary_image' ? (
                              getProductValue(product, field) !== '-' ? (
                                <img 
                                  src={getProductValue(product, field)} 
                                  alt="Product" 
                                  className="w-8 h-8 object-cover rounded"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : '-'
                            ) : (
                              <div className="truncate">
                                {getProductValue(product, field)}
                              </div>
                            )}
                          </TableCell>
                        ))
                      ) : (
                        // Fallback to default columns if no mapping template
                        <>
                          <TableCell className="font-medium text-sm">
                            <Link href={`/products/${product.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                              {removeEdcPrefix(product.sku)}
                            </Link>
                          </TableCell>
                          <TableCell className="min-w-[240px]">
                            <div>
                              <Link href={`/products/${product.id}`} className="font-medium text-sm leading-5 text-blue-600 hover:text-blue-800 hover:underline">
                                {product.name}
                              </Link>
                              {getSpecialFlagComponents(product)}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="text-sm text-gray-600 line-clamp-2" title={cleanHtmlTags(product.description || '')}>
                              {cleanHtmlTags(product.description || '') || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{product.upc || '-'}</TableCell>
                          <TableCell className="text-sm">{product.manufacturerPartNumber || '-'}</TableCell>
                          <TableCell className="text-sm">{product.manufacturerName || '-'}</TableCell>
                          <TableCell className="text-sm">{product.categoryName || '-'}</TableCell>
                          <TableCell className="text-sm">{product.cost || '-'}</TableCell>
                          <TableCell className="text-sm">{product.price || '-'}</TableCell>
                          <TableCell className="text-sm">{product.weight || '-'}</TableCell>
                        </>
                      )}
                      <TableCell className="text-sm">
                        {product.asinMappings && product.asinMappings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.asinMappings.slice(0, 2).map((mapping: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {mapping.asin}
                              </Badge>
                            ))}
                            {product.asinMappings.length > 2 && (
                              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                +{product.asinMappings.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : product.amazonSyncStatus === 'success' ? (
                          <span className="text-gray-400 text-xs">No ASINs</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.status === 'active' ? 'default' : 'secondary'}
                          className={product.status === 'active' ? 'bg-green-50 text-green-700 hover:bg-green-50 border-green-200' : ''}
                        >
                          {product.status || 'inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Barcode className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedProduct({ 
                                id: String(product.id), 
                                name: product.name,
                                upc: product.upc 
                              });
                              setFulfillmentDrawerOpen(true);
                            }}>
                              <Package2 className="mr-2 h-4 w-4" />
                              Manage Fulfillment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedProduct({ 
                                id: String(product.id), 
                                name: product.name,
                                upc: product.upc
                              });
                              setAmazonDataDrawerOpen(true);
                            }}>
                              <ShoppingBag className="mr-2 h-4 w-4" />
                              View Market Data
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between">
            <div className="text-sm text-neutral-500">
              Showing <span className="font-medium">{pagination ? Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalItems) : 0}</span> to <span className="font-medium">{pagination ? Math.min(pagination.page * pagination.limit, pagination.totalItems) : 0}</span> of <span className="font-medium">{pagination?.totalItems || 0}</span> products
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {pagination && Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {pagination && pagination.totalPages > 5 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(pagination?.totalPages || 1, prev + 1))}
                    className={!pagination || currentPage >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      {/* Advanced Search Dialog */}
      <Dialog open={isAdvancedSearchOpen} onOpenChange={setIsAdvancedSearchOpen}>
        <DialogContent className="sm:max-w-md md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Advanced Search</DialogTitle>
            <DialogDescription>
              Search and filter products with multiple criteria
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitSearch)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="attributes">Attributes</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="searchType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search In</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Fields</SelectItem>
                              <SelectItem value="sku">SKU</SelectItem>
                              <SelectItem value="mfgPart">Manufacturer Part #</SelectItem>
                              <SelectItem value="upc">UPC</SelectItem>
                              <SelectItem value="title">Product Name</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="manufacturer">Manufacturer</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="query"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Term</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter search term" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_categories">All Categories</SelectItem>
                              {categories.slice(1).map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Suppliers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_suppliers">All Suppliers</SelectItem>
                              <SelectItem value="ABC Trading Co.">ABC Trading Co.</SelectItem>
                              <SelectItem value="XYZ Supplies Inc.">XYZ Supplies Inc.</SelectItem>
                              <SelectItem value="Global Supplies Ltd.">Global Supplies Ltd.</SelectItem>
                              <SelectItem value="West Coast Distributors">West Coast Distributors</SelectItem>
                              <SelectItem value="Eastern Merchandise Group">Eastern Merchandise Group</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Manufacturers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_manufacturers">All Manufacturers</SelectItem>
                              <SelectItem value="TechVision">TechVision</SelectItem>
                              <SelectItem value="OfficeMax">OfficeMax</SelectItem>
                              <SelectItem value="AudioTech">AudioTech</SelectItem>
                              <SelectItem value="WoodWorks">WoodWorks</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="attributes" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="isRemanufactured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Remanufactured</FormLabel>
                            <FormDescription>
                              Products that have been refurbished or remanufactured
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isCloseout"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Closeout</FormLabel>
                            <FormDescription>
                              Products marked for closeout or discontinuation
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isOnSale"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>On Sale</FormLabel>
                            <FormDescription>
                              Products currently on sale or discount
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="hasRebate"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Has Rebate</FormLabel>
                            <FormDescription>
                              Products eligible for rebate or cash back
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="hasFreeShipping"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Free Shipping</FormLabel>
                            <FormDescription>
                              Products eligible for free shipping
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="inventory" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="inventoryStatus"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Inventory Status</FormLabel>
                        <FormControl>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="all"
                                className="text-primary"
                                value="all"
                                checked={field.value === 'all'}
                                onChange={() => field.onChange('all')}
                              />
                              <label htmlFor="all" className="text-sm">All</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="inStock"
                                className="text-primary"
                                value="inStock"
                                checked={field.value === 'inStock'}
                                onChange={() => field.onChange('inStock')}
                              />
                              <label htmlFor="inStock" className="text-sm">In Stock</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="lowStock"
                                className="text-primary"
                                value="lowStock"
                                checked={field.value === 'lowStock'}
                                onChange={() => field.onChange('lowStock')}
                              />
                              <label htmlFor="lowStock" className="text-sm">Low Stock</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="outOfStock"
                                className="text-primary"
                                value="outOfStock"
                                checked={field.value === 'outOfStock'}
                                onChange={() => field.onChange('outOfStock')}
                              />
                              <label htmlFor="outOfStock" className="text-sm">Out of Stock</label>
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => {
                  resetFilters();
                  setIsAdvancedSearchOpen(false);
                }}>
                  Reset
                </Button>
                <Button type="submit">Apply Filters</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Fulfillment Management Drawer */}
      <FulfillmentDrawer 
        isOpen={fulfillmentDrawerOpen}
        onClose={() => setFulfillmentDrawerOpen(false)}
        productId={selectedProduct?.id || null}
        productName={selectedProduct?.name || ''}
      />

      {/* Amazon Market Data Drawer */}
      <Drawer open={amazonDataDrawerOpen} onOpenChange={setAmazonDataDrawerOpen} direction="right" size="lg">
        <DrawerContent>
          <DrawerHeader className="border-b">
            <DrawerTitle>Amazon Marketplace Intelligence</DrawerTitle>
            <DrawerDescription>
              Marketplace data for {selectedProduct?.name || 'Product'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-6">
            {selectedProduct && (
              <div className="text-center py-8 text-gray-500">
                <div className="mb-4">Amazon Marketplace Intelligence</div>
                <div className="text-sm">Feature temporarily unavailable</div>
              </div>
            )}
          </div>
          <DrawerFooter className="border-t">
            <Button variant="outline" onClick={() => setAmazonDataDrawerOpen(false)}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Products;