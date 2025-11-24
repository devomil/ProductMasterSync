import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock } from 'lucide-react';

interface WalmartSyncJob {
  id: number;
  status: 'completed' | 'running' | 'failed';
  startedAt: string;
  completedAt?: string;
  productsProcessed: number;
  successCount: number;
  errorCount: number;
}

export function WalmartSyncJobHistory() {
  const { data: jobs, isLoading } = useQuery<WalmartSyncJob[]>({
    queryKey: ['/api/marketplace/walmart/sync-jobs'],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sync Jobs</CardTitle>
        <CardDescription>
          History of batch sync operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !jobs || jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No sync jobs found. Start a batch sync to see history here.
          </p>
        ) : (
          <div className="space-y-4">
            {jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(job.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>Processed: {job.productsProcessed}</span>
                    <span className="text-green-600">Success: {job.successCount}</span>
                    <span className="text-red-600">Errors: {job.errorCount}</span>
                  </div>
                  {job.completedAt && (
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Duration: {Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s
                      </span>
                    </div>
                  )}
                </div>
                <Badge variant={
                  job.status === 'completed' ? 'default' :
                  job.status === 'running' ? 'outline' :
                  'destructive'
                }>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
