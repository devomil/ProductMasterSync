import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Search, 
  Target, 
  BarChart3, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Database,
  GitMerge
} from 'lucide-react';

interface DeduplicationStats {
  totalProducts: number;
  potentialUpcDuplicates: number;
  potentialMpnDuplicates: number;
}

interface DeduplicationResult {
  success: boolean;
  message: string;
  results: {
    created: number;
    updated: number;
    skipped: number;
    totalProcessed: number;
  };
}

export default function AdvancedDeduplication() {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get deduplication statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DeduplicationStats>({
    queryKey: ['/api/products/deduplication-stats'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Run advanced deduplication
  const deduplicationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/products/advanced-deduplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Deduplication failed');
      return response.json();
    },
    onSuccess: (data: DeduplicationResult) => {
      setIsRunning(false);
      toast({
        title: "✅ Advanced Deduplication Complete",
        description: `Created: ${data.results.created}, Updated: ${data.results.updated}, Skipped: ${data.results.skipped}`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products/deduplication-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error) => {
      setIsRunning(false);
      toast({
        variant: "destructive",
        title: "❌ Deduplication Failed",
        description: error.message
      });
    }
  });

  const handleRunDeduplication = () => {
    setIsRunning(true);
    deduplicationMutation.mutate();
  };

  const duplicateRisk = stats ? 
    ((stats.potentialUpcDuplicates + stats.potentialMpnDuplicates) / stats.totalProducts * 100) : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Advanced Deduplication
          </h1>
          <p className="text-muted-foreground mt-2">
            Intelligent product deduplication with multiple matching strategies
          </p>
        </div>
        
        <Button 
          onClick={handleRunDeduplication}
          disabled={isRunning || deduplicationMutation.isPending}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Run Advanced Deduplication
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategies">Matching Strategies</TabsTrigger>
          <TabsTrigger value="results">Results & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.totalProducts?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products in Master Catalog
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential UPC Duplicates</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {statsLoading ? '...' : stats?.potentialUpcDuplicates || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products with duplicate UPC codes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential MPN Duplicates</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {statsLoading ? '...' : stats?.potentialMpnDuplicates || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products with duplicate manufacturer part numbers
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Duplicate Risk Assessment
              </CardTitle>
              <CardDescription>
                Analysis of potential duplicate products in your catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Duplicate Risk Level</span>
                  <span className="font-medium">{duplicateRisk.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={duplicateRisk} 
                  className={`h-2 ${duplicateRisk > 15 ? 'text-red-600' : duplicateRisk > 5 ? 'text-orange-600' : 'text-green-600'}`}
                />
              </div>
              
              {duplicateRisk > 15 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    High duplicate risk detected. Running advanced deduplication is recommended.
                  </AlertDescription>
                </Alert>
              )}

              {duplicateRisk <= 5 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Low duplicate risk. Your catalog is well-maintained!
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Strategy 1: USIN Matching
                </CardTitle>
                <CardDescription>Highest Priority - Exact Match</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Exact Match
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Matches products by Unique Supplier Identification Number (USIN). 
                    This is the most reliable method for identifying authentic duplicates.
                  </p>
                  <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                    IF product.usin === existing.usin → UPDATE
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-blue-600" />
                  Strategy 2: UPC + MPN Matching
                </CardTitle>
                <CardDescription>High Confidence - Dual Verification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Dual Match
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Combines Universal Product Code (UPC) with Manufacturer Part Number (MPN) 
                    for high-confidence duplicate detection.
                  </p>
                  <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                    IF upc + mpn === existing → UPDATE
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-orange-600" />
                  Strategy 3: Fuzzy Name Matching
                </CardTitle>
                <CardDescription>Smart Text Analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Fuzzy Match
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Uses PostgreSQL similarity algorithms to match products with similar names 
                    from the same supplier (80%+ similarity threshold).
                  </p>
                  <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                    IF similarity(name, existing.name) > 0.8 → UPDATE
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  Strategy 4: New Product Creation
                </CardTitle>
                <CardDescription>Fallback for Unique Products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    Create New
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    When no matches are found using any strategy, creates a new product entry 
                    with proper supplier relationships.
                  </p>
                  <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                    IF no_matches_found → CREATE
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {deduplicationMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Latest Deduplication Results
                </CardTitle>
                <CardDescription>
                  Results from the most recent deduplication run
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {deduplicationMutation.data.results.created}
                    </div>
                    <div className="text-sm text-muted-foreground">Created</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {deduplicationMutation.data.results.updated}
                    </div>
                    <div className="text-sm text-muted-foreground">Updated</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {deduplicationMutation.data.results.skipped}
                    </div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {deduplicationMutation.data.results.totalProcessed}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Processed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Process Flow</CardTitle>
              <CardDescription>
                How the advanced deduplication engine processes your products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">1</div>
                  <div>
                    <div className="font-medium">SFTP Import Detection</div>
                    <div className="text-sm text-muted-foreground">New products from SFTP imports are automatically processed</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600">2</div>
                  <div>
                    <div className="font-medium">Multi-Strategy Matching</div>
                    <div className="text-sm text-muted-foreground">Each product runs through 4 matching strategies in priority order</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-600">3</div>
                  <div>
                    <div className="font-medium">Smart Decision Making</div>
                    <div className="text-sm text-muted-foreground">Products are either updated (if match found) or created as new entries</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-600">4</div>
                  <div>
                    <div className="font-medium">Supplier Relationship Management</div>
                    <div className="text-sm text-muted-foreground">Maintains accurate supplier-product relationships and pricing data</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}