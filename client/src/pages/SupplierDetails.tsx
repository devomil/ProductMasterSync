import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin,
  TestTube,
  Download,
  Upload,
  Settings,
  Activity,
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SupplierDetails() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [supplier, setSupplier] = useState<any>(null);
  const [testPullResults, setTestPullResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestPullOpen, setIsTestPullOpen] = useState(false);

  const supplierId = params.id;

  useEffect(() => {
    if (supplierId) {
      fetchSupplierDetails();
    }
  }, [supplierId]);

  const fetchSupplierDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/suppliers/${supplierId}`);
      if (response.ok) {
        const data = await response.json();
        setSupplier(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load supplier details",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load supplier details",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test pull mutation
  const testPullMutation = useMutation({
    mutationFn: async (limit: number = 100) => {
      const response = await apiRequest(`/api/suppliers/${supplierId}/test-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit })
      });
      return response;
    },
    onSuccess: (data) => {
      setTestPullResults(data);
      setIsTestPullOpen(true);
      toast({
        title: "Test Pull Complete",
        description: data.success ? `Retrieved ${data.sample_data?.length || 0} sample records` : "Test pull failed",
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error) => {
      toast({
        title: "Test Pull Failed",
        description: `Failed to test data pull: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleTestPull = (limit: number = 100) => {
    testPullMutation.mutate(limit);
  };

  const handleSampleBatch = () => {
    handleTestPull(10);
  };

  const handleFullTest = () => {
    handleTestPull(100);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Supplier not found</h1>
          <Button onClick={() => setLocation("/suppliers")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Suppliers
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/suppliers")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{supplier.name}</h1>
            <p className="text-gray-600">Supplier ID: {supplier.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleSampleBatch}
            disabled={testPullMutation.isPending}
            className="gap-2"
          >
            {testPullMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Sample Batch
          </Button>
          <Button 
            variant="outline"
            onClick={handleFullTest}
            disabled={testPullMutation.isPending}
            className="gap-2"
          >
            <Database className="h-4 w-4" />
            Full Test
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <Badge className={getStatusColor(supplier.onboarding_status || 'active')}>
                {supplier.onboarding_status || 'Active'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Code</p>
              <p className="text-sm">{supplier.code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Contact Name</p>
              <p className="text-sm">{supplier.contact_name || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href={`mailto:${supplier.contact_email}`} className="text-sm text-blue-600 hover:underline">
                {supplier.contact_email}
              </a>
            </div>
            {supplier.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${supplier.contact_phone}`} className="text-sm text-blue-600 hover:underline">
                  {supplier.contact_phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  {supplier.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.data_sources ? (
              <div className="space-y-2">
                {Object.keys(supplier.data_sources).map((sourceType) => (
                  <div key={sourceType} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm capitalize">{sourceType.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-500">No data sources configured</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
          <TabsTrigger value="test-history">Test History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Overview</CardTitle>
              <CardDescription>
                General information and recent activity for this supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Address</h4>
                  {supplier.address ? (
                    <div className="text-sm text-gray-600">
                      <p>{supplier.address.street}</p>
                      <p>{supplier.address.city}, {supplier.address.state} {supplier.address.postal_code}</p>
                      <p>{supplier.address.country}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No address provided</p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">
                    {supplier.notes || 'No notes available'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Source Configuration</CardTitle>
              <CardDescription>
                Configured data sources for this supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {supplier.data_sources ? (
                <div className="space-y-4">
                  {Object.entries(supplier.data_sources).map(([sourceType, config]: [string, any]) => (
                    <div key={sourceType} className="p-4 border rounded-lg">
                      <h4 className="font-medium capitalize mb-2">{sourceType.replace('_', ' ')}</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        {sourceType === 'ftp' && (
                          <>
                            <p><strong>Host:</strong> {config.host}</p>
                            <p><strong>Username:</strong> {config.username}</p>
                            <p><strong>Port:</strong> {config.port}</p>
                            <p><strong>Path:</strong> {config.path}</p>
                          </>
                        )}
                        {sourceType === 'api' && (
                          <>
                            <p><strong>URL:</strong> {config.url}</p>
                            <p><strong>Auth Type:</strong> {config.auth_type}</p>
                          </>
                        )}
                        {sourceType === 'file_upload' && (
                          <>
                            <p><strong>Allowed Extensions:</strong> {config.allowed_extensions?.join(', ')}</p>
                            <p><strong>Has Header:</strong> {config.has_header ? 'Yes' : 'No'}</p>
                            <p><strong>Delimiter:</strong> {config.delimiter}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No data sources configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test-history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Pull History</CardTitle>
              <CardDescription>
                Recent test pull attempts and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Test history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Settings</CardTitle>
              <CardDescription>
                Configuration and advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Settings panel will be available here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Pull Results Dialog */}
      {isTestPullOpen && testPullResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Test Pull Results - {testPullResults.success ? 'Success' : 'Failed'}
              </h2>
              <Button 
                variant="ghost" 
                onClick={() => setIsTestPullOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium">Message:</p>
                <p className="text-sm text-gray-600">{testPullResults.message}</p>
              </div>
              
              {testPullResults.sample_data && testPullResults.sample_data.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Sample Data ({testPullResults.sample_data.length} records):</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(testPullResults.sample_data[0] || {}).slice(0, 6).map((key) => (
                            <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testPullResults.sample_data.slice(0, 5).map((row: any, index: number) => (
                          <tr key={index} className="border-b">
                            {Object.keys(row).slice(0, 6).map((key) => (
                              <td key={key} className="px-3 py-2 text-sm text-gray-900 border-r">
                                {String(row[key]).substring(0, 50)}
                                {String(row[key]).length > 50 ? '...' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {testPullResults.error_details && (
                <div className="p-3 bg-red-50 rounded">
                  <p className="font-medium text-red-800">Error Details:</p>
                  <pre className="text-sm text-red-600 mt-1 whitespace-pre-wrap">
                    {JSON.stringify(testPullResults.error_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}