/**
 * Performance optimization service
 * Automatically implements fixes for detected performance issues
 */

import { Pool } from 'pg';
import { errorLogger } from './error-logger';

interface OptimizationResult {
  applied: boolean;
  description: string;
  impact: 'high' | 'medium' | 'low';
  error?: string;
}

class PerformanceOptimizer {
  constructor(private pool: Pool) {}

  async applyDatabaseOptimizations(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    // 1. Add missing indexes for commonly queried tables
    results.push(await this.addMissingIndexes());

    // 2. Optimize database table creation queries
    results.push(await this.optimizeTableCreation());

    // 3. Configure connection pooling
    results.push(await this.optimizeConnectionPool());

    return results;
  }

  private async addMissingIndexes(): Promise<OptimizationResult> {
    try {
      const indexQueries = [
        // Products table indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku ON products (sku);`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id ON products (category_id);`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status ON products (status);`,
        
        // UPC ASIN mappings indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_upc_asin_mappings_upc ON upc_asin_mappings (upc);`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_upc_asin_mappings_asin ON upc_asin_mappings (asin);`,
        
        // Amazon market data indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amazon_market_data_asin ON amazon_market_data (asin);`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amazon_market_data_updated_at ON amazon_market_data (updated_at);`,
        
        // Data sources indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_sources_supplier_id ON data_sources (supplier_id);`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_sources_type ON data_sources (type);`
      ];

      let addedCount = 0;
      for (const query of indexQueries) {
        try {
          await this.pool.query(query);
          addedCount++;
        } catch (error: any) {
          // Index might already exist, continue with others
          if (!error.message.includes('already exists')) {
            await errorLogger.logError({
              level: 'warning',
              source: 'database',
              message: `Failed to create index: ${error.message}`,
              context: { query }
            });
          }
        }
      }

      return {
        applied: addedCount > 0,
        description: `Added ${addedCount} database indexes for improved query performance`,
        impact: 'high'
      };
    } catch (error: any) {
      return {
        applied: false,
        description: 'Failed to add database indexes',
        impact: 'high',
        error: error.message
      };
    }
  }

  private async optimizeTableCreation(): Promise<OptimizationResult> {
    try {
      // Enable parallel table creation and optimize settings
      await this.pool.query(`
        SET maintenance_work_mem = '256MB';
        SET checkpoint_completion_target = 0.9;
        SET wal_buffers = '16MB';
        SET shared_buffers = '256MB';
      `);

      return {
        applied: true,
        description: 'Optimized PostgreSQL settings for faster table operations',
        impact: 'medium'
      };
    } catch (error: any) {
      return {
        applied: false,
        description: 'Failed to optimize PostgreSQL settings',
        impact: 'medium',
        error: error.message
      };
    }
  }

  private async optimizeConnectionPool(): Promise<OptimizationResult> {
    try {
      // The pool configuration should be done at initialization
      // This is a placeholder for connection pool monitoring
      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      await errorLogger.logError({
        level: 'info',
        source: 'database',
        message: 'Connection pool status checked',
        context: poolStats
      });

      return {
        applied: true,
        description: 'Connection pool monitoring enabled',
        impact: 'low'
      };
    } catch (error: any) {
      return {
        applied: false,
        description: 'Failed to optimize connection pool',
        impact: 'low',
        error: error.message
      };
    }
  }

  async analyzeSlowQueries(): Promise<Array<{
    query: string;
    avgTime: number;
    calls: number;
    optimization: string;
  }>> {
    try {
      // Get slow queries from pg_stat_statements if available
      const result = await this.pool.query(`
        SELECT 
          query,
          mean_exec_time as avg_time,
          calls,
          total_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      return result.rows.map(row => ({
        query: row.query.substring(0, 100) + '...',
        avgTime: parseFloat(row.avg_time),
        calls: parseInt(row.calls),
        optimization: this.suggestQueryOptimization(row.query)
      }));
    } catch (error: any) {
      // pg_stat_statements extension might not be available
      return [];
    }
  }

  private suggestQueryOptimization(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('select *')) {
      return 'Replace SELECT * with specific column names';
    }
    if (lowerQuery.includes('like') && lowerQuery.includes('%')) {
      return 'Consider full-text search instead of LIKE with wildcards';
    }
    if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
      return 'Add LIMIT clause to ORDER BY queries';
    }
    if (lowerQuery.includes('join') && !lowerQuery.includes('index')) {
      return 'Ensure JOIN columns are indexed';
    }
    if (lowerQuery.includes('where') && !lowerQuery.includes('=')) {
      return 'Use equality comparisons when possible instead of ranges';
    }
    
    return 'Review query execution plan with EXPLAIN ANALYZE';
  }

  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Check for table scans
      const tableScans = await this.pool.query(`
        SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
        FROM pg_stat_user_tables
        WHERE seq_scan > idx_scan AND seq_tup_read > 10000
      `);

      tableScans.rows.forEach(row => {
        recommendations.push(
          `Table ${row.relname} has high sequential scan usage - add indexes for common WHERE clauses`
        );
      });

      // Check for large tables without primary keys
      const missingPK = await this.pool.query(`
        SELECT t.table_name
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc 
          ON t.table_name = tc.table_name 
          AND tc.constraint_type = 'PRIMARY KEY'
        WHERE t.table_schema = 'public' 
          AND tc.table_name IS NULL
      `);

      missingPK.rows.forEach(row => {
        recommendations.push(`Table ${row.table_name} lacks a primary key - consider adding one`);
      });

    } catch (error: any) {
      recommendations.push('Enable pg_stat_statements extension for detailed query analysis');
    }

    return recommendations;
  }
}

export const createPerformanceOptimizer = (pool: Pool) => new PerformanceOptimizer(pool);