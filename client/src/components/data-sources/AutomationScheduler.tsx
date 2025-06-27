import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FilePathConfig {
  id: string;
  label: string;
  path: string;
  fileType: 'catalog' | 'inventory' | 'pricing' | 'images' | 'specifications' | 'other';
  isAutomated: boolean;
  scheduleFrequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  dependsOn?: string; // ID of another file path
}

interface AutomationSchedulerProps {
  supplierId: string;
  connectionId: string;
  filePaths: FilePathConfig[];
  onSave: (config: any) => void;
}

export function AutomationScheduler({ supplierId, connectionId, filePaths, onSave }: AutomationSchedulerProps) {
  const { toast } = useToast();
  const [automationConfig, setAutomationConfig] = useState({
    name: "Supplier Automation",
    isActive: true,
    
    // Catalog settings
    catalogEnabled: true,
    catalogFrequency: 'daily' as const,
    catalogTimesPerDay: 1,
    catalogScheduleTimes: ['02:00'],
    
    // Inventory settings
    inventoryEnabled: true,
    inventoryFrequency: 'hourly' as const,
    inventoryTimesPerDay: 12,
    inventoryStartTime: '06:00',
    inventoryEndTime: '22:00',
    
    // Processing rules
    waitForCatalogCompletion: true,
    inventoryDelayAfterCatalog: 10,
    maxRetryAttempts: 3,
    retryDelayMinutes: 30,
    
    // Notifications
    notifyOnFailure: true,
    notificationEmails: [] as string[]
  });

  const [pathConfigs, setPathConfigs] = useState<FilePathConfig[]>(
    filePaths.map(path => ({
      ...path,
      fileType: path.label.toLowerCase().includes('catalog') ? 'catalog' :
                path.label.toLowerCase().includes('inventory') ? 'inventory' : 'other',
      isAutomated: true,
      scheduleFrequency: path.label.toLowerCase().includes('catalog') ? 'daily' : 'hourly'
    }))
  );

  const catalogPaths = pathConfigs.filter(p => p.fileType === 'catalog');
  const inventoryPaths = pathConfigs.filter(p => p.fileType === 'inventory');
  const otherPaths = pathConfigs.filter(p => !['catalog', 'inventory'].includes(p.fileType));

  const updatePathConfig = (pathId: string, updates: Partial<FilePathConfig>) => {
    setPathConfigs(prev => prev.map(p => 
      p.id === pathId ? { ...p, ...updates } : p
    ));
  };

  const getFrequencyOptions = (fileType: string) => {
    if (fileType === 'catalog') {
      return [
        { value: 'daily', label: 'Daily (1-2 times)' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }
      ];
    } else if (fileType === 'inventory') {
      return [
        { value: 'hourly', label: 'Hourly (1-12 times/day)' },
        { value: 'daily', label: 'Daily' }
      ];
    }
    return [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' }
    ];
  };

  const saveAutomation = async () => {
    try {
      // Create the comprehensive automation configuration
      const config = {
        ...automationConfig,
        supplierId: parseInt(supplierId),
        connectionId: parseInt(connectionId),
        filePaths: pathConfigs
      };

      await onSave(config);
      
      toast({
        title: "Automation Configured",
        description: "File processing automation has been set up successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Configuration Failed",
        description: "Failed to save automation settings"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Automation Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="automation-name">Automation Name</Label>
              <Input
                id="automation-name"
                value={automationConfig.name}
                onChange={(e) => setAutomationConfig(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="automation-active"
                checked={automationConfig.isActive}
                onCheckedChange={(checked) => setAutomationConfig(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="automation-active">Enable Automation</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Type Classification */}
      <Card>
        <CardHeader>
          <CardTitle>File Type Classification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Classify your files to set up proper processing dependencies. Catalog files will always process before inventory files.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {pathConfigs.map((path) => (
            <div key={path.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{path.label}</div>
                <div className="text-sm text-muted-foreground">{path.path}</div>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={path.fileType}
                  onValueChange={(value) => updatePathConfig(path.id, { 
                    fileType: value as any,
                    scheduleFrequency: value === 'catalog' ? 'daily' : 'hourly'
                  })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catalog">Catalog</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="pricing">Pricing</SelectItem>
                    <SelectItem value="images">Images</SelectItem>
                    <SelectItem value="specifications">Specs</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant={path.fileType === 'catalog' ? 'default' : 
                              path.fileType === 'inventory' ? 'secondary' : 'outline'}>
                  {path.fileType}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Processing Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Workflow</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visual representation of your file processing dependencies and timing.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {catalogPaths.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Step 1: Catalog Processing</div>
                  <div className="text-sm text-muted-foreground">
                    {catalogPaths.map(p => p.label).join(', ')} • Runs {automationConfig.catalogFrequency}
                  </div>
                </div>
              </div>
            )}
            
            {catalogPaths.length > 0 && inventoryPaths.length > 0 && (
              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            
            {inventoryPaths.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Step 2: Inventory Processing</div>
                  <div className="text-sm text-muted-foreground">
                    {inventoryPaths.map(p => p.label).join(', ')} • Runs {automationConfig.inventoryTimesPerDay}x daily
                    {automationConfig.waitForCatalogCompletion && " (waits for catalog completion)"}
                  </div>
                </div>
              </div>
            )}

            {otherPaths.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                  <div>
                    <div className="font-medium">Additional Files</div>
                    <div className="text-sm text-muted-foreground">
                      {otherPaths.map(p => p.label).join(', ')} • Independent processing
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catalog Schedule Settings */}
      {catalogPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Catalog Processing Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select
                  value={automationConfig.catalogFrequency}
                  onValueChange={(value) => setAutomationConfig(prev => ({ ...prev, catalogFrequency: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {automationConfig.catalogFrequency === 'daily' && (
                <div>
                  <Label>Times per Day</Label>
                  <Select
                    value={automationConfig.catalogTimesPerDay.toString()}
                    onValueChange={(value) => setAutomationConfig(prev => ({ ...prev, catalogTimesPerDay: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Once daily</SelectItem>
                      <SelectItem value="2">Twice daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Schedule Settings */}
      {inventoryPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Processing Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Times per Day</Label>
                <Select
                  value={automationConfig.inventoryTimesPerDay.toString()}
                  onValueChange={(value) => setAutomationConfig(prev => ({ ...prev, inventoryTimesPerDay: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} time{num > 1 ? 's' : ''} daily
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={automationConfig.inventoryStartTime}
                  onChange={(e) => setAutomationConfig(prev => ({ ...prev, inventoryStartTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={automationConfig.inventoryEndTime}
                  onChange={(e) => setAutomationConfig(prev => ({ ...prev, inventoryEndTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="wait-catalog"
                checked={automationConfig.waitForCatalogCompletion}
                onCheckedChange={(checked) => setAutomationConfig(prev => ({ ...prev, waitForCatalogCompletion: checked }))}
              />
              <Label htmlFor="wait-catalog">Wait for catalog processing to complete before updating inventory</Label>
            </div>
            
            {automationConfig.waitForCatalogCompletion && (
              <div>
                <Label>Delay after catalog completion (minutes)</Label>
                <Input
                  type="number"
                  value={automationConfig.inventoryDelayAfterCatalog}
                  onChange={(e) => setAutomationConfig(prev => ({ ...prev, inventoryDelayAfterCatalog: parseInt(e.target.value) }))}
                  min="0"
                  max="60"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Handling & Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Error Handling & Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Retry Attempts</Label>
              <Input
                type="number"
                value={automationConfig.maxRetryAttempts}
                onChange={(e) => setAutomationConfig(prev => ({ ...prev, maxRetryAttempts: parseInt(e.target.value) }))}
                min="1"
                max="10"
              />
            </div>
            <div>
              <Label>Retry Delay (minutes)</Label>
              <Input
                type="number"
                value={automationConfig.retryDelayMinutes}
                onChange={(e) => setAutomationConfig(prev => ({ ...prev, retryDelayMinutes: parseInt(e.target.value) }))}
                min="1"
                max="120"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="notify-failure"
              checked={automationConfig.notifyOnFailure}
              onCheckedChange={(checked) => setAutomationConfig(prev => ({ ...prev, notifyOnFailure: checked }))}
            />
            <Label htmlFor="notify-failure">Send email notifications on processing failures</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveAutomation} className="min-w-32">
          Save Automation
        </Button>
      </div>
    </div>
  );
}