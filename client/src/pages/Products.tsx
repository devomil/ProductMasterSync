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
  useProductSearch,
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
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schema for advanced search
const advancedSearchSchema = z.object({
  searchType: z.enum(['all', 'sku', 'mfgPart', 'upc', 'title', 'description', 'category', 'manufacturer']),
  query: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  manufacturer: z.string().optional(),
  inventoryStatus: z.enum(['all', 'inStock', 'lowStock', 'outOfStock']),
  isRemanufactured: z.boolean().optional(),
  isCloseout: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  hasRebate: z.boolean().optional(),
  hasFreeShipping: z.boolean().optional(),
});

// Define action types for filter state reducer
type FilterAction = 
  | { type: 'SET_FILTER'; field: string; value: any }
  | { type: 'RESET_FILTERS' }
  | { type: 'APPLY_FILTERS'; filters: any };

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
  
  // Filter state using reducer
  const [filters, dispatchFilters] = useReducer(filterReducer, {
    searchType: 'all' as SearchType,
    query: '',
    category: '',
    supplier: '',
    manufacturer: '',
    inventoryStatus: 'all' as InventoryStatusType,
    isRemanufactured: false,
    isCloseout: false,
    isOnSale: false,
    hasRebate: false,
    hasFreeShipping: false,
  });

  // Convert filters to ProductSearchFilters format
  const searchFilters: ProductSearchFilters = {
    searchType: (filters.searchType || 'all') as SearchType,
    query: filters.query || searchQuery,
    category: filters.category || '',
    supplier: filters.supplier || '',
    manufacturer: filters.manufacturer || '',
    isRemanufactured: filters.isRemanufactured || false,
    isCloseout: filters.isCloseout || false,
    isOnSale: filters.isOnSale || false,
    hasRebate: filters.hasRebate || false,
    hasFreeShipping: filters.hasFreeShipping || false,
    inventoryStatus: filters.inventoryStatus || 'all',
    page: currentPage,
    limit: itemsPerPage,
    sortBy: 'sku',
    sortDir: 'asc'
  };

  // Get products data using filtered search API (performance optimized)
  const { products, pagination, isLoading } = useProductSearch(searchFilters);
  
  // Get categories data
  const { categories, isLoading: categoriesLoading } = useCategories();

  // Define column display names
  const columnDisplayNames: Record<string, string> = {
    sku: 'EDC',
    usin: 'USIN',
    upc: 'UPC',
    cost: 'Cost',
    price: 'Price',
    category: 'Category',
    name: 'Product Name',
    description: 'Description',
    supplier_name: 'Supplier',
    manufacturer_part_number: 'MPN'
  };

  // Helper function to get product field value
  const getProductValue = (product: any, field: string): string => {
    const fieldMap: Record<string, string> = {
      sku: removeEdcPrefix(product.sku),
      usin: product.usin || '-',
      upc: product.upc || '-',
      cost: product.cost ? `$${parseFloat(product.cost).toFixed(2)}` : '-',
      price: product.price ? `$${parseFloat(product.price).toFixed(2)}` : '-',
      category: product.category_name || '-',
      name: product.name || '-',
      description: cleanHtmlTags(product.description || '') || '-',
      supplier_name: product.supplier_name || '-',
      manufacturer_part_number: product.manufacturer_part_number || '-'
    };
    
    return fieldMap[field] || product[field] || '-';
  };

  // Reset filters function
  const resetFilters = () => {
    dispatchFilters({ type: 'RESET_FILTERS' });
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Handle basic search
  const handleBasicSearch = (value: string) => {
    setSearchQuery(value);
    dispatchFilters({
      type: 'SET_FILTER',
      field: 'query',
      value: value
    });
    setCurrentPage(1);
  };

  // Form for advanced search
  const form = useForm({
    resolver: zodResolver(advancedSearchSchema),
    defaultValues: {
      searchType: 'all' as const,
      query: '',
      category: '',
      supplier: '',
      manufacturer: '',
      inventoryStatus: 'all' as const,
      isRemanufactured: false,
      isCloseout: false,
      isOnSale: false,
      hasRebate: false,
      hasFreeShipping: false,
    }
  });

  // Handle advanced search form submission
  const onSubmitAdvancedSearch = (data: any) => {
    dispatchFilters({
      type: 'APPLY_FILTERS',
      filters: {
        searchType: data.searchType,
        query: data.query || '',
        category: data.category || '',
        supplier: data.supplier || '',
        manufacturer: data.manufacturer || '',
        inventoryStatus: data.inventoryStatus,
        isRemanufactured: data.isRemanufactured || false,
        isCloseout: data.isCloseout || false,
        isOnSale: data.isOnSale || false,
        hasRebate: data.hasRebate || false,
        hasFreeShipping: data.hasFreeShipping || false,
      }
    });
    setCurrentPage(1);
    setIsAdvancedSearchOpen(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-muted-foreground">
            Manage your product inventory and catalog data with server-side filtering for optimal performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by SKU, name, UPC, or description..."
              value={searchQuery}
              onChange={(e) => handleBasicSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* View Mode Controls */}
          <div className="flex items-center border rounded-md">
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
          
          <Dialog open={isAdvancedSearchOpen} onOpenChange={setIsAdvancedSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Advanced Search
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Advanced Product Search</DialogTitle>
                <DialogDescription>
                  Use multiple filters to find specific products in your catalog
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitAdvancedSearch)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Search Type */}
                    <FormField
                      control={form.control}
                      name="searchType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select search type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Fields</SelectItem>
                              <SelectItem value="sku">EDC SKU</SelectItem>
                              <SelectItem value="mfgPart">Manufacturer Part</SelectItem>
                              <SelectItem value="upc">UPC</SelectItem>
                              <SelectItem value="title">Product Name</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="category">Category</SelectItem>
                              <SelectItem value="manufacturer">Manufacturer</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    {/* Search Query */}
                    <FormField
                      control={form.control}
                      name="query"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Query</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter search terms..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Category Filter */}
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input placeholder="Filter by category..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Supplier Filter */}
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <FormControl>
                            <Input placeholder="Filter by supplier..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Manufacturer Filter */}
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="Filter by manufacturer..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Inventory Status */}
                    <FormField
                      control={form.control}
                      name="inventoryStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inventory Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select inventory status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Products</SelectItem>
                              <SelectItem value="inStock">In Stock</SelectItem>
                              <SelectItem value="lowStock">Low Stock</SelectItem>
                              <SelectItem value="outOfStock">Out of Stock</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Boolean Filters */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Product Attributes</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="isRemanufactured"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Remanufactured</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isCloseout"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Closeout</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isOnSale"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>On Sale</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hasRebate"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Has Rebate</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hasFreeShipping"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Free Shipping</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      form.reset();
                      resetFilters();
                    }}>
                      Reset Filters
                    </Button>
                    <Button type="submit">
                      Apply Filters
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {isLoading ? 'Loading...' : `Showing ${products.length} of ${pagination.totalItems} products`}
        </div>
        <div>
          Performance optimized: Server-side filtering and pagination active
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">EDC</TableHead>
                  <TableHead className="w-[100px]">UPC</TableHead>
                  <TableHead className="w-[300px]">Product Name</TableHead>
                  <TableHead className="w-[150px]">Category</TableHead>
                  <TableHead className="w-[80px]">Cost</TableHead>
                  <TableHead className="w-[80px]">Price</TableHead>
                  <TableHead className="w-[120px]">Supplier</TableHead>
                  <TableHead className="w-[100px]">Inventory</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading products...
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No products found. Try adjusting your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {removeEdcPrefix(product.sku)}
                      </TableCell>
                      <TableCell>{product.upc || '-'}</TableCell>
                      <TableCell>
                        <div className="max-w-[300px] truncate" title={product.name}>
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell>{product.category_name || '-'}</TableCell>
                      <TableCell>
                        {product.cost ? `$${parseFloat(product.cost).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {product.price ? `$${parseFloat(product.price).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>{product.supplier_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={product.inventory_quantity > 0 ? "default" : "secondary"}>
                          {product.inventory_quantity || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Warehouse className="mr-2 h-4 w-4" />
                              Warehouse Details
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
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;