import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AutomationScheduler } from "./AutomationScheduler";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Database, 
  FileText, 
  Globe, 
  HardDrive,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  Package,
  Search,
  RotateCcw,
  Settings,
  Lightbulb,
  Check
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DataSourceWizardProps {
  suppliers: Array<{ id: number; name: string; }>;
  onComplete: (dataSource: any) => void;
  onCancel: () => void;
}

interface StepProps {
  isActive: boolean;
  isCompleted: boolean;
  title: string;
  description: string;
}

const Step = ({ isActive, isCompleted, title, description }: StepProps) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
    isActive ? 'border-blue-200 bg-blue-50' : 
    isCompleted ? 'border-green-200 bg-green-50' : 
    'border-gray-200'
  }`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
      isCompleted ? 'bg-green-500 text-white' :
      isActive ? 'bg-blue-500 text-white' :
      'bg-gray-200 text-gray-500'
    }`}>
      {isCompleted ? <CheckCircle size={16} /> : (isActive ? '•' : '')}
    </div>
    <div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  </div>
);

export default function DataSourceWizard({ suppliers, onComplete, onCancel }: DataSourceWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    purpose: "" as string,
    supplierId: "",
    host: "",
    port: "22",
    username: "",
    password: "",
    filePaths: [{ id: Date.now().toString(), label: "Main Catalog", path: "" }],
    url: "",
    apiKey: "",
    headers: "{}",
    apiProvider: "",
    clientId: "",
    clientSecret: "",
    customerNumber: "",
    countryCode: "US",
    fileFormat: "csv",
    hasHeader: true,
    delimiter: ","
  });

  const purposeOptions = [
    { value: 'catalog', label: 'Catalog Import', description: 'Bulk product data ingestion from files', icon: Database, color: 'blue' },
    { value: 'inventory_pricing', label: 'Inventory & Pricing Updates', description: 'Regular stock/price refreshes', icon: RefreshCw, color: 'green' },
    { value: 'order_fulfillment', label: 'Order Fulfillment', description: 'Real-time product lookup for order processing', icon: Package, color: 'purple' },
    { value: 'catalog_search', label: 'Catalog Search', description: 'API-based product discovery and enrichment', icon: Search, color: 'amber' },
    { value: 'returns', label: 'Returns Processing', description: 'Handle return workflows', icon: RotateCcw, color: 'red' },
    { value: 'general', label: 'General', description: 'Multi-purpose connection', icon: Settings, color: 'gray' },
  ] as const;

  const getSuggestedPurpose = (type: string, apiProvider: string): string => {
    if (type === 'sftp' || type === 'ftp') return 'inventory_pricing';
    if (type === 'api' && apiProvider === 'ingram_micro') return 'order_fulfillment';
    if (type === 'api') return 'catalog_search';
    if (type === 'csv' || type === 'excel') return 'catalog';
    return 'general';
  };

  const getPurposeColorClasses = (color: string, isSelected: boolean) => {
    if (!isSelected) return 'hover:border-gray-300 hover:scale-[1.02]';
    return 'ring-2 ring-emerald-500 bg-emerald-50/60 hover:scale-[1.02]';
  };

  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  }>({ tested: false, success: false, message: "" });

  const [sampleData, setSampleData] = useState<{
    pulled: boolean;
    success: boolean;
    records: any[];
    totalRecords: number;
    message: string;
  }>({ pulled: false, success: false, records: [], totalRecords: 0, message: "" });

  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    { title: "Data Source Type", description: "Choose connection method" },
    { title: "Connection Setup", description: "Configure credentials" },
    { title: "Test Connection", description: "Verify connectivity" },
    { title: "Sample Pull", description: "Get 50 sample products" },
    { title: "Review & Create", description: "Finalize setup" }
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'type' || field === 'apiProvider') {
        const type = field === 'type' ? (value as string) : prev.type;
        const provider = field === 'apiProvider' ? (value as string) : prev.apiProvider;
        if (!prev.purpose) {
          updated.purpose = getSuggestedPurpose(type, provider);
        }
      }
      return updated;
    });
  };

  const addFilePath = () => {
    setFormData(prev => ({
      ...prev,
      filePaths: [
        ...prev.filePaths,
        { 
          id: Date.now().toString(), 
          label: `Path ${prev.filePaths.length + 1}`, 
          path: "/" 
        }
      ]
    }));
  };

  const removeFilePath = (id: string) => {
    setFormData(prev => ({
      ...prev,
      filePaths: prev.filePaths.filter(fp => fp.id !== id)
    }));
  };

  const updateFilePath = (id: string, field: 'label' | 'path', value: string) => {
    setFormData(prev => ({
      ...prev,
      filePaths: prev.filePaths.map(fp => 
        fp.id === id ? { ...fp, [field]: value } : fp
      )
    }));
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      let credentials: any = {};
      
      if (formData.type === 'sftp') {
        credentials = {
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          filePaths: formData.filePaths,
          is_sftp: true
        };
      } else if (formData.type === 'api') {
        if (formData.apiProvider === 'ingram_micro') {
          credentials = {
            provider: 'ingram_micro',
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
            customerNumber: formData.customerNumber,
            countryCode: formData.countryCode || 'US'
          };
        } else {
          credentials = {
            url: formData.url,
            api_key: formData.apiKey,
            headers: JSON.parse(formData.headers || '{}')
          };
        }
      }

      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          credentials
        })
      });

      const result = await response.json();
      setConnectionStatus({
        tested: true,
        success: result.success,
        message: result.message
      });

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "Ready to pull sample data"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: result.message
        });
      }
    } catch (error) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: error instanceof Error ? error.message : "Connection failed"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const pullSampleData = async () => {
    setIsLoading(true);
    try {
      let credentials: any = {};
      
      if (formData.type === 'sftp') {
        credentials = {
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          filePaths: formData.filePaths,
          is_sftp: true
        };
      } else if (formData.type === 'api') {
        if (formData.apiProvider === 'ingram_micro') {
          credentials = {
            provider: 'ingram_micro',
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
            customerNumber: formData.customerNumber,
            countryCode: formData.countryCode || 'US'
          };
        } else {
          credentials = {
            url: formData.url,
            api_key: formData.apiKey,
            headers: JSON.parse(formData.headers || '{}')
          };
        }
      }

      const response = await fetch('/api/connections/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          credentials,
          limit: 50  // Pull 50 sample products
        })
      });

      const result = await response.json();
      setSampleData({
        pulled: true,
        success: result.success,
        records: result.data || result.records || [],
        totalRecords: result.total_records || (result.data ? result.data.length : 0),
        message: result.message
      });

      if (result.success) {
        const recordCount = (result.data || result.records || []).length;
        toast({
          title: "Sample Data Retrieved",
          description: `Retrieved ${recordCount} sample products`
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sample Pull Failed",
          description: result.message
        });
      }
    } catch (error) {
      setSampleData({
        pulled: true,
        success: false,
        records: [],
        totalRecords: 0,
        message: error instanceof Error ? error.message : "Sample pull failed"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createDataSource = async () => {
    setIsLoading(true);
    try {
      let config: any = {};
      
      if (formData.type === 'sftp') {
        config = {
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          path: formData.path,
          is_sftp: true
        };
      } else if (formData.type === 'api') {
        if (formData.apiProvider === 'ingram_micro') {
          config = {
            provider: 'ingram_micro',
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
            customerNumber: formData.customerNumber,
            countryCode: formData.countryCode || 'US'
          };
        } else {
          config = {
            url: formData.url,
            api_key: formData.apiKey,
            headers: JSON.parse(formData.headers || '{}')
          };
        }
      } else if (formData.type === 'csv') {
        config = {
          file_format: formData.fileFormat,
          has_header: formData.hasHeader,
          delimiter: formData.delimiter
        };
      }

      const response = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          purpose: formData.purpose || 'general',
          supplier_id: parseInt(formData.supplierId),
          config: JSON.stringify(config),
          active: true
        })
      });

      const result = await response.json();
      
      if (result.id) {
        toast({
          title: "Data Source Created",
          description: "Successfully created data source with sample data"
        });
        onComplete(result);
      } else {
        throw new Error(result.message || "Failed to create data source");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create data source"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: return formData.type && formData.supplierId;
      case 1: return formData.name && (
        (formData.type === 'sftp' && formData.host && formData.username && formData.password) ||
        (formData.type === 'api' && formData.apiProvider === 'ingram_micro' && formData.clientId && formData.clientSecret && formData.customerNumber) ||
        (formData.type === 'api' && formData.apiProvider === 'generic' && formData.url) ||
        (formData.type === 'csv')
      );
      case 2: return connectionStatus.tested && connectionStatus.success;
      case 3: return sampleData.pulled && sampleData.success;
      case 4: return true;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="supplierId">Supplier</Label>
              <Select value={formData.supplierId} onValueChange={(value) => handleInputChange('supplierId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Source Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                {[
                  { type: 'sftp', title: 'SFTP/FTP', description: 'Secure file transfer', icon: HardDrive },
                  { type: 'api', title: 'API', description: 'REST API endpoint', icon: Globe },
                  { type: 'csv', title: 'File Upload', description: 'Upload CSV/Excel files', icon: FileText }
                ].map(({ type, title, description, icon: Icon }) => (
                  <Card 
                    key={type}
                    className={`cursor-pointer transition-colors ${
                      formData.type === type ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleInputChange('type', type)}
                  >
                    <CardHeader className="text-center pb-2">
                      <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      <CardTitle className="text-sm">{title}</CardTitle>
                      <CardDescription className="text-xs">{description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Data Source Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="CWR Distribution SFTP"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Product catalog feed"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Purpose</Label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {purposeOptions.map(({ value, label, description, icon: Icon, color }) => {
                  const isSelected = formData.purpose === value;
                  const isSuggested = value === getSuggestedPurpose(formData.type, formData.apiProvider) && formData.type;
                  return (
                    <Card
                      key={value}
                      className={`cursor-pointer transition-all duration-150 relative ${getPurposeColorClasses(color, isSelected)}`}
                      onClick={() => handleInputChange('purpose', value)}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isSuggested && !isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 text-amber-600 border-amber-200 bg-amber-50">
                            <Lightbulb className="w-2.5 h-2.5" />
                            Suggested
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="p-3 text-center">
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <CardTitle className="text-xs font-medium">{label}</CardTitle>
                        <CardDescription className="text-[10px] leading-tight">{description}</CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>

            {formData.type === 'sftp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={formData.host}
                      onChange={(e) => handleInputChange('host', e.target.value)}
                      placeholder="sftp.supplier.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      value={formData.port}
                      onChange={(e) => handleInputChange('port', e.target.value)}
                      placeholder="22"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>File Paths</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFilePath}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Path
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.filePaths.map((filePath, index) => (
                      <div key={filePath.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label htmlFor={`path-label-${filePath.id}`} className="text-sm">
                            Label
                          </Label>
                          <Input
                            id={`path-label-${filePath.id}`}
                            value={filePath.label}
                            onChange={(e) => updateFilePath(filePath.id, 'label', e.target.value)}
                            placeholder={`Path ${index + 1}`}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`path-value-${filePath.id}`} className="text-sm">
                            File Path
                          </Label>
                          <Input
                            id={`path-value-${filePath.id}`}
                            value={filePath.path}
                            onChange={(e) => updateFilePath(filePath.id, 'path', e.target.value)}
                            placeholder="PRICE.ZIP or /data/products.csv"
                            className="mt-1"
                          />
                        </div>
                        {formData.filePaths.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeFilePath(filePath.id)}
                            className="p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Add multiple file paths for different product categories or time periods
                  </p>
                </div>
              </div>
            )}

            {formData.type === 'api' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="apiProvider">API Provider</Label>
                  <Select value={formData.apiProvider} onValueChange={(value) => handleInputChange('apiProvider', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select API provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingram_micro">Ingram Micro</SelectItem>
                      <SelectItem value="generic">Other / Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.apiProvider === 'ingram_micro' && (
                  <>
                    <div>
                      <Label htmlFor="url">API URL</Label>
                      <Input
                        id="url"
                        value={formData.url || 'https://api.ingrammicro.com'}
                        onChange={(e) => handleInputChange('url', e.target.value)}
                        placeholder="https://api.ingrammicro.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clientId">Client ID</Label>
                        <Input
                          id="clientId"
                          value={formData.clientId}
                          onChange={(e) => handleInputChange('clientId', e.target.value)}
                          placeholder="Your Ingram Micro Client ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientSecret">Client Secret</Label>
                        <Input
                          id="clientSecret"
                          type="password"
                          value={formData.clientSecret}
                          onChange={(e) => handleInputChange('clientSecret', e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customerNumber">Customer Number</Label>
                        <Input
                          id="customerNumber"
                          value={formData.customerNumber}
                          onChange={(e) => handleInputChange('customerNumber', e.target.value)}
                          placeholder="e.g. 20-222222"
                        />
                      </div>
                      <div>
                        <Label htmlFor="countryCode">Country Code</Label>
                        <Input
                          id="countryCode"
                          value={formData.countryCode}
                          onChange={(e) => handleInputChange('countryCode', e.target.value)}
                          placeholder="US"
                        />
                      </div>
                    </div>
                  </>
                )}

                {formData.apiProvider === 'generic' && (
                  <>
                    <div>
                      <Label htmlFor="url">API URL</Label>
                      <Input
                        id="url"
                        value={formData.url}
                        onChange={(e) => handleInputChange('url', e.target.value)}
                        placeholder="https://api.supplier.com/products"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => handleInputChange('apiKey', e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <Label htmlFor="headers">Headers (JSON)</Label>
                      <Textarea
                        id="headers"
                        value={formData.headers}
                        onChange={(e) => handleInputChange('headers', e.target.value)}
                        placeholder='{"Content-Type": "application/json"}'
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {formData.type === 'csv' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fileFormat">File Format</Label>
                    <Select value={formData.fileFormat} onValueChange={(value) => handleInputChange('fileFormat', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="delimiter">Delimiter</Label>
                    <Input
                      id="delimiter"
                      value={formData.delimiter}
                      onChange={(e) => handleInputChange('delimiter', e.target.value)}
                      placeholder=","
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHeader"
                    checked={formData.hasHeader}
                    onCheckedChange={(checked) => handleInputChange('hasHeader', checked as boolean)}
                  />
                  <Label htmlFor="hasHeader">File has header row</Label>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Test Connection</h3>
              <p className="text-gray-600 mb-6">Verify that we can connect to your data source</p>
              
              {!connectionStatus.tested ? (
                <Button onClick={testConnection} disabled={isLoading} className="gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Test Connection
                </Button>
              ) : (
                <Alert className={connectionStatus.success ? "border-green-200" : "border-red-200"}>
                  <div className="flex items-center gap-2">
                    {connectionStatus.success ? 
                      <CheckCircle className="w-4 h-4 text-green-600" /> : 
                      <XCircle className="w-4 h-4 text-red-600" />
                    }
                    <AlertDescription>
                      {connectionStatus.message}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Pull Sample Data</h3>
              <p className="text-gray-600 mb-6">Get 50 sample products to review field mappings</p>
              
              {!sampleData.pulled ? (
                <Button onClick={pullSampleData} disabled={isLoading} className="gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Pull Sample Data (50 products)
                </Button>
              ) : (
                <div className="space-y-4">
                  <Alert className={sampleData.success ? "border-green-200" : "border-red-200"}>
                    <div className="flex items-center gap-2">
                      {sampleData.success ? 
                        <CheckCircle className="w-4 h-4 text-green-600" /> : 
                        <XCircle className="w-4 h-4 text-red-600" />
                      }
                      <AlertDescription>
                        {sampleData.message}
                      </AlertDescription>
                    </div>
                  </Alert>

                  {sampleData.success && sampleData.records.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">Sample Data Preview</h4>
                        <Badge variant="secondary">{sampleData.records.length} records</Badge>
                      </div>
                      <div className="text-sm space-y-2">
                        {Object.keys(sampleData.records[0] || {}).slice(0, 5).map(field => (
                          <div key={field} className="flex justify-between">
                            <span className="text-gray-600">{field}:</span>
                            <span className="font-mono text-xs">
                              {String(sampleData.records[0][field]).substring(0, 30)}
                              {String(sampleData.records[0][field]).length > 30 ? '...' : ''}
                            </span>
                          </div>
                        ))}
                        {Object.keys(sampleData.records[0] || {}).length > 5 && (
                          <div className="text-xs text-gray-500">
                            ... and {Object.keys(sampleData.records[0] || {}).length - 5} more fields
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Review & Create</h3>
              <p className="text-gray-600 mb-6">Finalize your data source configuration</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Name</Label>
                  <div className="font-medium">{formData.name}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Type</Label>
                  <div className="font-medium">{formData.type.toUpperCase()}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Supplier</Label>
                  <div className="font-medium">
                    {suppliers.find(s => s.id.toString() === formData.supplierId)?.name}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Purpose</Label>
                  <div className="font-medium">
                    {purposeOptions.find(p => p.value === formData.purpose)?.label || 'General'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Connection</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Tested successfully</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Sample Data</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">{sampleData.records.length} records pulled</span>
                  </div>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                After creating this data source, you'll be able to set up field mappings and perform full data imports.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Progress sidebar */}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <Step
              key={index}
              isActive={index === currentStep}
              isCompleted={index < currentStep}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{steps[currentStep].title}</CardTitle>
                  <CardDescription>{steps[currentStep].description}</CardDescription>
                </div>
                <div className="text-sm text-gray-500">
                  Step {currentStep + 1} of {steps.length}
                </div>
              </div>
              <Progress value={(currentStep / (steps.length - 1)) * 100} className="mt-2" />
            </CardHeader>
            <CardContent>
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : onCancel()}
              className="gap-2"
            >
              <ArrowLeft size={16} />
              {currentStep > 0 ? 'Previous' : 'Cancel'}
            </Button>

            <Button
              onClick={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(currentStep + 1);
                } else {
                  createDataSource();
                }
              }}
              disabled={!canProceedToNext() || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentStep < steps.length - 1 ? (
                <>Next <ArrowRight size={16} /></>
              ) : (
                'Create Data Source'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}