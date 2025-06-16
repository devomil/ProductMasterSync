import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, XCircle, Pause, Play, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

interface BulkProcessingJob {
  id: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successfulSearches: number;
  failedSearches: number;
  startTime: string;
  endTime?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  progress: number;
  estimatedTimeRemaining?: number;
  results: Array<{
    row: number;
    searchCriteria: any;
    foundASINs: any[];
    error?: string;
    success: boolean;
  }>;
}

interface RateLimiterStatus {
  queueLength: number;
  activeRequests: number;
  tokenBucket: number;
  circuitBreakerOpen: boolean;
  failureCount: number;
}

interface BulkProgressMonitorProps {
  jobId?: string;
  onJobComplete?: (job: BulkProcessingJob) => void;
}

export default function BulkProgressMonitor({ jobId, onJobComplete }: BulkProgressMonitorProps) {
  const [job, setJob] = useState<BulkProcessingJob | null>(null);
  const [rateLimiterStatus, setRateLimiterStatus] = useState<RateLimiterStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [jobStatusInterval, setJobStatusInterval] = useState<NodeJS.Timeout | null>(null);
  const [rateLimiterInterval, setRateLimiterInterval] = useState<NodeJS.Timeout | null>(null);
  const [jobCompleted, setJobCompleted] = useState(false);

  useEffect(() => {
    if (jobId && !isPolling && !jobCompleted) {
      startPolling();
    }

    return () => {
      if (jobStatusInterval) {
        clearInterval(jobStatusInterval);
      }
      if (rateLimiterInterval) {
        clearInterval(rateLimiterInterval);
      }
    };
  }, [jobId, jobCompleted]);

  const stopAllPolling = () => {
    setIsPolling(false);
    setJobCompleted(true);
    
    if (jobStatusInterval) {
      clearInterval(jobStatusInterval);
      setJobStatusInterval(null);
    }
    if (rateLimiterInterval) {
      clearInterval(rateLimiterInterval);
      setRateLimiterInterval(null);
    }
  };

  const startPolling = () => {
    if (jobCompleted) return;
    
    setIsPolling(true);
    
    fetchJobStatus();
    fetchRateLimiterStatus();
    
    const jobInterval = setInterval(() => {
      if (!jobCompleted) fetchJobStatus();
    }, 1000);
    
    const limiterInterval = setInterval(() => {
      if (!jobCompleted) fetchRateLimiterStatus();
    }, 5000);
    
    setJobStatusInterval(jobInterval);
    setRateLimiterInterval(limiterInterval);
  };

  const fetchJobStatus = async () => {
    if (!jobId || !isPolling || jobCompleted) return;

    try {
      console.log(`Fetching job status for ${jobId}...`);
      const response = await fetch(`/api/marketplace/bulk-job-status/${jobId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Job status response:', data);
        
        if (data.success && data.data) {
          setJob(data.data);
          
          // Check if job is complete
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            console.log(`Job ${jobId} completed with status: ${data.data.status}`);
            stopAllPolling();
            
            if (onJobComplete && data.data.status === 'completed') {
              onJobComplete(data.data);
            }
          }
        } else {
          console.log('Job status response indicates no success or no data');
        }
      } else {
        console.error(`Job status fetch failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching job status:', error);
    }
  };

  const fetchRateLimiterStatus = async () => {
    if (!isPolling) return;
    
    try {
      const response = await fetch('/api/marketplace/rate-limiter-status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRateLimiterStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching rate limiter status:', error);
    }
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds === 0) return 'Calculating...';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'queued': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'processing': return <Activity className="h-4 w-4 animate-spin" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'queued': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (!job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            Processing Supplier Catalog...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-center text-muted-foreground">
              Analyzing your supplier manifest file...
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Reading UPC codes from CSV data</p>
              <p>• Checking existing Amazon marketplace data</p>
              <p>• Processing with rate limit optimization</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(job.status)}
              Supplier Catalog Analysis: {job.filename}
            </CardTitle>
            <Badge className={getStatusColor(job.status)}>
              {job.status.toUpperCase()}
            </Badge>
          </div>
          <CardDescription>
            Processing {job.totalRows} products with Amazon marketplace intelligence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Overall Progress</span>
              <span className="text-2xl font-bold text-primary">{job.progress.toFixed(1)}%</span>
            </div>
            <Progress value={job.progress} className="h-4" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{job.processedRows} of {job.totalRows} products analyzed</span>
              <span>{job.totalRows - job.processedRows} remaining</span>
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">{job.successfulSearches}</div>
              <div className="text-sm text-green-700">Amazon Matches</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">{job.failedSearches}</div>
              <div className="text-sm text-red-700">No Matches</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{job.processedRows}</div>
              <div className="text-sm text-blue-700">Processed</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">
                {job.successfulSearches > 0 ? ((job.successfulSearches / job.processedRows) * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-sm text-purple-700">Match Rate</div>
            </div>
          </div>

          {/* Processing Speed & Time Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg border">
              <div className="text-lg font-bold text-blue-600">
                {job.estimatedTimeRemaining ? formatTimeRemaining(job.estimatedTimeRemaining) : 'Calculating...'}
              </div>
              <div className="text-sm text-blue-700">Time Remaining</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border">
              <div className="text-lg font-bold text-orange-600">
                {job.processedRows > 0 ? ((Date.now() - new Date(job.startTime).getTime()) / job.processedRows / 1000).toFixed(1) : '0'}s
              </div>
              <div className="text-sm text-orange-700">Avg per Product</div>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg border">
              <div className="text-lg font-bold text-indigo-600">
                {job.processedRows > 0 ? (job.processedRows / ((Date.now() - new Date(job.startTime).getTime()) / 60000)).toFixed(1) : '0'}
              </div>
              <div className="text-sm text-indigo-700">Products/Min</div>
            </div>
          </div>

          {/* Current Processing Status */}
          {job.status === 'processing' && (
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-spin text-blue-600" />
                <span className="font-medium text-blue-800">Currently Processing...</span>
              </div>
              <div className="text-sm text-blue-700 mt-1">
                Reading UPC codes from supplier manifest and checking Amazon marketplace data
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {job.successfulSearches}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Successful
              </div>
            </div>
            
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {job.failedSearches}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                Failed
              </div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {job.processedRows}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Processed
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {job.totalRows - job.processedRows}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Remaining
              </div>
            </div>
          </div>

          {job.status === 'processing' && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Estimated Time Remaining:</span>
              </div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                {formatTimeRemaining(job.estimatedTimeRemaining)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {rateLimiterStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rate Limiter Status
            </CardTitle>
            <CardDescription>
              Amazon SP-API request throttling and queue management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                <div className="text-lg font-bold">
                  {rateLimiterStatus.queueLength}
                </div>
                <div className="text-xs text-muted-foreground">
                  Queue Length
                </div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {rateLimiterStatus.activeRequests}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Active Requests
                </div>
              </div>
              
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {rateLimiterStatus.tokenBucket}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  Available Tokens
                </div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {rateLimiterStatus.failureCount}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  Failure Count
                </div>
              </div>
              
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  {rateLimiterStatus.circuitBreakerOpen ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Circuit Breaker
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {job.results && job.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Results Preview</CardTitle>
            <CardDescription>
              Latest processed rows (showing first 10)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {job.results.slice(0, 10).map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Row {result.row}</Badge>
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {result.success 
                          ? `Found ${result.foundASINs.length} ASINs`
                          : result.error || 'Search failed'
                        }
                      </span>
                    </div>
                    {result.searchCriteria?.upc && (
                      <Badge variant="secondary" className="text-xs">
                        UPC: {result.searchCriteria.upc}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}