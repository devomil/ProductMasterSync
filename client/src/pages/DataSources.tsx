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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Import our new components
import SampleDataModal from "@/components/data-sources/SampleDataModal";
import RemotePathSelector from "@/components/data-sources/RemotePathSelector";
import FilePathList from "@/components/data-sources/FilePathList";
import { pullSampleDataForFile, retryPullWithBackoff } from "@/components/data-sources/PullSampleDataUtils";
import { RemotePathItem } from "@/components/data-sources/SampleDataModal";
import { useDataSourceActions } from "@/hooks/useDataSourceActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DataSources() {
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // For sample data functionality
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
  const [rawResponseData, setRawResponseData] = useState("");
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<RemotePathItem | null>(null);
  
  // Support for multiple remote paths in SFTP
  const [remotePaths, setRemotePaths] = useState<RemotePathItem[]>([
    { id: uuidv4(), label: 'Default Path', path: '/' }
  ]);
  const [requiresPrivateKey, setRequiresPrivateKey] = useState(false);
  
  // For data source actions
  const [dataSourceToDelete, setDataSourceToDelete] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Use our data source actions hook
  // Get data source actions
  const dataSourceActions = useDataSourceActions();

  // Create default form state
  const [newDataSource, setNewDataSource] = useState({
    name: "",
    description: "",
    type: "api",
    config: "{}",
    supplier_id: "",
    active: true
  });

  const { data: dataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ['/api/datasources'], 
    select: (data) => data || []
  });
  
  // Function to update the data sources state
  const setDataSources = (updatedDataSources: DataSource[]) => {
    queryClient.setQueryData(['/api/datasources'], updatedDataSources);
  };

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['/api/suppliers'],
    select: (data) => data || []
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewDataSource({ ...newDataSource, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNewDataSource({ ...newDataSource, [name]: checked });
  };

  const handleTypeChange = (value: string) => {
    setNewDataSource({ ...newDataSource, type: value });
    
    // Reset configuration when type changes
    if (value === 'sftp') {
      setRemotePaths([{ id: uuidv4(), label: 'Default Path', path: '/' }]);
      setRequiresPrivateKey(false);
    }
  };

  // Function to add a remote path
  const handleAddPath = () => {
    setRemotePaths([
      ...remotePaths,
      { id: uuidv4(), label: `Path ${remotePaths.length + 1}`, path: '/' }
    ]);
  };

  // Function to delete a remote path
  const handleDeletePath = (id: string) => {
    setRemotePaths(remotePaths.filter(p => p.id !== id));
  };

  // Function to update a remote path
  const handleEditRemotePath = (id: string, field: 'label' | 'path', value: string) => {
    setRemotePaths(
      remotePaths.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Function to handle saving a timestamp for a specific file path
  const handleSaveTimestamp = (pathId: string) => {
    setRemotePaths(paths => 
      paths.map(p => (
        p.id === pathId 
          ? { 
              ...p, 
              lastPulled: new Date().toISOString(),
              lastPullStatus: 'success'
            } 
          : p
      ))
    );
  };

  // Function to test connection with additional error handling
  const handleTestConnection = async () => {
    try {
      setIsTestingConnection(true);
      setTestConnectionResult(null);
      
      let requestConfig: any = {};
      
      if (newDataSource.type === 'sftp') {
        // Parse the private key if it's enabled
        const privateKey = requiresPrivateKey ? (document.getElementById("private_key") as HTMLTextAreaElement)?.value : null;
        
        // Build an SFTP configuration with the remote paths
        requestConfig = {
          host: (document.getElementById("host") as HTMLInputElement)?.value,
          port: parseInt((document.getElementById("port") as HTMLInputElement)?.value || "22"),
          username: (document.getElementById("username") as HTMLInputElement)?.value,
          password: (document.getElementById("password") as HTMLInputElement)?.value,
          is_sftp: true,
          remote_paths: remotePaths
        };
        
        if (privateKey) {
          requestConfig.private_key = privateKey;
        }
      } else if (newDataSource.type === 'api') {
        // Parse the JSON configuration
        try {
          requestConfig = JSON.parse(newDataSource.config);
        } catch (e) {
          toast({
            variant: "destructive",
            title: "Invalid JSON",
            description: "Please provide a valid JSON configuration"
          });
          setIsTestingConnection(false);
          return;
        }
      } else {
        // For other types, just use the config as is
        try {
          requestConfig = JSON.parse(newDataSource.config);
        } catch (e) {
          requestConfig = { data: newDataSource.config };
        }
      }
      
      // Make the API call to test the connection
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newDataSource.type,
          credentials: requestConfig
        }),
        credentials: 'include'
      }).then(res => res.json());
      
      // Process and display the results
      setTestConnectionResult({
        success: response.success || false,
        message: response.message || 'No response message'
      });
      
      if (response.success) {
        toast({
          title: "Connection Successful",
          description: response.message || "Connection test passed successfully"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: response.message || "Connection test failed"
        });
      }
    } catch (error) {
      console.error("Connection test error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setTestConnectionResult({
        success: false,
        message: errorMessage
      });
      
      toast({
        variant: "destructive",
        title: "Connection Test Error",
        description: errorMessage
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Function to pull sample data with error handling and status tracking
  const handlePullSampleData = async (selectedFile?: RemotePathItem) => {
    try {
      setIsPullingSampleData(true);
      setSampleData(null);
      setShowSampleDataModal(false);
      setRawResponseData("");
      
      // If a specific file was provided, use that
      const fileToUse = selectedFile || (remotePaths.length > 0 ? remotePaths[0] : null);
      
      if (!fileToUse && newDataSource.type !== 'api') {
        toast({
          variant: "destructive",
          title: "No File Selected",
          description: "Please select a file to pull sample data from"
        });
        setIsPullingSampleData(false);
        return;
      }
      
      // Set the selected file path for tracking and display
      if (fileToUse) {
        setSelectedFilePath(fileToUse);
      }
      
      // Prepare the request config
      let requestConfig: any = {};
      
      if (newDataSource.type === 'sftp') {
        // Parse the private key if it's enabled
        const privateKey = requiresPrivateKey ? (document.getElementById("private_key") as HTMLTextAreaElement)?.value : null;
        
        // Build an SFTP configuration
        requestConfig = {
          host: (document.getElementById("host") as HTMLInputElement)?.value,
          port: parseInt((document.getElementById("port") as HTMLInputElement)?.value || "22"),
          username: (document.getElementById("username") as HTMLInputElement)?.value,
          password: (document.getElementById("password") as HTMLInputElement)?.value,
          is_sftp: true,
          remote_paths: remotePaths
        };
        
        if (privateKey) {
          requestConfig.private_key = privateKey;
        }
        
        // For SFTP, use our new utility function for per-file pull
        if (fileToUse) {
          setSelectedFilePath(fileToUse);
          
          const result = await pullSampleDataForFile({
            selectedFile: fileToUse,
            credentials: requestConfig
          });
          
          setSampleData(result);
          setRawResponseData(result.rawResponse);
          setShowSampleDataModal(true);
          setIsPullingSampleData(false);
          
          // Update path status if it failed
          if (!result.success) {
            setRemotePaths(paths => 
              paths.map(p => (
                p.id === fileToUse.id 
                  ? { 
                      ...p, 
                      lastPulled: new Date().toISOString(),
                      lastPullStatus: 'error'
                    } 
                  : p
              ))
            );
          }
          
          return;
        }
      } else if (newDataSource.type === 'api') {
        // For API, parse the JSON configuration
        try {
          requestConfig = JSON.parse(newDataSource.config);
        } catch (e) {
          toast({
            variant: "destructive",
            title: "Invalid JSON",
            description: "Please provide a valid JSON configuration"
          });
          setIsPullingSampleData(false);
          return;
        }
      } else {
        // For other types, just use the config as is
        try {
          requestConfig = JSON.parse(newDataSource.config);
        } catch (e) {
          requestConfig = { data: newDataSource.config };
        }
      }
      
      // Standard pull sample data for non-SFTP or multi-file pulls
      const response = await fetch('/api/connections/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newDataSource.type,
          credentials: requestConfig,
          supplier_id: parseInt(newDataSource.supplier_id),
          limit: 10
        }),
        credentials: 'include'
      });
      
      // Get the raw response text first
      const responseText = await response.text();
      setRawResponseData(responseText);
      
      // Then try to parse it as JSON
      try {
        const result = JSON.parse(responseText);
        
        setSampleData({
          success: result.success || false,
          message: result.message || 'No response message',
          data: result.records || [],
          filename: result.filename || 'Unknown',
          fileType: result.fileType || 'Unknown',
          total_records: result.total_records || (result.records ? result.records.length : 0)
        });
        
        // Show success or error message
        if (result.success) {
          toast({
            title: "Sample Data Retrieved",
            description: `Retrieved ${result.records?.length || 0} records successfully`
          });
        } else {
          toast({
            variant: "destructive",
            title: "Failed to Retrieve Sample Data",
            description: result.message || "Unknown error occurred"
          });
        }
      } catch (e) {
        console.error("Error parsing response:", e);
        
        // If we couldn't parse the response, show it as a failure
        setSampleData({
          success: false,
          message: "Failed to parse server response",
          data: [],
          filename: 'Error'
        });
        
        toast({
          variant: "destructive",
          title: "Response Parse Error",
          description: "The server returned an invalid response format"
        });
      }
      
      setShowSampleDataModal(true);
    } catch (error) {
      console.error("Sample data pull error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Set error state
      setSampleData({
        success: false,
        message: errorMessage,
        data: []
      });
      
      setRawResponseData(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      toast({
        variant: "destructive",
        title: "Sample Data Error",
        description: errorMessage
      });
      
      setShowSampleDataModal(true);
    } finally {
      setIsPullingSampleData(false);
    }
  };

  // Function to retry a failed pull with backoff
  const handleRetryPull = async () => {
    if (!selectedFilePath) return;
    
    setIsPullingSampleData(true);
    
    try {
      // Prepare the SFTP configuration
      const privateKey = requiresPrivateKey ? (document.getElementById("private_key") as HTMLTextAreaElement)?.value : null;
      
      const requestConfig = {
        host: (document.getElementById("host") as HTMLInputElement)?.value,
        port: parseInt((document.getElementById("port") as HTMLInputElement)?.value || "22"),
        username: (document.getElementById("username") as HTMLInputElement)?.value,
        password: (document.getElementById("password") as HTMLInputElement)?.value,
        is_sftp: true,
        remote_paths: remotePaths
      };
      
      if (privateKey) {
        requestConfig.private_key = privateKey;
      }
      
      const result = await retryPullWithBackoff({
        selectedFile: selectedFilePath,
        credentials: requestConfig
      });
      
      setSampleData(result);
      setRawResponseData(result.rawResponse);
      
      // Update path status based on result
      setRemotePaths(paths => 
        paths.map(p => (
          p.id === selectedFilePath.id 
            ? { 
                ...p, 
                lastPulled: new Date().toISOString(),
                lastPullStatus: result.success ? 'success' : 'error'
              } 
            : p
        ))
      );
    } catch (error) {
      console.error("Retry pull error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: errorMessage
      });
    } finally {
      setIsPullingSampleData(false);
    }
  };

  const handleCreateDataSource = async () => {
    try {
      // Prepare the request payload
      let configToSubmit: any = {};
      
      if (newDataSource.type === 'sftp') {
        // Parse the private key if it's enabled
        const privateKey = requiresPrivateKey ? (document.getElementById("private_key") as HTMLTextAreaElement)?.value : null;
        
        // Build an SFTP configuration
        configToSubmit = {
          host: (document.getElementById("host") as HTMLInputElement)?.value,
          port: parseInt((document.getElementById("port") as HTMLInputElement)?.value || "22"),
          username: (document.getElementById("username") as HTMLInputElement)?.value,
          password: (document.getElementById("password") as HTMLInputElement)?.value,
          is_sftp: true,
          remote_paths: remotePaths
        };
        
        if (privateKey) {
          configToSubmit.private_key = privateKey;
        }
      } else {
        // For other types, just use the config as is
        try {
          configToSubmit = JSON.parse(newDataSource.config);
        } catch (e) {
          configToSubmit = { data: newDataSource.config };
        }
      }
      
      const response = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDataSource,
          config: JSON.stringify(configToSubmit),
          supplier_id: parseInt(newDataSource.supplier_id)
        }),
        credentials: 'include'
      }).then(res => res.json());
      
      if (response.id) {
        toast({
          title: "Data Source Created",
          description: "The data source was successfully created"
        });
        
        // Reset the form
        setNewDataSource({
          name: "",
          description: "",
          type: "api",
          config: "{}",
          supplier_id: "",
          active: true
        });
        
        setIsCreateDialogOpen(false);
        
        // Invalidate the cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ['/api/datasources'] });
      } else {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: response.message || "Failed to create data source"
        });
      }
    } catch (error) {
      console.error("Create data source error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        variant: "destructive",
        title: "Error Creating Data Source",
        description: errorMessage
      });
    }
  };

  // Render SFTP configuration form with multiple remote paths support
  const renderSFTPForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            placeholder="sftp.example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            placeholder="22"
            defaultValue="22"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="username"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required={!requiresPrivateKey}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="use_private_key" 
          checked={requiresPrivateKey}
          onCheckedChange={(checked) => {
            setRequiresPrivateKey(checked === true);
          }}
        />
        <Label htmlFor="use_private_key">Use private key authentication</Label>
      </div>
      
      {requiresPrivateKey && (
        <div className="space-y-2">
          <Label htmlFor="private_key">Private Key (PEM format)</Label>
          <Textarea
            id="private_key"
            placeholder="-----BEGIN RSA PRIVATE KEY-----..."
            className="font-mono text-xs"
            rows={5}
            required
          />
        </div>
      )}
      
      <FilePathList
        paths={remotePaths}
        onSelectPath={(path) => handlePullSampleData(path)}
        onDeletePath={handleDeletePath}
        onAddPath={handleAddPath}
        isPullingSampleData={isPullingSampleData}
      />
      
      <div className="space-y-2">
        <Label>Remote Path(s) editor</Label>
        <div className="max-h-60 overflow-y-auto">
          {remotePaths.map((path) => (
            <div key={path.id} className="grid grid-cols-5 gap-2 mb-2">
              <div className="col-span-2">
                <Input
                  value={path.label}
                  onChange={(e) => handleEditRemotePath(path.id, 'label', e.target.value)}
                  placeholder="Label"
                />
              </div>
              <div className="col-span-3">
                <Input
                  value={path.path}
                  onChange={(e) => handleEditRemotePath(path.id, 'path', e.target.value)}
                  placeholder="Path (e.g., /home/data)"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Filter data sources based on the active tab
  const filteredDataSources = (dataSources as DataSource[]).filter((dataSource: DataSource) => {
    if (activeTab === "all") return true;
    return dataSource.type === activeTab;
  });

  return (
    <main className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-gray-500">Manage your data connections and sources</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              Add Data Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Data Source</DialogTitle>
              <DialogDescription>
                Set up a new data source to import product data from external systems.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Data Source Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Supplier API"
                    value={newDataSource.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    name="type"
                    value={newDataSource.type}
                    onValueChange={handleTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="sftp">SFTP</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe this data source..."
                  value={newDataSource.description}
                  onChange={handleFormChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplier_id">Supplier</Label>
                <Select
                  name="supplier_id"
                  value={newDataSource.supplier_id}
                  onValueChange={(value) => setNewDataSource({...newDataSource, supplier_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers as any[]).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Configuration</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="active"
                      name="active"
                      checked={newDataSource.active}
                      onCheckedChange={(checked) => 
                        setNewDataSource({...newDataSource, active: checked === true})
                      }
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                </div>
                
                {/* Configuration forms based on type */}
                {newDataSource.type === 'sftp' ? (
                  renderSFTPForm()
                ) : (
                  <Textarea
                    id="config"
                    name="config"
                    placeholder="{ ... }"
                    className="font-mono"
                    rows={8}
                    value={newDataSource.config}
                    onChange={handleFormChange}
                  />
                )}
              </div>
              
              {/* Test Connection and Sample Data sections */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    variant="outline"
                    className="w-1/2"
                  >
                    {isTestingConnection ? "Testing..." : "Test Connection"}
                  </Button>
                  
                  <Button 
                    type="button" 
                    onClick={() => {
                      if (remotePaths && remotePaths.length > 0) {
                        // If we have paths, use the first one
                        const firstPath = remotePaths[0];
                        setSelectedFilePath(firstPath);
                        handlePullSampleData(firstPath);
                      } else {
                        // No paths, show error
                        toast({
                          variant: "destructive",
                          title: "No Path Available",
                          description: "Please add at least one remote path before pulling sample data."
                        });
                      }
                    }}
                    disabled={isPullingSampleData || (newDataSource.type === 'sftp' && (!remotePaths || remotePaths.length === 0))}
                    variant="outline"
                    className="w-1/2"
                  >
                    {isPullingSampleData ? "Pulling Data..." : "Pull Sample Data"}
                  </Button>
                </div>
                
                {testConnectionResult && (
                  <Alert variant={testConnectionResult.success ? "default" : "destructive"}>
                    <AlertTitle>
                      {testConnectionResult.success ? "Success" : "Error"}
                    </AlertTitle>
                    <AlertDescription>
                      {testConnectionResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateDataSource}>
                Create Data Source
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Sources</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="sftp">SFTP</TabsTrigger>
          <TabsTrigger value="ftp">FTP</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="file">File Upload</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          {isLoadingDataSources ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredDataSources.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No data sources found. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDataSources.map((dataSource: DataSource) => (
                <Card key={dataSource.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{dataSource.name}</CardTitle>
                        <CardDescription className="line-clamp-1">
                          {dataSource.description || "No description"}
                        </CardDescription>
                      </div>
                      <Badge variant={dataSource.active ? "default" : "outline"}>
                        {dataSource.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        {dataSource.type === 'api' && <Link2 size={16} />}
                        {dataSource.type === 'sftp' && <Server size={16} />}
                        {dataSource.type === 'ftp' && <Server size={16} />}
                        {dataSource.type === 'database' && <Database size={16} />}
                        {dataSource.type === 'file' && <UploadCloud size={16} />}
                        <span className="capitalize">{dataSource.type} Connection</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => setEditingDataSource(dataSource)}
                        >
                          <FileEdit size={14} />
                          Edit
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Settings size={14} />
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => dataSourceActions.handleTestConnectionForDataSource(dataSource)}>
                              Test Connection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => dataSourceActions.handlePullSampleDataForDataSource(dataSource)}>
                              Pull Sample Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => dataSourceActions.handleConfigureScheduler(dataSource)}>
                              Configure Scheduler
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => dataSourceActions.handleDeleteDataSource(dataSource.id)} className="text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Sample Data Modal - Get state from the hook */}
      {(showSampleDataModal || dataSourceActions.showSampleDataModal) && (sampleData || dataSourceActions.sampleData) && (
        <SampleDataModal
          sampleData={sampleData || dataSourceActions.sampleData!}
          selectedFilePath={selectedFilePath || dataSourceActions.selectedFilePath}
          rawResponseData={rawResponseData || dataSourceActions.rawResponseData}
          onClose={() => {
            setShowSampleDataModal(false);
            dataSourceActions.setShowSampleDataModal(false);
          }}
          onSaveTimestamp={handleSaveTimestamp}
        />
      )}
      {/* Delete Confirmation Dialog */}
      {/* Edit Dialog */}
      <Dialog open={editingDataSource !== null} onOpenChange={(open) => !open && setEditingDataSource(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Source</DialogTitle>
            <DialogDescription>
              Update the details for this data source.
            </DialogDescription>
          </DialogHeader>
          
          {editingDataSource && (
            <form id="edit-datasource-form" className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Data Source Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingDataSource.name}
                    placeholder="Supplier API"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier">Supplier</Label>
                  <Select defaultValue={String(editingDataSource.supplierId || 'none')} name="supplier">
                    <SelectTrigger id="edit-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {Array.isArray(suppliers) ? suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </SelectItem>
                      )) : null}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={typeof editingDataSource.description === 'string' ? editingDataSource.description : ''}
                  placeholder="Description of this data source"
                  rows={2}
                />
              </div>
              
              {editingDataSource.type === 'api' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-config">API Configuration (JSON)</Label>
                  <Textarea
                    id="edit-config"
                    name="config"
                    defaultValue={typeof editingDataSource.config === 'string' 
                      ? editingDataSource.config 
                      : JSON.stringify(editingDataSource.config, null, 2)}
                    placeholder="{}"
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}
              
              {editingDataSource.type === 'sftp' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-sftp-host">SFTP Host</Label>
                      <Input
                        id="edit-sftp-host"
                        name="host"
                        defaultValue={
                          typeof editingDataSource.config === 'object' && editingDataSource.config?.host
                            ? editingDataSource.config.host
                            : ''
                        }
                        placeholder="sftp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-sftp-port">Port</Label>
                      <Input
                        id="edit-sftp-port"
                        name="port"
                        type="number"
                        defaultValue={
                          typeof editingDataSource.config === 'object' && editingDataSource.config?.port
                            ? editingDataSource.config.port
                            : 22
                        }
                        placeholder="22"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-sftp-username">Username</Label>
                      <Input
                        id="edit-sftp-username"
                        name="username"
                        defaultValue={
                          typeof editingDataSource.config === 'object' && editingDataSource.config?.username
                            ? editingDataSource.config.username
                            : ''
                        }
                        placeholder="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-sftp-password">Password</Label>
                      <Input
                        id="edit-sftp-password"
                        name="password"
                        type="password"
                        defaultValue={
                          typeof editingDataSource.config === 'object' && editingDataSource.config?.password
                            ? editingDataSource.config.password
                            : ''
                        }
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Remote Paths</Label>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        type="button" 
                        onClick={() => {
                          // Get current config
                          const currentConfig = typeof editingDataSource.config === 'object' 
                            ? editingDataSource.config || {}
                            : {};
                            
                          // Get remote paths or initialize empty array
                          const remote_paths = Array.isArray(currentConfig.remote_paths) 
                            ? [...currentConfig.remote_paths]
                            : [];
                            
                          // Open an input dialog for new path
                          const path = window.prompt('Enter remote path (e.g., /eco8/out/inventory.csv)');
                          if (!path) return;
                          
                          const label = window.prompt('Enter a label for this path (e.g., Inventory File)');
                          if (!label) return;
                          
                          // Add new path
                          remote_paths.push({
                            path,
                            label,
                            lastPulled: null,
                            lastPullStatus: null
                          });
                          
                          // Update data source
                          setEditingDataSource({
                            ...editingDataSource,
                            config: {
                              ...currentConfig,
                              remote_paths
                            }
                          });
                        }}
                      >
                        Add Path
                      </Button>
                    </div>
                    <div className="border rounded-md p-4 bg-gray-50">
                      <div className="text-sm font-medium mb-2">Configured Remote Paths:</div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {typeof editingDataSource.config === 'object' && 
                         editingDataSource.config?.remote_paths && 
                         Array.isArray(editingDataSource.config.remote_paths) ? (
                          <div className="space-y-2">
                            {editingDataSource.config.remote_paths.map((path, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                <div>
                                  <span className="font-medium">{path.label || 'Path ' + (idx + 1)}</span>
                                  <div className="text-sm text-gray-500">{path.path}</div>
                                  {path.lastPulled && (
                                    <div className="text-xs text-gray-400">
                                      Last pulled: {new Date(path.lastPulled).toLocaleString()}
                                      {path.lastPullStatus && (
                                        <span className={path.lastPullStatus === 'success' ? 'text-green-600' : 'text-red-600'}>
                                          {' '}({path.lastPullStatus})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm" 
                                    variant="ghost" 
                                    type="button" 
                                    onClick={() => {
                                      // Get current config
                                      const currentConfig = typeof editingDataSource.config === 'object' 
                                        ? editingDataSource.config || {}
                                        : {};
                                        
                                      // Get remote paths
                                      const remote_paths = Array.isArray(currentConfig.remote_paths) 
                                        ? [...currentConfig.remote_paths]
                                        : [];
                                      
                                      // Remove path at index
                                      remote_paths.splice(idx, 1);
                                      
                                      // Update data source
                                      setEditingDataSource({
                                        ...editingDataSource,
                                        config: {
                                          ...currentConfig,
                                          remote_paths
                                        }
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No remote paths configured</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingDataSource(null)}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!editingDataSource) return;
                
                // Get form values
                const form = document.getElementById('edit-datasource-form');
                if (!form) return;
                
                const formData = new FormData(form as HTMLFormElement);
                
                // Prepare data for API
                const updatedDataSource = {
                  ...editingDataSource,
                  name: formData.get('name') as string,
                  supplierId: formData.get('supplier') !== 'none' ? Number(formData.get('supplier')) : null,
                  description: formData.get('description') as string,
                };
                
                // Handle different data source types
                if (editingDataSource.type === 'api') {
                  try {
                    // For API type, parse JSON config
                    updatedDataSource.config = JSON.parse(formData.get('config') as string);
                  } catch (e) {
                    toast({
                      variant: "destructive", 
                      title: "Invalid JSON Configuration",
                      description: "Please provide a valid JSON configuration"
                    });
                    return;
                  }
                } else if (editingDataSource.type === 'sftp') {
                  // For SFTP type, preserve remote_paths while updating other settings
                  const host = formData.get('host') as string;
                  const port = Number(formData.get('port'));
                  const username = formData.get('username') as string;
                  const password = formData.get('password') as string;
                  
                  // Get current config and ensure it's an object
                  const currentConfig = typeof editingDataSource.config === 'object' 
                    ? editingDataSource.config || {}
                    : {};
                  
                  // Make sure remote_paths exists and is preserved
                  const remote_paths = currentConfig.remote_paths || [];
                  
                  // Update config with form values
                  updatedDataSource.config = {
                    ...currentConfig,
                    host,
                    port,
                    username,
                    is_sftp: true,
                    remote_paths,
                    // Only update password if provided
                    ...(password ? { password } : {})
                  };
                }
                
                try {
                  // Show loading state
                  const loadingToast = toast({
                    title: "Saving Changes",
                    description: "Updating data source..."
                  });
                  
                  // Send update request
                  const response = await fetch(`/api/datasources/${editingDataSource.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedDataSource)
                  });
                  
                  if (response.ok) {
                    // Update local data
                    const updatedDataSources = Array.isArray(dataSources) ? [...dataSources] : [];
                    const index = updatedDataSources.findIndex(ds => ds.id === editingDataSource.id);
                    if (index !== -1) {
                      updatedDataSources[index] = {
                        ...updatedDataSources[index],
                        ...updatedDataSource
                      };
                      setDataSources(updatedDataSources);
                    }
                    
                    toast({
                      title: "Data Source Updated",
                      description: "Changes saved successfully"
                    });
                    
                    // Close dialog
                    setEditingDataSource(null);
                  } else {
                    // Handle error
                    const errorData = await response.json();
                    toast({
                      variant: "destructive",
                      title: "Update Failed",
                      description: errorData.message || "Failed to update data source"
                    });
                  }
                } catch (error) {
                  console.error("Error updating data source:", error);
                  toast({
                    variant: "destructive",
                    title: "Update Error",
                    description: error instanceof Error ? error.message : "An unknown error occurred"
                  });
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this data source?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the data source
              and remove any connection configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => dataSourceActions.handleConfirmDelete(dataSources, setDataSources)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}