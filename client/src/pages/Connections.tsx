import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, MoreHorizontal, Settings, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Form schema
const connectionFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  type: z.string().min(1, { message: "Type is required" }),
  description: z.string().optional(),
  supplierId: z.number().optional(),
  isActive: z.boolean().default(true),
  credentials: z.record(z.any())
});

type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

// Default credential fields by type
const defaultCredentialsByType = {
  ftp: {
    host: "",
    port: "21",
    username: "",
    password: "",
    path: "/"
  },
  sftp: {
    host: "",
    port: "22",
    username: "",
    password: "",
    path: "/"
  },
  api: {
    baseUrl: "",
    authType: "basic", // or "token", "oauth", etc.
    username: "",
    password: "",
    token: "",
    apiKey: ""
  },
  database: {
    host: "",
    port: "",
    database: "",
    username: "",
    password: ""
  }
};

export default function Connections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);

  // Query for fetching all connections
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["/api/connections"],
    retry: 1,
  });

  // Query for fetching suppliers for the dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
    retry: 1,
  });

  // Create connection mutation
  const createConnection = useMutation({
    mutationFn: (data: ConnectionFormValues) => {
      return apiRequest("/api/connections", {
        method: "POST",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Connection created",
        description: "The connection has been created successfully.",
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create connection. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update connection mutation
  const updateConnection = useMutation({
    mutationFn: (data: ConnectionFormValues & { id: number }) => {
      const { id, ...connectionData } = data;
      return apiRequest(`/api/connections/${id}`, {
        method: "PATCH",
        data: connectionData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Connection updated",
        description: "The connection has been updated successfully.",
      });
      setOpen(false);
      setEditingConnection(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update connection. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete connection mutation
  const deleteConnection = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/connections/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Connection deleted",
        description: "The connection has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete connection. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Test connection mutation
  const testConnection = useMutation({
    mutationFn: (data: ConnectionFormValues) => {
      return apiRequest("/api/connections/test", {
        method: "POST",
        data
      });
    },
    onSuccess: (data) => {
      setTestResults(data);
      toast({
        title: "Test completed",
        description: data.success 
          ? "Connection test was successful!" 
          : "Connection test failed. Please check your details.",
        variant: data.success ? "default" : "destructive",
      });
      setTestingConnection(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to test connection. Please try again.",
        variant: "destructive",
      });
      setTestingConnection(false);
    }
  });

  // React Hook Form setup
  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      isActive: true,
      credentials: {}
    }
  });

  const selectedType = form.watch("type");
  
  // Handle opening new connection dialog
  const handleAddNew = () => {
    form.reset({
      name: "",
      type: "",
      description: "",
      isActive: true,
      credentials: {}
    });
    setTestResults(null);
    setEditingConnection(null);
    setOpen(true);
  };

  // Handle editing a connection
  const handleEdit = (connection: any) => {
    setEditingConnection(connection);
    form.reset({
      name: connection.name,
      type: connection.type,
      description: connection.description || "",
      supplierId: connection.supplierId,
      isActive: connection.isActive,
      credentials: connection.credentials || {}
    });
    setTestResults(null);
    setOpen(true);
  };

  // Handle form submission
  const onSubmit = (data: ConnectionFormValues) => {
    if (editingConnection) {
      updateConnection.mutate({ ...data, id: editingConnection.id });
    } else {
      createConnection.mutate(data);
    }
  };

  // Handle connection type change
  const handleTypeChange = (type: string) => {
    // Reset credentials when type changes
    form.setValue("credentials", defaultCredentialsByType[type as keyof typeof defaultCredentialsByType] || {});
  };

  // Handle test connection
  const handleTestConnection = () => {
    const isValid = form.trigger();
    if (isValid) {
      setTestingConnection(true);
      const data = form.getValues();
      testConnection.mutate(data);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Manage your data source connections for imports, exports, and integrations.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Connection
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="bg-muted/30 h-24" />
              <CardContent className="h-32 mt-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No connections configured</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create connections to external data sources like FTP servers, APIs, or databases to import and export data.
            </p>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" /> Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection: any) => (
            <Card key={connection.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{connection.name}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {connection.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-5 w-5" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(connection)}>
                        <Settings className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        // First edit to load the data, then test
                        handleEdit(connection);
                        setTimeout(() => {
                          handleTestConnection();
                        }, 100);
                      }}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Test
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => deleteConnection.mutate(connection.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.isActive ? "default" : "outline"}>
                      {connection.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="secondary">{connection.type.toUpperCase()}</Badge>
                    {connection.supplierId && (
                      <Badge variant="outline">
                        {suppliers.find((s: any) => s.id === connection.supplierId)?.name || "Unknown supplier"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    <p>Last tested: {connection.lastTested 
                      ? new Date(connection.lastTested).toLocaleString() 
                      : "Never"}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <div className="flex justify-between items-center w-full">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(connection.createdAt).toLocaleDateString()}
                  </p>
                  {connection.lastStatus && (
                    <Badge 
                      variant={connection.lastStatus === "success" ? "success" : "destructive"}
                      className="ml-auto"
                    >
                      {connection.lastStatus === "success" ? "Success" : "Failed"}
                    </Badge>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingConnection ? "Edit Connection" : "Add New Connection"}</DialogTitle>
            <DialogDescription>
              Configure a connection to an external data source. Fill out the details below and test your connection.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Connection" {...field} />
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
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleTypeChange(value);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select connection type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ftp">FTP</SelectItem>
                          <SelectItem value="sftp">SFTP</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="database">Database</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description of this connection" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <Select
                      value={field.value?.toString() || ""}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Link to a supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {suppliers.map((supplier: any) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this connection with a supplier for easier data management
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedType && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-medium">Connection Details</h3>
                  
                  {/* FTP/SFTP Connection Fields */}
                  {(selectedType === "ftp" || selectedType === "sftp") && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="credentials.host"
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
                          name="credentials.port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input placeholder={selectedType === "ftp" ? "21" : "22"} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="credentials.username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="credentials.password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="credentials.path"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Path</FormLabel>
                            <FormControl>
                              <Input placeholder="/path/to/files" {...field} />
                            </FormControl>
                            <FormDescription>
                              The directory path where files are located
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  {/* API Connection Fields */}
                  {selectedType === "api" && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="credentials.baseUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://api.example.com/v1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="credentials.authType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Authentication Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select auth type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="basic">Basic Auth</SelectItem>
                                <SelectItem value="token">Bearer Token</SelectItem>
                                <SelectItem value="apiKey">API Key</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {form.watch("credentials.authType") === "basic" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="credentials.username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="username" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="credentials.password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                      
                      {form.watch("credentials.authType") === "token" && (
                        <FormField
                          control={form.control}
                          name="credentials.token"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bearer Token</FormLabel>
                              <FormControl>
                                <Input placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {form.watch("credentials.authType") === "apiKey" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="credentials.apiKeyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="X-API-Key" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Header or query parameter name
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="credentials.apiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key</FormLabel>
                                <FormControl>
                                  <Input placeholder="your-api-key" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Database Connection Fields */}
                  {selectedType === "database" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="credentials.host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Host</FormLabel>
                              <FormControl>
                                <Input placeholder="db.example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="credentials.port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input placeholder="5432" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="credentials.database"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Database Name</FormLabel>
                            <FormControl>
                              <Input placeholder="my_database" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="credentials.username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="db_user" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="credentials.password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {testResults && (
                <div className={`p-4 border rounded-md ${testResults.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                  <h4 className={`font-medium ${testResults.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResults.success ? 'Connection successful!' : 'Connection failed'}
                  </h4>
                  <p className="text-sm mt-1">
                    {testResults.message || (testResults.success ? 'Connected to the external resource.' : 'Unable to connect. Please check your credentials.')}
                  </p>
                  {testResults.details && (
                    <pre className="text-xs mt-2 p-2 bg-black/5 rounded overflow-x-auto">
                      {JSON.stringify(testResults.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Toggle whether this connection is active and available for use
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="mr-2 h-4 w-4"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={handleTestConnection}
                  disabled={!selectedType || testingConnection}
                  className="mr-auto"
                >
                  {testingConnection ? "Testing..." : "Test Connection"}
                </Button>
                <Button type="submit" disabled={createConnection.isPending || updateConnection.isPending}>
                  {createConnection.isPending || updateConnection.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}