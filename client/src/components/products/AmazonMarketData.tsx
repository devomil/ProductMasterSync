import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, ExternalLink, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { useFetchAmazonDataByUpc } from "@/hooks/useAmazonMarketData";

interface AmazonMarketDataProps {
  productId?: string;
  upc?: string;
}

export default function AmazonMarketData({ productId, upc }: AmazonMarketDataProps) {
  const [testResults, setTestResults] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Fetch existing Amazon data for this product
  const { data: marketData, isLoading: dataLoading, refetch } = useQuery({
    queryKey: [`/api/marketplace/amazon/product/${productId}`],
    enabled: !!productId,
    retry: 1
  });

  // Hook to fetch fresh Amazon data
  const fetchAmazonMutation = useFetchAmazonDataByUpc(Number(productId || 0));

  const handleTestUPC = async () => {
    if (!upc) return;
    
    setTestLoading(true);
    try {
      const response = await fetch('/api/marketplace/amazon/test-upc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upc })
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Error testing UPC:', error);
      setTestResults({ error: 'Failed to test UPC' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSyncData = () => {
    if (!upc) return;
    fetchAmazonMutation.mutate(upc, {
      onSuccess: () => {
        refetch();
      }
    });
  };

  if (!upc) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No UPC available for this product. Amazon marketplace data requires a valid UPC code.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test UPC Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Amazon Lookup Test
          </CardTitle>
          <CardDescription>
            Test what Amazon returns for UPC: <span className="font-mono font-semibold">{upc}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Button 
              onClick={handleTestUPC} 
              disabled={testLoading}
              variant="outline"
            >
              {testLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test UPC Lookup
            </Button>
            
            <Button 
              onClick={handleSyncData}
              disabled={fetchAmazonMutation.isPending}
            >
              {fetchAmazonMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Sync to Database
            </Button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <Separator />
              
              {testResults.success ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-green-700">Amazon Data Found</h4>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {testResults.totalAsinsFound} ASINs Found
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">ASINs</div>
                      <div className="space-y-1">
                        {testResults.asins?.map((asin: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge variant="outline">{asin}</Badge>
                            <a 
                              href={`https://amazon.com/dp/${asin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Sample Data</div>
                      {testResults.catalogItems?.[0] && (
                        <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                          <div><strong>Brand:</strong> {testResults.catalogItems[0].attributes?.brand?.[0]?.value || 'N/A'}</div>
                          <div><strong>Weight:</strong> {testResults.catalogItems[0].attributes?.item_weight?.[0]?.value || 'N/A'} {testResults.catalogItems[0].attributes?.item_weight?.[0]?.unit || ''}</div>
                          <div><strong>Dimensions:</strong> {testResults.catalogItems[0].attributes?.item_dimensions?.[0] ? 
                            `${testResults.catalogItems[0].attributes.item_dimensions[0].length?.value || 'N/A'} x ${testResults.catalogItems[0].attributes.item_dimensions[0].width?.value || 'N/A'} x ${testResults.catalogItems[0].attributes.item_dimensions[0].height?.value || 'N/A'} ${testResults.catalogItems[0].attributes.item_dimensions[0].length?.unit || ''}` : 'N/A'}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {testResults.error || 'No Amazon data found for this UPC'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stored Market Data Section */}
      <Card>
        <CardHeader>
          <CardTitle>Stored Amazon Data</CardTitle>
          <CardDescription>Previously synced competitive intelligence data</CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading market data...
            </div>
          ) : marketData && Array.isArray(marketData) && marketData.length > 0 ? (
            <div className="space-y-4">
              {(marketData as any[]).map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.asin}</Badge>
                      <a 
                        href={`https://amazon.com/dp/${item.asin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.last_sync_date && new Date(item.last_sync_date).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-700">Brand</div>
                      <div>{item.brand || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Price</div>
                      <div>{item.price ? `$${(item.price / 100).toFixed(2)}` : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Sales Rank</div>
                      <div>{item.sales_rank || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div>No Amazon market data stored yet</div>
              <div className="text-sm mt-1">Use the "Sync to Database" button to fetch and store competitive data</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}