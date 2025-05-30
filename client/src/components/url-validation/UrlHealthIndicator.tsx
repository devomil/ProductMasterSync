import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertCircle, XCircle, Clock, Ban, HelpCircle } from 'lucide-react';

interface UrlHealthStatus {
  url: string;
  status: 'healthy' | 'broken' | 'redirected' | 'timeout' | 'unreachable';
  statusCode?: number;
  responseTime?: number;
  redirectUrl?: string;
  error?: string;
  lastChecked: Date;
  contentType?: string;
  fileSize?: number;
}

interface UrlHealthIndicatorProps {
  status: UrlHealthStatus;
  showDetails?: boolean;
  compact?: boolean;
}

export default function UrlHealthIndicator({ 
  status, 
  showDetails = false, 
  compact = false 
}: UrlHealthIndicatorProps) {
  const getStatusInfo = () => {
    switch (status.status) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-800 border-green-200',
          label: 'Healthy',
          variant: 'default' as const
        };
      case 'redirected':
        return {
          icon: AlertCircle,
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          label: 'Redirected',
          variant: 'secondary' as const
        };
      case 'broken':
        return {
          icon: XCircle,
          color: 'bg-red-100 text-red-800 border-red-200',
          label: 'Broken',
          variant: 'destructive' as const
        };
      case 'timeout':
        return {
          icon: Clock,
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          label: 'Timeout',
          variant: 'secondary' as const
        };
      case 'unreachable':
        return {
          icon: Ban,
          color: 'bg-red-100 text-red-800 border-red-200',
          label: 'Unreachable',
          variant: 'destructive' as const
        };
      default:
        return {
          icon: HelpCircle,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: 'Unknown',
          variant: 'outline' as const
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getTooltipContent = () => (
    <div className="space-y-2 text-sm">
      <div className="font-medium">{status.url}</div>
      <div className="space-y-1">
        <div>Status: {statusInfo.label}</div>
        {status.statusCode && (
          <div>HTTP Code: {status.statusCode}</div>
        )}
        {status.responseTime && (
          <div>Response Time: {formatResponseTime(status.responseTime)}</div>
        )}
        {status.contentType && (
          <div>Content Type: {status.contentType}</div>
        )}
        {status.fileSize && (
          <div>File Size: {formatFileSize(status.fileSize)}</div>
        )}
        {status.redirectUrl && (
          <div>Redirected to: {status.redirectUrl}</div>
        )}
        {status.error && (
          <div className="text-red-600">Error: {status.error}</div>
        )}
        <div className="text-gray-500">
          Last checked: {new Date(status.lastChecked).toLocaleString()}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            <Icon className={`h-4 w-4 ${
              status.status === 'healthy' ? 'text-green-600' :
              status.status === 'redirected' ? 'text-yellow-600' :
              status.status === 'broken' || status.status === 'unreachable' ? 'text-red-600' :
              status.status === 'timeout' ? 'text-orange-600' : 'text-gray-600'
            }`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={statusInfo.variant} className={`inline-flex items-center gap-1 ${statusInfo.color}`}>
            <Icon className="h-3 w-3" />
            {statusInfo.label}
            {status.statusCode && ` (${status.statusCode})`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>

      {showDetails && (
        <div className="text-xs text-gray-600 space-y-1">
          {status.responseTime && (
            <div>Response: {formatResponseTime(status.responseTime)}</div>
          )}
          {status.fileSize && (
            <div>Size: {formatFileSize(status.fileSize)}</div>
          )}
          {status.redirectUrl && (
            <div className="truncate">→ {status.redirectUrl}</div>
          )}
          {status.error && (
            <div className="text-red-600 truncate">{status.error}</div>
          )}
        </div>
      )}
    </div>
  );
}