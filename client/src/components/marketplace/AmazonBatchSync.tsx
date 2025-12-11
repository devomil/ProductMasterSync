import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  RefreshCw, 
  Settings, 
  XCircle,
  Building2
} from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatchSyncAmazonData, useAmazonConfigStatus, useAmazonSyncStats } from '@/hooks/useAmazonMarketData';
import { useSuppliers } from '@/hooks/useSuppliers';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AmazonBatchSync() {
  const [batchSize, setBatchSize] = useState<number>(10);
  const [isFullCatalog, setIsFullCatalog] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  
  const { data: configStatus, isLoading: isConfigStatusLoading } = useAmazonConfigStatus();
  const { data: syncStats, isLoading: isStatsLoading } = useAmazonSyncStats();
  const { suppliers, isLoading: isSuppliersLoading } = useSuppliers();
  const batchSyncMutation = useBatchSyncAmazonData();

  // Check if configuration is valid
  const isConfigValid = (configStatus as { configValid?: boolean; missingEnvVars?: string[] } | undefined)?.configValid;

  // Handle batch sync click
  const handleBatchSync = () => {
    if (!isConfigValid) {
      setIsConfigModalOpen(true);
      return;
    }
    
    // If full catalog is selected, use a very large number (999999)
    // Otherwise use the specified batch size
    const effectiveLimit = isFullCatalog ? 999999 : batchSize;
    const supplierId = selectedSupplier !== 'all' ? parseInt(selectedSupplier, 10) : undefined;
    batchSyncMutation.mutate({ limit: effectiveLimit, supplierId });
  };

  // Handle "save" config click
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Credentials Already Configured',
      description: 'Amazon SP-API credentials are set as environment secrets. The integration is ready to use!',
    });
    setIsConfigModalOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <RefreshCw className="mr-2 h-5 w-5 text-blue-500" />
          Amazon Product Sync
        </CardTitle>
        <CardDescription>
          Sync product data with Amazon Selling Partner API
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConfigStatusLoading && !isConfigValid ? (
          <Alert className="mb-4 border-yellow-500 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Configuration Required</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Amazon SP-API configuration is incomplete. Click the "Configure API" button to set up the required credentials.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-select" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Supplier Filter
              </Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger id="supplier-select" data-testid="select-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {!isSuppliersLoading && suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Sync products from a specific supplier instead of the full catalog.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="full-catalog"
                checked={isFullCatalog}
                onChange={(e) => setIsFullCatalog(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                data-testid="checkbox-full-catalog"
              />
              <Label htmlFor="full-catalog" className="cursor-pointer font-medium">
                {selectedSupplier === 'all' ? 'Sync Full Catalog' : 'Sync All Products from This Supplier'}
              </Label>
            </div>
            
            {!isFullCatalog && (
              <>
                <div className="flex justify-between">
                  <Label htmlFor="batch-size">Batch Size: {batchSize} products</Label>
                </div>
                <Slider
                  id="batch-size"
                  min={1}
                  max={5000}
                  step={10}
                  value={[batchSize]}
                  onValueChange={(value) => setBatchSize(value[0])}
                  data-testid="slider-batch-size"
                />
                <p className="text-sm text-muted-foreground">
                  Number of products to process in a single batch. Higher values may take longer but process more products.
                </p>
              </>
            )}
            
            {isFullCatalog && (
              <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  🚀 {selectedSupplier === 'all' ? 'Full catalog sync enabled' : 'Full supplier sync enabled'}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  {selectedSupplier === 'all' 
                    ? 'This will process all products in your catalog with UPC or MPN codes. For large catalogs (30,000+ products), this may take several hours.'
                    : 'This will sync all products from the selected supplier that have UPC or MPN codes.'
                  }
                </p>
              </div>
            )}
          </div>

          {syncStats && !isStatsLoading && (
            <div className="mt-4">
              <div className="rounded-md bg-muted p-4">
                <div className="font-medium mb-3">Overall Sync Statistics</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="flex flex-col items-center p-3 rounded-md bg-background">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">
                      {syncStats.total}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-md bg-background">
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Success
                    </span>
                    <span className="text-2xl font-bold text-green-600">
                      {syncStats.successful}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-md bg-background">
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Failed
                    </span>
                    <span className="text-2xl font-bold text-red-600">
                      {syncStats.failed}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-md bg-background">
                    <span className="text-muted-foreground">Not Found</span>
                    <span className="text-2xl font-bold text-yellow-600">
                      {syncStats.notFound}
                    </span>
                  </div>
                </div>
                
                {syncStats.avgResponseTime && (
                  <div className="mt-3 text-sm text-muted-foreground text-center">
                    Avg response time: {Math.round(syncStats.avgResponseTime)}ms
                  </div>
                )}
              </div>
            </div>
          )}

          {batchSyncMutation.data && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Sync Job Completed</AlertTitle>
              <AlertDescription>
                Latest batch processed {batchSyncMutation.data.processed} products: 
                <span className="text-green-600 font-semibold"> {batchSyncMutation.data.successful} successful</span>,
                <span className="text-red-600 font-semibold"> {batchSyncMutation.data.failed} failed</span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configure API
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Amazon SP-API Configuration</DialogTitle>
              <DialogDescription>
                Enter your Amazon Selling Partner API credentials. These will be saved as environment variables.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Amazon SP-API Credentials</AlertTitle>
                <AlertDescription>
                  {(configStatus as { configValid?: boolean; missingEnvVars?: string[] } | undefined)?.configValid ? (
                    <div>
                      <p className="mb-2">✓ All required credentials are configured</p>
                      <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                        <li>Client ID</li>
                        <li>Client Secret</li>
                        <li>Refresh Token</li>
                        <li>Marketplace: US (ATVPDKIKX0DER)</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2">Missing required credentials:</p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {((configStatus as { configValid?: boolean; missingEnvVars?: string[] } | undefined)?.missingEnvVars || []).map((envVar: string) => (
                          <li key={envVar} className="text-red-600">{envVar}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              
              {!(configStatus as { configValid?: boolean; missingEnvVars?: string[] } | undefined)?.configValid && (
                <Alert className="border-yellow-500 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Missing Credentials</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    Some credentials are not configured. Please add them in the Replit Secrets panel to enable Amazon integration.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">To update credentials:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the Replit Secrets panel (🔒 icon in left sidebar)</li>
                  <li>Add or update these secrets:
                    <ul className="ml-6 mt-1 list-disc list-inside">
                      <li>AMAZON_SP_API_CLIENT_ID</li>
                      <li>AMAZON_SP_API_CLIENT_SECRET</li>
                      <li>AMAZON_SP_API_REFRESH_TOKEN</li>
                    </ul>
                  </li>
                  <li>Restart the application for changes to take effect</li>
                </ol>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsConfigModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Button 
          onClick={handleBatchSync}
          disabled={batchSyncMutation.isPending}
        >
          {batchSyncMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync with Amazon
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}