import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface SyncJob {
  id: number;
  batchId: string;
  totalQueued: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  notFoundCount: number;
  asinMatchesFound: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  failureReason: string | null;
}

export function AmazonSyncJobHistory() {
  const { data: syncJobs, isLoading } = useQuery<SyncJob[]>({
    queryKey: ['/api/marketplace/amazon/sync-jobs/history'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return '-';
    const seconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Sync Jobs</CardTitle>
        <CardDescription>
          History of Amazon batch sync operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Not Found</TableHead>
              <TableHead>ASIN Matches</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && syncJobs && syncJobs.length > 0 ? (
              syncJobs.map((job) => (
                <TableRow key={job.id} data-testid={`row-sync-job-${job.id}`}>
                  <TableCell className="text-sm">
                    {new Date(job.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        job.status === 'completed' ? 'default' :
                        job.status === 'failed' ? 'destructive' :
                        job.status === 'in_progress' ? 'outline' :
                        'secondary'
                      }
                      className="flex items-center gap-1 w-fit"
                      data-testid={`badge-job-status-${job.status}`}
                    >
                      {job.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                      {job.status === 'failed' && <XCircle className="h-3 w-3" />}
                      {job.status === 'in_progress' && <Clock className="h-3 w-3" />}
                      {job.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{job.processedCount}</span>
                      <span className="text-muted-foreground"> / {job.totalQueued}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-green-600" data-testid={`text-job-success-${job.id}`}>
                      {job.successCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-red-600">
                      {job.failedCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-gray-600">
                      {job.notFoundCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-blue-600" data-testid={`text-job-asin-matches-${job.id}`}>
                      {job.asinMatchesFound}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDuration(job.durationMs)}
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading sync job history...
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">
                  No batch sync jobs yet. Start a batch sync to see job history.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {syncJobs && syncJobs.length > 0 && syncJobs[0].failureReason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Last Job Failure:</span> {syncJobs[0].failureReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
