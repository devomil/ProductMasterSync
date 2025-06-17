/**
 * Database query optimization and monitoring system
 * Tracks slow queries, analyzes patterns, and suggests optimizations
 */

import { Pool } from 'pg';
import { errorLogger } from './error-logger';

interface QueryMetric {
  query: string;
  duration: number;
  timestamp: string;
  params?: any[];
  rows?: number;
  error?: string;
}

interface QueryAnalysis {
  query: string;
  avgDuration: number;
  callCount: number;
  totalDuration: number;
  slowestExecution: number;
  suggestions: string[];
}

class DatabaseMonitor {
  private queryMetrics: QueryMetric[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private maxMetrics = 1000;

  constructor(private pool: Pool) {
    this.setupQueryLogging();
  }

  private setupQueryLogging() {
    // Hook into the pool's query method to monitor all database operations
    const originalQuery = this.pool.query.bind(this.pool);
    
    this.pool.query = async (text: any, params?: any) => {
      const startTime = Date.now();
      const queryText = typeof text === 'string' ? text : text.text;
      
      try {
        const result = await originalQuery(text, params);
        const duration = Date.now() - startTime;
        
        await this.logQuery({
          query: queryText,
          duration,
          timestamp: new Date().toISOString(),
          params: params,
          rows: result.rowCount || 0
        });
        
        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        await this.logQuery({
          query: queryText,
          duration,
          timestamp: new Date().toISOString(),
          params: params,
          error: error.message
        });
        
        await errorLogger.logError({
          level: 'error',
          source: 'database',
          message: `Database query failed: ${error.message}`,
          context: { query: queryText, params, duration }
        });
        
        throw error;
      }
    };
  }

  private async logQuery(metric: QueryMetric) {
    this.queryMetrics.push(metric);
    
    // Keep only recent metrics in memory
    if (this.queryMetrics.length > this.maxMetrics) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetrics);
    }
    
