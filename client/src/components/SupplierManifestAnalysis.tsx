import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Star, 
  ExternalLink,
  Calculator,
  ShoppingCart,
  BarChart3,
  Target,
  Trophy,
  Zap
} from 'lucide-react';

interface SupplierProduct {
  row: number;
  searchCriteria: {
    upc?: string;
    description?: string;
    brand?: string;
    model?: string;
    asin?: string;
    manufacturerNumber?: string;
  };
  foundASINs: Array<{
    asin: string;
    title: string;
    brand: string;
    category: string;
    imageUrl?: string;
    currentPrice?: number;
    salesRank?: number;
    manufacturerNumber?: string;
  }>;
  searchMethod?: string;
  success?: boolean;
  error?: string;
  // Enhanced with supplier manifest data
  supplierCost?: number;
  retail?: string;
  weight?: string;
  department?: string;
  productType?: string;
  subcategory?: string;
}

interface ManifestAnalysisProps {
  results: SupplierProduct[];
  filename: string;
  totalRows: number;
  successfulSearches: number;
}

interface ProfitabilityMetrics {
  totalProducts: number;
  amazonMatches: number;
  profitableProducts: number;
  totalPotentialProfit: number;
  averageMargin: number;
  topOpportunities: SupplierProduct[];
  riskProducts: SupplierProduct[];
  recommendedPurchase: boolean;
  manifestScore: number;
}

