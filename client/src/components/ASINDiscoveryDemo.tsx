import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ExternalLink, TrendingUp, AlertTriangle, CheckCircle, XCircle, ShoppingCart, DollarSign } from 'lucide-react';

// Sample data to demonstrate the ASIN Discovery interface
const sampleDiscoveryResults = [
  {
    row: 1,
    searchCriteria: {
      upc: "885909950805",
      description: "Wireless Bluetooth Headphones",
      brand: "Sony",
      model: "WH-1000XM4"
    },
    foundASINs: [
      {
        asin: "B0863TXGM3",
        title: "Sony WH-1000XM4 Wireless Premium Noise Canceling Overhead Headphones with Mic for Phone-Call and Alexa Voice Control, Black",
        brand: "Sony",
        category: "Electronics > Headphones",
        imageUrl: "https://m.media-amazon.com/images/I/71o8Q5XJS5L._AC_SL1500_.jpg",
        salesRank: 15,
        price: 348.00,
        buyBoxPrice: 348.00,
        avgPrice: 365.00,
        manufacturerNumber: "WH1000XM4/B"
      },
      {
        asin: "B0863TXG93",
        title: "Sony WH-1000XM4 Wireless Premium Noise Canceling Overhead Headphones - Silver",
        brand: "Sony", 
        category: "Electronics > Headphones",
        imageUrl: "https://m.media-amazon.com/images/I/61vFO3N5RRL._AC_SL1500_.jpg",
        salesRank: 45,
        price: 348.00,
        buyBoxPrice: 348.00,
        avgPrice: 365.00,
        manufacturerNumber: "WH1000XM4/S"
      }
    ],
    searchMethod: "upc",
    success: true,
    profitabilityAnalysis: {
      estimatedCost: 280.00,
      estimatedProfit: 68.00,
      profitMargin: 19.5,
      competitorCount: 12,
      demandLevel: "High",
      recommendation: "Strong Buy - High demand product with good profit margins"
    }
  },
  {
    row: 2,
    searchCriteria: {
      upc: "194252014943",
      description: "Apple AirPods Pro 2nd Generation",
      brand: "Apple",
      model: "MTJV3AM/A"
    },
    foundASINs: [
      {
        asin: "B0BDHWDR12",
        title: "Apple AirPods Pro (2nd Generation) Wireless Ear Buds with USB-C Charging, Up to 2X More Active Noise Cancelling Bluetooth Headphones, Transparency Mode, Adaptive Audio, Personalized Spatial Audio",
        brand: "Apple",
        category: "Electronics > Headphones & Earbuds",
        imageUrl: "https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg",
        salesRank: 3,
        price: 249.00,
        buyBoxPrice: 249.00,
        avgPrice: 249.00,
        manufacturerNumber: "MTJV3AM/A"
      }
    ],
    searchMethod: "upc",
    success: true,
    profitabilityAnalysis: {
      estimatedCost: 220.00,
      estimatedProfit: 29.00,
      profitMargin: 11.6,
      competitorCount: 25,
      demandLevel: "Very High",
      recommendation: "Consider - High demand but lower margins due to high competition"
    }
  },
  {
    row: 3,
    searchCriteria: {
      upc: "123456789012",
      description: "Generic USB Cable",
      brand: "Unknown",
      model: "USB-C-001"
    },
    foundASINs: [],
    searchMethod: "upc",
    success: false,
    error: "No ASINs found for this UPC"
  }
];

