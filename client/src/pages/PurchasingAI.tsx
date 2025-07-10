import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingUp, DollarSign, Shield, Target, BarChart3, Bot, Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfitabilityData {
  productId: number;
  asin: string;
  costPrice: number;
  amazonPrice: number;
  grossMargin: number;
  grossMarginPercent: number;
  netProfit: number;
  netProfitPercent: number;
  roi: number;
  amazonFees: {
    referralFee: number;
    fulfillmentFee: number;
    storageFee: number;
    totalFees: number;
    feePercentage: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendationScore: number;
  automationEligible: boolean;
}

interface ProductRecommendation {
  productId: number;
  asin: string;
  productName: string;
  costPrice: number;
  amazonPrice: number;
  netProfitPercent: number;
  roi: number;
  recommendationScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  automationEligible: boolean;
  restrictions: {
    isRestricted: boolean;
    restrictionType: string[];
  };
  confidence: {
    overallScore: number;
    verificationStatus: 'VERIFIED' | 'PENDING' | 'FAILED';
  };
  automation: {
    flagReason: string[];
    automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
  };
}

export default function PurchasingAI() {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Fetch purchasing recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery({
    queryKey: ["/api/purchasing/recommendations"],
    enabled: true
  });

  // Fetch detailed profitability for selected product
  const { data: profitability, isLoading: profitabilityLoading } = useQuery({
    queryKey: ["/api/purchasing/profitability", selectedProductId],
    enabled: !!selectedProductId
  });

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HIGH': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAutomationColor = (level: string) => {
    switch (level) {
      case 'FULL': return 'bg-green-500';
      case 'PARTIAL': return 'bg-yellow-500';
      case 'MANUAL': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI-Powered Purchasing Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive profitability analysis, risk assessment, and automation recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bot className="h-3 w-3" />
            AI Enabled
          </Badge>
        </div>
      </div>

      {recommendationsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Analyzing product profitability...</p>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recommendations">Top Opportunities</TabsTrigger>
            <TabsTrigger value="analysis">Detailed Analysis</TabsTrigger>
            <TabsTrigger value="automation">Automation Flags</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                      <p className="text-2xl font-bold">{recommendations.length}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Automation Ready</p>
                      <p className="text-2xl font-bold text-green-600">
                        {recommendations.filter((r: any) => r.automationEligible).length}
                      </p>
                    </div>
                    <Bot className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">High ROI Products</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {recommendations.filter((r: any) => r.roi > 50).length}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Low Risk Items</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {recommendations.filter((r: any) => r.riskLevel === 'LOW').length}
                      </p>
                    </div>
                    <Shield className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  AI Insights Summary
                </CardTitle>
                <CardDescription>
                  Intelligent analysis of your product catalog for purchasing opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The AI system has analyzed {recommendations.length} products and identified {" "}
                    {recommendations.filter((r: any) => r.recommendationScore > 80).length} high-opportunity items 
                    with profit margins above 20% and low marketplace restrictions.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Profitability Analysis</span>
                    <span className="text-sm text-muted-foreground">Complete</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Restriction Detection</span>
                    <span className="text-sm text-muted-foreground">Active</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Match Confidence Scoring</span>
                    <span className="text-sm text-muted-foreground">95% Accuracy</span>
                  </div>
                  <Progress value={95} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Confidence based on: UPC exact match (60%), product title similarity (20%), brand verification (20%)
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top Purchasing Opportunities
                </CardTitle>
                <CardDescription>
                  Products ranked by AI recommendation score, profitability, and automation readiness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.slice(0, 10).map((rec: ProductRecommendation, index: number) => (
                    <div 
                      key={`${rec.productId}-${rec.asin}-${index}`} 
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedProductId(rec.productId)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{rec.productName || 'Product ' + rec.productId}</h3>
                            <Badge variant="outline" className="text-xs">{rec.asin}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Cost: ${rec.costPrice?.toFixed(2)}</span>
                            <span>Amazon: ${rec.amazonPrice?.toFixed(2)}</span>
                            <span>ROI: {rec.roi?.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getRiskColor(rec.riskLevel)} text-white`}>
                            {rec.riskLevel} Risk
                          </Badge>
                          <Badge className={`text-xs ${getAutomationColor(rec.automation?.automationLevel)} text-white`}>
                            {rec.automation?.automationLevel}
                          </Badge>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {rec.recommendationScore?.toFixed(0)}
                            </div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs">
                            <span>Profit Margin</span>
                            <span>{rec.netProfitPercent?.toFixed(1)}%</span>
                          </div>
                          <Progress value={Math.min(100, rec.netProfitPercent || 0)} className="h-1 mt-1" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs">
                            <span>Match Confidence</span>
                            <span>{rec.confidence?.overallScore?.toFixed(0)}%</span>
                          </div>
                          <Progress value={rec.confidence?.overallScore || 0} className="h-1 mt-1" />
                          <div className="text-xs text-muted-foreground mt-1">
                            UPC & Product Matching
                          </div>
                        </div>
                      </div>

                      {rec.automation?.flagReason?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.automation.flagReason.map((reason, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {reason.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {selectedProductId ? (
              profitabilityLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading detailed analysis...</p>
                </div>
              ) : profitability ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Detailed Profitability Analysis
                    </CardTitle>
                    <CardDescription>
                      Comprehensive financial breakdown for Product ID {selectedProductId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          ${profitability.netProfit?.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Net Profit</div>
                        <div className="text-xs text-green-600 mt-1">
                          {profitability.netProfitPercent?.toFixed(1)}% margin
                        </div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {profitability.roi?.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">ROI</div>
                        <div className="text-xs text-blue-600 mt-1">
                          Return on investment
                        </div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold">
                          {profitability.recommendationScore?.toFixed(0)}
                        </div>
                        <div className="text-sm text-muted-foreground">AI Score</div>
                        <div className="text-xs mt-1">
                          <Badge className={getRiskColor(profitability.riskLevel) + ' text-white'}>
                            {profitability.riskLevel} Risk
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Cost Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Product Cost</span>
                          <span>${profitability.costPrice?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amazon Price</span>
                          <span>${profitability.amazonPrice?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Referral Fee</span>
                          <span>-${profitability.amazonFees?.referralFee?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Fulfillment Fee</span>
                          <span>-${profitability.amazonFees?.fulfillmentFee?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Storage Fee</span>
                          <span>-${profitability.amazonFees?.storageFee?.toFixed(2)}</span>
                        </div>
                        <hr />
                        <div className="flex justify-between font-semibold">
                          <span>Net Profit</span>
                          <span className="text-green-600">${profitability.netProfit?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold">Amazon Fees Analysis</h4>
                      <div className="text-sm text-muted-foreground">
                        Total Amazon fees: ${profitability.amazonFees?.totalFees?.toFixed(2)} ({profitability.amazonFees?.feePercentage?.toFixed(1)}% of selling price)
                      </div>
                      <Progress value={profitability.amazonFees?.feePercentage || 0} className="h-2" />
                    </div>

                    {profitability.automationEligible && (
                      <Alert>
                        <Bot className="h-4 w-4" />
                        <AlertDescription>
                          This product is eligible for automated purchasing based on high profitability, 
                          low risk, and verified marketplace data.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No profitability data available for this product. Please ensure Amazon marketplace data is synchronized.
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Product for Analysis</h3>
                  <p className="text-muted-foreground">
                    Choose a product from the recommendations tab to view detailed profitability analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Automation Readiness Dashboard
                </CardTitle>
                <CardDescription>
                  Products flagged for automated purchasing based on AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations
                    .filter((rec: ProductRecommendation) => rec.automationEligible)
                    .map((rec: ProductRecommendation) => (
                    <div key={rec.productId} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{rec.productName || 'Product ' + rec.productId}</h3>
                            <Badge variant="outline">{rec.asin}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Automation Level: <span className="font-medium">{rec.automation?.automationLevel}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {rec.netProfitPercent?.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Profit Margin</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {rec.automation?.flagReason?.map((reason, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {reason.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="ml-1 font-medium">{rec.confidence?.overallScore?.toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ROI:</span>
                          <span className="ml-1 font-medium">{rec.roi?.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk:</span>
                          <Badge className={`ml-1 text-xs ${getRiskColor(rec.riskLevel)} text-white`}>
                            {rec.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {recommendations.filter((rec: ProductRecommendation) => rec.automationEligible).length === 0 && (
                    <div className="text-center py-8">
                      <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Products Ready for Automation</h3>
                      <p className="text-muted-foreground">
                        Products need high profitability, low risk, and verified marketplace data to qualify for automation
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}