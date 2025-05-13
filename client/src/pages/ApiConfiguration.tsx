import { useState } from "react";
import { 
  Globe, 
  Plus, 
  Save,
  RefreshCcw,
  Check,
  X,
  Clock,
  Settings,
  Link,
  Key,
  ExternalLink,
  Code,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Mock API connections
const apiConnections = [
  {
    id: 1,
    name: "ERP System Integration",
    type: "REST",
    status: "active",
    endpoint: "https://erp.example.com/api/v2/products",
    authType: "oauth2",
    lastSync: new Date(Date.now() - 12 * 60 * 60 * 1000),
    direction: "bidirectional"
  },
  {
    id: 2,
    name: "E-commerce Platform",
    type: "REST",
    status: "active",
    endpoint: "https://shop.example.com/api/inventory",
    authType: "api-key",
    lastSync: new Date(Date.now() - 3 * 60 * 60 * 1000),
    direction: "export"
  },
  {
    id: 3,
    name: "Supplier Portal",
    type: "SOAP",
    status: "inactive",
    endpoint: "https://suppliers.example.org/ws",
    authType: "basic",
    lastSync: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    direction: "import"
  }
];

const ApiConfiguration = () => {
  const [activeTab, setActiveTab] = useState("connections");
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);

  // Get the selected connection details
  const selectedConnectionDetails = apiConnections.find(c => c.id === selectedConnection);

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">API Configuration</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Connection
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="connections" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connections">API Connections</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="authentication">Authentication</TabsTrigger>
            <TabsTrigger value="logs">API Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="connections" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>API Connections</CardTitle>
                    <CardDescription>
                      Configure integrations with external systems
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-neutral-200">
                      {apiConnections.map((connection) => (
                        <li 
                          key={connection.id}
                          className={`px-4 py-3 hover:bg-neutral-50 cursor-pointer ${
                            selectedConnection === connection.id ? 'bg-neutral-50' : ''
                          }`}
                          onClick={() => setSelectedConnection(connection.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Globe className="h-5 w-5 text-neutral-400 mr-2" />
                              <div>
                                <p className="text-sm font-medium text-neutral-900">{connection.name}</p>
                                <p className="text-xs text-neutral-500">{connection.type} API</p>
                              </div>
                            </div>
                            <div>
                              <Badge variant={connection.status === 'active' ? 'success' : 'secondary'}>
                                {connection.status}
                              </Badge>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 py-3">
                    <Button variant="ghost" size="sm" className="text-primary">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Connection
                    </Button>
                  </CardFooter>
                </Card>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                {selectedConnectionDetails ? (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{selectedConnectionDetails.name}</CardTitle>
                          <CardDescription>
                            {selectedConnectionDetails.type} API Configuration
                          </CardDescription>
                        </div>
                        <Badge variant={selectedConnectionDetails.status === 'active' ? 'success' : 'secondary'}>
                          {selectedConnectionDetails.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="endpoint">API Endpoint</Label>
                          <div className="flex">
                            <Input 
                              id="endpoint" 
                              value={selectedConnectionDetails.endpoint} 
                              readOnly
                              className="flex-grow"
                            />
                            <Button variant="outline" size="icon" className="ml-2">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="auth-type">Authentication Type</Label>
                          <Select defaultValue={selectedConnectionDetails.authType}>
                            <SelectTrigger id="auth-type">
                              <SelectValue placeholder="Select auth type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="api-key">API Key</SelectItem>
                              <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                              <SelectItem value="jwt">JWT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="sync-direction">Sync Direction</Label>
                        <Select defaultValue={selectedConnectionDetails.direction}>
                          <SelectTrigger id="sync-direction">
                            <SelectValue placeholder="Select direction" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="import">Import Only</SelectItem>
                            <SelectItem value="export">Export Only</SelectItem>
                            <SelectItem value="bidirectional">Bidirectional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="mapping">Data Mapping</Label>
                        <Textarea 
                          id="mapping" 
                          className="font-mono text-sm"
                          placeholder="Define field mappings between systems"
                          rows={5}
                          defaultValue={`{
  "id": "productId",
  "name": "title",
  "description": "description",
  "price": "basePrice",
  "sku": "sku"
}`}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-md">
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Auto Synchronization</h4>
                          <p className="text-xs text-neutral-500">Enable automatic data synchronization</p>
                        </div>
                        <Switch defaultChecked={selectedConnectionDetails.status === 'active'} />
                      </div>
                      
                      <div className="flex items-center text-neutral-500 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        Last synchronized: {selectedConnectionDetails.lastSync.toLocaleString()}
                      </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4 bg-neutral-50 flex justify-between">
                      <Button variant="outline">Test Connection</Button>
                      <div className="space-x-2">
                        <Button variant="outline">Cancel</Button>
                        <Button>Save Changes</Button>
                      </div>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center h-64 text-neutral-500">
                      <div className="text-center">
                        <Settings className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                        <p>Select an API connection to configure</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="webhooks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>Configure event notifications and callbacks</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-center py-12">
                  Webhook configuration will be available soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="authentication" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>Manage API keys and access credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-center py-12">
                  Authentication configuration will be available soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>API Logs</CardTitle>
                <CardDescription>View API request and response logs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-center py-12">
                  API logs will be available soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ApiConfiguration;