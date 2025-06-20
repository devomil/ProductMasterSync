import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, Database, ArrowRight, Plus } from "lucide-react";

export default function SimpleTest() {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/health"],
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Master Data Management</h1>
        <p className="text-lg text-gray-600 mt-2">Centralized product information and supplier management system</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Database className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium ml-2">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    health?.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {health?.status || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">Database:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    health?.database === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {health?.database || "Unknown"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Package className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium ml-2">Products</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{products?.products?.length || 0}</div>
                <p className="text-xs text-gray-600">{products?.message || "No data available"}</p>
                <Button size="sm" className="mt-2" onClick={() => window.location.href = '/products'}>
                  Manage Products <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Users className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-medium ml-2">Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            {suppliersLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{suppliers?.suppliers?.length || 0}</div>
                <p className="text-xs text-gray-600">{suppliers?.message || "No data available"}</p>
                <Button size="sm" className="mt-2" onClick={() => window.location.href = '/suppliers'}>
                  Manage Suppliers <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/products'}>
                <Package className="h-4 w-4 mr-2" />
                Manage Product Catalog
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/suppliers'}>
                <Users className="h-4 w-4 mr-2" />
                Onboard New Suppliers
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/data-imports'}>
                <Database className="h-4 w-4 mr-2" />
                Import/Export Data
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/amazon-integration'}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Configure Amazon Integration
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Master Data Management</h4>
                <p className="text-sm text-gray-600">Centralized repository for product information, supplier data, and marketplace integration.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Amazon Integration</h4>
                <p className="text-sm text-gray-600">ASIN mapping, pricing analytics, and marketplace synchronization capabilities.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Data Quality</h4>
                <p className="text-sm text-gray-600">Validation rules, deduplication, and data completeness monitoring.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}