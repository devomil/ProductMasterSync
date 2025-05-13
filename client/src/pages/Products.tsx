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
  Sliders
} from "lucide-react";
import { 
  useProducts, 
  useProductSearch, 
  useProductDetails,
  ProductSearchFilters, 
  SearchType, 
  InventoryStatusType 
} from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Search filter schema
const searchFilterSchema = z.object({
  searchType: z.enum(['all', 'sku', 'mfgPart', 'upc', 'title', 'description', 'category', 'manufacturer']),
  query: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  isRemanufactured: z.boolean().optional(),
  isCloseout: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  hasRebate: z.boolean().optional(),
  hasFreeShipping: z.boolean().optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  inventoryStatus: z.enum(['all', 'inStock', 'lowStock', 'outOfStock']).optional(),
});

type SearchFilters = z.infer<typeof searchFilterSchema>;

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

// Main component
// Schema and state management for advanced search
const formSchema = z.object({
  searchType: z.enum(['all', 'sku', 'mfgPart', 'upc', 'title', 'description', 'category', 'manufacturer']),
  query: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  isRemanufactured: z.boolean().default(false),
  isCloseout: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  hasRebate: z.boolean().default(false),
  hasFreeShipping: z.boolean().default(false),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  inventoryStatus: z.enum(['all', 'inStock', 'lowStock', 'outOfStock']).default('all'),
});

type SearchFiltersSchema = z.infer<typeof formSchema>;

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

