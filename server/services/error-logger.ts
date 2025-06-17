/**
 * Comprehensive error detection and logging system
 * Captures runtime errors, API failures, and database issues
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';

interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  source: 'frontend' | 'backend' | 'database' | 'api';
  message: string;
  stack?: string;
  context?: any;
  requestId?: string;
  userId?: string;
  endpoint?: string;
  duration?: number;
}

class ErrorLogger {
  private logFile = path.join(process.cwd(), 'logs', 'system-errors.log');
  private metricsFile = path.join(process.cwd(), 'logs', 'performance-metrics.log');
  private errorCounts = new Map<string, number>();
  private performanceMetrics: Array<{
    endpoint: string;
    method: string;
    duration: number;
    timestamp: string;
    status: number;
  }> = [];

  constructor() {
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    try {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  async logError(errorData: Partial<ErrorLog>) {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: errorData.level || 'error',
      source: errorData.source || 'backend',
      message: errorData.message || 'Unknown error',
      stack: errorData.stack,
      context: errorData.context,
      requestId: errorData.requestId,
      userId: errorData.userId,
      endpoint: errorData.endpoint,
      duration: errorData.duration
    };

    // Track error frequency
    const errorKey = `${log.source}:${log.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Write to log file
    const logLine = JSON.stringify(log) + '\n';
    try {
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write error log:', error);
    }

    // Console output for development
    console.error(`[${log.level.toUpperCase()}] ${log.source}: ${log.message}`);
    if (log.stack) {
      console.error(log.stack);
    }
  }

  async logPerformance(metric: {
    endpoint: string;
    method: string;
    duration: number;
    status: number;
  }) {
    const perfLog = {
      ...metric,
      timestamp: new Date().toISOString()
    };

    this.performanceMetrics.push(perfLog);

    // Keep only last 1000 metrics in memory
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    // Log slow requests (>2 seconds)
    if (metric.duration > 2000) {
      await this.logError({
        level: 'warning',
        source: 'api',
        message: `Slow API response: ${metric.endpoint}`,
        context: metric,
        duration: metric.duration
      });
    }

    // Write to metrics file
    const metricsLine = JSON.stringify(perfLog) + '\n';
    try {
      await fs.appendFile(this.metricsFile, metricsLine);
    } catch (error) {
      console.error('Failed to write performance metrics:', error);
    }
  }

  getErrorSummary() {
    const summary = Array.from(this.errorCounts.entries())
      .map(([key, count]) => ({ error: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return summary;
  }

  getPerformanceStats() {
    if (this.performanceMetrics.length === 0) {
      return { avgDuration: 0, slowQueries: [], requestCounts: {} };
    }

    const durations = this.performanceMetrics.map(m => m.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    const slowQueries = this.performanceMetrics
      .filter(m => m.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const requestCounts = this.performanceMetrics.reduce((acc, m) => {
      const key = `${m.method} ${m.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { avgDuration, slowQueries, requestCounts };
  }

  // Express middleware for automatic error logging
  errorMiddleware() {
    return async (error: any, req: Request, res: Response, next: NextFunction) => {
      await this.logError({
        level: 'error',
        source: 'backend',
        message: error.message,
        stack: error.stack,
        endpoint: req.path,
        context: {
          method: req.method,
          body: req.body,
          query: req.query,
          headers: req.headers
        },
        requestId: req.headers['x-request-id'] as string
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    };
  }

  // Performance tracking middleware
  performanceMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        await this.logPerformance({
          endpoint: req.path,
          method: req.method,
          duration,
          status: res.statusCode
        });
      });

      next();
    };
  }
}

export const errorLogger = new ErrorLogger();