import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock, TrendingUp, Target, Database, RefreshCw, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface ScalingProgress {
  status: string;
  statusColor: string;
  isComplete: boolean;
  coveragePercent: number;
  intelligencePercent: number;
  totalEligible: number;
  mappedProducts: number;
  intelligenceRecords: number;
  completeChain: number;
  uniqueAsins: number;
  avgOpportunityScore: number | null;
  highOpportunityProducts: number;
  highMarginProducts: number;
  remaining: number;
  lastUpdated: string;
}

export default function AmazonScalingProgress() {
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState(5);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/purchasing/amazon-scaling-progress', Date.now()], // Force fresh data with timestamp
    queryFn: async () => {
      // Add cache-busting timestamp
      const timestamp = Date.now();
      const response = await fetch(`/api/purchasing/amazon-scaling-progress?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  const startScalingMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/marketplace/amazon/bulk-process', {
      batchSize: 20,
      delayBetweenRequests: 2000,
      maxProducts: 200
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/amazon-scaling-progress'] });
    }
  });

  // Live countdown timer to show refresh is working
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev === 1 ? 5 : prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const scalingData: ScalingProgress | null = data?.scaling || null;

  if (isLoading && !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center space-x-2 py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading scaling progress...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load scaling progress. Please try again. Error: {error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Use fallback data if needed
  if (!scalingData) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>
            Initializing Amazon scaling progress dashboard... Please wait.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (scalingData.isComplete) return <CheckCircle className="h-5 w-5" />;
    if (scalingData.coveragePercent >= 10) return <TrendingUp className="h-5 w-5" />;
    return <Clock className="h-5 w-5" />;
  };

  const getStatusVariant = () => {
    if (scalingData.isComplete) return 'default';
    if (scalingData.coveragePercent >= 50) return 'secondary';
    return 'outline';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Amazon Catalog Scaling Progress</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of Amazon marketplace synchronization across your entire catalog
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon()}
              <span>Current Status</span>
            </CardTitle>
            <Badge variant={getStatusVariant()}>
              {scalingData.status}
            </Badge>
          </div>
          <CardDescription>
            {scalingData.isComplete 
              ? 'Amazon catalog scaling has reached completion thresholds'
              : 'Amazon marketplace synchronization is actively running'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Amazon Coverage Progress</span>
                <span className="font-medium">{scalingData.coveragePercent}%</span>
              </div>
              <Progress value={scalingData.coveragePercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-1">
                {scalingData.mappedProducts} of {scalingData.totalEligible} products mapped to Amazon ASINs
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Market Intelligence</span>
                <span className="font-medium">{scalingData.intelligencePercent}%</span>
              </div>
              <Progress value={scalingData.intelligencePercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-1">
                {scalingData.intelligenceRecords} products with comprehensive market data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Excellent (95%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(scalingData.totalEligible * 0.95)}
            </div>
            <p className="text-xs text-muted-foreground">products target</p>
            {scalingData.coveragePercent >= 95 && (
              <Badge className="mt-2" variant="default">ACHIEVED</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Good (80%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(scalingData.totalEligible * 0.80)}
            </div>
            <p className="text-xs text-muted-foreground">products target</p>
            {scalingData.coveragePercent >= 80 && (
              <Badge className="mt-2" variant="secondary">ACHIEVED</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Moderate (50%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(scalingData.totalEligible * 0.50)}
            </div>
            <p className="text-xs text-muted-foreground">products target</p>
            {scalingData.coveragePercent >= 50 && (
              <Badge className="mt-2" variant="outline">ACHIEVED</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {scalingData.remaining}
            </div>
            <p className="text-xs text-muted-foreground">products to process</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marketplace Intelligence</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scalingData.uniqueAsins}</div>
            <p className="text-xs text-muted-foreground">unique ASINs discovered</p>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Complete chain: </span>
              <span className="font-medium">{scalingData.completeChain}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scalingData.highOpportunityProducts}</div>
            <p className="text-xs text-muted-foreground">products with 70+ opportunity score</p>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">High margin: </span>
              <span className="font-medium">{scalingData.highMarginProducts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Analysis</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scalingData.avgOpportunityScore || '—'}
              {scalingData.avgOpportunityScore && <span className="text-lg">/100</span>}
            </div>
            <p className="text-xs text-muted-foreground">average opportunity score</p>
            <div className="mt-2 text-sm text-green-600">
              Enhanced Purchasing AI Active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completion Status */}
      {scalingData.isComplete && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Scaling Complete!</strong> Your Amazon catalog scaling has reached {scalingData.status.toLowerCase()} 
            with {scalingData.coveragePercent}% coverage. Your Enhanced Purchasing AI now has comprehensive 
            marketplace intelligence across {scalingData.mappedProducts} products.
          </AlertDescription>
        </Alert>
      )}

      {!scalingData.isComplete && scalingData.remaining > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <strong>Scaling In Progress:</strong> {scalingData.remaining} products remaining to be processed. 
            The system is actively discovering Amazon marketplace data and building comprehensive market intelligence. 
            This page refreshes automatically every 5 seconds.
          </AlertDescription>
        </Alert>
      )}

      <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 p-3 rounded">
        <div className="font-semibold text-yellow-800 mb-2">🔄 Auto-Refresh Status</div>
        <div>Last updated: {new Date(scalingData.lastUpdated).toLocaleString()}</div>
        <div className="mt-2">
          <span className="font-mono bg-green-100 px-3 py-2 rounded text-green-800 font-bold text-lg">
            ⏱️ Next refresh: {countdown}s
          </span>
          <span className="ml-3 font-mono bg-blue-100 px-2 py-1 rounded text-blue-800">
            Mapped: {scalingData.mappedProducts}
          </span>
          <span className="ml-3 font-mono bg-purple-100 px-2 py-1 rounded text-purple-800">
            Auto-refresh: ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}