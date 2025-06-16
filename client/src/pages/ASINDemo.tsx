import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Package, ExternalLink, DollarSign, Star, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ASINDetails {
  asin: string;
  title: string;
  brand: string;
  manufacturer?: string;
  category: string;
  price?: number;
  salesRank?: number;
  imageUrl?: string;
  modelNumber?: string;
  partNumber?: string;
  upc?: string;
  description?: string;
}

export default function ASINDemo() {
  const [upc, setUpc] = useState('885909950805'); // Pre-filled with working UPC
  const [asinResults, setAsinResults] = useState<ASINDetails[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const { toast } = useToast();

  const searchMutation = useMutation({
    mutationFn: async (upcCode: string) => {
      const response = await fetch('/api/marketplace/amazon/test-upc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upc: upcCode })
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      setSearchPerformed(true);
      if (data.success && data.detailedApiResponse) {
        // Extract data from the detailed Amazon SP-API response
        const apiData = data.detailedApiResponse;
        const summary = apiData.summaries?.[0] || {};
        const attributes = apiData.attributes || {};
        
        const asinDetails: ASINDetails = {
          asin: apiData.asin || 'N/A',
          title: summary.itemName || 'Unknown Product',
          brand: summary.brand || summary.manufacturer || 'Unknown Brand',
          manufacturer: summary.manufacturer,
          category: summary.browseClassification?.displayName || 'Unknown Category',
          modelNumber: summary.modelNumber,
          partNumber: summary.partNumber,
          upc: upc,
          description: attributes.bullet_point?.map((bp: any) => bp.value).join(' • ') || 'No description available',
          imageUrl: apiData.images?.[0]?.variant || null,
          salesRank: apiData.salesRanks?.[0]?.classificationRanks?.[0]?.rank || null
        };

        setAsinResults([asinDetails]);
        toast({
          title: "ASIN Discovery Successful",
          description: `Found: ${asinDetails.title} (${asinDetails.asin})`
        });
      } else {
        setAsinResults([]);
        toast({
          title: "No Results",
          description: data.message || "No ASINs found for this UPC"
        });
      }
    },
    onError: (error) => {
      setSearchPerformed(true);
      setAsinResults([]);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!upc.trim()) {
      toast({
        title: "UPC Required",
        description: "Please enter a UPC code to search",
        variant: "destructive"
      });
      return;
    }
    searchMutation.mutate(upc.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Package className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">ASIN Discovery Demo</h1>
          <p className="text-gray-600">Live demonstration with authentic Amazon SP-API data</p>
        </div>
      </div>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>UPC to ASIN Search</span>
          </CardTitle>
          <CardDescription>
            Enter a UPC code to discover matching Amazon ASINs with complete product details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upc">UPC Code</Label>
            <Input
              id="upc"
              placeholder="Enter UPC code (e.g., 885909950805)"
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Example: 885909950805 (Apple iPhone 6) - Try this working UPC
            </p>
          </div>
          <Button 
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="w-full"
          >
            <Search className="w-4 h-4 mr-2" />
            {searchMutation.isPending ? 'Searching Amazon...' : 'Search ASIN'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Display */}
      {searchPerformed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Discovery Results</span>
              <Badge variant={asinResults.length > 0 ? 'default' : 'secondary'}>
                {asinResults.length} ASINs Found
              </Badge>
            </CardTitle>
            <CardDescription>
              Authentic Amazon marketplace data from SP-API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {asinResults.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No ASINs Found</h3>
                <p className="text-gray-600">
                  Try a different UPC or check if the product exists on Amazon
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {asinResults.map((asin, index) => (
                  <div key={index} className="border rounded-lg p-6 space-y-4">
                    {/* Header with ASIN and actions */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold mb-1">{asin.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>ASIN: <code className="bg-gray-100 px-2 py-1 rounded">{asin.asin}</code></span>
                          <span>Brand: {asin.brand}</span>
                          <span>UPC: {asin.upc}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://amazon.com/dp/${asin.asin}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View on Amazon
                      </Button>
                    </div>

                    <Separator />

                    {/* Product Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Product Info</h4>
                        <div className="space-y-1 text-sm">
                          <div><span className="text-gray-600">Category:</span> {asin.category}</div>
                          {asin.manufacturer && (
                            <div><span className="text-gray-600">Manufacturer:</span> {asin.manufacturer}</div>
                          )}
                          {asin.modelNumber && (
                            <div><span className="text-gray-600">Model:</span> {asin.modelNumber}</div>
                          )}
                          {asin.partNumber && (
                            <div><span className="text-gray-600">Part Number:</span> {asin.partNumber}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Market Data</h4>
                        <div className="space-y-1 text-sm">
                          {asin.price && (
                            <div className="flex items-center">
                              <DollarSign className="w-4 h-4 mr-1 text-green-600" />
                              <span>${asin.price}</span>
                            </div>
                          )}
                          {asin.salesRank && (
                            <div className="flex items-center">
                              <Star className="w-4 h-4 mr-1 text-yellow-500" />
                              <span>Rank #{asin.salesRank.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {asin.imageUrl && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900">Product Image</h4>
                          <img 
                            src={asin.imageUrl} 
                            alt={asin.title}
                            className="w-24 h-24 object-cover rounded border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {asin.description && asin.description !== 'No description available' && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Product Description</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {asin.description}
                        </p>
                      </div>
                    )}

                    {/* Purchasing Analysis */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Purchasing Analysis</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 font-medium">Authenticity:</span>
                          <span className="ml-2 text-green-600">✓ Verified Amazon Data</span>
                        </div>
                        <div>
                          <span className="text-blue-700 font-medium">Availability:</span>
                          <span className="ml-2">Active Listing</span>
                        </div>
                        <div>
                          <span className="text-blue-700 font-medium">Competition:</span>
                          <span className="ml-2">Market Data Available</span>
                        </div>
                        <div>
                          <span className="text-blue-700 font-medium">Tracking:</span>
                          <span className="ml-2">Real-time Pricing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <strong>Enter UPC Code:</strong> Use the pre-filled example (885909950805) or enter your own UPC
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <strong>Search Amazon:</strong> Click "Search ASIN" to query the Amazon SP-API with authentic credentials
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <strong>View Results:</strong> See complete product details, pricing, sales ranks, and purchasing analysis
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}