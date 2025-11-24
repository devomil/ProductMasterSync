import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function WalmartBatchSync() {
  const [batchSize, setBatchSize] = useState('10');
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleStartSync = async () => {
    try {
      setIsSyncing(true);
      await apiRequest('POST', '/api/marketplace/walmart/batch-sync', { 
        batchSize: parseInt(batchSize) 
      });
      
      toast({
        title: 'Batch Sync Started',
        description: `Syncing ${batchSize} products with Walmart catalog`,
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Sync</CardTitle>
        <CardDescription>
          Sync multiple products with Walmart catalog at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="batch-size">Number of Products</Label>
          <Input
            id="batch-size"
            type="number"
            min="1"
            max="100"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            data-testid="input-batch-size"
          />
          <p className="text-xs text-muted-foreground">
            Sync up to 100 products at once
          </p>
        </div>
        
        <Button 
          onClick={handleStartSync}
          disabled={isSyncing}
          className="w-full"
          data-testid="button-start-batch-sync"
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {isSyncing ? 'Syncing...' : 'Start Batch Sync'}
        </Button>
      </CardContent>
    </Card>
  );
}
