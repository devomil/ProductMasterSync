import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">MDM/PIM System Test</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <p>Loading...</p>
            ) : (
              <div>
                <p>Status: {health?.status || "Unknown"}</p>
                <p>Database: {health?.database || "Unknown"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <p>Loading...</p>
            ) : (
              <div>
                <p>Count: {products?.products?.length || 0}</p>
                <p>Message: {products?.message || "No data"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            {suppliersLoading ? (
              <p>Loading...</p>
            ) : (
              <div>
                <p>Count: {suppliers?.suppliers?.length || 0}</p>
                <p>Message: {suppliers?.message || "No data"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>• Manage product catalog</p>
            <p>• Onboard new suppliers</p>
            <p>• Import/export data</p>
            <p>• Configure Amazon marketplace integration</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}