import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Database, Globe, FileText, Settings, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { DataSource } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import DataSourceWizard from "@/components/data-sources/DataSourceWizard";

export default function DataSources() {
  const [showWizard, setShowWizard] = useState(false);

  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ['/api/datasources'], 
    select: (data) => data || []
  });

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/suppliers'],
    select: (data) => data || []
  });

  const handleDataSourceCreated = (newDataSource: any) => {
    queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
    setShowWizard(false);
    
    // Find the supplier name to display in the toast
    const supplier = suppliers.find(s => s.id === parseInt(newDataSource.supplier_id || newDataSource.supplierId));
    const supplierName = supplier?.name || newDataSource.name || 'Data source';
    
    toast({
      title: "Data Source Created",
      description: `${supplierName} is ready for sample data testing`
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sftp':
      case 'ftp':
        return <Database className="w-4 h-4" />;
      case 'api':
        return <Globe className="w-4 h-4" />;
      case 'csv':
      case 'excel':
        return <FileText className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (dataSource: DataSource) => {
    // Check both 'active' and 'isActive' properties
    const isActive = dataSource.active ?? dataSource.isActive ?? true;
    if (isActive) {
      return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Active</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Inactive</Badge>;
  };

  if (showWizard) {
    return (
      <main className="container mx-auto py-6 px-4 md:px-6">
        <DataSourceWizard
          suppliers={suppliers}
          onComplete={handleDataSourceCreated}
          onCancel={() => setShowWizard(false)}
        />
      </main>
    );
  }

  return (
    <main className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-gray-500">Manage your data connections and sources</p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <Plus size={16} />
          Add Data Source
        </Button>
      </div>

      {isLoadingDataSources ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dataSources.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data sources found</h3>
            <p className="text-gray-500 mb-6">
              Create your first data source to start importing supplier data. Configure SFTP credentials, 
              test connections, and pull sample products before full imports.
            </p>
            <Button onClick={() => setShowWizard(true)} className="gap-2">
              <Plus size={16} />
              Create Your First Data Source
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataSources.map((dataSource: DataSource) => {
            const supplier = suppliers.find(s => s.id === dataSource.supplierId);
            
            return (
              <Card key={dataSource.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(dataSource.type)}
                      <CardTitle className="text-lg">{dataSource.name}</CardTitle>
                    </div>
                    {getStatusBadge(dataSource)}
                  </div>
                  <CardDescription>{dataSource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{dataSource.type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Supplier:</span>
                      <span className="font-medium">{supplier?.name || 'Unknown'}</span>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          Test Connection
                        </Button>
                        <Button size="sm" className="flex-1">
                          Pull Sample (50)
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Supplier Onboarding Workflow</h4>
            <p className="text-sm text-blue-700 mt-1">
              1. Add data source with supplier credentials → 2. Test connection → 3. Pull 50 sample products → 
              4. Review and map fields → 5. Proceed with full catalog import
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}