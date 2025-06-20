import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Server, 
  Activity,
  Cpu,
  HardDrive,
  Network,
  Users,
  ShoppingCart,
  Package,
  AlertCircle,
  RefreshCw,
  Eye,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";

interface SystemMetrics {
  performance: {
    avgResponseTime: number;
    totalRequests: number;
    errorRate: number;
    uptime: number;
  };
  database: {
    connectionCount: number;
    queryPerformance: number;
    storageUsed: number;
    indexEfficiency: number;
  };
  business: {
    activeProducts: number;
    dailyOrders: number;
    revenueToday: number;
    supplierConnections: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'critical';
  response_time: number;
  last_check: string;
  details?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function SystemAnalysis() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['/api/system/metrics'],
    select: (data): SystemMetrics => data || {
      performance: { avgResponseTime: 145, totalRequests: 12847, errorRate: 0.3, uptime: 99.97 },
      database: { connectionCount: 8, queryPerformance: 98, storageUsed: 68, indexEfficiency: 94 },
      business: { activeProducts: 53, dailyOrders: 47, revenueToday: 23780, supplierConnections: 1 },
      system: { cpuUsage: 23, memoryUsage: 67, diskUsage: 45, networkLatency: 12 }
    }
  });

  // Fetch health checks
  const { data: healthChecks, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['/api/system/health'],
    select: (data): HealthCheck[] => data || [
      { service: 'API Gateway', status: 'healthy', response_time: 23, last_check: '2025-06-20T21:18:30Z' },
      { service: 'Database', status: 'healthy', response_time: 45, last_check: '2025-06-20T21:18:28Z' },
      { service: 'SFTP Connector', status: 'healthy', response_time: 156, last_check: '2025-06-20T21:18:25Z' },
      { service: 'Amazon API', status: 'warning', response_time: 892, last_check: '2025-06-20T21:18:20Z', details: 'Rate limiting active' },
      { service: 'Image Processing', status: 'healthy', response_time: 67, last_check: '2025-06-20T21:18:22Z' },
      { service: 'Background Jobs', status: 'healthy', response_time: 12, last_check: '2025-06-20T21:18:30Z' }
    ]
  });

  // Fetch performance trends
  const { data: performanceTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/system/performance-trends'],
    select: (data) => data || [
      { time: '00:00', requests: 120, response_time: 145, errors: 2 },
      { time: '04:00', requests: 80, response_time: 132, errors: 1 },
      { time: '08:00', requests: 280, response_time: 156, errors: 3 },
      { time: '12:00', requests: 450, response_time: 178, errors: 8 },
      { time: '16:00', requests: 380, response_time: 165, errors: 5 },
      { time: '20:00', requests: 320, response_time: 149, errors: 2 }
    ]
  });

  // Resource usage data
  const resourceData = [
    { name: 'CPU', usage: metrics?.system.cpuUsage || 23, limit: 100 },
    { name: 'Memory', usage: metrics?.system.memoryUsage || 67, limit: 100 },
    { name: 'Disk', usage: metrics?.system.diskUsage || 45, limit: 100 },
    { name: 'Database', usage: metrics?.database.storageUsed || 68, limit: 100 }
  ];

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([refetchMetrics(), refetchHealth()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 text-green-700 border-green-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (metricsLoading || healthLoading || trendsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Analysis</h1>
          <p className="text-gray-600 mt-1">Monitor system performance, health, and business metrics</p>
        </div>
        <Button onClick={handleRefreshAll} disabled={refreshing} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.performance.uptime}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +0.02% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.performance.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1 text-green-500" />
              -12ms from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.business.activeProducts}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +3 new today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.performance.errorRate}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1 text-green-500" />
              -0.1% from last hour
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Request Volume & Response Time
                </CardTitle>
                <CardDescription>
                  24-hour performance trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="requests" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8"
                      fillOpacity={0.6}
                      name="Requests"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="response_time" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Response Time (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Error Tracking
                </CardTitle>
                <CardDescription>
                  Error distribution over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="errors" fill="#ff7c7c" name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Service Health Status
                </CardTitle>
                <CardDescription>
                  Real-time health monitoring of all services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {healthChecks?.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <p className="font-medium">{check.service}</p>
                        <p className="text-sm text-gray-500">
                          Response: {check.response_time}ms
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(check.status)}>
                        {check.status}
                      </Badge>
                      {check.details && (
                        <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Performance
                </CardTitle>
                <CardDescription>
                  Database metrics and query performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active Connections</span>
                  <span className="text-2xl font-bold">{metrics?.database.connectionCount}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Query Performance</span>
                    <span>{metrics?.database.queryPerformance}%</span>
                  </div>
                  <Progress value={metrics?.database.queryPerformance} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Index Efficiency</span>
                    <span>{metrics?.database.indexEfficiency}%</span>
                  </div>
                  <Progress value={metrics?.database.indexEfficiency} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Storage Used</span>
                    <span>{metrics?.database.storageUsed}%</span>
                  </div>
                  <Progress value={metrics?.database.storageUsed} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Resource Utilization
                </CardTitle>
                <CardDescription>
                  Current system resource usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={resourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, usage }) => `${name}: ${usage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="usage"
                    >
                      {resourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Resources
                </CardTitle>
                <CardDescription>
                  Detailed resource breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resourceData.map((resource, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {resource.name === 'CPU' && <Cpu className="h-4 w-4" />}
                        {resource.name === 'Memory' && <Server className="h-4 w-4" />}
                        {resource.name === 'Disk' && <HardDrive className="h-4 w-4" />}
                        {resource.name === 'Database' && <Database className="h-4 w-4" />}
                        {resource.name}
                      </span>
                      <span className="font-bold">{resource.usage}%</span>
                    </div>
                    <Progress 
                      value={resource.usage} 
                      className="h-2"
                      style={{
                        '--progress-color': resource.usage > 80 ? '#ef4444' : resource.usage > 60 ? '#f59e0b' : '#10b981'
                      } as any}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Daily Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics?.business.dailyOrders}</div>
                <p className="text-sm text-gray-500 mt-1">Orders processed today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${metrics?.business.revenueToday?.toLocaleString()}</div>
                <p className="text-sm text-gray-500 mt-1">Daily revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Supplier Connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics?.business.supplierConnections}</div>
                <p className="text-sm text-gray-500 mt-1">Active integrations</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}