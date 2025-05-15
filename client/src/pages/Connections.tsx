import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PlusCircle, Trash2, Edit, RefreshCw, FolderSync, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// Types
type Connection = {
  id: number;
  name: string;
  type: 'ftp' | 'sftp' | 'api' | 'database';
  description: string | null;
  supplierId: number | null;
  isActive: boolean;
  credentials: Record<string, any>;
  lastTested: string | null;
  lastStatus: 'success' | 'error' | 'pending' | null;
  createdAt: string;
  updatedAt: string;
};

// Schema for connection form
const connectionFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["ftp", "sftp", "api", "database"]),
  description: z.string().nullable().optional(),
  supplierId: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
  credentials: z.record(z.any())
});

// Credential schemas for different connection types
const ftpCredentialsSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.string().transform(val => parseInt(val) || 21).optional(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  secure: z.boolean().default(false),
  remoteDir: z.string().optional()
});

const sftpCredentialsSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.string().transform(val => parseInt(val) || 22).optional(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required").or(z.literal("")),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  remoteDir: z.string().optional()
});

const apiCredentialsSchema = z.object({
  url: z.string().url("Must be a valid URL").min(1, "URL is required"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  authType: z.enum(["none", "basic", "bearer", "apiKey"]).default("none"),
  username: z.string().optional(),
  password: z.string().optional(),
  accessToken: z.string().optional(),
  apiKeyName: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyLocation: z.enum(["header", "query"]).default("header").optional(),
  contentType: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional()
});

const databaseCredentialsSchema = z.object({
  databaseType: z.enum(["postgresql", "mysql", "mssql", "oracle"]).default("postgresql"),
  host: z.string().min(1, "Host is required"),
  port: z.string().transform(val => parseInt(val) || 5432).optional(),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  ssl: z.boolean().default(false)
});

type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

export default function Connections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<null | {
    success: boolean;
    message: string;
    details: any;
  }>(null);
  
  // Form for creating/editing connections
  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: "",
      type: "ftp",
      description: "",
      supplierId: null,
      isActive: true,
      credentials: {}
    }
  });
  
  // Get the current connection type from the form
  const connectionType = form.watch("type");
  
  // Get connections from API
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["/api/connections"],
    select: (data: Connection[]) => {
      if (activeTab === "all") return data;
      return data.filter(conn => conn.type === activeTab);
    }
  });
  
  // Get suppliers for the dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
  });
  
  // Create connection mutation
  const createMutation = useMutation({
    mutationFn: (data: ConnectionFormValues) => {
      return apiRequest("/api/connections", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Connection created",
        description: "The connection has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create connection: " + (error as Error).message,
        variant: "destructive"
      });
    }
  });
  
  // Update connection mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; data: Partial<ConnectionFormValues> }) => {
      return apiRequest(`/api/connections/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.data),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Connection updated",
        description: "The connection has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update connection: " + (error as Error).message,
        variant: "destructive"
      });
    }
  });
  
  // Delete connection mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/connections/${id}`, {
        method: "DELETE"
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
        description: "Failed to delete connection: " + (error as Error).message,
        variant: "destructive"
      });
    }
  });
  
  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (credentials: ConnectionFormValues) => {
      return apiRequest(`/api/connections/test`, {
        method: "POST",
        body: JSON.stringify({
          type: credentials.type,
          credentials: credentials.credentials
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  });
  
  // Function to test a connection before saving
  const testConnection = async () => {
    try {
      setIsTestingConnection(true);
      setTestConnectionResult(null);
      
      // Validate form data based on connection type
      const formData = form.getValues();
      let isValid = true;
      
      switch (formData.type) {
        case "ftp":
          try {
            ftpCredentialsSchema.parse(formData.credentials);
          } catch (error) {
            if (error instanceof z.ZodError) {
              error.errors.forEach(err => {
                form.setError(`credentials.${err.path[0]}` as any, {
                  message: err.message
                });
              });
              isValid = false;
            }
          }
          break;
        case "sftp":
          try {
            sftpCredentialsSchema.parse(formData.credentials);
          } catch (error) {
            if (error instanceof z.ZodError) {
              error.errors.forEach(err => {
                form.setError(`credentials.${err.path[0]}` as any, {
                  message: err.message
                });
              });
              isValid = false;
            }
          }
          break;
        case "api":
          try {
            apiCredentialsSchema.parse(formData.credentials);
          } catch (error) {
            if (error instanceof z.ZodError) {
              error.errors.forEach(err => {
                form.setError(`credentials.${err.path[0]}` as any, {
                  message: err.message
                });
              });
              isValid = false;
            }
          }
          break;
        case "database":
          try {
            databaseCredentialsSchema.parse(formData.credentials);
          } catch (error) {
            if (error instanceof z.ZodError) {
              error.errors.forEach(err => {
                form.setError(`credentials.${err.path[0]}` as any, {
                  message: err.message
                });
              });
              isValid = false;
            }
          }
          break;
      }
      
      if (!isValid) {
        setIsTestingConnection(false);
        toast({
          title: "Validation Error",
          description: "Please correct the form errors before testing the connection.",
          variant: "destructive"
        });
        return;
      }
      
      // Send test request
      const result = await testMutation.mutateAsync(formData);
      setTestConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Connection Test Successful",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection Test Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Test Error",
        description: "An error occurred while testing the connection.",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const handleCreateSubmit = (data: ConnectionFormValues) => {
    createMutation.mutate(data);
  };
  
  const handleEditSubmit = (data: ConnectionFormValues) => {
    if (selectedConnection) {
      updateMutation.mutate({
        id: selectedConnection.id,
        data
      });
    }
  };
  
  const handleDeleteConnection = (id: number) => {
    if (window.confirm("Are you sure you want to delete this connection?")) {
      deleteMutation.mutate(id);
    }
  };
  
  const handleEditConnection = (connection: Connection) => {
    setSelectedConnection(connection);
    form.reset({
      name: connection.name,
      type: connection.type,
      description: connection.description || "",
      supplierId: connection.supplierId,
      isActive: connection.isActive,
      credentials: connection.credentials
    });
    setIsEditDialogOpen(true);
  };
  
  const handleCreateNewConnection = () => {
    setSelectedConnection(null);
    form.reset({
      name: "",
      type: "ftp",
      description: "",
      supplierId: null,
      isActive: true,
      credentials: {}
    });
    setIsCreateDialogOpen(true);
  };
  
  const renderCredentialsForm = () => {
    const type = form.watch("type");
    
    switch (type) {
      case "ftp":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="ftp.example.com" {...field} value={field.value || ""} />
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
                    <Input placeholder="21" {...field} value={field.value || "21"} />
                  </FormControl>
                  <FormDescription>Default FTP port is 21</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
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
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.secure"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Use Secure FTP (FTPS)</FormLabel>
                    <FormDescription>
                      Use TLS/SSL encryption for FTP connection
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.remoteDir"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remote Directory</FormLabel>
                  <FormControl>
                    <Input placeholder="/path/to/directory" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Optional path to remote directory</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case "sftp":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="sftp.example.com" {...field} value={field.value || ""} />
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
                    <Input placeholder="22" {...field} value={field.value || "22"} />
                  </FormControl>
                  <FormDescription>Default SFTP port is 22</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
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
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Leave blank if using private key authentication</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.privateKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private Key</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="-----BEGIN RSA PRIVATE KEY-----..." 
                      className="font-mono text-xs h-32" 
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>Optional SSH private key for authentication</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.passphrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Passphrase</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Optional passphrase for private key</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.remoteDir"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remote Directory</FormLabel>
                  <FormControl>
                    <Input placeholder="/path/to/directory" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Optional path to remote directory</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case "api":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com/endpoint" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTTP Method</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value || "GET"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select HTTP method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
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
                    onValueChange={field.onChange} 
                    defaultValue={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select authentication type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="apiKey">API Key</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("credentials.authType") === "basic" && (
              <>
                <FormField
                  control={form.control}
                  name="credentials.username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
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
                        <Input type="password" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            {form.watch("credentials.authType") === "bearer" && (
              <FormField
                control={form.control}
                name="credentials.accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bearer Token</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {form.watch("credentials.authType") === "apiKey" && (
              <>
                <FormField
                  control={form.control}
                  name="credentials.apiKeyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key Name</FormLabel>
                      <FormControl>
                        <Input placeholder="X-API-Key" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="credentials.apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key Value</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="credentials.apiKeyLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key Location</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value || "header"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select API key location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="header">Header</SelectItem>
                          <SelectItem value="query">Query Parameter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            <FormField
              control={form.control}
              name="credentials.contentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="application/json" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>Optional content type header</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {["POST", "PUT"].includes(form.watch("credentials.method") || "") && (
              <FormField
                control={form.control}
                name="credentials.body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Body</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"key": "value"}' 
                        className="font-mono h-32" 
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>JSON or form data payload</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </>
        );
        
      case "database":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.databaseType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value || "postgresql"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select database type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="mssql">Microsoft SQL Server</SelectItem>
                      <SelectItem value="oracle">Oracle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="db.example.com" {...field} value={field.value || ""} />
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
                    <Input placeholder="5432" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    {form.watch("credentials.databaseType") === "postgresql" && "Default PostgreSQL port is 5432"}
                    {form.watch("credentials.databaseType") === "mysql" && "Default MySQL port is 3306"}
                    {form.watch("credentials.databaseType") === "mssql" && "Default SQL Server port is 1433"}
                    {form.watch("credentials.databaseType") === "oracle" && "Default Oracle port is 1521"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
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
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.ssl"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Use SSL</FormLabel>
                    <FormDescription>
                      Use encrypted connection to database
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        );
      
      default:
        return null;
    }
  };
  
  // Function to render connection status badge
  const renderStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Not Tested</Badge>;
    
    switch (status) {
      case "success":
        return <Badge variant="success" className="bg-green-500">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500 text-white">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  // Function to render connection type badge
  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "ftp":
        return <Badge variant="outline" className="bg-blue-500 text-white">FTP</Badge>;
      case "sftp":
        return <Badge variant="outline" className="bg-indigo-600 text-white">SFTP</Badge>;
      case "api":
        return <Badge variant="outline" className="bg-purple-500 text-white">API</Badge>;
      case "database":
        return <Badge variant="outline" className="bg-emerald-600 text-white">Database</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Manage and test external connections for data integration
          </p>
        </div>
        <Button onClick={handleCreateNewConnection}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>
      
      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="ftp">FTP</TabsTrigger>
          <TabsTrigger value="sftp">SFTP</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {renderConnectionsList()}
        </TabsContent>
        <TabsContent value="ftp" className="mt-6">
          {renderConnectionsList()}
        </TabsContent>
        <TabsContent value="sftp" className="mt-6">
          {renderConnectionsList()}
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          {renderConnectionsList()}
        </TabsContent>
        <TabsContent value="database" className="mt-6">
          {renderConnectionsList()}
        </TabsContent>
      </Tabs>
      
      {/* Create Connection Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Connection</DialogTitle>
            <DialogDescription>
              Add a new connection to an external data source
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Production FTP Server" {...field} />
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
                      <FormLabel>Connection Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Associate this connection with a supplier</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable or disable this connection
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
                      <Textarea 
                        placeholder="Connection for daily inventory updates"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Connection Credentials</h3>
                {renderCredentialsForm()}
              </div>
              
              {testConnectionResult && (
                <Alert variant={testConnectionResult.success ? "success" : "destructive"}>
                  <div className="flex items-center gap-2">
                    {testConnectionResult.success ? 
                      <CheckCircle className="h-4 w-4" /> : 
                      <AlertCircle className="h-4 w-4" />}
                    <span className="font-semibold">{testConnectionResult.message}</span>
                  </div>
                  {testConnectionResult.details && (
                    <AlertDescription className="mt-2">
                      <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                        {JSON.stringify(testConnectionResult.details, null, 2)}
                      </pre>
                    </AlertDescription>
                  )}
                </Alert>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <FolderSync className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Connection"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Connection Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update connection details and credentials
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Production FTP Server" {...field} />
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
                      <FormLabel>Connection Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Associate this connection with a supplier</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable or disable this connection
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
                      <Textarea 
                        placeholder="Connection for daily inventory updates"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Connection Credentials</h3>
                {renderCredentialsForm()}
              </div>
              
              {testConnectionResult && (
                <Alert variant={testConnectionResult.success ? "success" : "destructive"}>
                  <div className="flex items-center gap-2">
                    {testConnectionResult.success ? 
                      <CheckCircle className="h-4 w-4" /> : 
                      <AlertCircle className="h-4 w-4" />}
                    <span className="font-semibold">{testConnectionResult.message}</span>
                  </div>
                  {testConnectionResult.details && (
                    <AlertDescription className="mt-2">
                      <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                        {JSON.stringify(testConnectionResult.details, null, 2)}
                      </pre>
                    </AlertDescription>
                  )}
                </Alert>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <FolderSync className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
  
  // Helper function to render the connections list
  function renderConnectionsList() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex mt-4 space-x-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }
    
    if (connections.length === 0) {
      return (
        <Card className="p-8 text-center">
          <CardTitle className="mb-2">No connections found</CardTitle>
          <CardDescription>
            Get started by creating your first connection to an external data source.
          </CardDescription>
          <Button className="mt-4" onClick={handleCreateNewConnection}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Connection
          </Button>
        </Card>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map((connection) => (
          <Card key={connection.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle>{connection.name}</CardTitle>
                {!connection.isActive && (
                  <Badge variant="outline" className="bg-gray-200 text-gray-700">
                    Inactive
                  </Badge>
                )}
              </div>
              <CardDescription>
                {connection.description && connection.description.length > 100
                  ? `${connection.description.substring(0, 100)}...`
                  : connection.description || "No description"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {renderTypeBadge(connection.type)}
                {renderStatusBadge(connection.lastStatus)}
                {connection.supplierId && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    {suppliers.find(s => s.id === connection.supplierId)?.name || `Supplier #${connection.supplierId}`}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Last tested: {connection.lastTested 
                  ? new Date(connection.lastTested).toLocaleString() 
                  : "Never"}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleEditConnection(connection)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteConnection(connection.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
}