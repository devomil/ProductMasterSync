import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Check, X, RefreshCcw } from 'lucide-react';

// Schema for the connection form
const connectionFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  type: z.string().min(1, { message: 'Please select a connection type' }),
  description: z.string().optional(),
  supplierId: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
  // Credentials vary based on type
  credentials: z.record(z.any())
});

type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

// Connection types with their required credential fields
const connectionTypes = [
  { 
    id: 'api',
    label: 'REST API',
    credentialFields: [
      { name: 'baseUrl', label: 'Base URL', type: 'input', required: true },
      { name: 'authType', label: 'Auth Type', type: 'select', options: ['none', 'basic', 'apiKey', 'oauth2'], required: true },
      { name: 'apiKey', label: 'API Key', type: 'input', showWhen: { field: 'authType', value: 'apiKey' } },
      { name: 'apiKeyName', label: 'API Key Name', type: 'input', showWhen: { field: 'authType', value: 'apiKey' } },
      { name: 'apiKeyLocation', label: 'API Key Location', type: 'select', options: ['header', 'query'], showWhen: { field: 'authType', value: 'apiKey' } },
      { name: 'username', label: 'Username', type: 'input', showWhen: { field: 'authType', value: 'basic' } },
      { name: 'password', label: 'Password', type: 'password', showWhen: { field: 'authType', value: 'basic' } },
      { name: 'clientId', label: 'Client ID', type: 'input', showWhen: { field: 'authType', value: 'oauth2' } },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', showWhen: { field: 'authType', value: 'oauth2' } },
      { name: 'tokenUrl', label: 'Token URL', type: 'input', showWhen: { field: 'authType', value: 'oauth2' } },
      { name: 'headers', label: 'Default Headers', type: 'jsonarea', required: false },
    ]
  },
  { 
    id: 'ftp',
    label: 'FTP',
    credentialFields: [
      { name: 'host', label: 'Host', type: 'input', required: true },
      { name: 'port', label: 'Port', type: 'input', required: true, defaultValue: '21' },
      { name: 'username', label: 'Username', type: 'input', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
      { name: 'basePath', label: 'Base Path', type: 'input', required: false },
      { name: 'passive', label: 'Passive Mode', type: 'checkbox', required: false, defaultValue: true },
    ]
  },
  { 
    id: 'sftp',
    label: 'SFTP',
    credentialFields: [
      { name: 'host', label: 'Host', type: 'input', required: true },
      { name: 'port', label: 'Port', type: 'input', required: true, defaultValue: '22' },
      { name: 'username', label: 'Username', type: 'input', required: true },
      { name: 'authType', label: 'Auth Type', type: 'select', options: ['password', 'privateKey'], required: true },
      { name: 'password', label: 'Password', type: 'password', showWhen: { field: 'authType', value: 'password' } },
      { name: 'privateKey', label: 'Private Key', type: 'textarea', showWhen: { field: 'authType', value: 'privateKey' } },
      { name: 'passphrase', label: 'Passphrase', type: 'password', showWhen: { field: 'authType', value: 'privateKey' }, required: false },
      { name: 'basePath', label: 'Base Path', type: 'input', required: false },
    ]
  },
  {
    id: 'amazon',
    label: 'Amazon SP-API',
    credentialFields: [
      { name: 'clientId', label: 'Client ID', type: 'input', required: true },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { name: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
      { name: 'region', label: 'Region', type: 'select', options: ['na', 'eu', 'fe'], required: true },
      { name: 'roleArn', label: 'Role ARN', type: 'input', required: true },
      { name: 'marketplaceId', label: 'Marketplace ID', type: 'input', required: true },
    ]
  },
  {
    id: 'custom',
    label: 'Custom',
    credentialFields: [
      { name: 'custom', label: 'Custom Credentials (JSON)', type: 'jsonarea', required: true },
    ]
  }
];

const ConnectionManagement = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedConnectionType, setSelectedConnectionType] = useState('');
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: '',
      type: '',
      description: '',
      isActive: true,
      credentials: {}
    }
  });

  // Get all connections
  const { data: connections = [], isLoading } = useQuery({ 
    queryKey: ['/api/connections'], 
    queryFn: () => apiRequest<any[]>('/api/connections') 
  });

  // Get all suppliers for the dropdown
  const { data: suppliers = [] } = useQuery({ 
    queryKey: ['/api/suppliers'], 
    queryFn: () => apiRequest<any[]>('/api/suppliers') 
  });

  // Create or update connection
  const mutation = useMutation({
    mutationFn: (data: ConnectionFormValues) => {
      if (selectedConnection) {
        return apiRequest(`/api/connections/${selectedConnection.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/connections', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      toast({
        title: selectedConnection ? 'Connection updated' : 'Connection created',
        description: selectedConnection 
          ? `The connection "${form.getValues('name')}" has been updated.` 
          : `The connection "${form.getValues('name')}" has been created.`,
      });
      setOpenDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save connection',
        variant: 'destructive'
      });
    }
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: (data: ConnectionFormValues) => {
      return apiRequest('/api/connections/test', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Connection test successful',
        description: 'The connection test was successful.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Connection test failed',
        description: error.message || 'Failed to test connection',
        variant: 'destructive'
      });
    }
  });

  // Reset form and selected connection
  const resetForm = () => {
    form.reset({
      name: '',
      type: '',
      description: '',
      isActive: true,
      credentials: {}
    });
    setSelectedConnection(null);
    setSelectedConnectionType('');
  };

  // Open dialog for creating a new connection
  const handleNewConnection = () => {
    resetForm();
    setOpenDialog(true);
  };

  // Open dialog for editing an existing connection
  const handleEditConnection = (connection: any) => {
    setSelectedConnection(connection);
    setSelectedConnectionType(connection.type);
    form.reset({
      name: connection.name,
      type: connection.type,
      description: connection.description || '',
      supplierId: connection.supplierId || undefined,
      isActive: connection.isActive,
      credentials: connection.credentials || {}
    });
    setOpenDialog(true);
  };

  // Handle form submission
  const onSubmit = (data: ConnectionFormValues) => {
    mutation.mutate(data);
  };

  // Handle connection type change
  const handleConnectionTypeChange = (value: string) => {
    setSelectedConnectionType(value);
    form.setValue('type', value);
    
    // Reset credentials when changing type
    form.setValue('credentials', {});

    // Set default values for credential fields
    const connectionType = connectionTypes.find(type => type.id === value);
    if (connectionType) {
      const defaultCredentials: Record<string, any> = {};
      connectionType.credentialFields.forEach(field => {
        if (field.defaultValue !== undefined) {
          defaultCredentials[field.name] = field.defaultValue;
        }
      });
      form.setValue('credentials', defaultCredentials);
    }
  };

  // Test the current connection configuration
  const handleTestConnection = () => {
    const isValid = form.trigger();
    if (!isValid) return;
    
    const data = form.getValues();
    testMutation.mutate(data);
  };

  // Render credential fields based on selected connection type
  const renderCredentialFields = () => {
    if (!selectedConnectionType) return null;
    
    const connectionType = connectionTypes.find(type => type.id === selectedConnectionType);
    if (!connectionType) return null;
    
    return connectionType.credentialFields.map(field => {
      // Check if this field should be shown based on conditions
      if (field.showWhen) {
        const fieldValue = form.watch(`credentials.${field.showWhen.field}`);
        if (fieldValue !== field.showWhen.value) {
          return null;
        }
      }
      
      switch (field.type) {
        case 'input':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
                  <FormControl>
                    <Input {...formField} placeholder={field.label} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        case 'password':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
                  <FormControl>
                    <Input 
                      {...formField} 
                      type="password" 
                      placeholder={field.label} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        case 'select':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
                  <Select 
                    onValueChange={formField.onChange} 
                    defaultValue={formField.value}
                    value={formField.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${field.label}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {field.options?.map(option => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        case 'textarea':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...formField} 
                      placeholder={field.label}
                      className="min-h-32" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        case 'jsonarea':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...formField} 
                      placeholder={field.label}
                      className="min-h-32 font-mono text-sm"
                      value={formField.value ? (typeof formField.value === 'string' ? formField.value : JSON.stringify(formField.value, null, 2)) : ''}
                      onChange={e => {
                        try {
                          // Try to parse as JSON first
                          if (e.target.value.trim()) {
                            const parsedValue = JSON.parse(e.target.value);
                            formField.onChange(parsedValue);
                          } else {
                            formField.onChange(e.target.value);
                          }
                        } catch (err) {
                          // If not valid JSON, store as string
                          formField.onChange(e.target.value);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter valid JSON
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        case 'checkbox':
          return (
            <FormField
              key={field.name}
              control={form.control}
              name={`credentials.${field.name}`}
              render={({ field: formField }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 my-2">
                  <FormControl>
                    <Checkbox
                      checked={formField.value}
                      onCheckedChange={formField.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{field.label}</FormLabel>
                    <FormDescription>
                      {field.description || ''}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Connection Management</h1>
        <Button onClick={handleNewConnection}>
          <Plus className="mr-2 h-4 w-4" /> New Connection
        </Button>
      </div>
      
      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Connections</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="ftp">FTP/SFTP</TabsTrigger>
          <TabsTrigger value="amazon">Amazon</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center p-10 border rounded-lg bg-gray-50">
              <p className="text-gray-500">No connections found. Add your first connection to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map(connection => (
                <Card key={connection.id} className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{connection.name}</CardTitle>
                        <CardDescription>{connection.type.toUpperCase()}</CardDescription>
                      </div>
                      <Badge variant={connection.isActive ? "success" : "secondary"}>
                        {connection.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{connection.description || "No description"}</p>
                    {connection.supplierId && (
                      <div className="mb-2">
                        <span className="text-sm font-medium">Supplier: </span>
                        <span className="text-sm">
                          {suppliers.find(s => s.id === connection.supplierId)?.name || "Unknown"}
                        </span>
                      </div>
                    )}
                    <div className="mb-2">
                      <span className="text-sm font-medium">Last tested: </span>
                      <span className="text-sm">
                        {connection.lastTested ? new Date(connection.lastTested).toLocaleString() : "Never"}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleEditConnection(connection)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      // Test existing connection
                      testMutation.mutate(connection);
                    }}>
                      <RefreshCcw className="mr-2 h-4 w-4" /> Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="api">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections
              .filter(conn => conn.type === 'api')
              .map(connection => (
                <Card key={connection.id} className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{connection.name}</CardTitle>
                        <CardDescription>REST API</CardDescription>
                      </div>
                      <Badge variant={connection.isActive ? "success" : "secondary"}>
                        {connection.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{connection.description || "No description"}</p>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Base URL: </span>
                      <span className="text-sm">{connection.credentials?.baseUrl || "Not set"}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Auth Type: </span>
                      <span className="text-sm">{connection.credentials?.authType || "None"}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleEditConnection(connection)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => testMutation.mutate(connection)}>
                      <RefreshCcw className="mr-2 h-4 w-4" /> Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
        
        <TabsContent value="ftp">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections
              .filter(conn => conn.type === 'ftp' || conn.type === 'sftp')
              .map(connection => (
                <Card key={connection.id} className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{connection.name}</CardTitle>
                        <CardDescription>{connection.type.toUpperCase()}</CardDescription>
                      </div>
                      <Badge variant={connection.isActive ? "success" : "secondary"}>
                        {connection.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{connection.description || "No description"}</p>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Host: </span>
                      <span className="text-sm">{connection.credentials?.host || "Not set"}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Username: </span>
                      <span className="text-sm">{connection.credentials?.username || "Not set"}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleEditConnection(connection)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => testMutation.mutate(connection)}>
                      <RefreshCcw className="mr-2 h-4 w-4" /> Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
        
        <TabsContent value="amazon">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections
              .filter(conn => conn.type === 'amazon')
              .map(connection => (
                <Card key={connection.id} className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{connection.name}</CardTitle>
                        <CardDescription>Amazon SP-API</CardDescription>
                      </div>
                      <Badge variant={connection.isActive ? "success" : "secondary"}>
                        {connection.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{connection.description || "No description"}</p>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Region: </span>
                      <span className="text-sm">{connection.credentials?.region || "Not set"}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-medium">Marketplace: </span>
                      <span className="text-sm">{connection.credentials?.marketplaceId || "Not set"}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleEditConnection(connection)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => testMutation.mutate(connection)}>
                      <RefreshCcw className="mr-2 h-4 w-4" /> Test
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Create/Edit Connection Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedConnection ? 'Edit Connection' : 'Create New Connection'}</DialogTitle>
            <DialogDescription>
              {selectedConnection 
                ? 'Update the connection details. Credentials are securely stored and encrypted.'
                : 'Add a new connection to integrate with external data sources.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="My API Connection" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {!selectedConnection && (
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Type *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          handleConnectionTypeChange(value);
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select connection type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {connectionTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe this connection" 
                        {...field} 
                        className="resize-none"
                      />
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
                      onValueChange={(value) => {
                        field.onChange(value === '0' ? undefined : parseInt(value));
                      }}
                      value={field.value?.toString() || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this connection to a specific supplier
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active Status
                      </FormLabel>
                      <FormDescription>
                        Inactive connections won't be used for automated processes
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
              
              {/* Render dynamic credential fields based on selected connection type */}
              {(selectedConnectionType || selectedConnection?.type) && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="text-lg font-medium">Connection Credentials</h3>
                  {renderCredentialFields()}
                </div>
              )}
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpenDialog(false)}
                >
                  Cancel
                </Button>
                {selectedConnectionType && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleTestConnection}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Test Connection
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={mutation.isPending}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {selectedConnection ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectionManagement;