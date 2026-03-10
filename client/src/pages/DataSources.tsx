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
import { Plus, Database, Globe, FileText, Settings, Trash2, CheckCircle, Clock, AlertCircle, MapPin, MoreVertical, Edit, Power, PowerOff, Download, BookOpen, Package, Play, Loader2, RefreshCw, Search, RotateCcw, ImageIcon, ScanBarcode, Boxes, Weight } from "lucide-react";
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
  purpose: z.enum(["catalog", "inventory_pricing", "order_fulfillment", "catalog_search", "returns", "general"]).optional(),
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
      purpose: ((dataSource as any).purpose || "general") as any,
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
      purpose: ((dataSource as any).purpose || "general") as any,
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
      const updateData = {
        ...data,
        purpose: data.purpose || 'general',
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

        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purpose</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || "general"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="catalog">Catalog Import</SelectItem>
                  <SelectItem value="inventory_pricing">Inventory & Pricing Updates</SelectItem>
                  <SelectItem value="order_fulfillment">Order Fulfillment</SelectItem>
                  <SelectItem value="catalog_search">Catalog Search</SelectItem>
                  <SelectItem value="returns">Returns Processing</SelectItem>
                  <SelectItem value="general">General</SelectItem>
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
                          placeholder="/data/catalog.csv"
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
  const [fullImportSize, setFullImportSize] = useState<number | 'all'>(5000);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [selectedDataSourceForAutomation, setSelectedDataSourceForAutomation] = useState<DataSource | null>(null);
  const [loadingWalkthroughId, setLoadingWalkthroughId] = useState<string | null>(null);
  const [showEnrichmentPanel, setShowEnrichmentPanel] = useState(false);
  const [showImageEnrichmentPanel, setShowImageEnrichmentPanel] = useState(false);
  const [imageSource, setImageSource] = useState<'amazon' | 'walmart'>('amazon');
  const [showProductDataEnrichmentPanel, setShowProductDataEnrichmentPanel] = useState(false);
  const [pdeSupplierId, setPdeSupplierId] = useState<number | null>(null);
  const [pdeSources, setPdeSources] = useState({ amazon: true, walmart: true, upcitemdb: true, aiExtraction: false });
  const [pdeFields, setPdeFields] = useState({ upc: true, dimensions: true, weight: true });

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
    mutationFn: async ({ dataSourceId, limit }: { dataSourceId: number; limit: number | 'all' }) => {
      const body = limit === 'all' 
        ? { fullImport: true, limit: 0 }
        : { limit };
      const response = await apiRequest("POST", `/api/datasources/${dataSourceId}/sample-pull-with-mapping`, body);
      return response as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/search'] });
      setShowFullImportDialog(false);
      setSelectedDataSourceForImport(null);
      toast({
        title: "Full Catalog Import Complete",
        description: `Successfully imported ${data.productsImported || (fullImportSize === 'all' ? 'all' : fullImportSize)} products from supplier catalog`
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

  const { data: enrichmentStatus, refetch: refetchEnrichment } = useQuery({
    queryKey: ['/api/marketplace/ingram-micro/bulk-enrich/status'],
    refetchInterval: showEnrichmentPanel ? 2000 : false,
  });

  const startEnrichmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/marketplace/ingram-micro/bulk-enrich", {
        batchSize: 25,
        detailsPerBatch: 10,
        delayMs: 600,
      });
      return response as any;
    },
    onSuccess: () => {
      setShowEnrichmentPanel(true);
      refetchEnrichment();
      toast({
        title: "Enrichment Started",
        description: "Fetching rich product details from Ingram Micro API. This will run in the background."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive"
      });
    }
  });

  const stopEnrichmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/marketplace/ingram-micro/bulk-enrich/stop");
      return response as any;
    },
    onSuccess: () => {
      refetchEnrichment();
      toast({ title: "Enrichment Stopped", description: "The enrichment process has been stopped." });
    }
  });

  const { data: imageEnrichmentStatus, refetch: refetchImageEnrichment } = useQuery({
    queryKey: ['/api/marketplace/image-enrichment/status'],
    refetchInterval: showImageEnrichmentPanel ? 2000 : false,
  });

  const startImageEnrichmentMutation = useMutation({
    mutationFn: async (source: 'amazon' | 'walmart') => {
      const delayMs = source === 'walmart' ? 250 : 550;
      const response = await apiRequest("POST", "/api/marketplace/image-enrichment/start", { source, delayMs });
      return response as any;
    },
    onSuccess: () => {
      setShowImageEnrichmentPanel(true);
      refetchImageEnrichment();
      const sourceName = imageSource === 'amazon' ? 'Amazon' : 'Walmart';
      toast({
        title: "Image Enrichment Started",
        description: `Looking up product images from ${sourceName} via UPC codes. This will run in the background.`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start image enrichment",
        variant: "destructive"
      });
    }
  });

  const stopImageEnrichmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/marketplace/image-enrichment/stop");
      return response as any;
    },
    onSuccess: () => {
      refetchImageEnrichment();
      toast({ title: "Image Enrichment Stopped", description: "The image lookup process has been stopped." });
    }
  });

  const { data: pdePreviewData } = useQuery({
    queryKey: ['/api/marketplace/product-data-enrichment/preview-all'],
  });

  const { data: pdeStatus, refetch: refetchPdeStatus } = useQuery({
    queryKey: ['/api/marketplace/product-data-enrichment/status'],
    refetchInterval: showProductDataEnrichmentPanel ? 2000 : false,
  });

  const startPdeMutation = useMutation({
    mutationFn: async () => {
      const suppliersList = pdePreviewData as any[];
      const supplier = suppliersList?.find((s: any) => s.supplier_id === pdeSupplierId);
      const response = await apiRequest("POST", "/api/marketplace/product-data-enrichment/start", {
        supplierId: pdeSupplierId,
        supplierName: supplier?.supplier_name || 'Unknown',
        sources: pdeSources,
        fields: pdeFields,
        delayMs: 600,
      });
      return response as any;
    },
    onSuccess: () => {
      setShowProductDataEnrichmentPanel(true);
      refetchPdeStatus();
      toast({ title: "Product Data Enrichment Started", description: "Looking up UPCs, dimensions, and weight from multiple sources." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start enrichment", variant: "destructive" });
    }
  });

  const stopPdeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/marketplace/product-data-enrichment/stop");
      return response as any;
    },
    onSuccess: () => {
      refetchPdeStatus();
      toast({ title: "Enrichment Stopped", description: "Product data enrichment has been stopped." });
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
    
    const suppliersList = suppliers as any[];
    const supplier = suppliersList.find((s: any) => s.id === parseInt(newDataSource.supplier_id || newDataSource.supplierId));
    const supplierName = supplier?.name || newDataSource.name || 'Data source';
    
    setCurrentDataSource(newDataSource);

    if (newDataSource.purpose === 'catalog_search') {
      toast({
        title: "Data Source Created",
        description: `${supplierName} is ready. This data source uses API-based search and doesn't require field mapping.`
      });
      return;
    }
    
    toast({
      title: "Data Source Created",
      description: `${supplierName} is ready for field mapping`
    });

    startMappingWalkthrough(newDataSource.id);
  };

  const startMappingWalkthrough = async (dataSourceId: string) => {
    setLoadingWalkthroughId(dataSourceId);
    
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
    } finally {
      setLoadingWalkthroughId(null);
    }
  };

  const handleMappingComplete = async (mappings: any[]) => {
    try {
      const processedMappings = mappings.reduce((acc: Record<string, any>, mapping: any) => {
        if (mapping.sourceField) {
          if (mapping.targetField === 'partNumber') {
            acc['sku'] = `EDC${mapping.sourceField}`;
            acc['supplierPartNumber'] = mapping.sourceField;
          } else if (mapping.sourceField === '__COMPUTED__' && mapping.computed) {
            acc[mapping.targetField] = {
              computed: true,
              operation: mapping.computed.operation,
              sourceFields: mapping.computed.sourceFields
            };
          } else {
            acc[mapping.targetField] = mapping.sourceField;
          }
        }
        return acc;
      }, {} as Record<string, any>);

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
          purpose: currentDataSource?.purpose || 'catalog',
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

  const getPurposeBadge = (purpose: string | null | undefined) => {
    const config: Record<string, { label: string; icon: any; className: string }> = {
      catalog: { label: 'Catalog', icon: Database, className: 'bg-blue-100 text-blue-700 border-blue-200' },
      inventory_pricing: { label: 'Inventory & Pricing', icon: RefreshCw, className: 'bg-green-100 text-green-700 border-green-200' },
      order_fulfillment: { label: 'Order Fulfillment', icon: Package, className: 'bg-purple-100 text-purple-700 border-purple-200' },
      catalog_search: { label: 'Catalog Search', icon: Search, className: 'bg-amber-100 text-amber-700 border-amber-200' },
      returns: { label: 'Returns', icon: RotateCcw, className: 'bg-red-100 text-red-700 border-red-200' },
      general: { label: 'General', icon: Settings, className: 'bg-gray-100 text-gray-700 border-gray-200' },
    };
    const p = config[purpose || 'general'] || config.general;
    const Icon = p.icon;
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0 ${p.className}`}>
        <Icon className="w-2.5 h-2.5" />
        {p.label}
      </Badge>
    );
  };

  if (showMappingWalkthrough) {
    return (
      <main className="container mx-auto py-6 px-4 md:px-6">
        <MappingWalkthrough
          dataSourceId={currentDataSource?.id || ''}
          dataSourceName={currentDataSource?.name || 'Supplier'}
          sampleData={sampleData}
          purpose={currentDataSource?.purpose || 'general'}
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

      {/* Ingram Micro API Enrichment Panel */}
      <Card className="mb-6 border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                Ingram Micro API Enrichment
              </CardTitle>
              <CardDescription>
                Enrich imported products with rich details, real-time pricing, and inventory from the Ingram Micro API
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {(enrichmentStatus as any)?.status === 'running' ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => stopEnrichmentMutation.mutate()}
                  disabled={stopEnrichmentMutation.isPending}
                >
                  <Power className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setShowEnrichmentPanel(true);
                    startEnrichmentMutation.mutate();
                  }}
                  disabled={startEnrichmentMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${startEnrichmentMutation.isPending ? 'animate-spin' : ''}`} />
                  {startEnrichmentMutation.isPending ? 'Starting...' : 'Start Enrichment'}
                </Button>
              )}
              {(enrichmentStatus as any)?.status !== 'idle' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowEnrichmentPanel(!showEnrichmentPanel);
                    refetchEnrichment();
                  }}
                >
                  {showEnrichmentPanel ? 'Hide Details' : 'Show Details'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showEnrichmentPanel && (enrichmentStatus as any)?.status !== 'idle' && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={
                  (enrichmentStatus as any)?.status === 'running' ? 'default' :
                  (enrichmentStatus as any)?.status === 'completed' ? 'secondary' :
                  (enrichmentStatus as any)?.status === 'error' ? 'destructive' : 'outline'
                }>
                  {(enrichmentStatus as any)?.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {(enrichmentStatus as any)?.status?.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Phase: {(enrichmentStatus as any)?.phase || 'N/A'}
                </span>
              </div>
              
              {(enrichmentStatus as any)?.totalProducts > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress: {(enrichmentStatus as any)?.processed?.toLocaleString()} / {(enrichmentStatus as any)?.totalProducts?.toLocaleString()}</span>
                    <span>{Math.round(((enrichmentStatus as any)?.processed / (enrichmentStatus as any)?.totalProducts) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((enrichmentStatus as any)?.processed / (enrichmentStatus as any)?.totalProducts) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-700">{(enrichmentStatus as any)?.enriched?.toLocaleString() || 0}</div>
                  <div className="text-xs text-green-600">Enriched</div>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <div className="text-lg font-bold text-red-700">{(enrichmentStatus as any)?.errors?.toLocaleString() || 0}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-lg font-bold text-blue-700">{(enrichmentStatus as any)?.totalProducts?.toLocaleString() || 0}</div>
                  <div className="text-xs text-blue-600">Total Products</div>
                </div>
              </div>

              {(enrichmentStatus as any)?.startedAt && (
                <p className="text-xs text-muted-foreground">
                  Started: {new Date((enrichmentStatus as any).startedAt).toLocaleString()}
                  {(enrichmentStatus as any)?.completedAt && ` · Completed: ${new Date((enrichmentStatus as any).completedAt).toLocaleString()}`}
                </p>
              )}
              
              {(enrichmentStatus as any)?.errorMessage && (
                <p className="text-sm text-red-600">Error: {(enrichmentStatus as any).errorMessage}</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Product Data Enrichment Panel */}
      <Card className="mb-6 border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ScanBarcode className="w-5 h-5 text-emerald-600" />
                Product Data Enrichment
              </CardTitle>
              <CardDescription>
                Fill in missing UPCs, GTINs, and shipping dimensions using Amazon, Walmart, UPCitemdb, and AI
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {(pdeStatus as any)?.status === 'running' ? (
                <Button size="sm" variant="destructive" onClick={() => stopPdeMutation.mutate()} disabled={stopPdeMutation.isPending}>
                  <Power className="w-4 h-4 mr-1" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { setShowProductDataEnrichmentPanel(true); startPdeMutation.mutate(); }}
                  disabled={startPdeMutation.isPending || !pdeSupplierId}
                >
                  <ScanBarcode className={`w-4 h-4 mr-1 ${startPdeMutation.isPending ? 'animate-pulse' : ''}`} />
                  {startPdeMutation.isPending ? 'Starting...' : 'Start Enrichment'}
                </Button>
              )}
              {(pdeStatus as any)?.status !== 'idle' && (
                <Button size="sm" variant="outline" onClick={() => { setShowProductDataEnrichmentPanel(!showProductDataEnrichmentPanel); refetchPdeStatus(); }}>
                  {showProductDataEnrichmentPanel ? 'Hide Details' : 'Show Details'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {(pdeStatus as any)?.status !== 'running' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Supplier</Label>
                  <select
                    value={pdeSupplierId || ''}
                    onChange={(e) => setPdeSupplierId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select supplier...</option>
                    {(pdePreviewData as any[])?.map((s: any) => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name} ({parseInt(s.missing_upc).toLocaleString()} missing UPC)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Lookup Sources</Label>
                  <div className="space-y-1">
                    {[
                      { key: 'amazon' as const, label: 'Amazon SP-API', color: 'text-orange-600' },
                      { key: 'walmart' as const, label: 'Walmart API', color: 'text-blue-600' },
                      { key: 'upcitemdb' as const, label: 'UPCitemdb (100/day)', color: 'text-purple-600' },
                      { key: 'aiExtraction' as const, label: 'AI Description Extract', color: 'text-emerald-600' },
                    ].map(({ key, label, color }) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pdeSources[key]}
                          onChange={(e) => setPdeSources(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className={color}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Fields to Enrich</Label>
                  <div className="space-y-1">
                    {[
                      { key: 'upc' as const, label: 'UPC / GTIN / EAN', icon: ScanBarcode },
                      { key: 'dimensions' as const, label: 'Dimensions (L×W×H)', icon: Boxes },
                      { key: 'weight' as const, label: 'Weight', icon: Weight },
                    ].map(({ key, label, icon: Icon }) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pdeFields[key]}
                          onChange={(e) => setPdeFields(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {pdeSupplierId && (pdeStatus as any)?.status !== 'running' && (() => {
              const preview = (pdePreviewData as any[])?.find((s: any) => s.supplier_id === pdeSupplierId);
              if (!preview) return null;
              return (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-amber-50 rounded border border-amber-100">
                    <div className="text-lg font-bold text-amber-700">{parseInt(preview.missing_upc).toLocaleString()}</div>
                    <div className="text-xs text-amber-600">Missing UPC</div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded border border-purple-100">
                    <div className="text-lg font-bold text-purple-700">{parseInt(preview.missing_weight).toLocaleString()}</div>
                    <div className="text-xs text-purple-600">Missing Weight</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
                    <div className="text-lg font-bold text-emerald-700">{parseInt(preview.has_mpn).toLocaleString()}</div>
                    <div className="text-xs text-emerald-600">Have MPN (lookupable)</div>
                  </div>
                </div>
              );
            })()}

            {showProductDataEnrichmentPanel && (pdeStatus as any)?.status !== 'idle' && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    (pdeStatus as any)?.status === 'running' ? 'default' :
                    (pdeStatus as any)?.status === 'completed' ? 'secondary' :
                    (pdeStatus as any)?.status === 'stopped' ? 'outline' :
                    (pdeStatus as any)?.status === 'error' ? 'destructive' : 'outline'
                  }>
                    {(pdeStatus as any)?.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {(pdeStatus as any)?.status?.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{(pdeStatus as any)?.supplierName}</span>
                  {(pdeStatus as any)?.status === 'running' && (pdeStatus as any)?.processed > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ~{Math.round(((pdeStatus as any).totalProducts - (pdeStatus as any).processed) * 0.6 / 60)} min remaining
                    </span>
                  )}
                </div>

                {(pdeStatus as any)?.totalProducts > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress: {(pdeStatus as any)?.processed?.toLocaleString()} / {(pdeStatus as any)?.totalProducts?.toLocaleString()}</span>
                      <span>{Math.round(((pdeStatus as any)?.processed / (pdeStatus as any)?.totalProducts) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500 bg-emerald-500"
                        style={{ width: `${Math.min(100, ((pdeStatus as any)?.processed / (pdeStatus as any)?.totalProducts) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-700">{(pdeStatus as any)?.enriched?.toLocaleString() || 0}</div>
                    <div className="text-xs text-green-600">Enriched</div>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded">
                    <div className="text-lg font-bold text-yellow-700">{(pdeStatus as any)?.skipped?.toLocaleString() || 0}</div>
                    <div className="text-xs text-yellow-600">No Match</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-700">{(pdeStatus as any)?.errors?.toLocaleString() || 0}</div>
                    <div className="text-xs text-red-600">Errors</div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded">
                    <div className="text-lg font-bold text-blue-700">{(pdeStatus as any)?.totalProducts?.toLocaleString() || 0}</div>
                    <div className="text-xs text-blue-600">Total</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-xs font-medium text-gray-500 mb-2">Fields Found</div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-emerald-700">{(pdeStatus as any)?.fieldCounts?.upc || 0}</div>
                        <div className="text-xs text-gray-500">UPCs</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-700">{(pdeStatus as any)?.fieldCounts?.ean || 0}</div>
                        <div className="text-xs text-gray-500">EANs</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-700">{(pdeStatus as any)?.fieldCounts?.gtin || 0}</div>
                        <div className="text-xs text-gray-500">GTINs</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-700">{(pdeStatus as any)?.fieldCounts?.dimensions || 0}</div>
                        <div className="text-xs text-gray-500">Dims</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-700">{(pdeStatus as any)?.fieldCounts?.weight || 0}</div>
                        <div className="text-xs text-gray-500">Weight</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-xs font-medium text-gray-500 mb-2">Source Breakdown</div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div>
                        <div className="text-sm font-bold text-orange-600">{(pdeStatus as any)?.sourceCounts?.amazon || 0}</div>
                        <div className="text-xs text-gray-500">Amazon</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-blue-600">{(pdeStatus as any)?.sourceCounts?.walmart || 0}</div>
                        <div className="text-xs text-gray-500">Walmart</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-purple-600">{(pdeStatus as any)?.sourceCounts?.upcitemdb || 0}</div>
                        <div className="text-xs text-gray-500">UPCdb</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-600">{(pdeStatus as any)?.sourceCounts?.ai || 0}</div>
                        <div className="text-xs text-gray-500">AI</div>
                      </div>
                    </div>
                  </div>
                </div>

                {(pdeStatus as any)?.recentResults?.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-xs font-medium text-gray-500 mb-2">Recent Lookups</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(pdeStatus as any).recentResults.slice(0, 5).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {r.status === 'found' ? (
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          ) : r.status === 'error' ? (
                            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1 text-gray-700">{r.productName || r.mpn}</span>
                          {r.source && <Badge variant="outline" className="text-xs py-0">{r.source}</Badge>}
                          {r.upc && <span className="text-emerald-600 font-mono text-xs">{r.upc}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(pdeStatus as any)?.startedAt && (
                  <p className="text-xs text-muted-foreground">
                    Started: {new Date((pdeStatus as any).startedAt).toLocaleString()}
                    {(pdeStatus as any)?.completedAt && ` · Completed: ${new Date((pdeStatus as any).completedAt).toLocaleString()}`}
                  </p>
                )}

                {(pdeStatus as any)?.errorMessage && (
                  <p className="text-sm text-red-600">Error: {(pdeStatus as any).errorMessage}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Enrichment Panel */}
      <Card className="mb-6 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                Product Image Enrichment
              </CardTitle>
              <CardDescription>
                Look up product images using UPC codes from Amazon or Walmart for products that don't have images yet
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {(imageEnrichmentStatus as any)?.status !== 'running' && (
                <select
                  value={imageSource}
                  onChange={(e) => setImageSource(e.target.value as 'amazon' | 'walmart')}
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="amazon">Amazon</option>
                  <option value="walmart">Walmart</option>
                </select>
              )}
              {(imageEnrichmentStatus as any)?.status === 'running' ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => stopImageEnrichmentMutation.mutate()}
                  disabled={stopImageEnrichmentMutation.isPending}
                >
                  <Power className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className={imageSource === 'walmart' ? "bg-blue-700 hover:bg-blue-800" : "bg-orange-600 hover:bg-orange-700"}
                  onClick={() => {
                    setShowImageEnrichmentPanel(true);
                    startImageEnrichmentMutation.mutate(imageSource);
                  }}
                  disabled={startImageEnrichmentMutation.isPending || (enrichmentStatus as any)?.status === 'running'}
                >
                  <ImageIcon className={`w-4 h-4 mr-1 ${startImageEnrichmentMutation.isPending ? 'animate-pulse' : ''}`} />
                  {startImageEnrichmentMutation.isPending ? 'Starting...' : `Start via ${imageSource === 'amazon' ? 'Amazon' : 'Walmart'}`}
                </Button>
              )}
              {(imageEnrichmentStatus as any)?.status !== 'idle' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowImageEnrichmentPanel(!showImageEnrichmentPanel);
                    refetchImageEnrichment();
                  }}
                >
                  {showImageEnrichmentPanel ? 'Hide Details' : 'Show Details'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showImageEnrichmentPanel && (imageEnrichmentStatus as any)?.status !== 'idle' && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={
                  (imageEnrichmentStatus as any)?.status === 'running' ? 'default' :
                  (imageEnrichmentStatus as any)?.status === 'completed' ? 'secondary' :
                  (imageEnrichmentStatus as any)?.status === 'error' ? 'destructive' : 'outline'
                }>
                  {(imageEnrichmentStatus as any)?.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {(imageEnrichmentStatus as any)?.status?.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  via {(imageEnrichmentStatus as any)?.source === 'walmart' ? 'Walmart' : 'Amazon'}
                </Badge>
                {(imageEnrichmentStatus as any)?.status === 'running' && (
                  <span className="text-sm text-muted-foreground">
                    ~{Math.round(((imageEnrichmentStatus as any)?.totalProducts - (imageEnrichmentStatus as any)?.processed) * ((imageEnrichmentStatus as any)?.source === 'walmart' ? 0.25 : 0.55) / 60)} min remaining
                  </span>
                )}
              </div>
              
              {(imageEnrichmentStatus as any)?.totalProducts > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress: {(imageEnrichmentStatus as any)?.processed?.toLocaleString()} / {(imageEnrichmentStatus as any)?.totalProducts?.toLocaleString()}</span>
                    <span>{Math.round(((imageEnrichmentStatus as any)?.processed / (imageEnrichmentStatus as any)?.totalProducts) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ${(imageEnrichmentStatus as any)?.source === 'walmart' ? 'bg-blue-700' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(100, ((imageEnrichmentStatus as any)?.processed / (imageEnrichmentStatus as any)?.totalProducts) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-700">{(imageEnrichmentStatus as any)?.enriched?.toLocaleString() || 0}</div>
                  <div className="text-xs text-green-600">Images Found</div>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <div className="text-lg font-bold text-yellow-700">{(imageEnrichmentStatus as any)?.skipped?.toLocaleString() || 0}</div>
                  <div className="text-xs text-yellow-600">No Match</div>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <div className="text-lg font-bold text-red-700">{(imageEnrichmentStatus as any)?.errors?.toLocaleString() || 0}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-lg font-bold text-blue-700">{(imageEnrichmentStatus as any)?.totalProducts?.toLocaleString() || 0}</div>
                  <div className="text-xs text-blue-600">Need Images</div>
                </div>
              </div>

              {(imageEnrichmentStatus as any)?.startedAt && (
                <p className="text-xs text-muted-foreground">
                  Started: {new Date((imageEnrichmentStatus as any).startedAt).toLocaleString()}
                  {(imageEnrichmentStatus as any)?.completedAt && ` · Completed: ${new Date((imageEnrichmentStatus as any).completedAt).toLocaleString()}`}
                </p>
              )}
              
              {(imageEnrichmentStatus as any)?.errorMessage && (
                <p className="text-sm text-red-600">Error: {(imageEnrichmentStatus as any).errorMessage}</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

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

                  <div className="flex items-center gap-1.5 mt-1">
                    {getPurposeBadge(dataSource.purpose)}
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
                        disabled={loadingWalkthroughId === dataSource.id.toString()}
                        onClick={() => {
                          setCurrentDataSource(dataSource);
                          startMappingWalkthrough(dataSource.id.toString());
                        }}
                        data-testid={`button-mapping-walkthrough-${dataSource.id}`}
                      >
                        {loadingWalkthroughId === dataSource.id.toString() ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Connecting to SFTP...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            Field Mapping Walkthrough
                          </>
                        )}
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
              {([1000, 5000, 10000, 30000, 50000, 100000, 200000, 'all'] as const).map((size) => (
                <Button
                  key={String(size)}
                  variant={fullImportSize === size ? "default" : "outline"}
                  className={`h-12 ${size === 'all' ? 'col-span-2 border-emerald-300 hover:border-emerald-500' : ''}`}
                  onClick={() => setFullImportSize(size)}
                >
                  <div className="text-center">
                    <div className="font-semibold">
                      {size === 'all' ? 'All Products' : `${size.toLocaleString()} Products`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {size === 'all' ? 'Complete catalog — no limit' :
                       size <= 5000 ? 'Small catalog' : 
                       size <= 30000 ? 'Medium catalog' : 
                       'Large catalog'}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            {fullImportSize === 'all' || (typeof fullImportSize === 'number' && fullImportSize >= 100000) ? (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">Large Import</p>
                    <p className="text-amber-700">
                      {fullImportSize === 'all' 
                        ? 'This will import the entire supplier catalog with no limit. This may take several minutes depending on catalog size.'
                        : `Importing ${fullImportSize.toLocaleString()} products may take several minutes. Make sure field mappings are correct before proceeding.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
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
              {fullImportMutation.isPending ? "Importing..." : 
                fullImportSize === 'all' ? 'Import All Products' : 
                `Import ${fullImportSize.toLocaleString()} Products`}
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
                <li>Set catalog file path (e.g., /data/catalog.csv)</li>
                <li>Set inventory file path (e.g., /data/inventory.csv)</li>
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