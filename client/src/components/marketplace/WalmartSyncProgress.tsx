import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useWalmartSyncProgress } from '@/hooks/useWalmartMarketData';
import { Loader2 } from 'lucide-react';

export function WalmartSyncProgress() {
  const { data: progress } = useWalmartSyncProgress();

  if (!progress?.isRunning) {
    return null;
  }

  const percentage = progress.total > 0 ? Math.round((progress.progress / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sync in Progress
        </CardTitle>
        <CardDescription>
          Syncing products with Walmart catalog
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress: {progress.progress} / {progress.total}</span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} data-testid="progress-sync" />
        {progress.currentProduct && (
          <p className="text-xs text-muted-foreground">
            Currently syncing: {progress.currentProduct}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
