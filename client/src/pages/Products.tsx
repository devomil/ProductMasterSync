import { useState, useReducer } from "react";
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
import { useCategories } from "@/hooks/useCategories";
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
import { AmazonMarketData } from "@/components/products/AmazonMarketData";

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
  
  // State for product drawers
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string, upc: string | null} | null>(null);
  const [fulfillmentDrawerOpen, setFulfillmentDrawerOpen] = useState(false);
  const [amazonDataDrawerOpen, setAmazonDataDrawerOpen] = useState(false);
  
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

  // Get products data from API
  const { products, isLoading } = useProducts();
  
  // Get categories data
  const { categories, isLoading: categoriesLoading } = useCategories();

  // Filtering logic
  const filteredProducts = products.filter(product => {
    // Simple search without filters
    if (searchQuery && !Object.values(filters).some(v => v && v !== '' && v !== 'all')) {
      return product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.manufacturerPartNumber && product.manufacturerPartNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.upc && product.upc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.manufacturerName && product.manufacturerName.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Advanced filtering
    if (Object.values(filters).some(v => v && v !== '' && v !== 'all')) {
      let matches = true;

      // Text search based on searchType
      if (filters.query) {
        const query = filters.query.toLowerCase();
        switch (filters.searchType) {
          case 'sku':
            matches = matches && product.sku.toLowerCase().includes(query);
            break;
          case 'mfgPart':
            matches = matches && (product.manufacturerPartNumber?.toLowerCase().includes(query) || false);
            break;
          case 'upc':
            matches = matches && (product.upc?.toLowerCase().includes(query) || false);
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
              product.sku.toLowerCase().includes(query) ||
              (product.manufacturerPartNumber?.toLowerCase().includes(query) || false) ||
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
        <h1 className="text-2xl font-semibold text-neutral-900">Products</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="space-y-4">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">
                    EDC
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Title
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[220px]">Description</TableHead>
                  <TableHead>UPC</TableHead>
                  <TableHead>MFG Part #</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  filteredProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {getSpecialFlagComponents(product)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 line-clamp-2" title={product.description || ''}>
                          {product.description || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{product.upc || '-'}</TableCell>
                      <TableCell>{product.mpn || '-'}</TableCell>
                      <TableCell>{product.brand || '-'}</TableCell>
                      <TableCell>{product.category || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-medium">{product.stockQuantity || 0}</span>
                          {/* Set a lower fixed threshold for demo purposes */}
                          {product.stockQuantity && product.stockQuantity < 100 && (
                            <Badge variant="outline" className="ml-2 text-amber-700 bg-amber-50 border-amber-200">
                              Low
                            </Badge>
                          )}
                        </div>
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

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between">
            <div className="text-sm text-neutral-500">
              Showing <span className="font-medium">{filteredProducts.length > 0 ? 1 : 0}</span> to <span className="font-medium">{Math.min(10, filteredProducts.length)}</span> of <span className="font-medium">{filteredProducts.length}</span> products
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">2</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">3</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" />
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
              <AmazonMarketData
                productId={parseInt(selectedProduct.id)}
                upc={selectedProduct.upc}
              />
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