import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckCircle, AlertCircle, XCircle, TrendingUp, MapPin, Settings, Eye } from 'lucide-react';
import { Link } from 'wouter';

interface MarketplaceStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string;
  total_products: number;
  mapped_products: number;
  mapping_rules: number;
  api_calls_today: number;
  error_rate: number;
}

export default function MarketplaceOverview() {
  // Fetch marketplace status data
  const { data: marketplaces = [] } = useQuery({
    queryKey: ['/api/marketplace/status'],
    queryFn: async () => {
      // Mock data for now - replace with real API
      return [
        {
          name: 'Amazon',
          status: 'connected',
          last_sync: '2024-01-20T10:30:00Z',
          total_products: 59,
          mapped_products: 45,
          mapping_rules: 12,
          api_calls_today: 1240,
          error_rate: 2.1
        },
        {
          name: 'Walmart',
          status: 'disconnected',
          last_sync: '2024-01-19T15:20:00Z',
          total_products: 0,
          mapped_products: 0,
          mapping_rules: 0,
          api_calls_today: 0,
          error_rate: 0
        },
        {
          name: 'eBay',
          status: 'error',
          last_sync: '2024-01-20T08:15:00Z',
          total_products: 32,
          mapped_products: 28,
          mapping_rules: 8,
          api_calls_today: 450,
          error_rate: 15.3
        },
        {
          name: 'Newegg',
          status: 'disconnected',
          last_sync: null,
          total_products: 0,
          mapped_products: 0,
          mapping_rules: 0,
          api_calls_today: 0,
          error_rate: 0
        }
      ] as MarketplaceStatus[];
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Disconnected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const mappingData = marketplaces.map(m => ({
    name: m.name,
    mapped: m.mapped_products,
    total: m.total_products,
    percentage: m.total_products > 0 ? Math.round((m.mapped_products / m.total_products) * 100) : 0
  }));

  const apiCallsData = marketplaces.map(m => ({
    name: m.name,
    calls: m.api_calls_today,
    errors: Math.round(m.api_calls_today * (m.error_rate / 100))
  }));

  const pieColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Hub</h1>
          <p className="text-muted-foreground">Manage multi-platform marketplace integrations and data mapping</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Marketplaces</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketplaces.filter(m => m.status === 'connected').length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {marketplaces.length} total marketplaces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketplaces.reduce((sum, m) => sum + m.total_products, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              across all marketplaces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mapped Products</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketplaces.reduce((sum, m) => sum + m.mapped_products, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((marketplaces.reduce((sum, m) => sum + m.mapped_products, 0) / Math.max(1, marketplaces.reduce((sum, m) => sum + m.total_products, 0))) * 100)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls Today</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketplaces.reduce((sum, m) => sum + m.api_calls_today, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {marketplaces.reduce((sum, m) => sum + Math.round(m.api_calls_today * (m.error_rate / 100)), 0)} errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketplace Status */}
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Status</CardTitle>
          <CardDescription>Current connection status and mapping progress for each marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {marketplaces.map((marketplace) => (
              <div key={marketplace.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(marketplace.status)}
                  <div>
                    <h3 className="font-medium">{marketplace.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {marketplace.last_sync 
                        ? `Last sync: ${new Date(marketplace.last_sync).toLocaleDateString()}`
                        : 'Never synced'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {marketplace.mapped_products}/{marketplace.total_products} products mapped
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {marketplace.mapping_rules} mapping rules
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(marketplace.status)}
                    <Link href={`/marketplaces/${marketplace.name.toLowerCase()}`}>
                      <Button size="sm" variant="outline">
                        Configure
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Tabs defaultValue="mapping" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mapping">Mapping Progress</TabsTrigger>
          <TabsTrigger value="api">API Usage</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Mapping Progress by Marketplace</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mappingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mapped" fill="#8884d8" name="Mapped Products" />
                    <Bar dataKey="total" fill="#82ca9d" name="Total Products" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marketplace Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mappingData.filter(d => d.total > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {mappingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Calls Today</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={apiCallsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="calls" fill="#8884d8" name="Total Calls" />
                  <Bar dataKey="errors" fill="#ff8042" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {marketplaces.map((marketplace) => (
              <Card key={marketplace.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{marketplace.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Error Rate</span>
                      <span className={marketplace.error_rate > 10 ? 'text-red-500' : 'text-green-500'}>
                        {marketplace.error_rate}%
                      </span>
                    </div>
                    <Progress 
                      value={marketplace.error_rate} 
                      className="h-2"
                      max={20}
                    />
                    <div className="text-xs text-muted-foreground">
                      {Math.round(marketplace.api_calls_today * (marketplace.error_rate / 100))} errors today
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}