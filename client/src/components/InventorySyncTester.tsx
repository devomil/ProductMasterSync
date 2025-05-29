import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SyncResult {
  success: boolean;
  totalCWRRecords: number;
  updatedProducts: number;
  newProductsFound: number;
  errors: string[];
  timestamp: string;
  source: string;
}

export function InventorySyncTester() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      const result = await apiRequest<SyncResult>('/api/inventory/sync', {
        method: 'POST'
      });
      
      setSyncResult(result);
      console.log('CWR inventory sync completed:', result);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync inventory';
      setError(errorMessage);
      console.error('Inventory sync failed:', err);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          CWR Inventory Synchronization
        </CardTitle>
        <CardDescription>
          Test automated synchronization with authentic CWR SFTP data from /eco8/out/inventory.csv
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Sync from CWR SFTP</h4>
            <p className="text-sm text-muted-foreground">
              Connect to edi.cwrdistribution.com and update all product inventory
            </p>
          </div>
          
          <Button 
            onClick={handleSync} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Sync Failed</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {syncResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  {syncResult.success ? 'Sync Completed' : 'Sync Failed'}
                </p>
                <p className="text-sm text-green-600">
                  Source: {syncResult.source}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">CWR Records</p>
                <p className="text-2xl font-bold text-blue-600">{syncResult.totalCWRRecords}</p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">Updated Products</p>
                <p className="text-2xl font-bold text-green-600">{syncResult.updatedProducts}</p>
              </div>
            </div>

            {syncResult.newProductsFound > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">
                  New Products Found in CWR: {syncResult.newProductsFound}
                </p>
                <p className="text-xs text-yellow-600">
                  These products exist in CWR inventory but not in your catalog
                </p>
              </div>
            )}

            {syncResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-800">Errors:</p>
                {syncResult.errors.map((error, index) => (
                  <Badge key={index} variant="destructive" className="text-xs">
                    {error}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Last sync: {new Date(syncResult.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}