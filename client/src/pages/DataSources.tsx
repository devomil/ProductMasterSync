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
  const [isPullingSampleData, setIsPullingSampleData] = useState(false);
  const [sampleData, setSampleData] = useState<{ 
    success: boolean; 
    message: string; 
    data?: any[]; 
    filename?: string;
    fileType?: string;
    remote_path?: string;
    total_records?: number;
  } | null>(null);
  
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
      const dataSource = await apiRequest('POST', '/api/data-sources', { 
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
      const dataSource = await apiRequest('PUT', `/api/data-sources/${selectedDataSource.id}`, { 
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
      await apiRequest('DELETE', `/api/data-sources/${id}`);
      
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
  
  const handlePullSampleData = async () => {
    // Clear previous sample data
    setSampleData(null);
    setIsPullingSampleData(true);
    
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
      setIsPullingSampleData(false);
      return;
    }
    
    // Validate remote paths
    if (remotePaths.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "At least one remote path is required"
      });
      setIsPullingSampleData(false);
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
      setIsPullingSampleData(false);
      return;
    }
    
    // Auth validation
    const usesPrivateKey = requiresPrivateKey;
    if (usesPrivateKey && !privateKeyElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Private key is required when using key authentication"
      });
      setIsPullingSampleData(false);
      return;
    } else if (!usesPrivateKey && !passwordElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password is required"
      });
      setIsPullingSampleData(false);
      return;
    }
    
    // Prepare credentials
    const credentials = {
      host: hostElement.value,
      port: portElement.value ? parseInt(portElement.value, 10) : 22,
      username: usernameElement.value,
      remote_paths: remotePaths,
      requiresPrivateKey: usesPrivateKey,
      ...(usesPrivateKey 
        ? { privateKey: privateKeyElement.value }
        : { password: passwordElement.value }
      )
    };
    
    try {
      // Make the request to pull sample data
      const response = await fetch('/api/connections/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sftp',
          credentials,
          supplier_id: 1, // Hardcoded for now
          limit: 10 // Only pull 10 records for sample
        }),
        credentials: 'include',
      });
      
      // Parse the JSON response
      const result = await response.json();
      console.log('SFTP sample data pull response:', result);
      
      // Update the state with the result
      setSampleData(result);
      
      // Display appropriate toast based on result
      if (result.success) {
        toast({
          title: "Sample Data Retrieved",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Retrieve Sample Data",
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error pulling sample data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pull sample data. Please check your connection settings."
      });
    } finally {
      setIsPullingSampleData(false);
    }
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
    
    // Reset sample data when testing connection
    setSampleData(null);
    
    // Auth validation
    const usesPrivateKey = requiresPrivateKey;
    if (usesPrivateKey && !privateKeyElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Private key is required when using key authentication"
      });
      setIsTestingConnection(false);
      return;
    } else if (!usesPrivateKey && !passwordElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Prepare credentials
    const credentials = {
      host: hostElement.value,
      port: portElement.value ? parseInt(portElement.value, 10) : 22,
      username: usernameElement.value,
      remote_paths: remotePaths,
      ...(usesPrivateKey 
        ? { privateKey: privateKeyElement.value }
        : { password: passwordElement.value }
      )
    };
    
    try {
      // First, make the request to test the connection
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sftp',
          credentials
        }),
        credentials: 'include',
      });
      
      // Parse the JSON response
      const result = await response.json();
      console.log('SFTP test connection response:', result);
      
      // Update the state with the result
      setTestConnectionResult(result);
      
      // Display appropriate toast based on result
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
      // Handle any errors in the request
      console.error('SFTP test connection error:', error);
      
      setTestConnectionResult({
        success: false,
        message: (error as Error).message || "Connection failed"
      });
      
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: (error as Error).message || "Could not connect to SFTP server"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const handleTestEditSFTPConnection = async () => {
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
    
    // Validate paths
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
    
    // Auth validation
    const usesPrivateKey = editRequiresPrivateKey;
    if (usesPrivateKey && !privateKeyElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Private key is required when using key authentication"
      });
      setIsTestingConnection(false);
      return;
    } else if (!usesPrivateKey && !passwordElement?.value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password is required"
      });
      setIsTestingConnection(false);
      return;
    }
    
    // Prepare credentials
    const credentials = {
      host: hostElement.value,
      port: portElement.value ? parseInt(portElement.value, 10) : 22,
      username: usernameElement.value,
      remote_paths: editRemotePaths,
      ...(usesPrivateKey 
        ? { privateKey: privateKeyElement.value }
        : { password: passwordElement.value }
      )
    };
    
    try {
      // First, make the request to test the connection
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sftp',
          credentials
        }),
        credentials: 'include',
      });
      
      // Parse the JSON response
      const result = await response.json();
      console.log('SFTP edit test connection response:', result);
      
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
        message: (error as Error).message || "Connection failed"
      });
      
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: (error as Error).message || "Could not connect to SFTP server"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
          <p className="text-muted-foreground">
            Configure and manage data sources for product information
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Data Source
        </Button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Sources</TabsTrigger>
          <TabsTrigger value="sftp">SFTP/FTP</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="csv">Files (CSV/Excel)</TabsTrigger>
          <TabsTrigger value="edi_x12">EDI</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          {isLoading ? (
            <div className="text-center p-4">Loading data sources...</div>
          ) : filteredDataSources.length === 0 ? (
            <div className="text-center p-4 border rounded-lg bg-muted/20">
              <p className="mb-2">No data sources found.</p>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Your First Data Source
              </Button>
            </div>
          ) : (
            filteredDataSources.map((dataSource: DataSource) => {
              return (
                <Card key={dataSource.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        {getSourceTypeIcon(dataSource.type)}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{dataSource.name}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          {getSourceTypeName(dataSource.type)}
                          <ChevronRight className="h-4 w-4 inline mx-1" />
                          {suppliers.find((s: any) => s.id === dataSource.supplierId)?.name || 'No supplier'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDataSource(dataSource);
                          setIsEditDialogOpen(true);
                          setTestConnectionResult(null);
                          
                          // Set private key flag based on selected data source config
                          try {
                            const config = JSON.parse(dataSource.config || '{}');
                            setEditRequiresPrivateKey(!!config.private_key);
                          } catch (e) {
                            setEditRequiresPrivateKey(false);
                          }
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1" /> Configure
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteDataSource(dataSource.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex justify-between mb-3">
                      <div>
                        <Badge variant={dataSource.active ? "default" : "secondary"}>
                          {dataSource.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <p>Last updated: {new Date(dataSource.updatedAt).toLocaleString()}</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
            <DialogDescription>
              Configure a new data source for importing product data.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateDataSource}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Product Feed"
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select 
                  name="type" 
                  defaultValue={selectedSourceType} 
                  onValueChange={setSelectedSourceType}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="excel">Excel File</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="ftp">FTP</SelectItem>
                    <SelectItem value="edi_x12">EDI X12</SelectItem>
                    <SelectItem value="edifact">EDIFACT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="supplierId" className="text-right">
                  Supplier
                </Label>
                <Select name="supplierId" defaultValue="">
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

              {/* SFTP Specific Config */}
              {(selectedSourceType === 'sftp' || selectedSourceType === 'ftp') && (
                <>
                  <Separator className="my-2" />
                  <h3 className="font-medium text-lg mb-2">{selectedSourceType.toUpperCase()} Configuration</h3>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-host" className="text-right">
                      Host
                    </Label>
                    <Input
                      id="sftp-host"
                      name="sftp-host"
                      placeholder="ftp.supplier.com"
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-port" className="text-right">
                      Port
                    </Label>
                    <Input
                      id="sftp-port"
                      name="sftp-port"
                      placeholder="22"
                      type="number"
                      className="col-span-3"
                      defaultValue="22"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sftp-username" className="text-right">
                      Username
                    </Label>
                    <Input
                      id="sftp-username"
                      name="sftp-username"
                      placeholder="username"
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 ml-auto">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="requires-private-key" 
                        name="requires-private-key" 
                        checked={requiresPrivateKey}
                        onCheckedChange={(checked) => setRequiresPrivateKey(checked as boolean)}
                      />
                      <label
                        htmlFor="requires-private-key"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use private key authentication
                      </label>
                    </div>
                  </div>
                  
                  {requiresPrivateKey ? (
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="sftp-private-key" className="text-right pt-2">
                        Private Key
                      </Label>
                      <Textarea
                        id="sftp-private-key"
                        name="sftp-private-key"
                        placeholder="Paste private key here"
                        className="col-span-3"
                        rows={6}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sftp-password" className="text-right">
                        Password
                      </Label>
                      <Input
                        id="sftp-password"
                        name="sftp-password"
                        type="password"
                        placeholder="password"
                        className="col-span-3"
                      />
                    </div>
                  )}
                  
                  <Separator className="my-2" />
                  
                  <h4 className="font-medium mb-2">Remote Paths</h4>
                  <div className="space-y-4">
                    {remotePaths.map((pathItem, index) => (
                      <div key={pathItem.id} className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-5">
                          <Label htmlFor={`path-label-${pathItem.id}`} className="mb-1 block">
                            Label
                          </Label>
                          <Input
                            id={`path-label-${pathItem.id}`}
                            value={pathItem.label}
                            onChange={(e) => updateRemotePath(pathItem.id, 'label', e.target.value)}
                            placeholder="Product Catalog"
                          />
                        </div>
                        
                        <div className="col-span-6">
                          <Label htmlFor={`path-value-${pathItem.id}`} className="mb-1 block">
                            Path
                          </Label>
                          <Input
                            id={`path-value-${pathItem.id}`}
                            value={pathItem.path}
                            onChange={(e) => updateRemotePath(pathItem.id, 'path', e.target.value)}
                            placeholder="/feeds/products.csv"
                          />
                        </div>
                        
                        <div className="col-span-1 pt-7">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeRemotePath(pathItem.id)}
                            disabled={remotePaths.length <= 1}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={addRemotePath}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Path
                    </Button>
                  </div>

                  {/* Test Connection Button */}
                  <div className="mt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled={isTestingConnection}
                      onClick={handleTestSFTPConnection}
                    >
                      {isTestingConnection ? "Testing..." : "Test Connection"}
                    </Button>
                    
                    {testConnectionResult && (
                      <Alert className="mt-3" variant={testConnectionResult.success ? "default" : "destructive"}>
                        <AlertTitle>
                          {testConnectionResult.success ? "Connection Successful" : "Connection Failed"}
                        </AlertTitle>
                        <AlertDescription>
                          {testConnectionResult.message}
                          
                          {/* Show directory contents if successful */}
                          {testConnectionResult.success && testConnectionResult.details?.listing && (
                            <div className="mt-2">
                              <h4 className="text-sm font-semibold">Directory Contents:</h4>
                              <ul className="text-xs mt-1 list-disc list-inside">
                                {testConnectionResult.details.listing.slice(0, 5).map((item: any, idx: number) => (
                                  <li key={idx}>{item.name} {item.size ? `(${Math.round(item.size / 1024)}KB)` : ''}</li>
                                ))}
                                {testConnectionResult.details.listing.length > 5 && (
                                  <li>...and {testConnectionResult.details.listing.length - 5} more items</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}

              {/* JSON Configuration for other source types */}
              {selectedSourceType !== 'sftp' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="config" className="text-right">
                    Config (JSON)
                  </Label>
                  <Textarea
                    id="config"
                    name="config"
                    placeholder="{ }"
                    className="col-span-3"
                    rows={10}
                    defaultValue="{}"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Data Source Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={selectedDataSource.name}
                    className="col-span-3"
                    required
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Type</Label>
                  <div className="col-span-3">
                    <Badge>{getSourceTypeName(selectedDataSource.type)}</Badge>
                    <input type="hidden" name="type" value={selectedDataSource.type} />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="supplierId" className="text-right">
                    Supplier
                  </Label>
                  <Select name="supplierId" defaultValue={selectedDataSource.supplierId ? selectedDataSource.supplierId.toString() : ""}>
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
                  <Label htmlFor="active" className="text-right">
                    Status
                  </Label>
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
                
                {/* SFTP Specific Config */}
                {(selectedDataSource.type === 'sftp' || selectedDataSource.type === 'ftp') && (
                  <>
                    <Separator className="my-2" />
                    <h3 className="font-medium text-lg mb-2">{selectedDataSource.type.toUpperCase()} Configuration</h3>
                    
                    {(() => {
                      let config;
                      try {
                        config = JSON.parse(selectedDataSource.config || '{}');
                      } catch (e) {
                        config = {};
                      }
                      
                      return (
                        <>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sftp-host-edit" className="text-right">
                              Host
                            </Label>
                            <Input
                              id="sftp-host-edit"
                              name="sftp-host-edit"
                              defaultValue={config.host || ''}
                              className="col-span-3"
                              required
                            />
                          </div>
                          
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sftp-port-edit" className="text-right">
                              Port
                            </Label>
                            <Input
                              id="sftp-port-edit"
                              name="sftp-port-edit"
                              defaultValue={config.port || '22'}
                              type="number"
                              className="col-span-3"
                            />
                          </div>
                          
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sftp-username-edit" className="text-right">
                              Username
                            </Label>
                            <Input
                              id="sftp-username-edit"
                              name="sftp-username-edit"
                              defaultValue={config.username || ''}
                              className="col-span-3"
                              required
                            />
                          </div>
                          
                          <div className="flex items-center gap-4 ml-auto">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="requires-private-key-edit" 
                                name="requires-private-key-edit" 
                                checked={editRequiresPrivateKey}
                                onCheckedChange={(checked) => setEditRequiresPrivateKey(checked as boolean)}
                              />
                              <label
                                htmlFor="requires-private-key-edit"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Use private key authentication
                              </label>
                            </div>
                          </div>
                          
                          {editRequiresPrivateKey ? (
                            <div className="grid grid-cols-4 items-start gap-4">
                              <Label htmlFor="sftp-private-key-edit" className="text-right pt-2">
                                Private Key
                              </Label>
                              <Textarea
                                id="sftp-private-key-edit"
                                name="sftp-private-key-edit"
                                defaultValue={config.private_key || ''}
                                className="col-span-3"
                                rows={6}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="sftp-password-edit" className="text-right">
                                Password
                              </Label>
                              <Input
                                id="sftp-password-edit"
                                name="sftp-password-edit"
                                type="password"
                                placeholder="Enter password to update"
                                className="col-span-3"
                              />
                            </div>
                          )}
                          
                          <Separator className="my-2" />
                          
                          <h4 className="font-medium mb-2">Remote Paths</h4>
                          <div className="space-y-4">
                            {editRemotePaths.map((pathItem, index) => (
                              <div key={pathItem.id} className="grid grid-cols-12 gap-3 items-start">
                                <div className="col-span-5">
                                  <Label htmlFor={`path-label-edit-${pathItem.id}`} className="mb-1 block">
                                    Label
                                  </Label>
                                  <Input
                                    id={`path-label-edit-${pathItem.id}`}
                                    value={pathItem.label}
                                    onChange={(e) => updateEditRemotePath(pathItem.id, 'label', e.target.value)}
                                    placeholder="Product Catalog"
                                  />
                                </div>
                                
                                <div className="col-span-6">
                                  <Label htmlFor={`path-value-edit-${pathItem.id}`} className="mb-1 block">
                                    Path
                                  </Label>
                                  <Input
                                    id={`path-value-edit-${pathItem.id}`}
                                    value={pathItem.path}
                                    onChange={(e) => updateEditRemotePath(pathItem.id, 'path', e.target.value)}
                                    placeholder="/feeds/products.csv"
                                  />
                                </div>
                                
                                <div className="col-span-1 pt-7">
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => removeEditRemotePath(pathItem.id)}
                                    disabled={editRemotePaths.length <= 1}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm"
                              onClick={addEditRemotePath}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Path
                            </Button>
                          </div>
                          
                          {/* Test Connection Button */}
                          <div className="mt-4">
                            <Button 
                              type="button" 
                              variant="outline" 
                              disabled={isTestingConnection}
                              onClick={handleTestEditSFTPConnection}
                            >
                              {isTestingConnection ? "Testing..." : "Test Connection"}
                            </Button>
                            
                            {testConnectionResult && (
                              <Alert className="mt-3" variant={testConnectionResult.success ? "default" : "destructive"}>
                                <AlertTitle>
                                  {testConnectionResult.success ? "Connection Successful" : "Connection Failed"}
                                </AlertTitle>
                                <AlertDescription>
                                  {testConnectionResult.message}
                                  
                                  {/* Show directory contents if successful */}
                                  {testConnectionResult.success && testConnectionResult.details?.listing && (
                                    <div className="mt-2">
                                      <h4 className="text-sm font-semibold">Directory Contents:</h4>
                                      <ul className="text-xs mt-1 list-disc list-inside">
                                        {testConnectionResult.details.listing.slice(0, 5).map((item: any, idx: number) => (
                                          <li key={idx}>{item.name} {item.size ? `(${Math.round(item.size / 1024)}KB)` : ''}</li>
                                        ))}
                                        {testConnectionResult.details.listing.length > 5 && (
                                          <li>...and {testConnectionResult.details.listing.length - 5} more items</li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                {/* JSON Configuration for other source types */}
                {selectedDataSource.type !== 'sftp' && (
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="config" className="text-right pt-2">
                      Config (JSON)
                    </Label>
                    <Textarea
                      id="config"
                      name="config"
                      className="col-span-3"
                      rows={10}
                      defaultValue={JSON.stringify(JSON.parse(selectedDataSource.config || '{}'), null, 2)}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}