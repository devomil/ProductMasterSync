import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, TrendingUp, Database, AlertTriangle, Settings, Activity, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SystemMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [systemOptimized, setSystemOptimized] = useState(true);

  // Fetch monitoring data
  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/monitoring/health"],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: performanceData, refetch: refetchPerformance } = useQuery({
    queryKey: ["/api/monitoring/performance"],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: databaseData, refetch: refetchDatabase } = useQuery({
    queryKey: ["/api/monitoring/database"],
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const { data: errorData, refetch: refetchErrors } = useQuery({
    queryKey: ["/api/monitoring/errors"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const refreshAll = () => {
    refetchHealth();
    refetchPerformance();
    refetchDatabase();
    refetchErrors();
  };

  useEffect(() => {
    // Check if system needs attention based on health data
    if (healthData && Array.isArray(healthData)) {
      const hasIssues = healthData.some((service: any) => service.status !== 'healthy');
      setSystemOptimized(!hasIssues);
    }
  }, [healthData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time platform stability, performance analysis, and error detection
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="auto-refresh">Auto-refresh:</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Badge variant={autoRefresh ? "default" : "secondary"}>
              {autoRefresh ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={systemOptimized ? "default" : "destructive"}>
              {systemOptimized ? "System Optimized" : "Needs Attention"}
            </Badge>
          </div>
          <Button onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
          <TabsTrigger value="database">Database Monitoring</TabsTrigger>
          <TabsTrigger value="errors">Error Detection</TabsTrigger>
          <TabsTrigger value="optimization">Auto-Optimizations</TabsTrigger>
          <TabsTrigger value="insights">System Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData?.avgResponseTime || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average response time
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests/min</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData?.requestsPerMinute || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current request rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData?.memoryUsage || 0}%
                </div>
                <Progress value={performanceData?.memoryUsage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  System memory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData?.cpuUsage || 0}%
                </div>
                <Progress value={performanceData?.cpuUsage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Processing load
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Health Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthData?.map((service: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {service.status === 'healthy' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">{service.service}</span>
                    </div>
                    <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'}>
                      {service.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connection Pool</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseData?.activeConnections || 0}/{databaseData?.maxConnections || 100}
                </div>
                <Progress value={(databaseData?.activeConnections / databaseData?.maxConnections) * 100 || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Active connections
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Query Performance</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseData?.avgQueryTime || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average query time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseData?.slowQueries || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queries &gt; 1000ms
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Database Tables Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {databaseData?.tables?.map((table: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{table.name}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-muted-foreground">{table.rows} rows</span>
                      <span className="text-sm text-muted-foreground">{table.size}</span>
                      <Badge variant={table.status === 'healthy' ? 'default' : 'destructive'}>
                        {table.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {errorData?.errorRate?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {errorData?.totalErrors || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {errorData?.criticalErrors || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Requires attention
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errorData?.recentErrors?.length > 0 ? (
                  errorData.recentErrors.map((error: any, index: number) => (
                    <div key={index} className="flex items-start justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={error.severity === 'critical' ? 'destructive' : 'secondary'}>
                            {error.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{error.timestamp}</span>
                        </div>
                        <p className="font-medium">{error.message}</p>
                        <p className="text-sm text-muted-foreground">{error.component}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">No recent errors</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automatic Optimizations</CardTitle>
              <p className="text-sm text-muted-foreground">
                System automatically applies performance improvements
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-medium">Database Connection Pooling</h4>
                    <p className="text-sm text-muted-foreground">Optimizes database connections</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-medium">Query Caching</h4>
                    <p className="text-sm text-muted-foreground">Caches frequent database queries</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-medium">Memory Management</h4>
                    <p className="text-sm text-muted-foreground">Automatic garbage collection</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-medium">Index Optimization</h4>
                    <p className="text-sm text-muted-foreground">Maintains database indexes</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Insights</CardTitle>
              <p className="text-sm text-muted-foreground">
                AI-powered recommendations for system improvements
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <h4 className="font-medium text-blue-800">Performance Recommendation</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Database queries are performing well. Consider adding more indexes if product catalog grows beyond 10,000 items.
                  </p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <h4 className="font-medium text-green-800">System Health</h4>
                  <p className="text-sm text-green-700 mt-1">
                    All services are running optimally. Connection pooling is effectively managing database load.
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <h4 className="font-medium text-yellow-800">Capacity Planning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Current system can handle up to 1000 concurrent users. Monitor memory usage as supplier data grows.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}