    // Log slow queries
    if (metric.duration > this.slowQueryThreshold) {
      await errorLogger.logError({
        level: 'warning',
        source: 'database',
        message: `Slow database query (${metric.duration}ms)`,
        context: {
          query: metric.query,
          duration: metric.duration,
          params: metric.params
        }
      });
    }
  }

  analyzeQueries(): QueryAnalysis[] {
    const queryGroups = new Map<string, QueryMetric[]>();
    
    // Group queries by normalized text (remove parameters)
    this.queryMetrics.forEach(metric => {
      const normalizedQuery = this.normalizeQuery(metric.query);
      if (!queryGroups.has(normalizedQuery)) {
        queryGroups.set(normalizedQuery, []);
      }
      queryGroups.get(normalizedQuery)!.push(metric);
    });
    
    const analyses: QueryAnalysis[] = [];
    
    queryGroups.forEach((metrics, query) => {
      const durations = metrics.map(m => m.duration);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = totalDuration / durations.length;
      const slowestExecution = Math.max(...durations);
      
      const analysis: QueryAnalysis = {
        query,
        avgDuration,
        callCount: metrics.length,
        totalDuration,
        slowestExecution,
        suggestions: this.generateSuggestions(query, avgDuration, metrics.length)
      };
      
      analyses.push(analysis);
    });
    
    // Sort by total time impact (avg duration * call count)
    return analyses.sort((a, b) => (b.avgDuration * b.callCount) - (a.avgDuration * a.callCount));
  }

  private normalizeQuery(query: string): string {
    // Remove parameter values to group similar queries
    return query
      .replace(/\$\d+/g, '$?') // Replace PostgreSQL parameters
      .replace(/'\w+'/g, "'?'") // Replace string literals
      .replace(/\b\d+\b/g, '?') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private generateSuggestions(query: string, avgDuration: number, callCount: number): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Slow query suggestions
    if (avgDuration > 1000) {
      suggestions.push('Consider adding an index for frequently queried columns');
      
      if (lowerQuery.includes('like')) {
        suggestions.push('LIKE queries can be slow - consider full-text search or indexed patterns');
      }
      
      if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
        suggestions.push('ORDER BY without LIMIT can be expensive - consider pagination');
      }
      
      if (lowerQuery.includes('select *')) {
        suggestions.push('SELECT * retrieves unnecessary data - specify needed columns');
      }
    }
    
    // Frequent query suggestions
    if (callCount > 100) {
      suggestions.push('High frequency query - consider caching results');
      
      if (lowerQuery.includes('join')) {
        suggestions.push('Frequent JOINs should have proper indexes on join columns');
      }
    }
    
    // Specific pattern suggestions
    if (lowerQuery.includes('where') && !lowerQuery.includes('index')) {
      suggestions.push('Ensure WHERE clause columns are indexed');
    }
    
    if (lowerQuery.match(/in\s*\([^)]+\)/)) {
      suggestions.push('IN clauses with many values can be slow - consider temporary tables');
    }
    
    return suggestions;
  }

  getSlowQueries(limit = 10): QueryMetric[] {
    return this.queryMetrics
      .filter(m => m.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getDatabaseStats() {
    const totalQueries = this.queryMetrics.length;
    const errorQueries = this.queryMetrics.filter(m => m.error).length;
    const slowQueries = this.queryMetrics.filter(m => m.duration > this.slowQueryThreshold).length;
    
    const durations = this.queryMetrics.map(m => m.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    
    return {
      totalQueries,
      errorQueries,
      slowQueries,
      avgDuration,
      errorRate: totalQueries > 0 ? (errorQueries / totalQueries) * 100 : 0,
      slowQueryRate: totalQueries > 0 ? (slowQueries / totalQueries) * 100 : 0
    };
  }

  // Check for missing indexes by analyzing query patterns
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    
    try {
      // Safely check for table statistics - handle cases where pg_stat views might not be accessible
      try {
        const tableStats = await this.pool.query(`
          SELECT schemaname, relname as tablename, n_tup_ins, n_tup_upd, n_tup_del, seq_scan, seq_tup_read
          FROM pg_stat_user_tables
          WHERE seq_scan > 100 AND seq_tup_read > seq_scan * 1000
        `);
        
        tableStats.rows.forEach(row => {
          suggestions.push(
            `Table ${row.tablename} has high sequential scan ratio (${row.seq_scan} scans, ${row.seq_tup_read} rows) - consider adding indexes`
          );
        });
      } catch (statError: any) {
        // pg_stat_user_tables might not be accessible
        suggestions.push('Unable to access table statistics - ensure proper PostgreSQL permissions');
      }
      
      // Check for unused indexes - handle gracefully if stats are not available
      try {
        const unusedIndexes = await this.pool.query(`
          SELECT schemaname, relname as tablename, indexrelname as indexname, idx_scan
          FROM pg_stat_user_indexes
          WHERE idx_scan < 10
        `);
        
        unusedIndexes.rows.forEach(row => {
          if (row.idx_scan === 0) {
            suggestions.push(`Index ${row.indexname} on ${row.tablename} is never used - consider dropping`);
          }
        });
      } catch (indexError: any) {
        // pg_stat_user_indexes might not be accessible
        suggestions.push('Index usage statistics unavailable - consider enabling pg_stat_statements');
      }

      // Add general optimization suggestions based on common patterns
      if (this.queryMetrics.length > 0) {
        const slowQueryCount = this.queryMetrics.filter(m => m.duration > 1000).length;
        if (slowQueryCount > 5) {
          suggestions.push('Multiple slow queries detected - review WHERE clause indexing');
        }

        const errorQueries = this.queryMetrics.filter(m => m.error).length;
        if (errorQueries > 0) {
          suggestions.push('Database errors detected - check connection pool settings and query syntax');
        }
      }
      
    } catch (error: any) {
      await errorLogger.logError({
        level: 'warning',
        source: 'database',
        message: `Failed to analyze database statistics: ${error.message}`
      });

      // Provide fallback suggestions based on observed patterns
      suggestions.push('Unable to fetch detailed statistics - ensure pg_stat_statements extension is enabled');
      suggestions.push('Consider adding indexes for frequently queried columns');
      suggestions.push('Monitor connection pool usage and query execution plans');
    }
    
    return suggestions;
  }
}

export const createDatabaseMonitor = (pool: Pool) => new DatabaseMonitor(pool);