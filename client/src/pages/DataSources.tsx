import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, FilePlus, FileEdit, Link2, Server, Database, UploadCloud, FileCode, Settings, Plus, Trash } from "lucide-react";
import type { DataSource } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { v4 as uuidv4 } from "uuid";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Interface for remote path items
interface RemotePathItem {
  id: string; // used for UI manipulation
  label: string;
  path: string;
}

export default function DataSources() {
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState("csv");
  const [requiresPrivateKey, setRequiresPrivateKey] = useState(false);
  const [editRequiresPrivateKey, setEditRequiresPrivateKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  
  // For handling multiple remote paths
  const [remotePaths, setRemotePaths] = useState<RemotePathItem[]>([
    { id: crypto.randomUUID(), label: "Product Catalog", path: "/feeds/products.csv" }
  ]);
  const [editRemotePaths, setEditRemotePaths] = useState<RemotePathItem[]>([]);
  
  // Initialize remote paths when source type changes
  useEffect(() => {
    if (selectedSourceType === 'sftp' && remotePaths.length === 0) {
      // Add a default remote path if none exists
      setRemotePaths([{ id: crypto.randomUUID(), label: "Product Catalog", path: "/feeds/products.csv" }]);
    }
  }, [selectedSourceType, remotePaths.length]);
  
  // Initialize edit remote paths when data is loaded
  useEffect(() => {
    if (selectedDataSource && selectedDataSource.type === 'sftp') {
      const config = JSON.parse(selectedDataSource.config || '{}');
      
      if (config.remote_paths && Array.isArray(config.remote_paths)) {
        // Convert saved remote paths to our format with IDs
        setEditRemotePaths(
          config.remote_paths.map((path: any) => ({
            id: crypto.randomUUID(),
            label: path.label || '',
            path: path.path || ''
          }))
        );
      } else if (config.path) {
        // Legacy format - convert single path to our new format
        setEditRemotePaths([{
          id: crypto.randomUUID(),
          label: "Default",
          path: config.path
        }]);
      } else {
        // Fallback
        setEditRemotePaths([{
          id: crypto.randomUUID(),
          label: "Product Catalog",
          path: "/feeds/products.csv"
        }]);
      }
    }
  }, [selectedDataSource]);
  
  
  const { data: dataSources = [], isLoading, error } = useQuery({
    queryKey: ['/api/data-sources'],
    refetchOnWindowFocus: false
  });
  
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    refetchOnWindowFocus: false
  });
  
  const { data: mappingTemplates = [] } = useQuery({
    queryKey: ['/api/mapping-templates'],
    refetchOnWindowFocus: false
  });
  
  // Filter data sources based on active tab
  const filteredDataSources = dataSources.filter((dataSource: DataSource) => {
    if (activeTab === "all") return true;
    return dataSource.type === activeTab;
  });
  
  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case "csv":
      case "excel":
        return <FilePlus className="h-4 w-4 mr-1" />;
      case "api":
        return <Link2 className="h-4 w-4 mr-1" />;
      case "sftp":
      case "ftp":
        return <Server className="h-4 w-4 mr-1" />;
      case "edi_x12":
      case "edifact":
        return <FileCode className="h-4 w-4 mr-1" />;
      default:
        return <Database className="h-4 w-4 mr-1" />;
    }
  };
  
  const getSourceTypeName = (type: string) => {
    switch (type) {
      case "csv": return "CSV File";
      case "excel": return "Excel File";
      case "json": return "JSON File";
      case "xml": return "XML File";
      case "api": return "API Integration";
      case "sftp": return "SFTP Connection";
      case "ftp": return "FTP Connection";
      case "edi_x12": return "EDI X12";
      case "edifact": return "EDIFACT";
      case "manual": return "Manual Upload";
      default: return type.toUpperCase();
    }
  };
  
  const handleCreateDataSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;
    const supplierId = Number(formData.get('supplierId'));
    let config: any = {};
    
    // Handle SFTP configuration
    if (type === 'sftp') {
      const host = formData.get('sftp-host') as string;
      const portValue = formData.get('sftp-port') as string;
      const port = portValue ? parseInt(portValue, 10) : 22;
      const username = formData.get('sftp-username') as string;
      const usesPrivateKey = formData.get('requires-private-key') === 'on';
      
      // Basic validation for connection
      if (!host || !username) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill in all required SFTP connection fields"
        });
        return;
      }
      

      
      // Build the SFTP config with multiple paths
      config = {
        host,
        port,
        username,
        is_sftp: true,
        remote_paths: remotePaths.map(p => ({
          label: p.label,
          path: p.path
        }))
      };
      
      // Add authentication based on chosen method
      if (usesPrivateKey) {
        const privateKey = formData.get('sftp-private-key') as string;
        if (!privateKey) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Private key is required when using key authentication"
          });
          return;
        }
        config.private_key = privateKey;
      } else {
        const password = formData.get('sftp-password') as string;
        if (!password) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Password is required"
          });
          return;
        }
        config.password = password;
      }
    } else {
      // Handle other data source types with JSON
      const configText = formData.get('config') as string;
      try {
        config = JSON.parse(configText);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Invalid JSON",
          description: "The configuration must be valid JSON"
        });
        return;
      }
    }
    
    try {
      const dataSource = await apiRequest('/api/data-sources', 'POST', { 
        name, 
        type, 
        supplierId, 
        config,
        active: true 
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/data-sources'] });
      
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Data Source Created",
        description: `${name} was successfully created`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create data source: ${(error as Error).message}`
      });
    }
  };
  
  const handleEditDataSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedDataSource) return;
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const name = formData.get('name') as string;
    const supplierId = Number(formData.get('supplierId'));
    const active = formData.get('active') === 'true';
    const type = selectedDataSource.type; // Use the existing type
    let config: any = {};
    
    // Handle SFTP configuration similar to create form
    if (type === 'sftp') {
      const host = formData.get('sftp-host-edit') as string;
      const portValue = formData.get('sftp-port-edit') as string;
      const port = portValue ? parseInt(portValue, 10) : 22;
      const username = formData.get('sftp-username-edit') as string;
      const usesPrivateKey = formData.get('requires-private-key-edit') === 'on';
      
      // Basic validation for connection
      if (!host || !username) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill in all required SFTP connection fields"
        });
        return;
      }
      
      // Validate remote paths
      if (editRemotePaths.length === 0) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "At least one remote path is required"
        });
        return;
      }
      
      // Check that all paths have labels and are valid
      const invalidPaths = editRemotePaths.filter(p => !p.label || !p.path || !p.path.startsWith('/'));
      if (invalidPaths.length > 0) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "All remote paths must have labels and start with /"
        });
        return;
      }
      
      // Build the SFTP config with multiple paths
      config = {
        host,
        port,
        username,
        is_sftp: true,
        remote_paths: editRemotePaths.map(p => ({
          label: p.label,
          path: p.path
        }))
      };
      
      // Add authentication based on chosen method
      if (usesPrivateKey) {
        const privateKey = formData.get('sftp-private-key-edit') as string;
        if (!privateKey) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Private key is required when using key authentication"
          });
          return;
        }
        config.private_key = privateKey;
      } else {
        const password = formData.get('sftp-password-edit') as string;
        if (!password) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Password is required"
          });
          return;
        }
        config.password = password;
      }
    } else {
      // Handle other data source types with JSON
      const configText = formData.get('config') as string;
      try {
        config = JSON.parse(configText);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Invalid JSON",
          description: "The configuration must be valid JSON"
        });
        return;
      }
    }
    
    try {
      const dataSource = await apiRequest(`/api/data-sources/${selectedDataSource.id}`, 'PUT', { 
        name, 
        supplierId, 
        config,
        active
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/data-sources'] });
      
      setIsEditDialogOpen(false);
      setSelectedDataSource(null);
      setTestConnectionResult(null);
      
      toast({
        title: "Data Source Updated",
        description: `${name} was successfully updated`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update data source: ${(error as Error).message}`
      });
    }
  };
  
  const handleDeleteDataSource = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this data source? This action cannot be undone.")) {
      return;
    }
    
    try {
      await apiRequest(`/api/data-sources/${id}`, 'DELETE');
      
      queryClient.invalidateQueries({ queryKey: ['/api/data-sources'] });
      
      toast({
        title: "Data Source Deleted",
        description: "The data source was successfully deleted"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete data source: ${(error as Error).message}`
      });
    }
  };
  
  // Helper functions for managing remote paths
  const addRemotePath = () => {
    setRemotePaths([
      ...remotePaths,
      { id: crypto.randomUUID(), label: "", path: "" }
    ]);
  };
  
  const removeRemotePath = (id: string) => {
    // Don't allow removing the last path
    if (remotePaths.length <= 1) return;
    setRemotePaths(remotePaths.filter(p => p.id !== id));
  };
  
  const updateRemotePath = (id: string, field: 'label' | 'path', value: string) => {
    setRemotePaths(remotePaths.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  // Similar helpers for edit mode
  const addEditRemotePath = () => {
    setEditRemotePaths([
      ...editRemotePaths,
      { id: crypto.randomUUID(), label: "", path: "" }
    ]);
  };
  
  const removeEditRemotePath = (id: string) => {
    // Don't allow removing the last path
    if (editRemotePaths.length <= 1) return;
    setEditRemotePaths(editRemotePaths.filter(p => p.id !== id));
  };
  
  const updateEditRemotePath = (id: string, field: 'label' | 'path', value: string) => {
    setEditRemotePaths(editRemotePaths.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  const handleTestSFTPConnection = async () => {
    setTestConnectionResult(null);
    setIsTestingConnection(true);
    
    // Get all SFTP-related form fields
    const hostElement = document.getElementById('sftp-host') as HTMLInputElement;
    const portElement = document.getElementById('sftp-port') as HTMLInputElement;
    const usernameElement = document.getElementById('sftp-username') as HTMLInputElement;
    const passwordElement = document.getElementById('sftp-password') as HTMLInputElement;
    const privateKeyElement = document.getElementById('sftp-private-key') as HTMLTextAreaElement;
    
    // Validate basic connection info
    if (!hostElement?.value || !usernameElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required SFTP connection fields"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Validate remote paths
    if (remotePaths.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "At least one remote path is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Check that all paths have valid values
    const invalidPaths = remotePaths.filter(p => !p.label || !p.path || !p.path.startsWith('/'));
    if (invalidPaths.length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "All remote paths must have labels and start with /"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // For testing, we'll use the first path in the list
    const testPath = remotePaths[0].path;
    
    // Determine authentication method
    const usesPrivateKey = requiresPrivateKey;
    if (usesPrivateKey && !privateKeyElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Private key is required when using key authentication"
      });
      setIsTestingConnection(false);
      return;
    }
    
    if (!usesPrivateKey && !passwordElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Build credentials object
    const credentials = {
      host: hostElement.value,
      port: portElement.value ? parseInt(portElement.value, 10) : 22,
      username: usernameElement.value,
      remoteDir: pathElement.value || '/',
      ...(usesPrivateKey 
        ? { privateKey: privateKeyElement.value }
        : { password: passwordElement.value }
      )
    };
    
    try {
      const result = await apiRequest('/api/connections/test', 'POST', {
        type: 'sftp',
        credentials
      });
      
      setTestConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to SFTP server"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: result.message || "Could not connect to SFTP server"
        });
      }
    } catch (error) {
      setTestConnectionResult({
        success: false,
        message: `Error: ${(error as Error).message}`
      });
      
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: `Failed to test connection: ${(error as Error).message}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const handleEditClick = (dataSource: DataSource) => {
    setSelectedDataSource(dataSource);
    setIsEditDialogOpen(true);
    setTestConnectionResult(null);
    
    // Initialize form state based on the data source type
    if (dataSource.type === 'sftp' && dataSource.config) {
      try {
        const config = dataSource.config as any;
        
        // Check if the config includes private key
        setEditRequiresPrivateKey(!!config.private_key);
        
        // Initialize remote paths from config if available
        if (Array.isArray(config.remote_paths) && config.remote_paths.length > 0) {
          // Create path objects with unique IDs
          const paths = config.remote_paths.map((path: any) => ({
            id: uuidv4(),
            label: path.label || '',
            path: path.path || '/'
          }));
          setEditRemotePaths(paths);
        } else {
          // Fallback for legacy data source with single path
          setEditRemotePaths([{
            id: uuidv4(),
            label: 'Default',
            path: config.path || config.remoteDir || '/'
          }]);
        }
      } catch (e) {
        // Config parsing error, assume defaults
        setEditRequiresPrivateKey(false);
        setEditRemotePaths([{
          id: uuidv4(),
          label: 'Default',
          path: '/'
        }]);
      }
    }
  };
  
  const handleTestSFTPConnectionEdit = async () => {
    setTestConnectionResult(null);
    setIsTestingConnection(true);
    
    // Get all SFTP-related form fields from the edit form
    const hostElement = document.getElementById('sftp-host-edit') as HTMLInputElement;
    const portElement = document.getElementById('sftp-port-edit') as HTMLInputElement;
    const usernameElement = document.getElementById('sftp-username-edit') as HTMLInputElement;
    const passwordElement = document.getElementById('sftp-password-edit') as HTMLInputElement;
    const privateKeyElement = document.getElementById('sftp-private-key-edit') as HTMLTextAreaElement;
    
    // Validate basic connection info
    if (!hostElement?.value || !usernameElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required SFTP connection fields"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Validate remote paths
    if (editRemotePaths.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "At least one remote path is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Check that all paths have valid values
    const invalidPaths = editRemotePaths.filter(p => !p.label || !p.path || !p.path.startsWith('/'));
    if (invalidPaths.length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "All remote paths must have labels and start with /"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // For testing, we'll use the first path in the list
    const testPath = editRemotePaths[0].path;
    
    // Determine authentication method
    const usesPrivateKey = editRequiresPrivateKey;
    if (usesPrivateKey && !privateKeyElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Private key is required when using key authentication"
      });
      setIsTestingConnection(false);
      return;
    }
    
    if (!usesPrivateKey && !passwordElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Build credentials object
    const credentials = {
      host: hostElement.value,
      port: portElement.value ? parseInt(portElement.value, 10) : 22,
      username: usernameElement.value,
      remoteDir: pathElement.value || '/',
      ...(usesPrivateKey 
        ? { privateKey: privateKeyElement.value }
        : { password: passwordElement.value }
      )
    };
    
    try {
      const result = await apiRequest('/api/connections/test', 'POST', {
        type: 'sftp',
        credentials
      });
      
      setTestConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to SFTP server"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: result.message || "Could not connect to SFTP server"
        });
      }
    } catch (error) {
      setTestConnectionResult({
        success: false,
        message: `Error: ${(error as Error).message}`
      });
      
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: `Failed to test connection: ${(error as Error).message}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading data sources...</div>;
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load data sources: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Data Sources</h1>
          <p className="text-gray-500">Manage your product data integration sources</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-2" />
          Add Data Source
        </Button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Sources</TabsTrigger>
          <TabsTrigger value="csv">CSV/Excel</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="edi_x12">EDI</TabsTrigger>
          <TabsTrigger value="sftp">SFTP/FTP</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          {filteredDataSources.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No data sources found. Click "Add Data Source" to create one.
              </CardContent>
            </Card>
          ) : (
            filteredDataSources.map((dataSource: DataSource) => {
              const supplierName = suppliers.find((s: any) => s.id === dataSource.supplierId)?.name || 'Unknown';
              
              return (
                <Card key={dataSource.id} className={!dataSource.active ? "opacity-70" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="flex items-center">
                          {getSourceTypeIcon(dataSource.type)}
                          {dataSource.name}
                        </CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <span className="font-medium mr-2">Source Type:</span> 
                          {getSourceTypeName(dataSource.type)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center">
                        {dataSource.active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mr-2">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 mr-2">
                            Inactive
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(dataSource)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Supplier</h4>
                        <p>{supplierName}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Last Updated</h4>
                        <p>{new Date(dataSource.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Configuration</h4>
                      <pre className="text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-24">
                        {JSON.stringify(dataSource.config, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
      
      {/* Create Data Source Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
            <DialogDescription>
              Configure a new data source for importing product data.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateDataSource}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" className="col-span-3" required />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select 
                  name="type" 
                  required 
                  defaultValue="csv"
                  onValueChange={(value) => setSelectedSourceType(value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="excel">Excel File</SelectItem>
                    <SelectItem value="json">JSON File</SelectItem>
                    <SelectItem value="xml">XML File</SelectItem>
                    <SelectItem value="api">API Integration</SelectItem>
                    <SelectItem value="sftp">SFTP Connection</SelectItem>
                    <SelectItem value="ftp">FTP Connection</SelectItem>
                    <SelectItem value="edi_x12">EDI X12</SelectItem>
                    <SelectItem value="edifact">EDIFACT</SelectItem>
                    <SelectItem value="manual">Manual Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="supplierId" className="text-right">Supplier</Label>
                <Select name="supplierId" required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedSourceType === "sftp" ? (
                <div className="grid gap-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-md font-medium">SFTP Configuration</h3>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-host" className="text-right">Host</Label>
                    <Input 
                      id="sftp-host" 
                      name="sftp-host" 
                      className="col-span-3" 
                      placeholder="sftp.example.com" 
                      required 
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-port" className="text-right">Port</Label>
                    <Input 
                      id="sftp-port" 
                      name="sftp-port" 
                      className="col-span-3" 
                      type="number" 
                      placeholder="22" 
                      defaultValue="22" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-username" className="text-right">Username</Label>
                    <Input 
                      id="sftp-username" 
                      name="sftp-username" 
                      className="col-span-3" 
                      required 
                    />
                  </div>
                  
                  {!requiresPrivateKey && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-password" className="text-right">Password</Label>
                      <Input 
                        id="sftp-password" 
                        name="sftp-password" 
                        className="col-span-3" 
                        type="password" 
                        required={!requiresPrivateKey}
                      />
                    </div>
                  )}
                  
                  <div className="grid gap-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-md font-medium">Remote Paths</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addRemotePath}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Path
                      </Button>
                    </div>

                    {remotePaths.length === 0 ? (
                      <div className="p-4 text-center border rounded-md border-dashed">
                        No remote paths. Click "Add Path" to add one.
                      </div>
                    ) : (
                      remotePaths.map((path, index) => (
                        <div key={path.id} className="grid gap-4 p-3 border rounded-md bg-white">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Path {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRemotePath(path.id)}
                              disabled={remotePaths.length <= 1}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor={`path-label-${path.id}`} className="text-right">Label</Label>
                            <Input 
                              id={`path-label-${path.id}`}
                              value={path.label}
                              onChange={(e) => updateRemotePath(path.id, 'label', e.target.value)}
                              className="col-span-3" 
                              placeholder="Products" 
                            />
                          </div>
                          
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor={`path-${path.id}`} className="text-right">Path</Label>
                            <Input 
                              id={`path-${path.id}`}
                              value={path.path}
                              onChange={(e) => updateRemotePath(path.id, 'path', e.target.value)}
                              className="col-span-3" 
                              placeholder="/feeds/products.csv" 
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="text-right">Authentication</div>
                    <div className="col-span-3 flex items-center space-x-2">
                      <Checkbox 
                        id="requires-private-key" 
                        name="requires-private-key"
                        checked={requiresPrivateKey}
                        onCheckedChange={(checked) => setRequiresPrivateKey(checked === true)}
                      />
                      <Label htmlFor="requires-private-key">Requires private key authentication</Label>
                    </div>
                  </div>
                  
                  {requiresPrivateKey && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-private-key" className="text-right align-top mt-2">Private Key</Label>
                      <Textarea 
                        id="sftp-private-key" 
                        name="sftp-private-key" 
                        className="col-span-3 font-mono" 
                        rows={4}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" 
                        required={requiresPrivateKey}
                      />
                    </div>
                  )}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleTestSFTPConnection}
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? "Testing..." : "Test Connection"}
                  </Button>
                  
                  {testConnectionResult && (
                    <Alert variant={testConnectionResult.success ? "default" : "destructive"}>
                      <AlertTitle>
                        {testConnectionResult.success ? "Connection Successful" : "Connection Failed"}
                      </AlertTitle>
                      <AlertDescription>
                        {testConnectionResult.message}
                        {testConnectionResult.success && testConnectionResult.details && (
                          <div className="mt-2 text-xs">
                            <p>Found {testConnectionResult.details.totalFiles || 0} files in directory</p>
                            {testConnectionResult.details.directoryContents && (
                              <div className="mt-1 bg-gray-50 p-2 rounded">
                                {testConnectionResult.details.directoryContents.map((item: any, index: number) => (
                                  <div key={index} className="truncate">{item.name}</div>
                                ))}
                                {(testConnectionResult.details.totalFiles || 0) > 5 && (
                                  <div className="text-gray-500 mt-1">
                                    + {(testConnectionResult.details.totalFiles || 0) - 5} more files
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="config" className="text-right align-top mt-2">Configuration</Label>
                  <Textarea 
                    id="config" 
                    name="config" 
                    className="col-span-3 font-mono" 
                    rows={8}
                    placeholder="{}"
                    defaultValue="{}"
                    required 
                  />
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Data Source</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Data Source Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Data Source</DialogTitle>
            <DialogDescription>
              Update data source configuration.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDataSource && (
            <form onSubmit={handleEditDataSource}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Name</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    className="col-span-3" 
                    defaultValue={selectedDataSource.name}
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-type" className="text-right">Type</Label>
                  <Input 
                    id="edit-type" 
                    className="col-span-3" 
                    value={getSourceTypeName(selectedDataSource.type)}
                    disabled
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-supplierId" className="text-right">Supplier</Label>
                  <Select name="supplierId" defaultValue={selectedDataSource.supplierId.toString()}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-active" className="text-right">Status</Label>
                  <Select name="active" defaultValue={selectedDataSource.active ? "true" : "false"}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedDataSource.type === "sftp" ? (
                  <div className="grid gap-4 border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-md font-medium">SFTP Configuration</h3>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-host-edit" className="text-right">Host</Label>
                      <Input 
                        id="sftp-host-edit" 
                        name="sftp-host-edit" 
                        className="col-span-3" 
                        placeholder="sftp.example.com" 
                        defaultValue={(selectedDataSource.config as any)?.host || ''}
                        required 
                      />
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-port-edit" className="text-right">Port</Label>
                      <Input 
                        id="sftp-port-edit" 
                        name="sftp-port-edit" 
                        className="col-span-3" 
                        type="number" 
                        placeholder="22" 
                        defaultValue={(selectedDataSource.config as any)?.port || 22} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-username-edit" className="text-right">Username</Label>
                      <Input 
                        id="sftp-username-edit" 
                        name="sftp-username-edit" 
                        className="col-span-3" 
                        defaultValue={(selectedDataSource.config as any)?.username || ''}
                        required 
                      />
                    </div>
                    
                    {!editRequiresPrivateKey && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sftp-password-edit" className="text-right">Password</Label>
                        <Input 
                          id="sftp-password-edit" 
                          name="sftp-password-edit" 
                          className="col-span-3" 
                          type="password" 
                          defaultValue={(selectedDataSource.config as any)?.password || ''}
                          required={!editRequiresPrivateKey}
                        />
                      </div>
                    )}
                    
                    <div className="grid gap-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-md font-medium">Remote Paths</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={addEditRemotePath}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Path
                        </Button>
                      </div>

                      {editRemotePaths.length === 0 ? (
                        <div className="p-4 text-center border rounded-md border-dashed">
                          No remote paths. Click "Add Path" to add one.
                        </div>
                      ) : (
                        editRemotePaths.map((path, index) => (
                          <div key={path.id} className="grid gap-4 p-3 border rounded-md bg-white">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Path {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEditRemotePath(path.id)}
                                disabled={editRemotePaths.length <= 1}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor={`edit-path-label-${path.id}`} className="text-right">Label</Label>
                              <Input 
                                id={`edit-path-label-${path.id}`}
                                value={path.label}
                                onChange={(e) => updateEditRemotePath(path.id, 'label', e.target.value)}
                                className="col-span-3" 
                                placeholder="Products" 
                              />
                            </div>
                            
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor={`edit-path-${path.id}`} className="text-right">Path</Label>
                              <Input 
                                id={`edit-path-${path.id}`}
                                value={path.path}
                                onChange={(e) => updateEditRemotePath(path.id, 'path', e.target.value)}
                                className="col-span-3" 
                                placeholder="/feeds/products.csv" 
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <div className="text-right">Authentication</div>
                      <div className="col-span-3 flex items-center space-x-2">
                        <Checkbox 
                          id="requires-private-key-edit" 
                          name="requires-private-key-edit"
                          checked={editRequiresPrivateKey}
                          onCheckedChange={(checked) => setEditRequiresPrivateKey(checked === true)}
                        />
                        <Label htmlFor="requires-private-key-edit">Requires private key authentication</Label>
                      </div>
                    </div>
                    
                    {editRequiresPrivateKey && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sftp-private-key-edit" className="text-right align-top mt-2">Private Key</Label>
                        <Textarea 
                          id="sftp-private-key-edit" 
                          name="sftp-private-key-edit" 
                          className="col-span-3 font-mono" 
                          rows={4}
                          placeholder="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" 
                          defaultValue={(selectedDataSource.config as any)?.private_key || ''}
                          required={editRequiresPrivateKey}
                        />
                      </div>
                    )}
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleTestSFTPConnectionEdit}
                      disabled={isTestingConnection}
                    >
                      {isTestingConnection ? "Testing..." : "Test Connection"}
                    </Button>
                    
                    {testConnectionResult && (
                      <Alert variant={testConnectionResult.success ? "default" : "destructive"}>
                        <AlertTitle>
                          {testConnectionResult.success ? "Connection Successful" : "Connection Failed"}
                        </AlertTitle>
                        <AlertDescription>
                          {testConnectionResult.message}
                          {testConnectionResult.success && testConnectionResult.details && (
                            <div className="mt-2 text-xs">
                              <p>Found {testConnectionResult.details.totalFiles || 0} files in directory</p>
                              {testConnectionResult.details.directoryContents && (
                                <div className="mt-1 bg-gray-50 p-2 rounded">
                                  {testConnectionResult.details.directoryContents.map((item: any, index: number) => (
                                    <div key={index} className="truncate">{item.name}</div>
                                  ))}
                                  {(testConnectionResult.details.totalFiles || 0) > 5 && (
                                    <div className="text-gray-500 mt-1">
                                      + {(testConnectionResult.details.totalFiles || 0) - 5} more files
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-config" className="text-right align-top mt-2">Configuration</Label>
                    <Textarea 
                      id="edit-config" 
                      name="config" 
                      className="col-span-3 font-mono" 
                      rows={8}
                      defaultValue={JSON.stringify(selectedDataSource.config, null, 2)}
                      required 
                    />
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => handleDeleteDataSource(selectedDataSource.id)}
                >
                  Delete
                </Button>
                
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setSelectedDataSource(null);
                    }}
                    className="mr-2"
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Update</Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}