const Products = () => {
  // State for basic and advanced search
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter state using reducer
  const [filters, dispatchFilters] = useReducer(filterReducer, {
    searchType: 'all' as SearchType,
    query: '',
    inventoryStatus: 'all' as InventoryStatusType,
    query: '',
    isRemanufactured: false,
    isCloseout: false,
    isOnSale: false,
    hasRebate: false,
    hasFreeShipping: false,
    inventoryStatus: 'all' as const,
  });

  const form = useForm<SearchFilters>({
    resolver: zodResolver(searchFilterSchema),
    defaultValues: {
      searchType: 'all',
      query: '',
      isRemanufactured: false,
      isCloseout: false,
      isOnSale: false,
      hasRebate: false,
      hasFreeShipping: false,
      inventoryStatus: 'all' as const,
    },
  });

  // Filtering logic
  const filteredProducts = products.filter(product => {
    // Simple search without filters
    if (searchQuery && !Object.values(activeFilters).some(v => v)) {
      return product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.manufacturerPartNumber && product.manufacturerPartNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.upc && product.upc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.manufacturerName && product.manufacturerName.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Advanced filtering
    if (Object.values(activeFilters).some(v => v)) {
      let matches = true;

      // Text search based on searchType
      if (activeFilters.query) {
        const query = activeFilters.query.toLowerCase();
        switch (activeFilters.searchType) {
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
            matches = matches && (product.categoryId?.toString() === activeFilters.category || false);
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

      // Special flags
      if (activeFilters.isRemanufactured) matches = matches && (product.isRemanufactured || false);
      if (activeFilters.isCloseout) matches = matches && (product.isCloseout || false);
      if (activeFilters.isOnSale) matches = matches && (product.isOnSale || false);
      if (activeFilters.hasRebate) matches = matches && (product.hasRebate || false);
      if (activeFilters.hasFreeShipping) matches = matches && (product.hasFreeShipping || false);

      // Inventory status
      if (activeFilters.inventoryStatus !== 'all') {
        const qty = product.inventoryQuantity || 0;
        const threshold = product.reorderThreshold || 5;

        switch (activeFilters.inventoryStatus) {
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

  const onSubmitSearch = (data: SearchFilters) => {
    setActiveFilters(data);
    setIsAdvancedSearchOpen(false);
  };

  const resetFilters = () => {
    const defaultFilters = {
      searchType: 'all',
      query: '',
      isRemanufactured: false,
      isCloseout: false,
      isOnSale: false,
      hasRebate: false,
      hasFreeShipping: false,
      inventoryStatus: 'all' as const,
    };
    setActiveFilters(defaultFilters);
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
            {Object.values(activeFilters).some(v => v) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            )}
            <Button variant="outline" size="sm">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Applied filters summary */}
        {Object.values(activeFilters).some(v => v) && (
          <div className="mt-4 bg-neutral-50 p-3 rounded-md">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium">Active Filters:</span>
              {activeFilters.query && (
                <Badge variant="secondary" className="gap-1">
                  {activeFilters.searchType !== 'all' ? `${activeFilters.searchType}: ` : ''}
                  {activeFilters.query}
                  <button onClick={() => {
                    const newFilters = {...activeFilters, query: ''};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.isRemanufactured && (
                <Badge variant="secondary" className="gap-1">
                  Remanufactured
                  <button onClick={() => {
                    const newFilters = {...activeFilters, isRemanufactured: false};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.isCloseout && (
                <Badge variant="secondary" className="gap-1">
                  Closeout
                  <button onClick={() => {
                    const newFilters = {...activeFilters, isCloseout: false};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.isOnSale && (
                <Badge variant="secondary" className="gap-1">
                  On Sale
                  <button onClick={() => {
                    const newFilters = {...activeFilters, isOnSale: false};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.hasRebate && (
                <Badge variant="secondary" className="gap-1">
                  Rebate
                  <button onClick={() => {
                    const newFilters = {...activeFilters, hasRebate: false};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.hasFreeShipping && (
                <Badge variant="secondary" className="gap-1">
                  Free Shipping
                  <button onClick={() => {
                    const newFilters = {...activeFilters, hasFreeShipping: false};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeFilters.inventoryStatus && activeFilters.inventoryStatus !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {activeFilters.inventoryStatus === 'inStock' ? 'In Stock' : 
                   activeFilters.inventoryStatus === 'lowStock' ? 'Low Stock' : 'Out of Stock'}
                  <button onClick={() => {
                    const newFilters = {...activeFilters, inventoryStatus: 'all'};
                    setActiveFilters(newFilters);
                  }} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">SKU</TableHead>
                  <TableHead className="w-[120px]">MFG Part #</TableHead>
                  <TableHead className="w-[120px]">UPC</TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Product Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Category</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-neutral-500">
                      {searchQuery || Object.values(activeFilters).some(v => v) 
                        ? "No products matching your search criteria" 
                        : "No products available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-mono text-sm">{product.manufacturerPartNumber || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{product.upc || "-"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        {getSpecialFlagComponents(product)}
                      </TableCell>
                      <TableCell>{product.manufacturerName || "-"}</TableCell>
                      <TableCell>
                        {product.categoryId === 1 ? "Electronics" : 
                         product.categoryId === 2 ? "Office Supplies" : 
                         product.categoryId === 3 ? "Furniture" : "Uncategorized"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === "active" ? "success" : "secondary"}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Package2 className="mr-2 h-4 w-4" />
                              View Details
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
      </div>

      {/* Advanced Search Dialog */}
      <Dialog open={isAdvancedSearchOpen} onOpenChange={setIsAdvancedSearchOpen}>
        <DialogContent className="sm:max-w-md md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Advanced Search</DialogTitle>
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
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Fields</SelectItem>
                              <SelectItem value="sku">SKU</SelectItem>
                              <SelectItem value="mfgPart">Manufacturer Part #</SelectItem>
                              <SelectItem value="upc">UPC Code</SelectItem>
                              <SelectItem value="title">Title</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="category">Category</SelectItem>
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
                            <Input placeholder="Enter search term" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="attributes" className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
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
                                <FormLabel className="flex items-center gap-1">
                                  <Gauge className="h-4 w-4" />
                                  Remanufactured
                                </FormLabel>
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
                                <FormLabel className="flex items-center gap-1">
                                  <Tag className="h-4 w-4" />
                                  Closeout
                                </FormLabel>
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
                                <FormLabel className="flex items-center gap-1">
                                  <ShoppingBag className="h-4 w-4" />
                                  On Sale
                                </FormLabel>
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
                                <FormLabel className="flex items-center gap-1">
                                  <BadgePercent className="h-4 w-4" />
                                  Rebate
                                </FormLabel>
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
                                <FormLabel className="flex items-center gap-1">
                                  <Truck className="h-4 w-4" />
                                  Free Shipping
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="inventory" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="inventoryStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inventory Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select inventory status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Inventory Statuses</SelectItem>
                            <SelectItem value="inStock">In Stock</SelectItem>
                            <SelectItem value="lowStock">Low Stock</SelectItem>
                            <SelectItem value="outOfStock">Out of Stock</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsAdvancedSearchOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Reset
                </Button>
                <Button type="submit">
                  Apply Filters
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Products;
