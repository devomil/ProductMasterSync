import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Package2, 
  Plus, 
  Search, 
  RefreshCcw,
  MoreHorizontal,
  Edit,
  Trash2,
  Download,
  Upload,
  X,
  Tag,
  Barcode,
  AlignLeft,
  LayoutGrid,
  Factory,
  Truck,
  BadgePercent,
  ShoppingBag,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Sparkles,
  Loader2,
} from "lucide-react";
import { 
  useProductSearch, 
  useManufacturers,
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
import { useSuppliers } from "@/hooks/useSuppliers";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FulfillmentDrawer } from "@/components/products/FulfillmentDrawer";
// import { AmazonMarketData } from "@/components/products/AmazonMarketData";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [jumpToPageInput, setJumpToPageInput] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // State for view options
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  
  // State for product drawers
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string, upc: string | null} | null>(null);
  const [fulfillmentDrawerOpen, setFulfillmentDrawerOpen] = useState(false);
  const [amazonDataDrawerOpen, setAmazonDataDrawerOpen] = useState(false);
  
  const { toast } = useToast();
  const [enrichmentStatus, setEnrichmentStatus] = useState<string | null>(null);

  const enrichMutation = useMutation({
    mutationFn: async (action: string) => {
      setEnrichmentStatus(`Running ${action}...`);
      const res = await apiRequest('POST', `/api/catalog/${action}`);
      return res.json();
    },
    onSuccess: (data, action) => {
      setEnrichmentStatus(null);
      queryClient.invalidateQueries({ queryKey: ['/api/products/search'] });
      if (action === 'migrate-walmart-ids') {
        toast({ title: "Walmart IDs Migrated", description: `${data.totalMigrated || 0} products linked to Walmart listings` });
      } else if (action === 'enrich-descriptions') {
        toast({ title: "Descriptions Enriched", description: `${data.enriched || 0} products updated with better descriptions` });
      } else if (action === 'auto-categorize') {
        toast({ title: "Categories Assigned", description: `${data.categorized || 0} products categorized into ${data.categoriesCreated || 0} categories. ${data.totalRemaining || 0} remaining.` });
      } else if (action === 'discover-asins') {
        toast({ title: "ASINs Discovered", description: `${data.discovered || 0} Amazon ASINs found from ${data.processed || 0} products. ${data.remaining || 0} remaining.` });
      }
    },
    onError: () => {
      setEnrichmentStatus(null);
      toast({ title: "Enrichment Failed", description: "An error occurred. Check logs for details.", variant: "destructive" });
    },
  });

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

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  }, []);

  const searchFilters: ProductSearchFilters = {
    searchType: filters.searchType || 'all',
    query: debouncedSearch || filters.query || undefined,
    category: filters.category || undefined,
    status: filters.status || undefined,
    supplier: filters.supplier || undefined,
    manufacturer: filters.manufacturer || undefined,
    isRemanufactured: filters.isRemanufactured || false,
    isCloseout: filters.isCloseout || false,
    isOnSale: filters.isOnSale || false,
    hasRebate: filters.hasRebate || false,
    hasFreeShipping: filters.hasFreeShipping || false,
    priceMin: priceMin || undefined,
    priceMax: priceMax || undefined,
    inventoryStatus: filters.inventoryStatus || 'all',
    page: currentPage,
    limit: itemsPerPage,
  };

  // All filtering is now server-side via /api/products/search
  const { products, pagination, isLoading } = useProductSearch(searchFilters);
  
  const formatApproximateCount = useCallback((count: number): string => {
    if (count > 1000000) return `~${(count / 1000000).toFixed(1)}M`;
    if (count > 10000) return `~${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  }, []);

  const handleJumpToPage = useCallback(() => {
    const page = parseInt(jumpToPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= (pagination?.totalPages || 1)) {
      setCurrentPage(page);
      setJumpToPageInput("");
    }
  }, [jumpToPageInput, pagination?.totalPages]);

  const handlePageSizeChange = useCallback((newSize: string) => {
    setItemsPerPage(parseInt(newSize, 10));
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        setCurrentPage(prev => Math.max(1, prev - 1));
      } else if (e.key === 'ArrowRight' && currentPage < (pagination?.totalPages || 1)) {
        e.preventDefault();
        setCurrentPage(prev => Math.min(pagination?.totalPages || 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pagination?.totalPages]);

  const { categories, isLoading: categoriesLoading } = useCategories();
  const { suppliers } = useSuppliers();
  const { manufacturers: allManufacturers } = useManufacturers();
  
  // Get CWR mapping template to determine dynamic columns
  const cwrTemplate = mappingTemplates?.find(t => t.name === 'CWR');
  
  // Define the desired column order for CWR - EDC first, then USIN, then UPC
  const desiredColumnOrder = ['sku', 'usin', 'upc', 'cost', 'price', 'category', 'weight', 'product_name', 'description', 'brand', 'primary_image', 'mpn'];
  
  // Get dynamic columns in the correct order: EDC (sku), USIN, UPC, then others
  let dynamicColumns = [];
  if (cwrTemplate?.mappings) {
    // Always start with EDC (sku) - this is application-generated
    dynamicColumns = ['sku'];
    
    // Add USIN if it exists in mapping (Supplier Part Number maps to usin)
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
      usin: product.usin || product.supplierPartNumber || '-',  // USIN field from Supplier Part Number
      upc: product.upc || '-',
      cost: product.cost ? `$${parseFloat(product.cost).toFixed(2)}` : '-',
      price: product.price ? `$${parseFloat(product.price).toFixed(2)}` : '-',
      category: product.categoryName || '-',
      weight: product.weight ? `${product.weight} lbs` : '-',
      product_name: product.name || '-',
      description: cleanHtmlTags(product.description || '') || '-',  // Clean HTML tags from description
      brand: product.manufacturerName || '-',
      primary_image: product.imageUrl || product.image_url || product.primaryImageUrl || product.imageUrlLarge || product.primaryImage || '-',
      mpn: product.manufacturerPartNumber || '-'
    };
    
    return fieldMap[field] || product[field] || '-';
  };

  // Check if any meaningful filters are active (for UI display)
  const hasActiveFilters = () => {
    return searchQuery || filters.query || 
           (filters.category && filters.category !== '' && filters.category !== 'all_categories') ||
           (filters.supplier && filters.supplier !== '' && filters.supplier !== 'all_suppliers') ||
           (filters.manufacturer && filters.manufacturer !== '' && filters.manufacturer !== 'all_manufacturers') ||
           (filters.status && filters.status !== '' && filters.status !== 'all_statuses') ||
           (filters.inventoryStatus && filters.inventoryStatus !== 'all') ||
           filters.isRemanufactured || filters.isCloseout || filters.isOnSale || 
           filters.hasRebate || filters.hasFreeShipping ||
           priceMin || priceMax;
  };

  const activeFilterCount = [
    searchQuery || filters.query,
    filters.category && filters.category !== '' && filters.category !== 'all_categories',
    filters.supplier && filters.supplier !== '' && filters.supplier !== 'all_suppliers',
    filters.manufacturer && filters.manufacturer !== '' && filters.manufacturer !== 'all_manufacturers',
    filters.status && filters.status !== '' && filters.status !== 'all_statuses',
    filters.inventoryStatus && filters.inventoryStatus !== 'all',
    filters.isRemanufactured, filters.isCloseout, filters.isOnSale,
    filters.hasRebate, filters.hasFreeShipping,
    priceMin, priceMax,
  ].filter(Boolean).length;

  const resetFilters = () => {
    dispatchFilters({ type: 'RESET_FILTERS' });
    setSearchQuery("");
    setDebouncedSearch("");
    setPriceMin("");
    setPriceMax("");
    setCurrentPage(1);
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

          {/* Search bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 sm:max-w-lg">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="search" 
                  placeholder="Search products... (e.g. HP thin client i5 WiFi)"
                  className="pl-9" 
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center space-x-1 border rounded-md p-1">
                  <Button variant={viewMode === 'compact' ? "default" : "ghost"} size="sm" onClick={() => setViewMode('compact')} className="h-7 px-2" title="Compact View">
                    <LayoutGrid className="h-3 w-3" />
                  </Button>
                  <Button variant={viewMode === 'comfortable' ? "default" : "ghost"} size="sm" onClick={() => setViewMode('comfortable')} className="h-7 px-2" title="Comfortable View">
                    <AlignLeft className="h-3 w-3" />
                  </Button>
                  <Button variant={viewMode === 'spacious' ? "default" : "ghost"} size="sm" onClick={() => setViewMode('spacious')} className="h-7 px-2" title="Spacious View">
                    <Package2 className="h-3 w-3" />
                  </Button>
                </div>
                {hasActiveFilters() && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Clear All ({activeFilterCount})
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter bar - all filters in one compact row */}
            <div className="flex flex-wrap items-center gap-2">
              <Select 
                value={filters.supplier || "all_suppliers"} 
                onValueChange={(value) => {
                  dispatchFilters({ type: 'SET_FILTER', field: 'supplier', value });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Truck className="mr-1 h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_suppliers">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.category || "all_categories"} 
                onValueChange={(value) => {
                  dispatchFilters({ type: 'SET_FILTER', field: 'category', value });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
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

              <Select 
                value={filters.status || "all_statuses"} 
                onValueChange={(value) => {
                  dispatchFilters({ type: 'SET_FILTER', field: 'status', value });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.manufacturer || "all_manufacturers"} 
                onValueChange={(value) => {
                  dispatchFilters({ type: 'SET_FILTER', field: 'manufacturer', value });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Factory className="mr-1 h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_manufacturers">All Manufacturers</SelectItem>
                  {allManufacturers.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Price:</span>
                <Input
                  type="number"
                  placeholder="Min"
                  className="w-[80px] h-8 text-xs"
                  value={priceMin}
                  onChange={(e) => { setPriceMin(e.target.value); setCurrentPage(1); }}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  className="w-[80px] h-8 text-xs"
                  value={priceMax}
                  onChange={(e) => { setPriceMax(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <Select 
                value={filters.inventoryStatus || "all"} 
                onValueChange={(value) => {
                  dispatchFilters({ type: 'SET_FILTER', field: 'inventoryStatus', value });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Warehouse className="mr-1 h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="inStock">In Stock</SelectItem>
                  <SelectItem value="lowStock">Low Stock</SelectItem>
                  <SelectItem value="outOfStock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-purple-200 text-purple-700 hover:bg-purple-50" disabled={enrichMutation.isPending}>
                    {enrichMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {enrichmentStatus || 'Data Enrichment'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => enrichMutation.mutate('auto-categorize')}>
                    <Tag className="mr-2 h-4 w-4" />
                    Auto-Categorize Products (AI)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => enrichMutation.mutate('enrich-descriptions')}>
                    <AlignLeft className="mr-2 h-4 w-4" />
                    Enrich Descriptions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => enrichMutation.mutate('discover-asins')}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Discover Amazon ASINs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => enrichMutation.mutate('migrate-walmart-ids')}>
                    <Barcode className="mr-2 h-4 w-4" />
                    Link Walmart IDs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                    <TableHead className="w-[140px] text-sm font-medium whitespace-nowrap px-4 py-3">Walmart ID</TableHead>
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
                  products.map((product, index) => (
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
                      <TableCell className="text-sm">
                        {product.walmartMappings && product.walmartMappings.length > 0 ? (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            {product.walmartMappings[0].walmartItemId}
                          </Badge>
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
          <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-500">
                Showing <span className="font-medium">{pagination ? Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalItems) : 0}</span> to <span className="font-medium">{pagination ? Math.min(pagination.page * pagination.limit, pagination.totalItems) : 0}</span> of <span className="font-medium">{pagination ? formatApproximateCount(pagination.totalItems) : '0'}</span> products
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Per page:</span>
                <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
                {itemsPerPage > 100 && (
                  <span className="text-xs text-amber-600">Larger sizes may load slower</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {pagination && (() => {
                    const totalPages = pagination.totalPages;
                    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push('ellipsis-start');
                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);
                      for (let i = start; i <= end; i++) pages.push(i);
                      if (currentPage < totalPages - 2) pages.push('ellipsis-end');
                      pages.push(totalPages);
                    }
                    return pages.map((page, idx) => {
                      if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    });
                  })()}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(pagination?.totalPages || 1, prev + 1))}
                      className={!pagination || currentPage >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="flex items-center gap-1">
                <span className="text-sm text-neutral-500 whitespace-nowrap">Go to:</span>
                <Input
                  type="number"
                  min={1}
                  max={pagination?.totalPages || 1}
                  value={jumpToPageInput}
                  onChange={(e) => setJumpToPageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJumpToPage(); }}
                  placeholder={`${currentPage}`}
                  className="h-8 w-[70px] text-sm"
                />
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleJumpToPage}>
                  Go
                </Button>
              </div>
              <span className="text-xs text-neutral-400 hidden lg:inline" title="Use left/right arrow keys to navigate pages">
                ← → keys
              </span>
            </div>
          </div>
        </div>
      </div>

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