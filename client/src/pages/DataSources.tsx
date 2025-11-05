import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Plus, Database, Globe, FileText, Settings, Trash2, CheckCircle, Clock, AlertCircle, MapPin, MoreVertical, Edit, Power, PowerOff, Download, BookOpen, Package, Play } from "lucide-react";
import type { DataSource } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DataSourceWizard from "@/components/data-sources/DataSourceWizard";
import { MappingWalkthrough } from "@/components/mapping/MappingWalkthrough";

// Schema for editing data source
const editDataSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["sftp", "ftp", "api", "csv", "excel"]),
  config: z.object({
    host: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    url: z.string().optional(),
    apiKey: z.string().optional(),
    filePaths: z.array(z.object({
      id: z.string(),
      label: z.string(),
      path: z.string(),
    })).optional(),
  }).optional(),
});

type EditDataSourceFormData = z.infer<typeof editDataSourceSchema>;

// Edit Data Source Form Component
interface EditDataSourceFormProps {
  dataSource: DataSource;
  onClose: () => void;
}

function EditDataSourceForm({ dataSource, onClose }: EditDataSourceFormProps) {
  const [filePaths, setFilePaths] = useState<Array<{id: string, label: string, path: string}>>([]);

  // Parse config if it's a JSON string
  const parsedConfig = React.useMemo(() => {
    if (typeof dataSource.config === 'string') {
      try {
        return JSON.parse(dataSource.config);
      } catch (e) {
        console.error('Failed to parse config:', e);
        return {};
      }
    }
    return dataSource.config || {};
  }, [dataSource.config]);

  const form = useForm<EditDataSourceFormData>({
    resolver: zodResolver(editDataSourceSchema),
    defaultValues: {
      name: dataSource.name,
      description: (dataSource as any).description || "",
      type: dataSource.type as any,
      config: {
        host: parsedConfig?.host || "",
        port: parsedConfig?.port || 22,
        username: parsedConfig?.username || "",
        password: parsedConfig?.password ? "••••••••" : "", // Show masked password if exists
        url: parsedConfig?.url || "",
        apiKey: parsedConfig?.apiKey ? "••••••••" : "", // Show masked API key if exists
        filePaths: parsedConfig?.filePaths || [],
      },
    },
  });

  // Initialize file paths and reset form when parsedConfig changes
  React.useEffect(() => {
    const configFilePaths = parsedConfig?.filePaths || [];
    setFilePaths(configFilePaths);
    
    // Reset form with actual parsed config values
    form.reset({
      name: dataSource.name,
      description: (dataSource as any).description || "",
      type: dataSource.type as any,
      config: {
        host: parsedConfig?.host || "",
        port: parsedConfig?.port || 22,
        username: parsedConfig?.username || "",
        password: parsedConfig?.password ? "••••••••" : "", // Show masked password if exists
        url: parsedConfig?.url || "",
        apiKey: parsedConfig?.apiKey ? "••••••••" : "", // Show masked API key if exists
        filePaths: parsedConfig?.filePaths || [],
      },
    });
  }, [parsedConfig, dataSource, form]);

  const addFilePath = () => {
    const newPath = {
      id: Date.now().toString(),
      label: "",
      path: "",
    };
    setFilePaths([...filePaths, newPath]);
  };

  const removeFilePath = (id: string) => {
    setFilePaths(filePaths.filter(fp => fp.id !== id));
  };

  const updateFilePath = (id: string, field: 'label' | 'path', value: string) => {
    setFilePaths(filePaths.map(fp => 
      fp.id === id ? { ...fp, [field]: value } : fp
    ));
  };

  const updateMutation = useMutation({
    mutationFn: async (data: EditDataSourceFormData) => {
      // Include file paths in the config
      const updateData = {
        ...data,
        config: {
          ...data.config,
          filePaths: filePaths,
        },
      };
      return await apiRequest("PUT", `/api/datasources/${dataSource.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
      toast({
        title: "Success",
        description: "Data source updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update data source",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditDataSourceFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Data source name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data source type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="sftp">SFTP</SelectItem>
                  <SelectItem value="ftp">FTP</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Configuration fields based on type */}
        {(form.watch("type") === "sftp" || form.watch("type") === "ftp") && (
          <>
            <FormField
              control={form.control}
              name="config.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="ftp.example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder={form.watch("type") === "sftp" ? "22" : "21"} 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 22)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave blank to keep current password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {form.watch("type") === "api" && (
          <>
            <FormField
              control={form.control}
              name="config.url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com/data" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave blank to keep current API key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* File Paths Management for SFTP/FTP */}
        {(form.watch("type") === "sftp" || form.watch("type") === "ftp") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <FormLabel className="text-base font-medium">File Paths</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFilePath}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Path
              </Button>
            </div>
            
            {filePaths.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No file paths configured</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add multiple file paths for different product categories or time periods
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filePaths.map((filePath) => (
                  <div key={filePath.id} className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50">
                    <div>
                      <FormLabel className="text-sm font-medium text-gray-700 mb-1 block">Label</FormLabel>
                      <Input
                        placeholder="Main Catalog"
                        value={filePath.label}
                        onChange={(e) => updateFilePath(filePath.id, 'label', e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <FormLabel className="text-sm font-medium text-gray-700 mb-1 block">File Path</FormLabel>
                        <Input
                          placeholder="/ecodata/out/catalog.csv"
                          value={filePath.path}
                          onChange={(e) => updateFilePath(filePath.id, 'path', e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFilePath(filePath.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Add multiple file paths for different product categories or time periods
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Updating..." : "Update Data Source"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function DataSources() {
  const [showWizard, setShowWizard] = useState(false);
  const [showMappingWalkthrough, setShowMappingWalkthrough] = useState(false);
  const [currentDataSource, setCurrentDataSource] = useState<any>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [deletingDataSource, setDeletingDataSource] = useState<DataSource | null>(null);
  const [showSampleSizeDialog, setShowSampleSizeDialog] = useState(false);
  const [selectedDataSourceForSample, setSelectedDataSourceForSample] = useState<DataSource | null>(null);
  const [sampleSize, setSampleSize] = useState(50);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);
  const [showFullImportDialog, setShowFullImportDialog] = useState(false);
  const [selectedDataSourceForImport, setSelectedDataSourceForImport] = useState<DataSource | null>(null);
  const [fullImportSize, setFullImportSize] = useState(5000);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [selectedDataSourceForAutomation, setSelectedDataSourceForAutomation] = useState<DataSource | null>(null);

  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ['/api/datasources'], 
    select: (data) => data || []
  });

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/suppliers'],
    select: (data: any) => data || []
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

  // Mutation for testing connection
  const testConnectionMutation = useMutation({
    mutationFn: async (dataSourceId: number) => {
      const response = await apiRequest("POST", `/api/datasources/${dataSourceId}/test-connection`, {});
      return response as any;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Connection Successful",
        description: data.message || "Successfully connected to data source",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error?.details || "Failed to connect. Please check your settings.",
        variant: "destructive"
      });
    }
  });

  // Mutation for sample pull
  const samplePullMutation = useMutation({
    mutationFn: async ({ dataSourceId, limit }: { dataSourceId: number; limit: number }) => {
      const response = await apiRequest("POST", `/api/datasources/${dataSourceId}/sample-pull-with-mapping`, { 
        limit 
      });
      return response as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShowSampleSizeDialog(false);
      setSelectedDataSourceForSample(null);
      toast({
        title: "Sample Pull Complete",
        description: `Successfully imported ${data.productsImported || sampleSize} products from supplier data`
      });
    },
    onError: (error) => {
      toast({
        title: "Sample Pull Failed",
        description: "Failed to pull sample data. Please check your connection settings.",
        variant: "destructive"
      });
    }
  });

  // Mutation for full catalog import
  const fullImportMutation = useMutation({
    mutationFn: async ({ dataSourceId, limit }: { dataSourceId: number; limit: number }) => {
      const response = await apiRequest("POST", `/api/datasources/${dataSourceId}/sample-pull-with-mapping`, { 
        limit 
      });
      return response as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShowFullImportDialog(false);
      setSelectedDataSourceForImport(null);
      toast({
        title: "Full Catalog Import Complete",
        description: `Successfully imported ${data.productsImported || fullImportSize} products from supplier catalog`
      });
    },
    onError: (error) => {
      toast({
        title: "Full Import Failed",
        description: "Failed to import full catalog. Please check your connection settings.",
        variant: "destructive"
      });
    }
  });

  // Mutation for removing duplicate products
  const deduplicateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/products/deduplicate", { confirm: true });
      return response as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Duplicates Removed",
        description: `Removed ${data.removedCount || 0} duplicate products`
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove duplicate products",
        variant: "destructive"
      });
    }
  });

  // Mutation for clearing all products
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/products/clear-all", { confirm: true });
      return response as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShowClearConfirmDialog(false);
      toast({
        title: "Database Cleared",
        description: `Successfully removed all ${data.deletedCount || 0} products`
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear products",
        variant: "destructive"
      });
    }
  });

  const handleDeduplicate = () => {
    deduplicateMutation.mutate();
  };

  const handleClearAll = () => {
    setShowClearConfirmDialog(true);
  };

  const confirmClearAll = () => {
    clearAllMutation.mutate();
  };

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

  const handleSamplePullWithMapping = async (dataSource: DataSource) => {
    try {
      toast({
        title: "Starting Sample Pull",
        description: "Pulling 50 products using your saved field mappings..."
      });

      const response = await fetch(`/api/datasources/${dataSource.id}/sample-pull-with-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 })
      });
      
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Sample Pull Complete",
          description: `Successfully imported ${result.imported} products using field mappings!`
        });
        
        // Refresh products data
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      } else {
        throw new Error(result.message || 'Sample pull failed');
      }
    } catch (error) {
      console.error('Sample pull with mapping error:', error);
      toast({
        variant: "destructive",
        title: "Sample Pull Failed",
        description: error instanceof Error ? error.message : "Failed to pull sample data with mappings"
      });
    }
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
    if (dataSource.active) {
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
        <div className="flex gap-2">
          <Link href="/field-mapping-docs">
            <Button variant="outline" className="gap-2" data-testid="button-field-mapping-docs">
              <BookOpen size={16} />
              Field Mapping Docs
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={handleDeduplicate}
            className="gap-2"
            disabled={deduplicateMutation.isPending}
            data-testid="button-remove-duplicates"
          >
            <Trash2 size={16} />
            {deduplicateMutation.isPending ? "Removing..." : "Remove Duplicates"}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleClearAll}
            className="gap-2"
            disabled={clearAllMutation.isPending}
            data-testid="button-clear-all"
          >
            <Database size={16} />
            {clearAllMutation.isPending ? "Clearing..." : "Clear All Products"}
          </Button>
          <Button onClick={() => setShowWizard(true)} className="gap-2" data-testid="button-add-data-source">
            <Plus size={16} />
            Add Data Source
          </Button>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Products?</DialogTitle>
            <DialogDescription>
              This will permanently delete all products from the database. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 my-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Warning: This is a destructive operation</p>
                <p>All product data, including images, pricing, and inventory information will be permanently removed.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowClearConfirmDialog(false)}
              disabled={clearAllMutation.isPending}
              data-testid="button-cancel-clear"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmClearAll}
              disabled={clearAllMutation.isPending}
              data-testid="button-confirm-clear"
            >
              {clearAllMutation.isPending ? "Clearing..." : "Yes, Clear All Products"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      ) : (dataSources as DataSource[]).length === 0 ? (
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
          {(dataSources as DataSource[]).map((dataSource: DataSource) => {
            const supplier = (suppliers as any[]).find((s: any) => s.id === dataSource.supplierId);
            
            return (
              <Card key={dataSource.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(dataSource.type)}
                      <CardTitle className="text-lg">{dataSource.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(dataSource)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingDataSource(dataSource)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Connection
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => toggleStatusMutation.mutate({ 
                              id: dataSource.id, 
                              active: !dataSource.active 
                            })}
                          >
                            {dataSource.active ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletingDataSource(dataSource)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Source
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <CardDescription>
                    {`${dataSource.type.toUpperCase()} data source for ${supplier?.name || 'supplier'}`}
                  </CardDescription>
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
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium flex items-center gap-1">
                        {dataSource.active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            Online
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-gray-400" />
                            Disabled
                          </>
                        )}
                      </span>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="flex gap-2 mb-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => testConnectionMutation.mutate(dataSource.id)}
                          disabled={testConnectionMutation.isPending}
                          data-testid={`button-test-connection-${dataSource.id}`}
                        >
                          {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedDataSourceForSample(dataSource);
                            setShowSampleSizeDialog(true);
                          }}
                          disabled={samplePullMutation.isPending}
                          data-testid={`button-pull-sample-${dataSource.id}`}
                        >
                          {samplePullMutation.isPending ? "Pulling..." : "Pull Sample"}
                        </Button>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="flex-1 gap-1"
                          onClick={() => handleSamplePullWithMapping(dataSource)}
                        >
                          <Download className="w-4 h-4" />
                          Sample Pull with Mapping
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
                      
                      {/* Full Import & Automation (after mapping is complete) */}
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="flex-1 gap-1"
                          onClick={() => {
                            setSelectedDataSourceForImport(dataSource);
                            setShowFullImportDialog(true);
                          }}
                          data-testid={`button-full-import-${dataSource.id}`}
                        >
                          <Package className="w-4 h-4" />
                          Run Full Import
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 gap-1"
                          onClick={() => {
                            setSelectedDataSourceForAutomation(dataSource);
                            setShowAutomationDialog(true);
                          }}
                          data-testid={`button-automation-${dataSource.id}`}
                        >
                          <Play className="w-4 h-4" />
                          Set Up Automation
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

      {/* Edit Data Source Dialog */}
      <Dialog open={!!editingDataSource} onOpenChange={() => setEditingDataSource(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Source</DialogTitle>
            <DialogDescription>
              Update connection details and configuration for this data source.
            </DialogDescription>
          </DialogHeader>
          {editingDataSource && <EditDataSourceForm dataSource={editingDataSource} onClose={() => setEditingDataSource(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingDataSource} onOpenChange={() => setDeletingDataSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Data Source</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingDataSource?.name}"? This action cannot be undone and will permanently remove the data source configuration.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDataSource(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingDataSource && deleteMutation.mutate(deletingDataSource.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Data Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sample Size Selection Dialog */}
      <Dialog open={showSampleSizeDialog} onOpenChange={setShowSampleSizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Sample Size</DialogTitle>
            <DialogDescription>
              Choose how many products to pull from "{selectedDataSourceForSample?.name}". 
              Larger samples provide better testing coverage but may take longer to process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[50, 100, 500, 1000, 5000].map((size) => (
                <Button
                  key={size}
                  variant={sampleSize === size ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setSampleSize(size)}
                >
                  <div className="text-center">
                    <div className="font-semibold">{size} Products</div>
                    <div className="text-xs text-muted-foreground">
                      {size <= 100 ? "Quick test" : size <= 1000 ? "Medium test" : "Large scale"}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Sample Size Guide:</p>
                  <p className="text-blue-700">
                    • 50-100: Quick validation and field mapping
                    <br />
                    • 500-1000: Comprehensive testing before full import
                    <br />
                    • 5000: Large-scale validation for production readiness
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSampleSizeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedDataSourceForSample) {
                  samplePullMutation.mutate({
                    dataSourceId: selectedDataSourceForSample.id,
                    limit: sampleSize
                  });
                }
              }}
              disabled={samplePullMutation.isPending}
            >
              {samplePullMutation.isPending ? "Pulling Sample..." : `Pull ${sampleSize} Products`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Import Dialog */}
      <Dialog open={showFullImportDialog} onOpenChange={setShowFullImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Full Catalog Import</DialogTitle>
            <DialogDescription>
              Import the complete product catalog from "{selectedDataSourceForImport?.name}". 
              This will pull all products from the supplier's catalog file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[1000, 5000, 10000, 30000, 50000].map((size) => (
                <Button
                  key={size}
                  variant={fullImportSize === size ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setFullImportSize(size)}
                >
                  <div className="text-center">
                    <div className="font-semibold">{size.toLocaleString()} Products</div>
                    <div className="text-xs text-muted-foreground">
                      {size <= 5000 ? "Small catalog" : size <= 10000 ? "Medium catalog" : "Large catalog"}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Ready for Production</p>
                  <p className="text-green-700">
                    This will import your complete supplier catalog. Make sure field mappings are correct and sample data looks good before proceeding.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFullImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedDataSourceForImport) {
                  fullImportMutation.mutate({
                    dataSourceId: selectedDataSourceForImport.id,
                    limit: fullImportSize
                  });
                }
              }}
              disabled={fullImportMutation.isPending}
            >
              {fullImportMutation.isPending ? "Importing..." : `Import ${fullImportSize.toLocaleString()} Products`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automation Setup Dialog */}
      <Dialog open={showAutomationDialog} onOpenChange={setShowAutomationDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Up Automated Syncing</DialogTitle>
            <DialogDescription>
              Configure automatic catalog and inventory updates for "{selectedDataSourceForAutomation?.name}". 
              The system will keep your products in sync with the supplier's latest data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">File Paths Required</h4>
              <p className="text-sm text-blue-700 mb-3">
                You'll configure automation in the Inventory Management page where you can:
              </p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Set catalog file path (e.g., /eco8/out/catalog.csv)</li>
                <li>Set inventory file path (e.g., /eco8/out/inventory.csv)</li>
                <li>Configure sync schedules (e.g., every 2 hours for inventory)</li>
                <li>Set up error notifications</li>
              </ul>
            </div>
            <div className="border-l-4 border-yellow-400 bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800">
                <strong>Next Step:</strong> Click "Continue to Automation" below to navigate to the Inventory Management page where you can complete the automation setup with specific file paths and schedules.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationDialog(false)}>
              Cancel
            </Button>
            <Link href="/inventory-management">
              <Button onClick={() => setShowAutomationDialog(false)}>
                Continue to Automation →
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}