import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, Database, Globe, FileText, Settings, Trash2, CheckCircle, Clock, AlertCircle, MapPin, MoreVertical, Edit, Power, PowerOff } from "lucide-react";
import type { DataSource } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import DataSourceWizard from "@/components/data-sources/DataSourceWizard";
import { MappingWalkthrough } from "@/components/mapping/MappingWalkthrough";

export default function DataSources() {
  const [showWizard, setShowWizard] = useState(false);
  const [showMappingWalkthrough, setShowMappingWalkthrough] = useState(false);
  const [currentDataSource, setCurrentDataSource] = useState<any>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [deletingDataSource, setDeletingDataSource] = useState<DataSource | null>(null);

  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ['/api/datasources'], 
    select: (data) => data || []
  });

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/suppliers'],
    select: (data) => data || []
  });

  // Mutation for toggling data source active status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const response = await apiRequest("PATCH", `/api/datasources/${id}/status`, { active });
      return response;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
      toast({
        title: "Status Updated",
        description: `Data source ${variables.active ? 'activated' : 'deactivated'} successfully`
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update data source status",
        variant: "destructive"
      });
    }
  });

  // Mutation for deleting data source
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/datasources/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
      setDeletingDataSource(null);
      toast({
        title: "Data Source Deleted",
        description: "Data source has been permanently removed"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete data source",
        variant: "destructive"
      });
    }
  });

  // Mutation for updating data source
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DataSource> }) => {
      const response = await apiRequest("PUT", `/api/datasources/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
      setEditingDataSource(null);
      toast({
        title: "Data Source Updated",
        description: "Changes have been saved successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update data source",
        variant: "destructive"
      });
    }
  });

  const handleDataSourceCreated = (newDataSource: any) => {
    queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
    setShowWizard(false);
    
    // Find the supplier name to display in the toast
    const suppliersList = suppliers as any[];
    const supplier = suppliersList.find((s: any) => s.id === parseInt(newDataSource.supplier_id || newDataSource.supplierId));
    const supplierName = supplier?.name || newDataSource.name || 'Data source';
    
    toast({
      title: "Data Source Created",
      description: `${supplierName} is ready for field mapping`
    });

    // Automatically start the mapping walkthrough
    setCurrentDataSource(newDataSource);
    startMappingWalkthrough(newDataSource.id);
  };

  const startMappingWalkthrough = async (dataSourceId: string) => {
    try {
      // Fetch actual sample data from the data source
      const response = await fetch(`/api/datasources/${dataSourceId}/sample-data`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch sample data');
      }
      
      const result = await response.json();
      let sampleData = result.data || [];
      
      // Fallback to demo data structure if API fails
      if (!sampleData.length) {
        sampleData = [
          {
            "Part Number": "010342",
            "Product Name": "Oil Filter - Mercury Marine",
            "Description": "High-performance oil filter for Mercury Marine engines, superior filtration technology",
            "UPC": "123456789012",
            "Manufacturer": "Mercury Marine", 
            "Price": "29.99",
            "Cost": "19.99",
            "Inventory": "150",
            "Weight": "2.5",
            "Dimensions": "4.5 x 4.5 x 6.2 inches",
            "Case Qty": "12",
            "Image URL": "https://productimageserver.com/images/010342_300.jpg",
            "Large Image": "https://productimageserver.com/images/010342_1000.jpg"
          },
        {
          "Part Number": "010343", 
          "Product Name": "Fuel Filter - Yamaha",
          "Description": "Premium fuel filter for Yamaha outboard motors, advanced water separation",
          "UPC": "123456789013",
          "Manufacturer": "Yamaha",
          "Price": "24.99",
          "Cost": "16.99", 
          "Inventory": "200",
          "Weight": "1.8",
          "Dimensions": "3.2 x 3.2 x 5.1 inches",
          "Case Qty": "24",
          "Image URL": "https://productimageserver.com/images/010343_300.jpg",
          "Large Image": "https://productimageserver.com/images/010343_1000.jpg"
        },
        {
          "Part Number": "010344",
          "Product Name": "Spark Plug - NGK",
          "Description": "Marine grade spark plug with corrosion-resistant coating for saltwater environments",
          "UPC": "123456789014",
          "Manufacturer": "NGK",
          "Price": "12.99",
          "Cost": "8.99",
          "Inventory": "500", 
          "Weight": "0.3",
          "Dimensions": "0.8 x 0.8 x 3.5 inches",
          "Case Qty": "8",
          "Image URL": "https://productimageserver.com/images/010344_300.jpg",
          "Large Image": "https://productimageserver.com/images/010344_1000.jpg"
        }
        ];
      }

      setSampleData(sampleData);
      setShowMappingWalkthrough(true);
      
    } catch (error) {
      console.error('Error starting mapping walkthrough:', error);
      toast({
        variant: "destructive",
        title: "Walkthrough Error",
        description: "Failed to start field mapping walkthrough"
      });
    }
  };

  const handleMappingComplete = async (mappings: any[]) => {
    try {
      // Process mappings and include EDC SKU auto-generation logic
      const processedMappings = mappings.reduce((acc, mapping) => {
        if (mapping.sourceField) {
          // Handle part number to EDC SKU conversion
          if (mapping.targetField === 'partNumber') {
            acc['sku'] = `EDC${mapping.sourceField}`; // Auto-generate EDC SKU
            acc['supplierPartNumber'] = mapping.sourceField; // Keep original part number
          } else {
            acc[mapping.targetField] = mapping.sourceField;
          }
        }
        return acc;
      }, {} as Record<string, string>);

      // Save the mapping template with EDC SKU generation
      const response = await fetch('/api/mapping-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${currentDataSource?.name} Mapping`,
          description: 'Auto-generated from mapping walkthrough with EDC SKU creation',
          sourceType: currentDataSource?.type || 'sftp',
          mappings: processedMappings,
          supplierId: currentDataSource?.supplier_id || currentDataSource?.supplierId,
          transformations: [
            {
              field: 'sku',
              type: 'prefix',
              value: 'EDC',
              sourceField: processedMappings.supplierPartNumber || 'partNumber',
              description: 'Auto-generate EDC SKU from supplier part number'
            }
          ]
        })
      });

      if (response.ok) {
        // Don't close walkthrough immediately - let it show completion screen
        // The user will close it manually using the "Close Walkthrough" button
        
        toast({
          title: "Mapping Complete",
          description: "Field mappings saved with EDC SKU auto-generation. Ready for sample pull testing."
        });
      } else {
        throw new Error('Failed to save mapping template');
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: "Failed to save field mappings"
      });
    }
  };

  const handleMappingCancel = () => {
    setShowMappingWalkthrough(false);
    setCurrentDataSource(null);
    setSampleData([]);
    
    // Refresh data sources to show updated status
    queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
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

  if (showMappingWalkthrough) {
    return (
      <main className="container mx-auto py-6 px-4 md:px-6">
        <MappingWalkthrough
          dataSourceId={currentDataSource?.id || ''}
          sampleData={sampleData}
          onComplete={handleMappingComplete}
          onCancel={handleMappingCancel}
        />
      </main>
    );
  }

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
                      <div className="flex gap-2 mb-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          Test Connection
                        </Button>
                        <Button size="sm" className="flex-1">
                          Pull Sample (50)
                        </Button>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full gap-1"
                        onClick={() => {
                          setCurrentDataSource(dataSource);
                          startMappingWalkthrough(dataSource.id.toString());
                        }}
                      >
                        <MapPin className="w-4 h-4" />
                        Field Mapping Walkthrough
                      </Button>
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