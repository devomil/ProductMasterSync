import { useState } from "react";
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
import { Clock, Play, Pause, Settings, AlertTriangle, CheckCircle, XCircle, RotateCcw, Database, Calendar, Activity } from "lucide-react";
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

export default function InventoryManagement() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch automation schedules
  const { data: automationSchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["/api/supplier-automation"],
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
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
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