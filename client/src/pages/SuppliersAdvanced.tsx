import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  Shield, 
  BarChart3,
  Target,
  Globe,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function SuppliersAdvanced() {
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [timeframe, setTimeframe] = useState("3months");

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const { data: supplierKPIs } = useQuery({
    queryKey: ["/api/suppliers-advanced/kpis", selectedSupplier, timeframe],
  });

  const { data: riskAnalysis } = useQuery({
    queryKey: ["/api/suppliers-advanced/risk-analysis", selectedSupplier],
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["/api/suppliers-advanced/price-history", selectedSupplier, timeframe],
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Supplier Management</h1>
          <p className="text-muted-foreground">
            Supplier performance KPIs, risk assessment, and strategic relationship management
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers?.map((supplier: any) => (
                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">1 Month</SelectItem>
              <SelectItem value="3months">3 Months</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="kpis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kpis">Supplier KPIs</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="pricing">Price History & Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance Scorecards</TabsTrigger>
          <TabsTrigger value="contracts">Contract Management</TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {supplierKPIs?.onTimeDelivery || 94}%
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                  +2.1% from last period
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {supplierKPIs?.qualityScore || 4.7}/5.0
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                  +0.3 improvement
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {supplierKPIs?.costVariance || -2.3}%
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                  Below budget target
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {supplierKPIs?.responseTime || 4.2}hrs
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                  -1.2hrs improvement
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Supplier Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suppliers?.slice(0, 3).map((supplier: any, index: number) => (
                  <div key={supplier.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {supplier.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">{supplier.name}</h4>
                        <p className="text-sm text-muted-foreground">{supplier.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-sm font-medium">97%</div>
                        <div className="text-xs text-muted-foreground">Delivery</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">4.8</div>
                        <div className="text-xs text-muted-foreground">Quality</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-green-600">Low</div>
                        <div className="text-xs text-muted-foreground">Risk</div>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Financial Risk</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Low</div>
                <p className="text-xs text-muted-foreground">
                  Strong financial position
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Geographic Risk</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">Medium</div>
                <p className="text-xs text-muted-foreground">
                  Single region dependency
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance Risk</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Low</div>
                <p className="text-xs text-muted-foreground">
                  All certifications current
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <h4 className="font-medium">Single Source Dependency</h4>
                      <p className="text-sm text-muted-foreground">CWR Distribution - Marine Electronics</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Medium Risk</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <h4 className="font-medium">Financial Stability</h4>
                      <p className="text-sm text-muted-foreground">Strong credit rating and payment history</p>
                    </div>
                  </div>
                  <Badge variant="default">Low Risk</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-green-500" />
                    <div>
                      <h4 className="font-medium">Compliance Status</h4>
                      <p className="text-sm text-muted-foreground">All required certifications up to date</p>
                    </div>
                  </div>
                  <Badge variant="default">Low Risk</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Price Change</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">+3.2%</div>
                <p className="text-xs text-muted-foreground">
                  Last 3 months
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price Volatility</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">Moderate</div>
                <p className="text-xs text-muted-foreground">
                  ±5.2% variation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contract Savings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">$12,450</div>
                <p className="text-xs text-muted-foreground">
                  YTD negotiated savings
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historical Price Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-64 flex items-center justify-center border rounded">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Price History Chart</h3>
                    <p className="text-gray-600">
                      Historical pricing data visualization would appear here
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Top Price Increases</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                        <span className="text-sm">Marine Compass HF-743</span>
                        <span className="text-sm font-medium text-red-600">+8.3%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                        <span className="text-sm">Navigation Light LED</span>
                        <span className="text-sm font-medium text-red-600">+5.7%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Top Price Decreases</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                        <span className="text-sm">Safety Whistle Pack</span>
                        <span className="text-sm font-medium text-green-600">-3.2%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                        <span className="text-sm">Anchor Chain 8mm</span>
                        <span className="text-sm font-medium text-green-600">-1.8%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Scorecards</CardTitle>
              <p className="text-sm text-muted-foreground">
                Comprehensive performance evaluation across key metrics
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {suppliers?.slice(0, 2).map((supplier: any, index: number) => (
                  <div key={supplier.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">{supplier.name}</h3>
                      <Badge variant="default">Overall Score: 87/100</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Quality</span>
                          <span className="text-sm">92/100</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Delivery</span>
                          <span className="text-sm">88/100</span>
                        </div>
                        <Progress value={88} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Cost</span>
                          <span className="text-sm">84/100</span>
                        </div>
                        <Progress value={84} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">Service</span>
                          <span className="text-sm">90/100</span>
                        </div>
                        <Progress value={90} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track contract terms, renewals, and negotiation opportunities
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <div>
                      <h4 className="font-medium">CWR Distribution - Master Agreement</h4>
                      <p className="text-sm text-muted-foreground">Annual contract with volume discounts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Expires: Jun 2025</div>
                    <Badge variant="secondary">120 days remaining</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-yellow-500" />
                    <div>
                      <h4 className="font-medium">Test Marine Supply - Service Agreement</h4>
                      <p className="text-sm text-muted-foreground">Quarterly pricing reviews</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Expires: Mar 2025</div>
                    <Badge variant="destructive">45 days remaining</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}