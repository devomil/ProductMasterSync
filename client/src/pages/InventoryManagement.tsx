import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Play, Pause, Settings, AlertTriangle, CheckCircle, XCircle, RotateCcw, Database, Calendar, Activity, Folder, Trash2, Plus, TestTube, FileText, Package, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Validation schemas
const automationScheduleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  isActive: z.boolean().default(true),
  catalogEnabled: z.boolean().default(true),
  catalogFilePath: z.string().min(1, "Catalog file path is required"),
  catalogFrequency: z.enum(["once", "hourly", "daily", "weekly", "monthly", "custom"]),
  catalogTimesPerDay: z.number().min(1).max(24).default(1),
  catalogScheduleTimes: z.array(z.string()).default(["02:00"]),
  inventoryEnabled: z.boolean().default(true),
  inventoryFilePath: z.string().min(1, "Inventory file path is required"),
  inventoryFrequency: z.enum(["once", "hourly", "daily", "weekly", "monthly", "custom"]),
  inventoryTimesPerDay: z.number().min(1).max(24).default(12),
  inventoryStartTime: z.string().default("06:00"),
  inventoryEndTime: z.string().default("22:00"),
  waitForCatalogCompletion: z.boolean().default(true),
  catalogTimeoutMinutes: z.number().min(5).max(180).default(30),
  inventoryDelayAfterCatalog: z.number().min(0).max(60).default(10),
  maxRetryAttempts: z.number().min(1).max(10).default(3),
  retryDelayMinutes: z.number().min(5).max(120).default(30),
  pauseOnConsecutiveFailures: z.number().min(3).max(20).default(5),
  notifyOnSuccess: z.boolean().default(false),
  notifyOnFailure: z.boolean().default(true),
  notificationEmails: z.array(z.string().email()).default([])
});

type AutomationSchedule = z.infer<typeof automationScheduleSchema>;

