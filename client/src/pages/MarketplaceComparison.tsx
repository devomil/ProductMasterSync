import { useQuery } from '@tanstack/react-query';
import { useState } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, TrendingUp, DollarSign, ExternalLink, ShoppingCart } from 'lucide-react';
import { SiAmazon, SiWalmart } from 'react-icons/si';

export default function MarketplaceComparison() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/marketplace/cross-marketplace-comparison'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const products = data?.products || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Cross-Marketplace Product Analysis
          </h1>
          <p className="text-muted-foreground mt-2">
            Compare your products across Amazon and Walmart marketplaces
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {total} Products
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <SiAmazon className="h-4 w-4" />
              Amazon Mapped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter((p: any) => p.amazon_mapping_count > 0).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <SiWalmart className="h-4 w-4" />
              Walmart Mapped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter((p: any) => p.walmart_mapping_count > 0).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Both Marketplaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter((p: any) => p.amazon_mapping_count > 0 && p.walmart_mapping_count > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Marketplace Data</CardTitle>
          <CardDescription>
            View and compare marketplace availability and pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Product</TableHead>
                  <TableHead>UPC</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <SiAmazon className="h-4 w-4" />
                      Amazon
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <SiWalmart className="h-4 w-4" />
                      Walmart
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product: any) => (
                  <TableRow key={product.product_id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{product.product_name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{product.upc}</TableCell>
                    <TableCell>
                      <AmazonData product={product} />
                    </TableCell>
                    <TableCell>
                      <WalmartData product={product} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {products.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products with UPC codes found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AmazonData({ product }: { product: any }) {
  const amazonData = product.amazon_data;
  const status = product.amazon_status;

  if (!amazonData || amazonData.length === 0) {
    return (
      <div className="text-center py-2">
        {status === 'not_found' && (
          <Badge variant="secondary" className="text-xs">Not Found</Badge>
        )}
        {status === 'error' && (
          <Badge variant="destructive" className="text-xs">Error</Badge>
        )}
        {!status && (
          <Badge variant="outline" className="text-xs">Not Checked</Badge>
        )}
      </div>
    );
  }

  const item = amazonData[0];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-amazon text-xs">
          {amazonData.length} ASIN{amazonData.length > 1 ? 's' : ''}
        </Badge>
        {item.opportunityScore && (
          <Badge variant="outline" className="text-xs">
            Score: {item.opportunityScore}
          </Badge>
        )}
      </div>
      <div className="text-xs font-mono text-muted-foreground">
        ASIN: {item.asin}
      </div>
      {item.title && <div className="text-sm font-medium line-clamp-1">{item.title}</div>}
      {item.brand && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{item.brand}</span>
        </div>
      )}
      {item.price && (
        <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
          <DollarSign className="h-3 w-3" />
          {(item.price / 100).toFixed(2)}
        </div>
      )}
      {item.listPrice && (
        <div className="text-xs text-muted-foreground line-through">
          List: ${(item.listPrice / 100).toFixed(2)}
        </div>
      )}
      {item.inStock !== null && (
        <div className="text-xs">
          {item.inStock ? (
            <Badge variant="default" className="text-xs bg-green-600">In Stock</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function WalmartData({ product }: { product: any }) {
  const walmartData = product.walmart_data;
  const status = product.walmart_status;

  if (!walmartData || walmartData.length === 0) {
    return (
      <div className="text-center py-2">
        {status === 'not_found' && (
          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">Not Found</Badge>
            {product.walmart_next_check && (
              <div className="text-xs text-muted-foreground">
                Recheck: {new Date(product.walmart_next_check).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
        {status === 'error' && (
          <Badge variant="destructive" className="text-xs">Error</Badge>
        )}
        {!status && (
          <Badge variant="outline" className="text-xs">Not Checked</Badge>
        )}
      </div>
    );
  }

  const item = walmartData[0];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-walmart text-xs">
          {walmartData.length} Item{walmartData.length > 1 ? 's' : ''}
        </Badge>
      </div>
      <div className="text-xs font-mono text-muted-foreground">
        ID: {item.itemId}
      </div>
      {item.title && <div className="text-sm font-medium line-clamp-1">{item.title}</div>}
      {item.brand && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{item.brand}</span>
        </div>
      )}
      {item.price && (
        <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
          <DollarSign className="h-3 w-3" />
          {parseFloat(item.price).toFixed(2)}
        </div>
      )}
      {item.listPrice && (
        <div className="text-xs text-muted-foreground line-through">
          List: ${parseFloat(item.listPrice).toFixed(2)}
        </div>
      )}
      {item.shippingCost && parseFloat(item.shippingCost) > 0 && (
        <div className="text-xs text-orange-600">
          +${parseFloat(item.shippingCost).toFixed(2)} shipping
        </div>
      )}
      {item.avgRating && (
        <div className="text-xs text-muted-foreground">
          ⭐ {parseFloat(item.avgRating).toFixed(1)} ({item.numReviews} reviews)
        </div>
      )}
      {item.inStock !== null && (
        <div className="text-xs">
          {item.inStock ? (
            <Badge variant="default" className="text-xs bg-green-600">In Stock</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
          )}
        </div>
      )}
    </div>
  );
}
