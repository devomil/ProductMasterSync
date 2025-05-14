import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmazonSyncStats } from '@/hooks/useAmazonMarketData';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertCircle, Clock, ThumbsDown } from 'lucide-react';

export function AmazonSyncStats() {
  const { data: stats, isLoading } = useAmazonSyncStats();

  if (isLoading || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-[250px]" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-[350px]" />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Performance (Last 24 Hours)</CardTitle>
        <CardDescription>
          Statistics for recent Amazon marketplace data synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <StatCard 
          title="Successful" 
          value={stats.successful || 0} 
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} 
          description="Products successfully synced"
          colorClass="bg-green-50"
        />
        
        <StatCard 
          title="Failed" 
          value={stats.failed || 0} 
          icon={<XCircle className="h-4 w-4 text-red-500" />} 
          description="Products that failed to sync"
          colorClass="bg-red-50"
        />
        
        <StatCard 
          title="Not Found" 
          value={stats.notFound || 0} 
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />} 
          description="Products not found on Amazon"
          colorClass="bg-amber-50"
        />
        
        <StatCard 
          title="Rate Limited" 
          value={stats.rateLimited || 0} 
          icon={<ThumbsDown className="h-4 w-4 text-blue-500" />} 
          description="Operations throttled by Amazon"
          colorClass="bg-blue-50"
        />

        <div className="col-span-2">
          <StatCard 
            title="Average Response Time" 
            value={(stats.avgResponseTime || 0).toFixed(0) + 'ms'} 
            icon={<Clock className="h-4 w-4 text-purple-500" />} 
            description="Average API response time"
            colorClass="bg-purple-50"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  colorClass: string;
}

function StatCard({ title, value, icon, description, colorClass }: StatCardProps) {
  return (
    <div className={`flex flex-col rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {icon}
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{description}</span>
    </div>
  );
}