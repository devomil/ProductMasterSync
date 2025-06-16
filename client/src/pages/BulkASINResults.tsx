import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  ExternalLink, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Database,
  BarChart3,
  DollarSign,
  Star
} from 'lucide-react';

interface BulkJobStatus {
  id: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successfulSearches: number;
  failedSearches: number;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  results: Array<{
    row: number;
    searchCriteria: {
      upc?: string;
      description?: string;
      brand?: string;
      model?: string;
    };
    foundASINs: Array<{
      asin: string;
      title: string;
      brand: string;
      category: string;
      price?: number;
      salesRank?: number;
      imageUrl?: string;
    }>;
    searchMethod: string;
    processingTime: number;
    success: boolean;
  }>;
}

interface BulkASINResultsProps {
  jobId: string;
}

export default function BulkASINResults({ jobId }: BulkASINResultsProps) {
  const [refreshInterval, setRefreshInterval] = useState(2000);

  // Query bulk job status with auto-refresh
  const { data: jobStatus, isLoading } = useQuery({
    queryKey: ['/api/marketplace/bulk-job-status', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/bulk-job-status/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch job status');
      const result = await response.json();
      return result.data as BulkJobStatus;
    },
    refetchInterval: jobStatus?.status === 'processing' ? refreshInterval : false,
    enabled: !!jobId
  });

  // Stop auto-refresh when job completes
  useEffect(() => {
    if (jobStatus?.status === 'completed' || jobStatus?.status === 'error') {
      setRefreshInterval(0);
    }
  }, [jobStatus?.status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 animate-spin" />
          <span>Loading bulk processing results...</span>
        </div>
      </div>
    );
  }

  if (!jobStatus) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">No job status found for ID: {jobId}</p>
      </div>
    );
  }

  const completedResults = jobStatus.results.filter(r => r.foundASINs.length > 0);
  const noMatchResults = jobStatus.results.filter(r => r.foundASINs.length === 0);
  const totalASINsFound = jobStatus.results.reduce((sum, r) => sum + r.foundASINs.length, 0);

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Bulk ASIN Discovery Progress</span>
            <Badge variant={jobStatus.status === 'completed' ? 'default' : 'secondary'}>
              {jobStatus.status}
            </Badge>
          </CardTitle>
          <CardDescription>
            Processing {jobStatus.filename} with {jobStatus.totalRows} products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Progress: {jobStatus.processedRows} of {jobStatus.totalRows} processed</span>
              <span>{Math.round(jobStatus.progress)}%</span>
            </div>
            <Progress value={jobStatus.progress} className="h-2" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{jobStatus.successfulSearches}</div>
                <div className="text-sm text-gray-600">Successful Searches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalASINsFound}</div>
                <div className="text-sm text-gray-600">ASINs Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{completedResults.length}</div>
                <div className="text-sm text-gray-600">Products Matched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{jobStatus.failedSearches}</div>
                <div className="text-sm text-gray-600">Failed Searches</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Tabs */}
      <Tabs defaultValue="matched" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="matched" className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Matched Products ({completedResults.length})</span>
          </TabsTrigger>
          <TabsTrigger value="no-match" className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>No Match ({noMatchResults.length})</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="space-y-4">
          {completedResults.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
                <p className="text-gray-600">
                  {jobStatus.status === 'processing' 
                    ? 'Processing continues... ASIN matches will appear here as they are discovered.'
                    : 'No Amazon ASINs were found for the processed products.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedResults.map((result, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Row {result.row} - {result.searchCriteria.brand || 'Unknown Brand'}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{result.searchMethod}</Badge>
                        <Badge variant="secondary">{result.foundASINs.length} ASINs</Badge>
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      UPC: {result.searchCriteria.upc || 'N/A'} | 
                      Processing Time: {result.processingTime}ms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {result.foundASINs.map((asin, asinIndex) => (
                        <div key={asinIndex} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          {asin.imageUrl && (
                            <img 
                              src={asin.imageUrl} 
                              alt={asin.title}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-sm truncate">{asin.title}</h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`https://amazon.com/dp/${asin.asin}`, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-gray-600">
                              <span>ASIN: {asin.asin}</span>
                              <span>Brand: {asin.brand}</span>
                              <span>Category: {asin.category}</span>
                              {asin.price && (
                                <span className="flex items-center">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  ${asin.price}
                                </span>
                              )}
                              {asin.salesRank && (
                                <span className="flex items-center">
                                  <Star className="w-3 h-3 mr-1" />
                                  Rank #{asin.salesRank.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="no-match" className="space-y-4">
          {noMatchResults.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <h3 className="text-lg font-semibold mb-2">All Products Matched!</h3>
                <p className="text-gray-600">Every processed product has been successfully matched to Amazon ASINs.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {noMatchResults.map((result, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          Row {result.row} - {result.searchCriteria.brand || 'Unknown Brand'}
                        </div>
                        <div className="text-xs text-gray-600">
                          UPC: {result.searchCriteria.upc || 'N/A'} | 
                          Method: {result.searchMethod}
                        </div>
                      </div>
                      <Badge variant="outline">No Match</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Match Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobStatus.processedRows > 0 
                    ? Math.round((completedResults.length / jobStatus.processedRows) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-gray-600">
                  {completedResults.length} of {jobStatus.processedRows} products matched
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Avg ASINs per Product
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {completedResults.length > 0 
                    ? (totalASINsFound / completedResults.length).toFixed(1)
                    : '0'}
                </div>
                <p className="text-xs text-gray-600">
                  {totalASINsFound} total ASINs found
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Avg Processing Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobStatus.results.length > 0
                    ? Math.round(jobStatus.results.reduce((sum, r) => sum + r.processingTime, 0) / jobStatus.results.length)
                    : 0}ms
                </div>
                <p className="text-xs text-gray-600">
                  Per product search
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Processing Status by Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Search Methods Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(new Set(jobStatus.results.map(r => r.searchMethod))).map(method => {
                  const methodResults = jobStatus.results.filter(r => r.searchMethod === method);
                  const methodMatches = methodResults.filter(r => r.foundASINs.length > 0);
                  const successRate = methodResults.length > 0 
                    ? Math.round((methodMatches.length / methodResults.length) * 100)
                    : 0;
                  
                  return (
                    <div key={method} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{method.toUpperCase()}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-600">
                          {methodMatches.length}/{methodResults.length} matches
                        </span>
                        <Badge variant={successRate > 50 ? 'default' : 'secondary'}>
                          {successRate}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}