import React from 'react';
import { AmazonBatchSync } from '@/components/marketplace/AmazonBatchSync';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Download, ExternalLink, HelpCircle, RefreshCw, Settings, Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function AmazonIntegration() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['/api/products'],
  });

  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Amazon Marketplace Integration</h1>
          <p className="text-muted-foreground">
            Connect your product catalog with Amazon's Selling Partner API
          </p>
        </div>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Products
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "Loading..." : products?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Products in your catalog
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Amazon Matches
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">23</div>
                <p className="text-xs text-muted-foreground">
                  Products matched with Amazon
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Data Coverage
                </CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">38%</div>
                <p className="text-xs text-muted-foreground">
                  UPC coverage in catalog
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Complete these steps to set up Amazon SP-API integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Enable Amazon Integration</h3>
                      <p className="text-sm text-muted-foreground">
                        Integration module is active and ready to use.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Configure SP-API Credentials</h3>
                      <p className="text-sm text-muted-foreground">
                        Set up your Amazon Selling Partner API credentials.
                      </p>
                      <Button variant="link" size="sm" className="p-0 h-auto text-blue-600" onClick={() => setActiveTab('sync')}>
                        Configure Now →
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Run Initial Data Sync</h3>
                      <p className="text-sm text-muted-foreground">
                        Sync your products with Amazon catalog data.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Schedule Regular Updates</h3>
                      <p className="text-sm text-muted-foreground">
                        Set up automatic sync schedule for marketplace data.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
                <CardDescription>
                  Helpful resources for working with Amazon SP-API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Amazon SP-API Documentation</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Official documentation for the Selling Partner API.
                      </p>
                      <a 
                        href="https://developer-docs.amazon.com/sp-api/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 flex items-center"
                      >
                        View Documentation <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <Upload className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Create UPC Batch Import</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Import UPC codes for your products in bulk.
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600"
                      >
                        Create Import
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      <Download className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">Export Amazon Data</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        Export all Amazon marketplace data to CSV.
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600"
                      >
                        Export Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="sync" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <AmazonBatchSync />
            
            <Card>
              <CardHeader>
                <CardTitle>UPC Coverage</CardTitle>
                <CardDescription>
                  Products that have UPC codes and can be matched with Amazon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>UPC</TableHead>
                      <TableHead>ASIN</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && products ? (
                      products.slice(0, 5).map((product: any) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.sku}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>{product.upc || '-'}</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" disabled={!product.upc}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sync
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          Loading products...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>
                Recent Amazon data sync operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Successful</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>May 13, 2025</TableCell>
                    <TableCell>Batch Sync</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>8</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>3m 24s</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>May 12, 2025</TableCell>
                    <TableCell>Batch Sync</TableCell>
                    <TableCell>25</TableCell>
                    <TableCell>23</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>5m 17s</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>May 10, 2025</TableCell>
                    <TableCell>Single Product</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>32s</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Check component for rendering the checkmark in the getting started section
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}