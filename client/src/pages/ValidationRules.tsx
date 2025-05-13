import { useState } from "react";
import { 
  AlertCircle, 
  Plus, 
  Filter, 
  Search,
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  CheckSquare,
  FileCheck,
  Activity,
  Gauge,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

// Sample validation rules
const validationRules = [
  {
    id: 1,
    name: "Required Fields Check",
    description: "Ensures all required product fields are filled",
    type: "completeness",
    scope: "product",
    severity: "error",
    active: true,
    condition: "!isEmpty(name) && !isEmpty(sku) && !isEmpty(description)",
    failureRate: 4,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: 2,
    name: "Price Range Validation",
    description: "Checks if product price is within acceptable range",
    type: "range",
    scope: "product",
    severity: "warning",
    active: true,
    condition: "price > 0 && price < 10000",
    failureRate: 7,
    lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000)
  },
  {
    id: 3,
    name: "Image Format Check",
    description: "Validates product images are in acceptable formats",
    type: "format",
    scope: "product",
    severity: "info",
    active: false,
    condition: "images.every(img => ['jpg', 'png', 'webp'].includes(img.format))",
    failureRate: 12,
    lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000)
  },
  {
    id: 4,
    name: "Category Attribute Validation",
    description: "Ensures products have required category-specific attributes",
    type: "conformity",
    scope: "product",
    severity: "error",
    active: true,
    condition: "hasRequiredCategoryAttributes(productId, categoryId)",
    failureRate: 15,
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000)
  },
  {
    id: 5,
    name: "Supplier Reference Check",
    description: "Validates that products have at least one supplier reference",
    type: "relationship",
    scope: "product",
    severity: "warning",
    active: true,
    condition: "productSuppliers.length > 0",
    failureRate: 9,
    lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000)
  }
];

// Data quality metrics
const dataQualityMetrics = [
  { name: "Completeness", percentage: 91, color: "success" },
  { name: "Consistency", percentage: 82, color: "primary" },
  { name: "Accuracy", percentage: 79, color: "warning" },
  { name: "Timeliness", percentage: 95, color: "success" },
];

const ValidationRules = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rules");

  // Filter validation rules based on search query
  const filteredRules = validationRules.filter(rule => 
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return <Badge variant="warning">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "completeness":
        return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case "range":
        return <Gauge className="h-4 w-4 text-purple-500" />;
      case "format":
        return <FileCheck className="h-4 w-4 text-teal-500" />;
      case "conformity":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Activity className="h-4 w-4 text-neutral-500" />;
    }
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Validation Rules</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="rules" onValueChange={setActiveTab}>
          <div className="flex justify-between flex-col sm:flex-row">
            <TabsList>
              <TabsTrigger value="rules">Validation Rules</TabsTrigger>
              <TabsTrigger value="metrics">Data Quality Metrics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {activeTab === "rules" && (
              <div className="flex space-x-2 mt-3 sm:mt-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input 
                    type="search" 
                    placeholder="Search validation rules"
                    className="pl-9 w-full sm:w-64" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="rules" className="mt-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">
                        <div className="flex items-center">
                          Rule Name
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Failure Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-neutral-500">
                          {searchQuery ? "No rules matching your search" : "No validation rules available"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-sm text-neutral-500 truncate max-w-xs">
                              {rule.description}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center capitalize">
                              {getTypeIcon(rule.type)}
                              <span className="ml-1">{rule.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{rule.scope}</TableCell>
                          <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm ${rule.failureRate > 10 ? 'text-red-600' : 'text-neutral-600'}`}>
                                {rule.failureRate}%
                              </span>
                              <Progress 
                                value={100 - rule.failureRate} 
                                className="h-1.5 w-16 bg-neutral-200" 
                                indicatorClassName={rule.failureRate > 10 ? 'bg-red-500' : 'bg-green-500'} 
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch id={`rule-${rule.id}`} defaultChecked={rule.active} />
                              <Label htmlFor={`rule-${rule.id}`} className="text-sm text-neutral-500">
                                {rule.active ? 'Active' : 'Inactive'}
                              </Label>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Rule
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Log
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  View Failures
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="metrics" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="col-span-1 md:col-span-3 bg-white">
                <CardHeader>
                  <CardTitle>Overall Data Quality</CardTitle>
                  <CardDescription>
                    Data quality metrics based on validation rule results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto text-center mb-6">
                    <div className="inline-flex items-center justify-center p-1 bg-neutral-100 rounded-full h-32 w-32">
                      <div className="bg-white rounded-full h-28 w-28 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary">86%</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-neutral-900">Overall Data Quality Score</p>
                  </div>
                
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {dataQualityMetrics.map((metric, index) => (
                      <Card key={index} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{metric.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="text-2xl font-bold text-neutral-900 mb-2">{metric.percentage}%</div>
                          <Progress 
                            value={metric.percentage} 
                            className="h-1.5 bg-neutral-200" 
                            indicatorClassName={
                              metric.color === "success" ? "bg-green-500" : 
                              metric.color === "warning" ? "bg-amber-500" : 
                              "bg-primary"
                            } 
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="col-span-1 md:col-span-3">
                <CardHeader>
                  <CardTitle>Data Quality Trends</CardTitle>
                  <CardDescription>
                    Historical trends of data quality metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64 flex items-center justify-center">
                  <div className="text-neutral-500">
                    <Activity className="h-16 w-16 mx-auto mb-4 text-neutral-300" />
                    <p>Quality trend charts will be implemented soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Validation Settings</CardTitle>
                <CardDescription>Configure validation behavior and schedules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-md">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Automatic Validation</h4>
                      <p className="text-xs text-neutral-500">Validate products automatically when updated</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-md">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Block Invalid Submissions</h4>
                      <p className="text-xs text-neutral-500">Prevent saving products with validation errors</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-md">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Run Validation Jobs</h4>
                      <p className="text-xs text-neutral-500">Periodically validate all products in background</p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                  
                  <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-md">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Email Notifications</h4>
                      <p className="text-xs text-neutral-500">Send email when validation errors are detected</p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4 bg-neutral-50 flex justify-end">
                <Button>Save Settings</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ValidationRules;