// Test Inventory Sync Dialog Component
function TestInventorySyncDialog({ suppliers, dataSources }: { suppliers: any[], dataSources: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [testStep, setTestStep] = useState(1);
  const [testResults, setTestResults] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetTest = () => {
    setTestStep(1);
    setTestResults({});
    setSelectedSupplier('');
  };

  const validateExistingCatalog = useMutation({
    mutationFn: async (supplierId: string) => {
      const response = await apiRequest("GET", `/api/suppliers/${supplierId}/existing-catalog-validation`);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(prev => ({ ...prev, catalogValidation: data }));
      setTestStep(2);
      toast({
        title: "Catalog Validation Complete",
        description: `Found ${data.productCount || 0} mapped products ready for inventory sync`
      });
    },
    onError: () => {
      toast({
        title: "Catalog Validation Failed",
        description: "No existing catalog data found. Please complete sample pull and mapping first.",
        variant: "destructive"
      });
    }
  });

  const testInventoryUpdate = useMutation({
    mutationFn: async () => {
      // Simulate inventory update by checking current inventory levels
      const response = await apiRequest("GET", `/api/inventory/test-sync`);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(prev => ({ ...prev, inventorySync: data }));
      setTestStep(3);
      toast({
        title: "Inventory Sync Test Complete",
        description: "Inventory levels updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Inventory Sync Failed",
        description: "Unable to sync inventory data.",
        variant: "destructive"
      });
    }
  });

  const validateDataFlow = useMutation({
    mutationFn: async () => {
      // Check data flow from sample pull to product catalog to inventory
      const response = await apiRequest("GET", `/api/test/data-flow-validation`);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(prev => ({ ...prev, dataFlowValidation: data }));
      setTestStep(4);
      toast({
        title: "Data Flow Validation Complete",
        description: "All systems working correctly"
      });
    },
    onError: () => {
      toast({
        title: "Data Flow Validation Failed",
        description: "Issues detected in the data pipeline.",
        variant: "destructive"
      });
    }
  });

  const selectedSupplierData = suppliers.find(s => s.id.toString() === selectedSupplier);
  const selectedDataSource = dataSources.find(ds => ds.supplierId.toString() === selectedSupplier);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <TestTube className="h-4 w-4 mr-2" />
          Test Inventory Sync
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Test Inventory Sync Workflow</DialogTitle>
          <DialogDescription>
            Validate your complete inventory management pipeline from data pull to inventory syncing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Select Supplier to Test</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a supplier" />
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

          {selectedSupplier && (
            <>
              {/* Supplier Info Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Testing: {selectedSupplierData?.name}</CardTitle>
                  <CardDescription>
                    Data Source: {selectedDataSource?.type.toUpperCase()} | 
                    Host: {selectedDataSource?.config?.host}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Test Steps Progress */}
              <div className="grid grid-cols-3 gap-4">
                <Card className={`${testStep >= 1 ? 'border-blue-500' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className={`h-8 w-8 mx-auto mb-2 ${testStep >= 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div className="text-sm font-medium">Catalog Validation</div>
                    {testResults.catalogValidation && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ {testResults.catalogValidation.productCount} mapped products
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={`${testStep >= 2 ? 'border-blue-500' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <Package className={`h-8 w-8 mx-auto mb-2 ${testStep >= 2 ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div className="text-sm font-medium">Inventory Sync</div>
                    {testResults.inventorySync && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ {testResults.inventorySync.updatedCount} updated
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={`${testStep >= 3 ? 'border-blue-500' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <RefreshCw className={`h-8 w-8 mx-auto mb-2 ${testStep >= 3 ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div className="text-sm font-medium">Data Flow</div>
                    {testResults.dataFlowValidation && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ All validated
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={`${testStep >= 3 ? 'border-green-500' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className={`h-8 w-8 mx-auto mb-2 ${testStep >= 3 ? 'text-green-500' : 'text-gray-400'}`} />
                    <div className="text-sm font-medium">Ready</div>
                    {testStep >= 3 && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ Ready for automation
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Test Results Display */}
              {Object.keys(testResults).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Test Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {testResults.catalogValidation && (
                      <div>
                        <h4 className="font-medium text-sm text-green-600 mb-2">✓ Catalog Validation Results</h4>
                        <div className="text-sm text-muted-foreground">
                          • {testResults.catalogValidation.productCount} mapped products found
                          • Mapping template: {testResults.catalogValidation.mappingTemplate}
                          • Last updated: {testResults.catalogValidation.lastUpdated}
                        </div>
                      </div>
                    )}

                    {testResults.inventorySync && (
                      <div>
                        <h4 className="font-medium text-sm text-green-600 mb-2">✓ Inventory Sync Results</h4>
                        <div className="text-sm text-muted-foreground mb-3">
                          • {testResults.inventorySync.totalMatches} products matched with supplier inventory
                          • Average sync time: {testResults.inventorySync.avgSyncTime}ms
                          • {testResults.inventorySync.unmatchedCount} unmatched products
                        </div>
                        
                        {testResults.inventorySync.matchedProducts && testResults.inventorySync.matchedProducts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <h5 className="text-xs font-medium text-gray-700">Sample Matched Products:</h5>
                            <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                              {testResults.inventorySync.matchedProducts.slice(0, 3).map((product: any, idx: number) => (
                                <div key={idx} className="text-xs bg-gray-50 p-2 rounded border">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{product.sku}</span>
                                    <span className="text-green-600">✓ Matched</span>
                                  </div>
                                  <div className="text-gray-600 truncate">{product.name}</div>
                                  <div className="flex justify-between text-gray-500">
                                    <span>Catalog: {product.catalogQuantity}</span>
                                    <span>Supplier: {product.supplierQuantity}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {testResults.inventorySync.matchedProducts.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{testResults.inventorySync.matchedProducts.length - 3} more products matched...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {testResults.dataFlowValidation && (
                      <div>
                        <h4 className="font-medium text-sm text-green-600 mb-2">✓ Data Flow Validation</h4>
                        <div className="text-sm text-muted-foreground">
                          • Catalog ↔ Inventory sync: Working
                          • Field mappings: All validated
                          • System performance: {testResults.dataFlowValidation.performance}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={resetTest}>
                  Reset Test
                </Button>
                <div className="flex gap-2">
                  {testStep === 1 && (
                    <Button 
                      onClick={() => validateExistingCatalog.mutate(selectedSupplier)}
                      disabled={validateExistingCatalog.isPending}
                    >
                      {validateExistingCatalog.isPending ? "Validating..." : "Validate Existing Catalog"}
                    </Button>
                  )}
                  {testStep === 2 && (
                    <Button 
                      onClick={() => testInventoryUpdate.mutate()}
                      disabled={testInventoryUpdate.isPending}
                    >
                      {testInventoryUpdate.isPending ? "Syncing..." : "Test Inventory Sync"}
                    </Button>
                  )}
                  {testStep === 3 && (
                    <Button onClick={() => setIsOpen(false)}>
                      Ready for Automation
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryManagement() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch automation schedules
  const { data: automationSchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["/api/automations"],
  });

  // Fetch recent jobs
  const { data: recentJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["/api/data-pull-jobs", { limit: 50 }],
  });

  // Fetch suppliers for dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  // Fetch data sources for dropdown
  const { data: dataSources = [] } = useQuery({
    queryKey: ["/api/datasources"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "running": return "bg-blue-500";
      case "pending": return "bg-yellow-500";
      case "failed": return "bg-red-500";
      case "cancelled": return "bg-gray-500";
      case "timeout": return "bg-orange-500";
      default: return "bg-gray-400";
    }
  };

  const getHealthStatus = (schedule: any) => {
    if (!schedule.isActive) return { status: "inactive", color: "text-gray-500" };
    if (schedule.consecutiveFailures > 3) return { status: "critical", color: "text-red-500" };
    if (schedule.consecutiveFailures > 0) return { status: "warning", color: "text-yellow-500" };
    return { status: "healthy", color: "text-green-500" };
  };

  const formatTime = (time: string) => {
    return new Date(`1970-01-01T${time}:00`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage automated data pulls, scheduling, and monitoring for supplier catalogs and inventory files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            System Health
          </Button>
          <CreateAutomationDialog suppliers={suppliers} dataSources={dataSources} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedules">Automation Schedules</TabsTrigger>
          <TabsTrigger value="jobs">Recent Jobs</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring & Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{automationSchedules.filter((s: any) => s.isActive).length}</div>
                <p className="text-xs text-muted-foreground">
                  {automationSchedules.length} total configured
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Jobs</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentJobs.filter((job: any) => 
                    new Date(job.scheduledAt).toDateString() === new Date().toDateString()
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {recentJobs.filter((job: any) => 
                    new Date(job.scheduledAt).toDateString() === new Date().toDateString() && 
                    job.status === "completed"
                  ).length} completed successfully
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Pulls</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentJobs.filter((job: any) => job.status === "running").length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently processing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentJobs.length > 0 ? 
                    Math.round((recentJobs.filter((job: any) => job.status === "completed").length / recentJobs.length) * 100) : 0
                  }%
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 50 jobs
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Health Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Health Overview</CardTitle>
              <CardDescription>Current status of all automation schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {automationSchedules.map((schedule: any) => {
                  const health = getHealthStatus(schedule);
                  return (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${health.status === "healthy" ? "bg-green-500" : 
                          health.status === "warning" ? "bg-yellow-500" : 
                          health.status === "critical" ? "bg-red-500" : "bg-gray-400"}`} />
                        <div>
                          <h4 className="font-medium">{schedule.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Catalog: {schedule.catalogEnabled ? "Enabled" : "Disabled"} | 
                            Inventory: {schedule.inventoryEnabled ? "Enabled" : "Disabled"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            Next: {schedule.nextCatalogPull ? 
                              new Date(schedule.nextCatalogPull).toLocaleString() : "Not scheduled"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.consecutiveFailures > 0 && `${schedule.consecutiveFailures} consecutive failures`}
                          </p>
                        </div>
                        <Badge variant={schedule.isActive ? "default" : "secondary"}>
                          {schedule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          <div className="space-y-4">
            {automationSchedules.map((schedule: any) => (
              <Card key={schedule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {schedule.name}
                        <Badge variant={schedule.isActive ? "default" : "secondary"}>
                          {schedule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {suppliers.find((s: any) => s.id === schedule.supplierId)?.name || "Unknown Supplier"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <EditAutomationDialog 
                        schedule={schedule} 
                        suppliers={suppliers} 
                        dataSources={dataSources} 
                      />
                      <TestInventoryDialog schedule={schedule} />
                      <TestInventorySyncDialog suppliers={suppliers} dataSources={dataSources} />
                      <Button variant="outline" size="sm">
                        {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Catalog Configuration */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Catalog Processing
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={schedule.catalogEnabled ? "default" : "secondary"} className="h-5">
                            {schedule.catalogEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">File Path:</span>
                          <span className="font-mono text-xs">{schedule.catalogFilePath}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency:</span>
                          <span>{schedule.catalogFrequency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Times per Day:</span>
                          <span>{schedule.catalogTimesPerDay}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Pull:</span>
                          <span>{schedule.lastCatalogPull ? 
                            new Date(schedule.lastCatalogPull).toLocaleDateString() : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Next Pull:</span>
                          <span>{schedule.nextCatalogPull ? 
                            new Date(schedule.nextCatalogPull).toLocaleString() : "Not scheduled"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Inventory Configuration */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Inventory Processing
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={schedule.inventoryEnabled ? "default" : "secondary"} className="h-5">
                            {schedule.inventoryEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">File Path:</span>
                          <span className="font-mono text-xs">{schedule.inventoryFilePath}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency:</span>
                          <span>{schedule.inventoryFrequency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Times per Day:</span>
                          <span>{schedule.inventoryTimesPerDay}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Window:</span>
                          <span>{formatTime(schedule.inventoryStartTime)} - {formatTime(schedule.inventoryEndTime)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Pull:</span>
                          <span>{schedule.lastInventoryPull ? 
                            new Date(schedule.lastInventoryPull).toLocaleDateString() : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Next Pull:</span>
                          <span>{schedule.nextInventoryPull ? 
                            new Date(schedule.nextInventoryPull).toLocaleString() : "Not scheduled"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{schedule.totalSuccessfulPulls || 0}</p>
                        <p className="text-xs text-muted-foreground">Successful Pulls</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{schedule.totalFailedPulls || 0}</p>
                        <p className="text-xs text-muted-foreground">Failed Pulls</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{schedule.consecutiveFailures || 0}</p>
                        <p className="text-xs text-muted-foreground">Consecutive Failures</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {schedule.averageProcessingTimeMinutes ? 
                            formatDuration(Math.round(schedule.averageProcessingTimeMinutes)) : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Processing Time</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Data Pull Jobs</CardTitle>
              <CardDescription>Monitor the status and performance of individual data pull operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentJobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`} />
                      <div>
                        <h4 className="font-medium">{job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)} Pull</h4>
                        <p className="text-sm text-muted-foreground">
                          {suppliers.find((s: any) => s.id === job.supplierId)?.name || "Unknown Supplier"} • 
                          {job.filePath}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {job.status === "running" ? "Running..." : 
                           job.status === "completed" ? `${job.recordsProcessed || 0} records` :
                           job.status === "failed" ? "Failed" : 
                           job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : "Unknown time"}
                        </p>
                      </div>
                      <Badge variant={
                        job.status === "completed" ? "default" :
                        job.status === "running" ? "secondary" :
                        job.status === "failed" ? "destructive" : "outline"
                      }>
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {recentJobs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent jobs found. Create an automation schedule to start pulling data.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Monitoring & Logs</CardTitle>
              <CardDescription>Detailed logs and monitoring information for debugging and analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Monitoring and logging interface coming soon. This will include detailed execution logs, 
                performance metrics, error tracking, and system health monitoring.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Create Automation Dialog Component
function CreateAutomationDialog({ suppliers, dataSources }: { suppliers: any[], dataSources: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AutomationSchedule>({
    resolver: zodResolver(automationScheduleSchema),
    defaultValues: {
      name: "",
      isActive: true,
      catalogEnabled: true,
      catalogFilePath: "",
      catalogFrequency: "daily",
      catalogTimesPerDay: 1,
      catalogScheduleTimes: ["02:00"],
      inventoryEnabled: true,
      inventoryFilePath: "",
      inventoryFrequency: "hourly",
      inventoryTimesPerDay: 12,
      inventoryStartTime: "06:00",
      inventoryEndTime: "22:00",
      waitForCatalogCompletion: true,
      catalogTimeoutMinutes: 30,
      inventoryDelayAfterCatalog: 10,
      maxRetryAttempts: 3,
      retryDelayMinutes: 30,
      pauseOnConsecutiveFailures: 5,
      notifyOnSuccess: false,
      notifyOnFailure: true,
      notificationEmails: []
    }
  });

  const createAutomation = useMutation({
    mutationFn: (data: AutomationSchedule) => apiRequest("/api/supplier-automation", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-automation"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Automation schedule created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create automation schedule",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Automation Schedule</DialogTitle>
          <DialogDescription>
            Set up automated data pulls for catalog and inventory files from your supplier
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createAutomation.mutate(data))} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Automation Name</FormLabel>
                    <FormControl>
                      <Input placeholder="CWR Distribution Automation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Enable this automation schedule</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Catalog Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Catalog Processing</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="catalogFilePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catalog File Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/eco8/out/catalog.csv" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="catalogFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="once">Once</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Inventory Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Inventory Processing</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inventoryFilePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inventory File Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/eco8/out/inventory.csv" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inventoryFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="inventoryTimesPerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Times per Day</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="24" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inventoryStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inventoryEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAutomation.isPending}>
                {createAutomation.isPending ? "Creating..." : "Create Automation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Automation Dialog Component
function EditAutomationDialog({ schedule, suppliers, dataSources }: { schedule: any, suppliers: any[], dataSources: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Convert old automation format to new format with file paths
  const convertToNewFormat = (oldSchedule: any) => {
    const filePaths = [];
    
    // Add catalog file path if enabled
    if (oldSchedule.catalogEnabled && oldSchedule.catalogFilePath) {
      filePaths.push({
        id: Date.now(),
        label: 'Catalog Processing',
        filePath: oldSchedule.catalogFilePath,
        fileType: 'catalog',
        isEnabled: true,
        frequency: oldSchedule.catalogFrequency || 'daily',
        timesPerDay: oldSchedule.catalogTimesPerDay || 1,
        startTime: oldSchedule.catalogScheduleTimes?.[0] || '02:00',
        endTime: '22:00',
        processingOrder: 1
      });
    }
    
    // Add inventory file path if enabled
    if (oldSchedule.inventoryEnabled && oldSchedule.inventoryFilePath) {
      filePaths.push({
        id: Date.now() + 1,
        label: 'Inventory Processing',
        filePath: oldSchedule.inventoryFilePath,
        fileType: 'inventory',
        isEnabled: true,
        frequency: oldSchedule.inventoryFrequency || 'hourly',
        timesPerDay: oldSchedule.inventoryTimesPerDay || 12,
        startTime: oldSchedule.inventoryStartTime || '06:00',
        endTime: oldSchedule.inventoryEndTime || '22:00',
        processingOrder: 2
      });
    }
    
    return {
      ...oldSchedule,
      filePaths
    };
  };

  const isLoading = false;

  // Initialize state from converted data - only run once when dialog opens
  const [initialized, setInitialized] = useState(false);
  const [automationName, setAutomationName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [filePaths, setFilePaths] = useState<any[]>([]);
  const [maxRetryAttempts, setMaxRetryAttempts] = useState(3);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(30);
  const [pauseOnConsecutiveFailures, setPauseOnConsecutiveFailures] = useState(5);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);

  // Initialize state once when dialog opens
  useEffect(() => {
    if (isOpen && !initialized) {
      const fullAutomation = convertToNewFormat(schedule);
      const data = fullAutomation as any;
      setAutomationName(data.name || '');
      setIsActive(data.isActive || true);
      setFilePaths(data.filePaths || []);
      setMaxRetryAttempts(data.maxRetryAttempts || 3);
      setRetryDelayMinutes(data.retryDelayMinutes || 30);
      setPauseOnConsecutiveFailures(data.pauseOnConsecutiveFailures || 5);
      setNotifyOnSuccess(data.notifyOnSuccess || false);
      setNotifyOnFailure(data.notifyOnFailure || true);
      setNotificationEmails(data.notificationEmails || []);
      setInitialized(true);
    }
    
    // Reset initialized state when dialog closes
    if (!isOpen && initialized) {
      setInitialized(false);
    }
  }, [isOpen, initialized, schedule]);

  const addFilePath = () => {
    const newFilePath = {
      id: Date.now(),
      label: '',
      filePath: '',
      fileType: 'catalog',
      isEnabled: true,
      frequency: 'daily',
      timesPerDay: 1,
      startTime: '06:00',
      endTime: '22:00',
      processingOrder: filePaths.length + 1
    };
    setFilePaths([...filePaths, newFilePath]);
  };

  const removeFilePath = (id: number) => {
    setFilePaths(filePaths.filter((fp: any) => fp.id !== id));
  };

  const updateFilePath = (id: number, updates: any) => {
    setFilePaths(filePaths.map((fp: any) => fp.id === id ? { ...fp, ...updates } : fp));
  };

  const updateAutomation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/automations/${schedule.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-pull-jobs"] });
      toast({
        title: "Automation Updated",
        description: `${automationName} has been updated successfully.`,
      });
      setIsOpen(false);
    },
    onError: (error) => {
      console.error("Update automation error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update automation schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = () => {
    const data = {
      name: automationName,
      isActive,
      maxRetryAttempts,
      retryDelayMinutes,
      pauseOnConsecutiveFailures,
      notifyOnSuccess,
      notifyOnFailure,
      notificationEmails,
      filePaths: filePaths.map((fp: any) => ({
        label: fp.label,
        filePath: fp.filePath,
        fileType: fp.fileType,
        isEnabled: fp.isEnabled,
        frequency: fp.frequency,
        timesPerDay: fp.timesPerDay,
        startTime: fp.startTime,
        endTime: fp.endTime,
        processingOrder: fp.processingOrder
      }))
    };
    updateAutomation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Automation Schedule</DialogTitle>
          <DialogDescription>
            Modify the automation configuration for {schedule.name}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading automation details...</p>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Automation Name</Label>
                  <Input
                    id="name"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="e.g., CWR Distribution Automation"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="active">Enable automation</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Path Configurations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  File Path Schedules
                </span>
                <Button onClick={addFilePath} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add File Path
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filePaths.map((filePath: any, index: number) => (
                <Card key={filePath.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={filePath.isEnabled}
                          onCheckedChange={(checked) => updateFilePath(filePath.id, { isEnabled: checked })}
                        />
                        <span className="font-medium">{filePath.label || `File Path ${index + 1}`}</span>
                      </div>
                      <Button
                        onClick={() => removeFilePath(filePath.id)}
                        size="sm"
                        variant="destructive"
                        disabled={filePaths.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={filePath.label}
                          onChange={(e) => updateFilePath(filePath.id, { label: e.target.value })}
                          placeholder="e.g., Main Catalog"
                        />
                      </div>
                      <div>
                        <Label>File Path</Label>
                        <Input
                          value={filePath.filePath}
                          onChange={(e) => updateFilePath(filePath.id, { filePath: e.target.value })}
                          placeholder="e.g., /eco8/out/catalog.csv"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>File Type</Label>
                        <Select
                          value={filePath.fileType}
                          onValueChange={(value) => updateFilePath(filePath.id, { fileType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="catalog">Catalog</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="pricing">Pricing</SelectItem>
                            <SelectItem value="images">Images</SelectItem>
                            <SelectItem value="specifications">Specifications</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Frequency</Label>
                        <Select
                          value={filePath.frequency}
                          onValueChange={(value) => updateFilePath(filePath.id, { frequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Times per Day
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={filePath.timesPerDay}
                          onChange={(e) => updateFilePath(filePath.id, { timesPerDay: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={filePath.startTime}
                          onChange={(e) => updateFilePath(filePath.id, { startTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={filePath.endTime}
                          onChange={(e) => updateFilePath(filePath.id, { endTime: e.target.value })}
                        />
                      </div>
                    </div>

                    {filePath.frequency === 'hourly' && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        This file will run {filePath.timesPerDay} times between {filePath.startTime} and {filePath.endTime}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Max Retry Attempts</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={maxRetryAttempts}
                    onChange={(e) => setMaxRetryAttempts(parseInt(e.target.value) || 3)}
                  />
                </div>
                <div>
                  <Label>Retry Delay (minutes)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    value={retryDelayMinutes}
                    onChange={(e) => setRetryDelayMinutes(parseInt(e.target.value) || 30)}
                  />
                </div>
                <div>
                  <Label>Pause After Failures</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={pauseOnConsecutiveFailures}
                    onChange={(e) => setPauseOnConsecutiveFailures(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notifyOnSuccess}
                    onCheckedChange={setNotifyOnSuccess}
                  />
                  <Label>Notify on Success</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={notifyOnFailure}
                    onCheckedChange={setNotifyOnFailure}
                  />
                  <Label>Notify on Failure</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onSubmit}
              disabled={updateAutomation.isPending || !automationName}
            >
              {updateAutomation.isPending ? "Updating..." : "Update Automation"}
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Test Inventory Updates Dialog Component  
function TestInventoryDialog({ schedule }: { schedule: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  const runInventoryTest = async () => {
    setIsTestRunning(true);
    setTestResults(null);

    try {
      const response = await apiRequest(`/api/test-inventory-pull/${schedule.id}`, {
        method: "POST",
        body: JSON.stringify({ testMode: true })
      });

      setTestResults(response);
      toast({
        title: "Inventory Test Complete",
        description: `Updated ${response.updatedProducts || 0} products successfully.`,
      });
    } catch (error) {
      toast({
        title: "Test Failed", 
        description: "Failed to run inventory test. Please check your automation configuration.",
        variant: "destructive",
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Database className="h-4 w-4 mr-2" />
          Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Inventory Updates</DialogTitle>
          <DialogDescription>
            Run a test inventory pull to see how your existing products will be updated
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Test Configuration</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inventory Path:</span>
                <span className="font-mono">{schedule.inventoryFilePath}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency:</span>
                <span>{schedule.inventoryFrequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Times per Day:</span>
                <span>{schedule.inventoryTimesPerDay}</span>
              </div>
            </div>
          </div>

          {testResults && (
            <div className="p-4 border rounded-lg bg-green-50">
              <h4 className="font-medium mb-2 text-green-800">Test Results</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Products Updated:</span>
                  <span className="font-medium">{testResults.updatedProducts || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Time:</span>
                  <span className="font-medium">{testResults.processingTimeMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="default">{testResults.status}</Badge>
                </div>
                {testResults.updatedProducts > 0 && (
                  <div className="mt-3 text-xs text-green-700">
                    <p>✓ Inventory levels and pricing updated for your CWR products</p>
                    <p>✓ Changes can be viewed in product details pages</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button onClick={runInventoryTest} disabled={isTestRunning}>
            {isTestRunning ? "Running Test..." : "Run Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
