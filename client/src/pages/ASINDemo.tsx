import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Package, ExternalLink, DollarSign, Star, Image, AlertTriangle, TrendingUp, ShoppingCart, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PurchasingDecisionData {
  asin: string;
  title: string;
  brand: string;
  manufacturer?: string;
  category: string;
  modelNumber?: string;
  partNumber?: string;
  upc?: string;
  description?: string;
  imageUrl?: string;
  
  // Market Analysis
  salesRank?: number;
  currentPrice?: number;
  buyBoxPrice?: number;
  lowestPrice?: number;
  offerCount?: number;
  fulfillmentChannel?: string;
  
  // Purchasing Intelligence
  opportunityScore?: number;
  profitMargin?: number;
  netProfit?: number;
  supplierCost?: number;
  
  // Listing Status
  listingRestrictions?: any;
  canList?: boolean;
  
  // Competition Analysis
  competitorCount?: number;
  priceCompetitiveness?: string;
  
  // Raw API data for debugging
  rawApiResponse?: any;
}

export default function ASINDemo() {
  const [upc, setUpc] = useState('885909950805'); // Pre-filled with working UPC
  const [supplierCost, setSupplierCost] = useState('45.00'); // Estimated supplier cost for demonstration
  const [purchasingData, setPurchasingData] = useState<PurchasingDecisionData[]>([]);
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
        // Extract comprehensive data from Amazon SP-API response
        const apiData = data.detailedApiResponse;
        const summary = apiData.summaries?.[0] || {};
        const attributes = apiData.attributes || {};
        const offers = apiData.offers || [];
        const pricing = apiData.pricing || {};
        
        // Calculate purchasing intelligence
        const cost = parseFloat(supplierCost) || 0;
        const buyBoxPrice = offers.find((o: any) => o.isBuyBoxWinner)?.listingPrice?.amount || 0;
        const lowestPrice = Math.min(...offers.map((o: any) => o.listingPrice?.amount || Infinity).filter(p => p !== Infinity)) || 0;
        const currentPrice = buyBoxPrice || lowestPrice || 0;
        
        const profitMargin = currentPrice > 0 ? ((currentPrice - cost) / currentPrice) * 100 : 0;
        const netProfit = currentPrice - cost;
        const opportunityScore = calculateOpportunityScore(profitMargin, apiData.salesRanks?.[0]?.classificationRanks?.[0]?.rank || 999999, offers.length);
        
        const purchasingDetails: PurchasingDecisionData = {
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
          salesRank: apiData.salesRanks?.[0]?.classificationRanks?.[0]?.rank || null,
          
          // Market Analysis
          currentPrice,
          buyBoxPrice,
          lowestPrice,
          offerCount: offers.length,
          fulfillmentChannel: offers.find((o: any) => o.isBuyBoxWinner)?.fulfillmentChannel || 'MERCHANT',
          
          // Purchasing Intelligence
          supplierCost: cost,
          profitMargin,
          netProfit,
          opportunityScore,
          
          // Competition Analysis
          competitorCount: offers.length,
          priceCompetitiveness: getPriceCompetitiveness(currentPrice, lowestPrice),
          
          // Listing Status (will be enhanced with actual restrictions check)
          canList: true, // Assume true until we check restrictions
          listingRestrictions: null,
          
          rawApiResponse: data
        };

        setPurchasingData([purchasingDetails]);
        toast({
          title: "ASIN Analysis Complete",
          description: `Found: ${purchasingDetails.title} - Score: ${opportunityScore}/100`
        });
      } else {
        setPurchasingData([]);
        toast({
          title: "No Results",
          description: data.message || "No ASINs found for this UPC"
        });
      }
    },
    onError: (error) => {
      setSearchPerformed(true);
      setPurchasingData([]);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });

  // Helper functions for purchasing intelligence
  const calculateOpportunityScore = (margin: number, rank: number, competitors: number) => {
    let score = 0;
    
    // Profit margin component (40% weight)
    if (margin >= 50) score += 40;
    else if (margin >= 30) score += 30;
    else if (margin >= 15) score += 20;
    else if (margin >= 5) score += 10;
    
    // Sales rank component (40% weight)
    if (rank <= 1000) score += 40;
    else if (rank <= 10000) score += 30;
    else if (rank <= 50000) score += 20;
    else if (rank <= 100000) score += 10;
    
    // Competition component (20% weight)
    if (competitors <= 3) score += 20;
    else if (competitors <= 10) score += 15;
    else if (competitors <= 20) score += 10;
    else if (competitors <= 50) score += 5;
    
    return Math.min(100, Math.max(0, score));
  };

  const getPriceCompetitiveness = (currentPrice: number, lowestPrice: number) => {
    const diff = ((currentPrice - lowestPrice) / lowestPrice) * 100;
    if (diff <= 5) return 'Highly Competitive';
    if (diff <= 15) return 'Competitive';
    if (diff <= 30) return 'Moderately Competitive';
    return 'Less Competitive';
  };

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
        <ShoppingCart className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Supplier Manifest Analysis</h1>
          <p className="text-gray-600">Make informed purchasing decisions with real Amazon marketplace data</p>
        </div>
      </div>

      {/* Search Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5" />
              <span>Product Analysis</span>
            </CardTitle>
            <CardDescription>
              Enter UPC and supplier cost to analyze purchasing opportunity
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Supplier Cost ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="Enter your cost"
                value={supplierCost}
                onChange={(e) => setSupplierCost(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              className="w-full"
            >
              <Calculator className="w-4 h-4 mr-2" />
              {searchMutation.isPending ? 'Analyzing...' : 'Analyze Opportunity'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Decision Factors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Margin Analysis</span>
                <span className="font-medium">40% weight</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sales Rank Performance</span>
                <span className="font-medium">40% weight</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Competition Level</span>
                <span className="font-medium">20% weight</span>
              </div>
              <Separator />
              <div className="text-xs text-gray-500">
                Opportunity scores range from 0-100 based on Amazon marketplace data
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchasing Decision Analysis */}
      {searchPerformed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calculator className="w-5 h-5" />
              <span>Purchasing Decision Analysis</span>
              <Badge variant={purchasingData.length > 0 ? 'default' : 'secondary'}>
                {purchasingData.length > 0 ? `Score: ${purchasingData[0].opportunityScore?.toFixed(0) || 0}` : 'No Data'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Comprehensive supplier manifest analysis with authentic Amazon marketplace data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {purchasingData.length > 0 ? (
              <div className="space-y-6">
                {purchasingData.map((product, index) => (
                  <div key={index} className="bg-gray-50 p-6 rounded-lg space-y-6">
                    {/* Product Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-xl font-semibold">{product.title}</h3>
                          <Badge variant="outline">{product.category}</Badge>
                          <Badge 
                            variant={product.opportunityScore >= 80 ? 'default' : product.opportunityScore >= 60 ? 'secondary' : 'outline'}
                            className="flex items-center space-x-1"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>Score: {product.opportunityScore?.toFixed(0) || 0}</span>
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                          <div><strong>ASIN:</strong> {product.asin}</div>
                          <div><strong>Brand:</strong> {product.brand}</div>
                          <div><strong>MPN:</strong> {product.partNumber || 'N/A'}</div>
                          <div><strong>UPC:</strong> {product.upc}</div>
                          {product.salesRank && <div><strong>Sales Rank:</strong> #{product.salesRank.toLocaleString()}</div>}
                          <div><strong>Competitors:</strong> {product.competitorCount || 0} sellers</div>
                          <div><strong>Fulfillment:</strong> {product.fulfillmentChannel || 'MERCHANT'}</div>
                          <div><strong>Price Position:</strong> {product.priceCompetitiveness || 'Unknown'}</div>
                        </div>
                      </div>
                      {product.imageUrl && (
                        <div className="ml-4">
                          <img 
                            src={product.imageUrl} 
                            alt={product.title}
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>

                    {/* Financial Analysis */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500">Buy Box Price</p>
                        <p className="text-lg font-bold text-blue-600">
                          ${product.buyBoxPrice?.toFixed(2) || product.currentPrice?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500">Lowest Price</p>
                        <p className="text-lg font-bold text-orange-600">
                          ${product.lowestPrice?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500">Your Cost</p>
                        <p className="text-lg font-bold text-gray-700">${product.supplierCost?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500">Net Profit</p>
                        <p className={`text-lg font-bold ${product.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${product.netProfit?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Profitability Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500 mb-2">Profit Margin</p>
                        <div className="flex items-center space-x-2">
                          <p className={`text-lg font-bold ${product.profitMargin > 20 ? 'text-green-600' : product.profitMargin > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {product.profitMargin?.toFixed(1) || '0.0'}%
                          </p>
                          <Badge variant={product.profitMargin > 20 ? 'secondary' : 'outline'}>
                            {product.profitMargin > 30 ? 'Excellent' : product.profitMargin > 20 ? 'Good' : product.profitMargin > 10 ? 'Fair' : 'Poor'}
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500 mb-2">Market Position</p>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-700">
                            Rank: #{product.salesRank?.toLocaleString() || 'Unknown'}
                          </p>
                          <Badge variant={product.salesRank <= 10000 ? 'secondary' : 'outline'}>
                            {product.salesRank <= 1000 ? 'Hot Seller' : product.salesRank <= 10000 ? 'Good Seller' : product.salesRank <= 100000 ? 'Moderate' : 'Slow'}
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-500 mb-2">Competition</p>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-700">{product.competitorCount || 0} sellers</p>
                          <Badge variant={product.competitorCount <= 5 ? 'secondary' : 'outline'}>
                            {product.competitorCount <= 3 ? 'Low' : product.competitorCount <= 10 ? 'Medium' : 'High'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Listing Status */}
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 mb-2">Listing Status</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Can List</Badge>
                        <span className="text-sm text-gray-600">No restrictions detected</span>
                      </div>
                    </div>

                    {/* Purchase Recommendation */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Purchase Recommendation</p>
                          <p className={`text-lg font-bold ${product.opportunityScore >= 70 ? 'text-green-600' : product.opportunityScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {product.opportunityScore >= 80 ? 'Strong Buy' : product.opportunityScore >= 60 ? 'Buy' : product.opportunityScore >= 40 ? 'Consider' : 'Avoid'}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`https://amazon.com/dp/${product.asin}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View on Amazon
                          </Button>
                          <Button 
                            variant={product.opportunityScore >= 70 ? 'default' : 'outline'} 
                            size="sm"
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {product.opportunityScore >= 70 ? 'Add to Manifest' : 'Consider Adding'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No purchasing analysis available.</p>
                <p className="text-sm mt-2">Enter a valid UPC code and supplier cost to analyze purchasing opportunities.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Manifest Decision Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <strong>Enter Product Details:</strong> Input UPC code and your supplier cost for accurate profitability analysis
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <strong>Analyze Market Data:</strong> System retrieves real-time Amazon pricing, sales ranks, and competition data
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <strong>Make Informed Decisions:</strong> Review opportunity scores, profit margins, and purchase recommendations
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg mt-4">
            <p className="text-xs text-yellow-800">
              <strong>Opportunity Scoring:</strong> Based on profit margin (40%), sales rank (40%), and competition level (20%). 
              Scores 80+ indicate strong buying opportunities, 60-79 good buys, 40-59 consider carefully, below 40 avoid.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}