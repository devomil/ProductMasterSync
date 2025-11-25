import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, 
  FileSpreadsheet, 
  Search, 
  Package, 
  DollarSign, 
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Filter,
  LayoutGrid,
  List,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { SiAmazon, SiWalmart } from 'react-icons/si';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CatalogProduct {
  id: number;
  sku: string;
  name: string;
  upc: string | null;
  cost: number | null;
  shippingCost: number | null;
  
  // Amazon data
  asin: string | null;
  amazonPrice: number | null;
  amazonReferralFee: number | null;
  amazonFbaFee: number | null;
  amazonSalesRank: number | null;
  amazonRestricted: boolean;
  amazonCanList: boolean | null;
  
  // Walmart data
  walmartItemId: string | null;
  walmartPrice: number | null;
  walmartReferralFee: number | null;
  walmartContractCategory: string | null;
  walmartProductType: string | null;
  walmartInStock: boolean;
  
  // Calculated fields
  amazonMargin: number | null;
  walmartMargin: number | null;
  recommendation: string;
  listingStatus: 'ready' | 'needs_approval' | 'restricted' | 'no_mapping';
}

function SortableHeader({ 
  column, 
  currentColumn, 
  direction, 
  onClick, 
  children, 
  className = '' 
}: { 
  column: string; 
  currentColumn: string; 
  direction: 'asc' | 'desc'; 
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = currentColumn === column;
  return (
    <TableHead className={className}>
      <button
        onClick={onClick}
        className="flex items-center space-x-1 hover:text-blue-600 transition-colors font-medium"
        data-testid={`sort-${column}`}
      >
        <span>{children}</span>
        {isActive ? (
          direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

export default function MarketplaceCatalog() {
  const { toast } = useToast();
  const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'amazon' | 'walmart'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('all');
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const productsPerPage = 50;

  // Fetch catalog data with marketplace info
  const { data: catalogData, isLoading, refetch } = useQuery<{
    products: CatalogProduct[];
    total: number;
    stats: {
      totalProducts: number;
      amazonMapped: number;
      walmartMapped: number;
      readyToList: number;
      needsApproval: number;
      restricted: number;
    };
  }>({
    queryKey: ['/api/marketplace/catalog', { marketplace: selectedMarketplace }],
  });

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!catalogData?.products) return [];
    
    let filtered = catalogData.products;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.upc?.toLowerCase().includes(query) ||
        p.asin?.toLowerCase().includes(query) ||
        p.walmartItemId?.toLowerCase().includes(query)
      );
    }
    
    // Marketplace filter
    if (selectedMarketplace === 'amazon') {
      filtered = filtered.filter(p => p.asin);
    } else if (selectedMarketplace === 'walmart') {
      filtered = filtered.filter(p => p.walmartItemId);
    }
    
    // Listing status filter
    if (listingStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.listingStatus === listingStatusFilter);
    }
    
    // Recommendation filter
    if (recommendationFilter !== 'all') {
      filtered = filtered.filter(p => p.recommendation === recommendationFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortColumn) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'cost':
          aVal = a.cost || 0;
          bVal = b.cost || 0;
          break;
        case 'amazonPrice':
          aVal = a.amazonPrice || 0;
          bVal = b.amazonPrice || 0;
          break;
        case 'walmartPrice':
          aVal = a.walmartPrice || 0;
          bVal = b.walmartPrice || 0;
          break;
        case 'amazonMargin':
          aVal = a.amazonMargin || -999;
          bVal = b.amazonMargin || -999;
          break;
        case 'walmartMargin':
          aVal = a.walmartMargin || -999;
          bVal = b.walmartMargin || -999;
          break;
        case 'amazonSalesRank':
          aVal = a.amazonSalesRank || 999999999;
          bVal = b.amazonSalesRank || 999999999;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [catalogData?.products, searchQuery, selectedMarketplace, listingStatusFilter, recommendationFilter, sortColumn, sortDirection]);

  // Paginate
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Export to CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const dataToExport = selectedProducts.size > 0 
        ? filteredProducts.filter(p => selectedProducts.has(p.id))
        : filteredProducts;
      
      const headers = [
        'SKU',
        'Product Name',
        'UPC',
        'Cost',
        'Shipping Cost',
        'ASIN',
        'Amazon Price',
        'Amazon Referral Fee',
        'Amazon FBA Fee',
        'Amazon Margin %',
        'Amazon Sales Rank',
        'Amazon Status',
        'Walmart Item ID',
        'Walmart Product Type',
        'Walmart Price',
        'Walmart Referral Fee',
        'Walmart Contract Category',
        'Walmart Margin %',
        'Walmart Status',
        'Recommendation',
        'Listing Status'
      ];
      
      const rows = dataToExport.map(p => [
        p.sku || '',
        p.name || '',
        p.upc || '',
        p.cost ? (p.cost / 100).toFixed(2) : '',
        p.shippingCost ? (p.shippingCost / 100).toFixed(2) : '',
        p.asin || '',
        p.amazonPrice ? (p.amazonPrice / 100).toFixed(2) : '',
        p.amazonReferralFee ? (p.amazonReferralFee / 100).toFixed(2) : '',
        p.amazonFbaFee ? (p.amazonFbaFee / 100).toFixed(2) : '',
        p.amazonMargin ? p.amazonMargin.toFixed(1) : '',
        p.amazonSalesRank || '',
        p.amazonCanList === true ? 'Approved' : p.amazonRestricted ? 'Restricted' : 'Unknown',
        p.walmartItemId || '',
        p.walmartProductType || '',
        p.walmartPrice ? (p.walmartPrice / 100).toFixed(2) : '',
        p.walmartReferralFee ? (p.walmartReferralFee / 100).toFixed(2) : '',
        p.walmartContractCategory || '',
        p.walmartMargin ? p.walmartMargin.toFixed(1) : '',
        p.walmartInStock ? 'In Stock' : 'Out of Stock',
        p.recommendation || '',
        p.listingStatus || ''
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marketplace-catalog-${selectedMarketplace}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export Complete',
        description: `Exported ${dataToExport.length} products to CSV`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export catalog data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle product selection
  const toggleProductSelection = (productId: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Select all visible products
  const toggleSelectAll = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const getListingStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
      case 'needs_approval':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Needs Approval</Badge>;
      case 'restricted':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Restricted</Badge>;
      default:
        return <Badge variant="outline">No Mapping</Badge>;
    }
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'warehouse':
        return <Badge className="bg-purple-100 text-purple-800">Warehouse</Badge>;
      case 'dropship':
        return <Badge className="bg-blue-100 text-blue-800">Dropship</Badge>;
      case 'no_opportunity':
        return <Badge variant="outline" className="text-gray-500">No Opportunity</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const stats = catalogData?.stats || {
    totalProducts: 0,
    amazonMapped: 0,
    walmartMapped: 0,
    readyToList: 0,
    needsApproval: 0,
    restricted: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketplace Catalog</h1>
              <p className="text-gray-600">Unified view of products across all marketplaces with fees and margins</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              data-testid="button-refresh-catalog"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleExportCSV}
              disabled={isExporting || filteredProducts.length === 0}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-export-csv"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV {selectedProducts.size > 0 && `(${selectedProducts.size})`}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Package className="h-5 w-5 text-gray-400" />
              <span className="text-2xl font-bold">{stats.totalProducts.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <SiAmazon className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{stats.amazonMapped.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Amazon Mapped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <SiWalmart className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{stats.walmartMapped.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Walmart Mapped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{stats.readyToList.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ready to List</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600">{stats.needsApproval.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Needs Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">{stats.restricted.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Restricted</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, SKU, UPC, ASIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-catalog"
                />
              </div>
            </div>
            
            <Select value={selectedMarketplace} onValueChange={(v: 'all' | 'amazon' | 'walmart') => setSelectedMarketplace(v)}>
              <SelectTrigger className="w-[160px]" data-testid="select-marketplace">
                <SelectValue placeholder="Marketplace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Marketplaces</SelectItem>
                <SelectItem value="amazon">Amazon Only</SelectItem>
                <SelectItem value="walmart">Walmart Only</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={listingStatusFilter} onValueChange={setListingStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-listing-status">
                <SelectValue placeholder="Listing Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ready">Ready to List</SelectItem>
                <SelectItem value="needs_approval">Needs Approval</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
                <SelectItem value="no_mapping">No Mapping</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={recommendationFilter} onValueChange={setRecommendationFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-recommendation">
                <SelectValue placeholder="Recommendation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recommendations</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="dropship">Dropship</SelectItem>
                <SelectItem value="no_opportunity">No Opportunity</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="text-sm text-gray-500">
              {filteredProducts.length.toLocaleString()} products
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading catalog data...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[40px]">
                        <Checkbox 
                          checked={selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <SortableHeader column="name" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('name')}>
                        Product
                      </SortableHeader>
                      <TableHead>UPC</TableHead>
                      <SortableHeader column="cost" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('cost')} className="text-right">
                        Cost
                      </SortableHeader>
                      <TableHead className="text-right">Shipping</TableHead>
                      
                      {/* Amazon Columns */}
                      {(selectedMarketplace === 'all' || selectedMarketplace === 'amazon') && (
                        <>
                          <TableHead className="bg-orange-50">ASIN</TableHead>
                          <SortableHeader column="amazonPrice" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('amazonPrice')} className="text-right bg-orange-50">
                            Amazon Price
                          </SortableHeader>
                          <TableHead className="text-right bg-orange-50">Amz Fee</TableHead>
                          <SortableHeader column="amazonMargin" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('amazonMargin')} className="text-right bg-orange-50">
                            Amz Margin
                          </SortableHeader>
                          <SortableHeader column="amazonSalesRank" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('amazonSalesRank')} className="text-right bg-orange-50">
                            Rank
                          </SortableHeader>
                        </>
                      )}
                      
                      {/* Walmart Columns */}
                      {(selectedMarketplace === 'all' || selectedMarketplace === 'walmart') && (
                        <>
                          <TableHead className="bg-blue-50">Walmart ID</TableHead>
                          <TableHead className="bg-blue-50">Product Type</TableHead>
                          <SortableHeader column="walmartPrice" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('walmartPrice')} className="text-right bg-blue-50">
                            Walmart Price
                          </SortableHeader>
                          <TableHead className="text-right bg-blue-50">WM Fee</TableHead>
                          <SortableHeader column="walmartMargin" currentColumn={sortColumn} direction={sortDirection} onClick={() => handleSort('walmartMargin')} className="text-right bg-blue-50">
                            WM Margin
                          </SortableHeader>
                        </>
                      )}
                      
                      <TableHead>Recommendation</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={16} className="text-center py-12 text-gray-500">
                          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No products found matching your criteria</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProducts.map((product) => (
                        <TableRow key={product.id} className="hover:bg-gray-50" data-testid={`row-product-${product.id}`}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedProducts.has(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <Link href={`/products/${product.id}`}>
                                <span className="text-blue-600 hover:underline font-medium line-clamp-2 cursor-pointer">
                                  {product.name}
                                </span>
                              </Link>
                              <div className="text-xs text-gray-500">{product.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{product.upc || '—'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {product.cost ? `$${(product.cost / 100).toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {product.shippingCost ? `$${(product.shippingCost / 100).toFixed(2)}` : '—'}
                          </TableCell>
                          
                          {/* Amazon Data */}
                          {(selectedMarketplace === 'all' || selectedMarketplace === 'amazon') && (
                            <>
                              <TableCell className="bg-orange-50/50 font-mono text-xs">
                                {product.asin ? (
                                  <a 
                                    href={`https://amazon.com/dp/${product.asin}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:underline flex items-center gap-1"
                                  >
                                    {product.asin}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-orange-50/50 font-medium">
                                {product.amazonPrice ? `$${(product.amazonPrice / 100).toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-orange-50/50 text-orange-700 text-sm">
                                {product.amazonReferralFee ? `$${(product.amazonReferralFee / 100).toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-orange-50/50">
                                {product.amazonMargin !== null ? (
                                  <span className={product.amazonMargin >= 25 ? 'text-green-600 font-bold' : product.amazonMargin >= 12 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                                    {product.amazonMargin.toFixed(1)}%
                                  </span>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-orange-50/50 text-sm">
                                {product.amazonSalesRank ? product.amazonSalesRank.toLocaleString() : '—'}
                              </TableCell>
                            </>
                          )}
                          
                          {/* Walmart Data */}
                          {(selectedMarketplace === 'all' || selectedMarketplace === 'walmart') && (
                            <>
                              <TableCell className="bg-blue-50/50 font-mono text-xs">
                                {product.walmartItemId ? (
                                  <a 
                                    href={`https://walmart.com/ip/${product.walmartItemId}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    {product.walmartItemId}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="bg-blue-50/50 text-xs max-w-[150px]">
                                <span className="line-clamp-2" title={product.walmartProductType || ''}>
                                  {product.walmartProductType || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right bg-blue-50/50 font-medium">
                                {product.walmartPrice ? `$${(product.walmartPrice / 100).toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-blue-50/50 text-blue-700 text-sm">
                                {product.walmartReferralFee ? `$${(product.walmartReferralFee / 100).toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-blue-50/50">
                                {product.walmartMargin !== null ? (
                                  <span className={product.walmartMargin >= 25 ? 'text-green-600 font-bold' : product.walmartMargin >= 12 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                                    {product.walmartMargin.toFixed(1)}%
                                  </span>
                                ) : '—'}
                              </TableCell>
                            </>
                          )}
                          
                          <TableCell>{getRecommendationBadge(product.recommendation)}</TableCell>
                          <TableCell>{getListingStatusBadge(product.listingStatus)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * productsPerPage) + 1} to {Math.min(currentPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