export default function SupplierManifestAnalysis({ 
  results, 
  filename, 
  totalRows, 
  successfulSearches 
}: ManifestAnalysisProps) {
  const [selectedTab, setSelectedTab] = useState('overview');

  // Calculate comprehensive profitability metrics
  const metrics = useMemo((): ProfitabilityMetrics => {
    const productsWithMatches = results.filter(p => p.foundASINs.length > 0);
    let totalProfit = 0;
    let profitableCount = 0;
    let marginSum = 0;
    
    const opportunities: Array<SupplierProduct & { profitScore: number; margin: number; profit: number }> = [];
    const risks: SupplierProduct[] = [];

    productsWithMatches.forEach(product => {
      const supplierCost = parseFloat(product.retail || '0');
      const bestAsin = product.foundASINs[0];
      const amazonPrice = bestAsin?.currentPrice || 0;
      
      if (supplierCost > 0 && amazonPrice > 0) {
        const profit = amazonPrice - supplierCost;
        const margin = (profit / amazonPrice) * 100;
        
        totalProfit += profit;
        marginSum += margin;
        
        if (profit > 0) {
          profitableCount++;
        }

        // Calculate opportunity score based on profit, margin, and sales rank
        const salesRankScore = bestAsin.salesRank ? Math.max(0, 100 - (bestAsin.salesRank / 1000)) : 50;
        const profitScore = Math.min(100, (profit / supplierCost) * 50);
        const marginScore = Math.min(100, margin * 2);
        const overallScore = (salesRankScore + profitScore + marginScore) / 3;

        const enhancedProduct = product as SupplierProduct & { 
          profitScore: number; 
          margin: number; 
          profit: number 
        };
        enhancedProduct.profitScore = overallScore;
        enhancedProduct.margin = margin;
        enhancedProduct.profit = profit;

        if (overallScore >= 60 && profit > 5) {
          opportunities.push(enhancedProduct);
        } else if (profit < 0 || margin < 10) {
          risks.push(product);
        }
      }
    });

    const averageMargin = productsWithMatches.length > 0 ? marginSum / productsWithMatches.length : 0;
    const matchRate = (successfulSearches / totalRows) * 100;
    const profitRate = (profitableCount / productsWithMatches.length) * 100;
    const manifestScore = (matchRate * 0.3) + (profitRate * 0.4) + (Math.min(averageMargin, 50) * 0.3);

    return {
      totalProducts: totalRows,
      amazonMatches: successfulSearches,
      profitableProducts: profitableCount,
      totalPotentialProfit: totalProfit,
      averageMargin,
      topOpportunities: opportunities.sort((a, b) => b.profitScore - a.profitScore).slice(0, 10),
      riskProducts: risks.slice(0, 10),
      recommendedPurchase: manifestScore >= 60 && totalProfit > 100,
      manifestScore
    };
  }, [results, totalRows, successfulSearches]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'EXCELLENT' };
    if (score >= 60) return { variant: 'secondary' as const, text: 'GOOD' };
    return { variant: 'destructive' as const, text: 'POOR' };
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Supplier Manifest Analysis: {filename}
              </CardTitle>
              <CardDescription>
                Comprehensive purchasing decision analysis with real Amazon marketplace data
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold">{metrics.manifestScore.toFixed(0)}</span>
                <Badge {...getScoreBadge(metrics.manifestScore)}>
                  {getScoreBadge(metrics.manifestScore).text}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">Manifest Score</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.totalProducts}</div>
              <div className="text-sm text-blue-700">Total Products</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metrics.amazonMatches}</div>
              <div className="text-sm text-green-700">Amazon Matches</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{metrics.profitableProducts}</div>
              <div className="text-sm text-purple-700">Profitable Items</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                ${metrics.totalPotentialProfit.toFixed(0)}
              </div>
              <div className="text-sm text-orange-700">Potential Profit</div>
            </div>
          </div>

          {/* Purchase Recommendation */}
          <div className={`p-6 rounded-lg border-l-4 ${
            metrics.recommendedPurchase 
              ? 'bg-green-50 border-green-400' 
              : 'bg-red-50 border-red-400'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {metrics.recommendedPurchase ? (
                <Trophy className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
              <h3 className={`text-lg font-semibold ${
                metrics.recommendedPurchase ? 'text-green-800' : 'text-red-800'
              }`}>
                {metrics.recommendedPurchase ? 'RECOMMENDED PURCHASE' : 'NOT RECOMMENDED'}
              </h3>
            </div>
            <p className={`text-sm ${
              metrics.recommendedPurchase ? 'text-green-700' : 'text-red-700'
            }`}>
              {metrics.recommendedPurchase 
                ? `This supplier manifest shows strong profitability potential with ${metrics.profitableProducts} profitable products and $${metrics.totalPotentialProfit.toFixed(0)} total profit opportunity.`
                : `This supplier manifest shows limited profitability with only ${metrics.profitableProducts} profitable products. Consider negotiating better pricing or finding alternative suppliers.`
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="opportunities">Top Opportunities</TabsTrigger>
          <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Market Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Amazon Match Rate</span>
                    <span>{((metrics.amazonMatches / metrics.totalProducts) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(metrics.amazonMatches / metrics.totalProducts) * 100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Profitability Rate</span>
                    <span>{metrics.amazonMatches > 0 ? ((metrics.profitableProducts / metrics.amazonMatches) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <Progress value={metrics.amazonMatches > 0 ? (metrics.profitableProducts / metrics.amazonMatches) * 100 : 0} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Average profit margin: {metrics.averageMargin.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Products with Amazon presence:</span>
                  <span className="font-bold">{metrics.amazonMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Profitable opportunities:</span>
                  <span className="font-bold text-green-600">{metrics.profitableProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">High-opportunity products:</span>
                  <span className="font-bold text-blue-600">{metrics.topOpportunities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Risk products:</span>
                  <span className="font-bold text-red-600">{metrics.riskProducts.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Top Profit Opportunities
              </CardTitle>
              <CardDescription>
                Products with highest profitability potential based on real Amazon marketplace data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.topOpportunities.map((product, index) => (
                  <div key={`${product.row}-${index}`} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{product.foundASINs[0]?.title || 'Product'}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{product.foundASINs[0]?.asin}</Badge>
                          <Badge variant="secondary">Score: {(product as any).profitScore?.toFixed(0) || 0}</Badge>
                        </div>
                      </div>
                      {product.foundASINs[0]?.imageUrl && (
                        <img 
                          src={product.foundASINs[0].imageUrl} 
                          alt={product.foundASINs[0].title}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">Your Cost:</span>
                        <div className="font-bold">${parseFloat(product.retail || '0').toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Amazon Price:</span>
                        <div className="font-bold text-blue-600">
                          ${product.foundASINs[0]?.currentPrice?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Profit:</span>
                        <div className="font-bold text-green-600">${(product as any).profit?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Margin:</span>
                        <div className="font-bold text-purple-600">{(product as any).margin?.toFixed(1) || '0.0'}%</div>
                      </div>
                    </div>

                    {product.foundASINs[0]?.salesRank && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Sales Rank: #{product.foundASINs[0].salesRank.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Risk Analysis
              </CardTitle>
              <CardDescription>
                Products with low profitability or potential issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.riskProducts.length > 0 ? (
                <div className="space-y-3">
                  {metrics.riskProducts.map((product, index) => (
                    <div key={`${product.row}-${index}`} className="p-3 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium">{product.foundASINs[0]?.title || product.searchCriteria.description}</h5>
                          <div className="text-sm text-red-600 mt-1">
                            UPC: {product.searchCriteria.upc} | Cost: ${parseFloat(product.retail || '0').toFixed(2)}
                          </div>
                        </div>
                        <Badge variant="destructive">Risk</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No significant risks identified in this supplier manifest.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Product Results</CardTitle>
              <CardDescription>
                Complete analysis of all {totalRows} products in supplier manifest
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((product, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {product.foundASINs.length > 0 
                            ? product.foundASINs[0].title 
                            : product.searchCriteria.description || `Product ${product.row}`
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          UPC: {product.searchCriteria.upc} | 
                          Cost: ${parseFloat(product.retail || '0').toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.foundASINs.length > 0 ? (
                          <>
                            <Badge variant="secondary">{product.foundASINs.length} match(es)</Badge>
                            <a
                              href={`https://amazon.com/dp/${product.foundASINs[0].asin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </>
                        ) : (
                          <Badge variant="outline">No matches</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}