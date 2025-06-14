import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, Eye, ShoppingCart, Settings, Play, Pause, BarChart3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PurchasingStatus {
  isRunning: boolean;
  totalProducts: number;
  analyzedProducts: number;
  remainingProducts: number;
  currentBatch: number;
  estimatedTimeRemaining: string;
  rateLimit: {
    requestsPerHour: number;
    currentUsage: number;
    remainingRequests: number;
  };
  lastRun: string | null;
  nextScheduledRun: string | null;
}

interface PurchasingConfig {
  costThresholds: {
    maxProductCost: number;
    minProfitMargin: number;
    minMonthlyVolume: number;
  };
  priorityCategories: string[];
  riskTolerance: string;
  autoApprovalThreshold: number;
}

interface RecommendationSummary {
  summary: {
    totalAnalyzed: number;
    buyRecommendations: number;
    monitorRecommendations: number;
    avoidRecommendations: number;
    avgOpportunityScore: number;
  };
  topOpportunities: any[];
  riskProducts: any[];
  lastUpdated: string;
}

export default function AIPurchasing() {
  const [config, setConfig] = useState<PurchasingConfig>({
    costThresholds: {
      maxProductCost: 500000, // $5,000 in cents
      minProfitMargin: 20,
      minMonthlyVolume: 15
    },
    priorityCategories: ['Electronics', 'Automotive', 'Marine'],
    riskTolerance: 'medium',
    autoApprovalThreshold: 80
  });

  const queryClient = useQueryClient();

  // Get analysis status
  const { data: status } = useQuery({
    queryKey: ['/api/ai-purchasing/status'],
    refetchInterval: status?.isRunning ? 5000 : 30000 // Refresh every 5s when running
  });

  // Get recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['/api/ai-purchasing/recommendations'],
    refetchInterval: 30000
  });

  // Start analysis mutation
  const startAnalysis = useMutation({
    mutationFn: (params: { maxProducts: number; focusCategories?: string[] }) =>
      apiRequest('/api/ai-purchasing/start-analysis', { method: 'POST', body: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-purchasing/status'] });
    }
  });

  // Configure AI settings mutation
  const updateConfig = useMutation({
    mutationFn: (newConfig: PurchasingConfig) =>
      apiRequest('/api/ai-purchasing/configure', { method: 'POST', body: newConfig }),
    onSuccess: () => {
      // Configuration updated successfully
    }
  });

  const handleStartAnalysis = () => {
    startAnalysis.mutate({
      maxProducts: 1000,
      focusCategories: config.priorityCategories
    });
  };

  const handleConfigUpdate = () => {
    updateConfig.mutate(config);
  };

  const getProgressPercentage = () => {
    if (!status?.totalProducts) return 0;
    return (status.analyzedProducts / status.totalProducts) * 100;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'bg-green-500';
      case 'monitor': return 'bg-yellow-500';
      case 'avoid': return 'bg-red-500';
      case 'investigate': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Purchasing Intelligence</h1>
          <p className="text-muted-foreground">
            Automated product analysis and purchasing recommendations for your entire catalog
          </p>
        </div>
        <div className="flex gap-2">
          {status?.isRunning ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Play className="w-3 h-3 mr-1" />
              Analysis Running
            </Badge>
          ) : (
            <Button onClick={handleStartAnalysis} disabled={startAnalysis.isPending}>
              <Play className="w-4 h-4 mr-2" />
              Start AI Analysis
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Analysis Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analysis Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progress: {status?.analyzedProducts || 0} / {status?.totalProducts || 0} products</span>
                <span>{getProgressPercentage().toFixed(1)}% complete</span>
              </div>
              <Progress value={getProgressPercentage()} className="w-full" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {status?.totalProducts?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Products</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {status?.analyzedProducts?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {status?.currentBatch || '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Batch</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {status?.estimatedTimeRemaining || '0 min'}
                  </div>
                  <div className="text-sm text-muted-foreground">Time Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limiting Status */}
          <Card>
            <CardHeader>
              <CardTitle>Amazon API Rate Limiting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {status?.rateLimit?.requestsPerHour || 3600}
                  </div>
                  <div className="text-sm text-muted-foreground">Requests/Hour Limit</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">
                    {status?.rateLimit?.currentUsage || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {status?.rateLimit?.remainingRequests || 3600}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Metrics */}
          {recommendations && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Buy Recommendations</p>
                      <p className="text-2xl font-bold text-green-600">
                        {recommendations.summary?.buyRecommendations || 0}
                      </p>
                    </div>
                    <ShoppingCart className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monitor</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {recommendations.summary?.monitorRecommendations || 0}
                      </p>
                    </div>
                    <Eye className="w-8 h-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avoid</p>
                      <p className="text-2xl font-bold text-red-600">
                        {recommendations.summary?.avoidRecommendations || 0}
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Score</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {recommendations.summary?.avgOpportunityScore?.toFixed(1) || '0'}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Purchase Opportunities</CardTitle>
              <p className="text-sm text-muted-foreground">
                Products with the highest purchasing recommendation scores
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No recommendations available yet. Start an analysis to generate purchasing insights.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Products</CardTitle>
              <p className="text-sm text-muted-foreground">
                Products flagged with high risk factors
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No risk assessments available yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                AI Purchasing Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCost">Max Product Cost ($)</Label>
                  <Input
                    id="maxCost"
                    type="number"
                    value={config.costThresholds.maxProductCost / 100}
                    onChange={(e) => setConfig({
                      ...config,
                      costThresholds: {
                        ...config.costThresholds,
                        maxProductCost: parseInt(e.target.value) * 100
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minMargin">Min Profit Margin (%)</Label>
                  <Input
                    id="minMargin"
                    type="number"
                    value={config.costThresholds.minProfitMargin}
                    onChange={(e) => setConfig({
                      ...config,
                      costThresholds: {
                        ...config.costThresholds,
                        minProfitMargin: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minVolume">Min Monthly Volume</Label>
                  <Input
                    id="minVolume"
                    type="number"
                    value={config.costThresholds.minMonthlyVolume}
                    onChange={(e) => setConfig({
                      ...config,
                      costThresholds: {
                        ...config.costThresholds,
                        minMonthlyVolume: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="riskTolerance">Risk Tolerance</Label>
                  <Select
                    value={config.riskTolerance}
                    onValueChange={(value) => setConfig({ ...config, riskTolerance: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoApproval">Auto-Approval Threshold</Label>
                  <Input
                    id="autoApproval"
                    type="number"
                    min="0"
                    max="100"
                    value={config.autoApprovalThreshold}
                    onChange={(e) => setConfig({
                      ...config,
                      autoApprovalThreshold: parseInt(e.target.value)
                    })}
                  />
                </div>
              </div>

              <Button onClick={handleConfigUpdate} disabled={updateConfig.isPending}>
                Update Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}