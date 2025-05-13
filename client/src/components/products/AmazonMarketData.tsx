import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@components/ui/alert";
import { Badge } from "@components/ui/badge";
import { Separator } from "@components/ui/separator";
import { Progress } from "@components/ui/progress";
import { Skeleton } from "@components/ui/skeleton";
import { 
  AlertCircle, 
  ArrowDownUp, 
  ArrowUpDown, 
  Check, 
  Info, 
  RefreshCw, 
  ShoppingCart, 
  Sparkles, 
  TrendingUp 
} from 'lucide-react';
import { useAmazonMarketData, useFetchAmazonDataByUpc } from '@hooks/useAmazonMarketData';
import { AmazonMarketData as AmazonDataType } from '@shared/schema';

interface AmazonMarketDataProps {
  productId: number;
  upc: string | null;
}

export function AmazonMarketData({ productId, upc }: AmazonMarketDataProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { 
    data: amazonData, 
    isLoading, 
    isError, 
    error
  } = useAmazonMarketData(productId);
  
  const fetchMutation = useFetchAmazonDataByUpc(productId);

  // Handle fetch data click
  const handleFetchData = () => {
    if (!upc) {
      return;
    }
    
    fetchMutation.mutate(upc);
  };

  // Helper to format a sales rank
  const formatSalesRank = (rank: number | null) => {
    if (!rank) return 'Unknown';
    
    if (rank < 1000) return rank.toString();
    if (rank < 1000000) return `${(rank / 1000).toFixed(1)}K`;
    return `${(rank / 1000000).toFixed(1)}M`;
  };

  // Helper to get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Render error state
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
            Amazon Marketplace Intelligence
          </CardTitle>
          <CardDescription>
            Failed to load marketplace data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {(error as Error)?.message || 'An error occurred while fetching Amazon marketplace data'}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => handleFetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Skeleton className="h-5 w-5 rounded-full mr-2" />
            <Skeleton className="h-6 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }

  // Check if we need to fetch data
  const noData = !amazonData || amazonData.length === 0;
  if (noData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5 text-blue-500" />
            Amazon Marketplace Intelligence
          </CardTitle>
          <CardDescription>
            No Amazon marketplace data is available for this product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Missing Marketplace Data</AlertTitle>
            <AlertDescription>
              {upc ? 
                'This product has a UPC code but no Amazon marketplace data has been fetched yet.' : 
                'This product does not have a UPC code, which is required to fetch Amazon marketplace data.'}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button 
            disabled={!upc || fetchMutation.isPending} 
            onClick={() => handleFetchData()}
          >
            {fetchMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Fetch Amazon Data
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // We have data, display it
  const marketData = amazonData[0] as AmazonDataType;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
          Amazon Marketplace Intelligence
        </CardTitle>
        <CardDescription>
          ASIN: {marketData.asin} • Last Updated: {new Date(marketData.dataFetchedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pricing">Pricing & Sales</TabsTrigger>
            <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Title:</span>
                <span className="text-sm">{marketData.title}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Category:</span>
                <span className="text-sm">{marketData.category}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Brand:</span>
                <span className="text-sm">{marketData.brand}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Sales Rank:</span>
                <div className="flex items-center">
                  <Badge variant="outline" className="mr-2">
                    {formatSalesRank(marketData.salesRank)}
                  </Badge>
                  {marketData.salesRank && marketData.salesRank < 100000 && (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Variations:</span>
                <Badge variant="outline">
                  {marketData.variationCount || 0}
                </Badge>
              </div>
              
              {marketData.restrictionsFlag && (
                <div className="mt-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Selling Restrictions</AlertTitle>
                    <AlertDescription>
                      This product has selling restrictions on Amazon.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="pricing" className="space-y-4 pt-4">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Estimated Price:</span>
                <span className="text-lg font-bold">
                  {marketData.priceEstimate ? `$${marketData.priceEstimate.toFixed(2)}` : 'Unknown'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Market Competitiveness</span>
                  <span className={getScoreColor(75)}>75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Price Stability</span>
                  <span className={getScoreColor(82)}>82%</span>
                </div>
                <Progress value={82} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sales Potential</span>
                  <span className={getScoreColor(marketData.salesRank ? (100000 - Math.min(marketData.salesRank, 100000)) / 1000 : 50)}>
                    {marketData.salesRank ? Math.round((100000 - Math.min(marketData.salesRank, 100000)) / 1000) : 50}%
                  </span>
                </div>
                <Progress 
                  value={marketData.salesRank ? (100000 - Math.min(marketData.salesRank, 100000)) / 1000 : 50} 
                  className="h-2"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="fulfillment" className="space-y-4 pt-4">
            <div className="flex flex-col space-y-4">
              <div className="font-semibold">Fulfillment Options:</div>
              
              <div className="grid grid-cols-2 gap-2">
                {(marketData.fulfillmentOptions || []).includes('FBA') ? (
                  <div className="border rounded-md p-2 flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <div className="text-sm">
                      <div className="font-semibold">Fulfillment by Amazon</div>
                      <div className="text-xs text-muted-foreground">Prime eligible</div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md p-2 flex items-center opacity-50">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    <div className="text-sm">
                      <div className="font-semibold">Fulfillment by Amazon</div>
                      <div className="text-xs text-muted-foreground">Not available</div>
                    </div>
                  </div>
                )}
                
                {(marketData.fulfillmentOptions || []).includes('FBM') ? (
                  <div className="border rounded-md p-2 flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <div className="text-sm">
                      <div className="font-semibold">Merchant Fulfilled</div>
                      <div className="text-xs text-muted-foreground">Self shipping</div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md p-2 flex items-center opacity-50">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    <div className="text-sm">
                      <div className="font-semibold">Merchant Fulfilled</div>
                      <div className="text-xs text-muted-foreground">Not available</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 mt-2">
                <div className="flex justify-between items-center">
                  <div className="font-semibold flex items-center">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Box Competition
                  </div>
                  <Badge variant="outline" className={marketData.salesRank && marketData.salesRank < 50000 ? "bg-yellow-100" : ""}>
                    {marketData.salesRank && marketData.salesRank < 50000 ? "High" : "Moderate"}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="font-semibold flex items-center">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Price Volatility
                  </div>
                  <Badge variant="outline">
                    {marketData.salesRank && marketData.salesRank < 20000 ? "High" : "Low"}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="font-semibold flex items-center">
                    <ArrowDownUp className="mr-2 h-4 w-4" />
                    Inventory Turnover
                  </div>
                  <Badge variant="outline" className={marketData.salesRank && marketData.salesRank < 30000 ? "bg-green-100" : ""}>
                    {marketData.salesRank && marketData.salesRank < 30000 ? "Fast" : "Moderate"}
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleFetchData()}
          disabled={!upc || fetchMutation.isPending}
        >
          {fetchMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Data
            </>
          )}
        </Button>
        
        {marketData.imageUrl && (
          <a 
            href={`https://www.amazon.com/dp/${marketData.asin}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="ghost">
              View on Amazon
            </Button>
          </a>
        )}
      </CardFooter>
    </Card>
  );
}