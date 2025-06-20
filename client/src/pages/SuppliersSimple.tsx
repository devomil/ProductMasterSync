import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, Building, Mail, Phone, TestTube, Eye, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SuppliersSimple() {
  const [searchTerm, setSearchTerm] = useState("");
  const [testPullResults, setTestPullResults] = useState<any>(null);
  const [isTestPullOpen, setIsTestPullOpen] = useState(false);
  const [testingSupplier, setTestingSupplier] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  // Test pull mutation
  const testPullMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      const response = await apiRequest(`/api/suppliers/${supplierId}/test-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 })
      });
      return response;
    },
    onSuccess: (data, supplierId) => {
      setTestPullResults(data);
      setIsTestPullOpen(true);
      setTestingSupplier(null);
      toast({
        title: "Test Pull Complete",
        description: data.success ? `Retrieved ${data.sample_data?.length || 0} sample records` : "Test pull failed",
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error) => {
      setTestingSupplier(null);
      toast({
        title: "Test Pull Failed",
        description: `Failed to test data pull: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleViewDetails = (supplierId: number) => {
    window.location.href = `/suppliers/${supplierId}/details`;
  };

  const handleManage = (supplierId: number) => {
    setTestingSupplier(supplierId);
    testPullMutation.mutate(supplierId);
  };

  const filteredSuppliers = suppliers?.filter((supplier: any) => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-gray-600 mt-1">Manage your supplier relationships and data sources</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search suppliers by name, contact, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !suppliers || suppliers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
              <p className="text-gray-600 mb-4">
                Start building your supplier network by adding your first supplier.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier: any) => (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Building className="h-5 w-5 mr-2 text-blue-600" />
                    {supplier.name}
                  </CardTitle>
                  <div className="space-y-1 text-sm text-gray-600">
                    {supplier.contact_email && (
                      <div className="flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {supplier.contact_email}
                      </div>
                    )}
                    {supplier.contact_phone && (
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {supplier.contact_phone}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Status:</span> 
                      <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                        supplier.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {supplier.code && (
                      <div><span className="font-medium">Code:</span> {supplier.code}</div>
                    )}
                    {supplier.contact_name && (
                      <div><span className="font-medium">Contact:</span> {supplier.contact_name}</div>
                    )}
                    <div className="pt-2 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-1"
                        onClick={() => handleViewDetails(supplier.id)}
                      >
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 gap-1"
                        onClick={() => handleManage(supplier.id)}
                        disabled={testingSupplier === supplier.id}
                      >
                        {testingSupplier === supplier.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <TestTube className="h-3 w-3" />
                        )}
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Button variant="outline" className="justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Onboard New Supplier
              </Button>
              <Button variant="outline" className="justify-start">
                <Building className="h-4 w-4 mr-2" />
                Bulk Import Suppliers
              </Button>
              <Button variant="outline" className="justify-start">
                <Search className="h-4 w-4 mr-2" />
                Advanced Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Suppliers:</span>
                <span className="font-medium">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending Approval:</span>
                <span className="font-medium">1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Products:</span>
                <span className="font-medium">225</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">This Month:</span>
                <span className="font-medium text-green-600">+15%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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