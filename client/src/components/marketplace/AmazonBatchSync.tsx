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
  XCircle 
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
import { useBatchSyncAmazonData, useAmazonConfigStatus } from '@/hooks/useAmazonMarketData';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AmazonBatchSync() {
  const [batchSize, setBatchSize] = useState<number>(10);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  
  const { data: configStatus, isLoading: isConfigStatusLoading } = useAmazonConfigStatus();
  const batchSyncMutation = useBatchSyncAmazonData();

  // Check if configuration is valid
  const isConfigValid = configStatus?.configValid;

  // Handle batch sync click
  const handleBatchSync = () => {
    if (!isConfigValid) {
      setIsConfigModalOpen(true);
      return;
    }
    
    batchSyncMutation.mutate(batchSize);
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
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
              Amazon SP-API configuration is incomplete. Click the "Configure API" button to set up the required credentials.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="batch-size">Batch Size: {batchSize} products</Label>
            </div>
            <Slider
              id="batch-size"
              min={1}
              max={50}
              step={1}
              value={[batchSize]}
              onValueChange={(value) => setBatchSize(value[0])}
            />
            <p className="text-sm text-muted-foreground">
              Number of products to process in a single batch. Higher values may take longer but process more products.
            </p>
          </div>

          {batchSyncMutation.data && (
            <div className="mt-4">
              <div className="rounded-md bg-muted p-4">
                <div className="font-medium">Last Sync Results</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div className="flex flex-col items-center p-2 rounded-md bg-background">
                    <span className="text-muted-foreground">Processed</span>
                    <span className="text-xl font-bold">
                      {batchSyncMutation.data.processed}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-background">
                    <span className="text-muted-foreground text-green-600">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Success
                    </span>
                    <span className="text-xl font-bold text-green-600">
                      {batchSyncMutation.data.successful}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-background">
                    <span className="text-muted-foreground text-red-600">
                      <XCircle className="h-4 w-4 inline mr-1" />
                      Failed
                    </span>
                    <span className="text-xl font-bold text-red-600">
                      {batchSyncMutation.data.failed}
                    </span>
                  </div>
                </div>
                
                {batchSyncMutation.data.failed > 0 && Object.keys(batchSyncMutation.data.errors).length > 0 && (
                  <div className="mt-2">
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">View Errors</summary>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {Object.entries(batchSyncMutation.data.errors).map(([sku, error]) => (
                          <div key={sku} className="py-1">
                            <span className="font-semibold">{sku}:</span> {error}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
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
                  {configStatus?.configValid ? (
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
                        {configStatus?.missingEnvVars?.map((envVar: string) => (
                          <li key={envVar} className="text-red-600">{envVar}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              
              {!configStatus?.configValid && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Missing Credentials</AlertTitle>
                  <AlertDescription>
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