export default function ASINDiscoveryDemo() {
  const [selectedTab, setSelectedTab] = useState("results");

  const getProfitabilityColor = (margin: number) => {
    if (margin >= 20) return 'text-green-600 bg-green-50';
    if (margin >= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getDemandColor = (demand: string) => {
    switch(demand) {
      case 'Very High': return 'bg-green-100 text-green-700';
      case 'High': return 'bg-green-100 text-green-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            ASIN Discovery Results - Demo
          </CardTitle>
          <CardDescription>
            This demonstrates how your ASIN discovery results would appear with valid Amazon SP-API credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="results">Discovery Results</TabsTrigger>
              <TabsTrigger value="analytics">Profit Analysis</TabsTrigger>
              <TabsTrigger value="recommendations">Buy Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="space-y-4">
              {sampleDiscoveryResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Row {result.row}</Badge>
                      {result.foundASINs.length > 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : result.error ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <Badge variant={result.foundASINs.length > 0 ? "default" : "secondary"}>
                      {result.foundASINs.length} ASINs Found
                    </Badge>
                  </div>
                  
                  {/* Product Information */}
                  <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">UPC:</span>
                        <div className="font-mono">{result.searchCriteria.upc}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Brand:</span>
                        <div>{result.searchCriteria.brand}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Model:</span>
                        <div>{result.searchCriteria.model}</div>
                      </div>
                      {result.profitabilityAnalysis && (
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Est. Profit:</span>
                          <div className={`font-semibold ${getProfitabilityColor(result.profitabilityAnalysis.profitMargin)}`}>
                            ${result.profitabilityAnalysis.estimatedProfit.toFixed(2)} ({result.profitabilityAnalysis.profitMargin}%)
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Description:</span>
                      <div className="text-sm mt-1">{result.searchCriteria.description}</div>
                    </div>
                  </div>
                  
                  {/* ASIN Results */}
                  {result.foundASINs.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Found {result.foundASINs.length} Matching ASIN{result.foundASINs.length > 1 ? 's' : ''}
                      </h4>
                      <div className="grid gap-3">
                        {result.foundASINs.map((asin, asinIndex) => (
                          <div key={asinIndex} className="border rounded p-3 bg-white dark:bg-gray-800">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">{asin.asin}</Badge>
                                <a
                                  href={`https://amazon.com/dp/${asin.asin}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  Rank: #{asin.salesRank}
                                </Badge>
                                <Badge variant="default" className="text-xs">
                                  ${asin.price}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex gap-3">
                              <img 
                                src={asin.imageUrl} 
                                alt={asin.title}
                                className="w-16 h-16 object-cover rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm line-clamp-2 mb-1">{asin.title}</h5>
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                  <div><span className="font-medium">Brand:</span> {asin.brand}</div>
                                  <div><span className="font-medium">Category:</span> {asin.category}</div>
                                  <div><span className="font-medium">Sales Rank:</span> #{asin.salesRank}</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Purchasing Decision Indicators */}
                            <div className="mt-3 pt-2 border-t">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex gap-3">
                                  <span className={`px-2 py-1 rounded ${
                                    asin.salesRank < 100 
                                      ? 'bg-green-100 text-green-700' 
                                      : asin.salesRank < 1000
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {asin.salesRank < 100 
                                      ? '🟢 Very High Demand' 
                                      : asin.salesRank < 1000
                                      ? '🟡 High Demand'
                                      : '🔴 Medium Demand'
                                    }
                                  </span>
                                  <span className="text-gray-500">
                                    Buy Box: ${asin.buyBoxPrice}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    <ShoppingCart className="h-3 w-3 mr-1" />
                                    Add to Buy List
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Profit Analysis
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      {result.error ? (
                        <div className="flex items-center justify-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span>Error: {result.error}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>No ASINs found for this product</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sampleDiscoveryResults.filter(r => r.profitabilityAnalysis).map((result, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{result.searchCriteria.description}</CardTitle>
                      <CardDescription className="text-xs">
                        {result.foundASINs.length} ASIN{result.foundASINs.length > 1 ? 's' : ''} Found
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Est. Cost:</span>
                          <div className="font-semibold">${result.profitabilityAnalysis!.estimatedCost}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Est. Profit:</span>
                          <div className="font-semibold text-green-600">${result.profitabilityAnalysis!.estimatedProfit}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Margin:</span>
                          <div className={`font-semibold ${getProfitabilityColor(result.profitabilityAnalysis!.profitMargin)}`}>
                            {result.profitabilityAnalysis!.profitMargin}%
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Competitors:</span>
                          <div className="font-semibold">{result.profitabilityAnalysis!.competitorCount}</div>
                        </div>
                      </div>
                      <div className="text-center">
                        <Badge className={getDemandColor(result.profitabilityAnalysis!.demandLevel)}>
                          {result.profitabilityAnalysis!.demandLevel} Demand
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              {sampleDiscoveryResults.filter(r => r.profitabilityAnalysis).map((result, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      {result.searchCriteria.description}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Recommendation:</span>
                        <Badge variant={result.profitabilityAnalysis!.profitMargin >= 15 ? "default" : "secondary"}>
                          {result.profitabilityAnalysis!.profitMargin >= 15 ? "Strong Buy" : "Consider"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{result.profitabilityAnalysis!.recommendation}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default">
                          Add to Purchase List
                        </Button>
                        <Button size="sm" variant="outline">
                          Set Price Alert
                        </Button>
                        <Button size="sm" variant="outline">
                          View Competition
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}