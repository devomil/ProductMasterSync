/**
 * Monitoring and performance analysis API routes
 * Provides system health, error tracking, and performance metrics
 */

import { Router, Request, Response } from 'express';
import { errorLogger } from '../services/error-logger';
import { createDatabaseMonitor } from '../services/database-monitor';
import { createPerformanceOptimizer } from '../services/performance-optimizer';
import { pool } from '../db';

const router = Router();

// Initialize monitoring services
const dbMonitor = createDatabaseMonitor(pool);
const perfOptimizer = createPerformanceOptimizer(pool);

// Frontend metrics endpoint
router.post('/frontend-metrics', async (req: Request, res: Response) => {
  try {
    const metric = req.body;
    
    // Log frontend metrics as backend errors for centralized tracking
    await errorLogger.logError({
      level: metric.type === 'error' ? 'error' : 'info',
      source: 'frontend',
      message: metric.name,
      context: metric,
      endpoint: metric.url,
      duration: metric.duration
    });

    res.json({ success: true });
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Failed to log frontend metric: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// System health overview
router.get('/health', async (req: Request, res: Response) => {
  try {
    const errorSummary = errorLogger.getErrorSummary();
    const performanceStats = errorLogger.getPerformanceStats();
    const dbStats = dbMonitor.getDatabaseStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      errors: {
        summary: errorSummary,
        totalErrors: errorSummary.reduce((sum, item) => sum + item.count, 0)
      },
      performance: performanceStats,
      database: dbStats
    };

    // Determine overall health status
    if (dbStats.errorRate > 10 || performanceStats.avgDuration > 3000) {
      health.status = 'degraded';
    }
    if (dbStats.errorRate > 25 || performanceStats.avgDuration > 5000) {
      health.status = 'unhealthy';
    }

    res.json(health);
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Health check failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error analysis endpoint
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const { limit = 50, source, level } = req.query;
    
    // Read recent error logs
    const errorSummary = errorLogger.getErrorSummary();
    const performanceStats = errorLogger.getPerformanceStats();

    const analysis = {
      summary: errorSummary,
      slowQueries: performanceStats.slowQueries,
      insights: [
        ...generateErrorInsights(errorSummary),
        ...generatePerformanceInsights(performanceStats)
      ]
    };

    res.json(analysis);
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend', 
      message: `Error analysis failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Database performance analysis
router.get('/database', async (req: Request, res: Response) => {
  try {
    const queryAnalysis = dbMonitor.analyzeQueries();
    const slowQueries = dbMonitor.getSlowQueries();
    const dbStats = dbMonitor.getDatabaseStats();
    const indexSuggestions = await dbMonitor.suggestIndexes();

    const analysis = {
      statistics: dbStats,
      slowQueries: slowQueries.map(q => ({
        query: q.query.substring(0, 200) + (q.query.length > 200 ? '...' : ''),
        duration: q.duration,
        timestamp: q.timestamp,
        error: q.error
      })),
      queryAnalysis: queryAnalysis.slice(0, 10).map(qa => ({
        ...qa,
        query: qa.query.substring(0, 200) + (qa.query.length > 200 ? '...' : '')
      })),
      indexSuggestions,
      insights: generateDatabaseInsights(dbStats, queryAnalysis, indexSuggestions)
    };

    res.json(analysis);
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Database analysis failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Performance bottleneck analysis
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const performanceStats = errorLogger.getPerformanceStats();
    const dbStats = dbMonitor.getDatabaseStats();
    
    const bottlenecks = identifyBottlenecks(performanceStats, dbStats);
    const recommendations = generateRecommendations(bottlenecks);

    const analysis = {
      performance: performanceStats,
      database: dbStats,
      bottlenecks,
      recommendations,
      insights: [
        ...generatePerformanceInsights(performanceStats),
        ...generateDatabaseInsights(dbStats, [], [])
      ]
    };

    res.json(analysis);
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Performance analysis failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Live monitoring dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const errorSummary = errorLogger.getErrorSummary();
    const performanceStats = errorLogger.getPerformanceStats();
    const dbStats = dbMonitor.getDatabaseStats();

    const dashboard = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      errors: {
        total: errorSummary.reduce((sum, item) => sum + item.count, 0),
        recent: errorSummary.slice(0, 5)
      },
      performance: {
        avgResponseTime: performanceStats.avgDuration,
        slowEndpoints: Object.entries(performanceStats.requestCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      },
      database: {
        queryCount: dbStats.totalQueries,
        errorRate: dbStats.errorRate,
        avgDuration: dbStats.avgDuration,
        slowQueryCount: dbStats.slowQueries
      },
      alerts: generateAlerts(errorSummary, performanceStats, dbStats)
    };

    res.json(dashboard);
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Dashboard data failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions for analysis
function generateErrorInsights(errorSummary: any[]): string[] {
  const insights: string[] = [];
  
  if (errorSummary.length === 0) return ['No recent errors detected'];
  
  const topError = errorSummary[0];
  if (topError.count > 10) {
    insights.push(`High frequency error: "${topError.error}" occurred ${topError.count} times`);
  }
  
  const frontendErrors = errorSummary.filter(e => e.error.includes('frontend'));
  if (frontendErrors.length > 0) {
    insights.push(`${frontendErrors.length} frontend errors detected - check client-side code`);
  }
  
  const apiErrors = errorSummary.filter(e => e.error.includes('api'));
  if (apiErrors.length > 0) {
    insights.push(`${apiErrors.length} API errors detected - investigate backend endpoints`);
  }
  
  return insights;
}

function generatePerformanceInsights(performanceStats: any): string[] {
  const insights: string[] = [];
  
  if (performanceStats.avgDuration > 2000) {
    insights.push(`Average response time is high (${performanceStats.avgDuration.toFixed(0)}ms)`);
  }
  
  if (performanceStats.slowQueries.length > 5) {
    insights.push(`${performanceStats.slowQueries.length} slow endpoints detected`);
  }
  
  const requestCounts = Object.values(performanceStats.requestCounts) as number[];
  const totalRequests = requestCounts.reduce((sum, count) => sum + count, 0);
  if (totalRequests > 1000) {
    insights.push(`High request volume: ${totalRequests} requests tracked`);
  }
  
  return insights;
}

function generateDatabaseInsights(dbStats: any, queryAnalysis: any[], indexSuggestions: string[]): string[] {
  const insights: string[] = [];
  
  if (dbStats.errorRate > 5) {
    insights.push(`Database error rate is high (${dbStats.errorRate.toFixed(1)}%)`);
  }
  
  if (dbStats.avgDuration > 1000) {
    insights.push(`Average query time is slow (${dbStats.avgDuration.toFixed(0)}ms)`);
  }
  
  if (indexSuggestions.length > 0) {
    insights.push(`${indexSuggestions.length} database optimization opportunities found`);
  }
  
  if (queryAnalysis.length > 0) {
    const slowestQuery = queryAnalysis[0];
    if (slowestQuery.avgDuration > 1000) {
      insights.push(`Slowest query pattern takes ${slowestQuery.avgDuration.toFixed(0)}ms on average`);
    }
  }
  
  return insights;
}

function identifyBottlenecks(performanceStats: any, dbStats: any) {
  const bottlenecks = [];
  
  if (dbStats.avgDuration > performanceStats.avgDuration * 0.7) {
    bottlenecks.push({
      type: 'database',
      severity: 'high',
      description: 'Database queries are the primary performance bottleneck',
      impact: dbStats.avgDuration
    });
  }
  
  if (performanceStats.avgDuration > 3000) {
    bottlenecks.push({
      type: 'api',
      severity: 'medium',
      description: 'API response times are slower than optimal',
      impact: performanceStats.avgDuration
    });
  }
  
  if (dbStats.errorRate > 10) {
    bottlenecks.push({
      type: 'reliability',
      severity: 'high',
      description: 'High database error rate affecting system stability',
      impact: dbStats.errorRate
    });
  }
  
  return bottlenecks;
}

function generateRecommendations(bottlenecks: any[]): string[] {
  const recommendations: string[] = [];
  
  bottlenecks.forEach(bottleneck => {
    switch (bottleneck.type) {
      case 'database':
        recommendations.push('Add database indexes for frequently queried columns');
        recommendations.push('Consider query optimization and connection pooling');
        break;
      case 'api':
        recommendations.push('Implement response caching for frequently accessed data');
        recommendations.push('Optimize business logic and reduce computational overhead');
        break;
      case 'reliability':
        recommendations.push('Investigate database connection issues and error handling');
        recommendations.push('Implement circuit breakers and retry mechanisms');
        break;
    }
  });
  
  return recommendations;
}

function generateAlerts(errorSummary: any[], performanceStats: any, dbStats: any) {
  const alerts = [];
  
  if (dbStats.errorRate > 15) {
    alerts.push({
      level: 'critical',
      message: `Database error rate is critically high (${dbStats.errorRate.toFixed(1)}%)`,
      action: 'Immediate investigation required'
    });
  }
  
  if (performanceStats.avgDuration > 5000) {
    alerts.push({
      level: 'warning',
      message: `API response time is very slow (${performanceStats.avgDuration.toFixed(0)}ms)`,
      action: 'Performance optimization needed'
    });
  }
  
  const totalErrors = errorSummary.reduce((sum, item) => sum + item.count, 0);
  if (totalErrors > 50) {
    alerts.push({
      level: 'warning',
      message: `High error count detected (${totalErrors} total errors)`,
      action: 'Review error logs and fix common issues'
    });
  }
  
  return alerts;
}

// Auto-optimization endpoint
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const optimizations = await perfOptimizer.applyDatabaseOptimizations();
    const recommendations = await perfOptimizer.getOptimizationRecommendations();
    
    const appliedOptimizations = optimizations.filter(opt => opt.applied);
    const failedOptimizations = optimizations.filter(opt => !opt.applied);

    await errorLogger.logError({
      level: 'info',
      source: 'backend',
      message: `Applied ${appliedOptimizations.length} performance optimizations`,
      context: { optimizations, recommendations }
    });

    res.json({
      success: true,
      applied: appliedOptimizations,
      failed: failedOptimizations,
      recommendations,
      summary: {
        totalOptimizations: optimizations.length,
        appliedCount: appliedOptimizations.length,
        failedCount: failedOptimizations.length
      }
    });
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Performance optimization failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Query analysis endpoint
router.get('/queries', async (req: Request, res: Response) => {
  try {
    const slowQueries = await perfOptimizer.analyzeSlowQueries();
    const queryAnalysis = dbMonitor.analyzeQueries();
    
    res.json({
      slowQueries,
      patterns: queryAnalysis.slice(0, 20),
      insights: generateQueryInsights(slowQueries, queryAnalysis)
    });
  } catch (error: any) {
    await errorLogger.logError({
      level: 'error',
      source: 'backend',
      message: `Query analysis failed: ${error.message}`,
      stack: error.stack,
      endpoint: req.path
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
});

function generateQueryInsights(slowQueries: any[], queryAnalysis: any[]): string[] {
  const insights: string[] = [];
  
  if (slowQueries.length > 0) {
    insights.push(`Found ${slowQueries.length} slow queries requiring optimization`);
    
    const mostCommonIssue = slowQueries
      .map(q => q.optimization)
      .reduce((acc, opt) => {
        acc[opt] = (acc[opt] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topIssue = Object.entries(mostCommonIssue)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (topIssue) {
      insights.push(`Most common optimization needed: ${topIssue[0]}`);
    }
  }
  
  if (queryAnalysis.length > 0) {
    const highImpactQueries = queryAnalysis.filter(q => q.avgDuration > 1000 && q.callCount > 10);
    if (highImpactQueries.length > 0) {
      insights.push(`${highImpactQueries.length} high-impact query patterns need immediate attention`);
    }
  }
  
  return insights;
}

export default router;