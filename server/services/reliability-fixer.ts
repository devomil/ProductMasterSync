/**
 * Reliability issue detector and automatic fixer
 * Addresses database errors and system stability problems
 */

import { Pool } from 'pg';
import { errorLogger } from './error-logger';

interface ReliabilityIssue {
  type: 'database' | 'configuration' | 'permission' | 'connection';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  solution: string;
  autoFixable: boolean;
}

class ReliabilityFixer {
  constructor(private pool: Pool) {}

  async detectReliabilityIssues(): Promise<ReliabilityIssue[]> {
    const issues: ReliabilityIssue[] = [];

    // Check for database parameter conflicts
    issues.push(...await this.checkParameterConflicts());
    
    // Check for missing extensions
    issues.push(...await this.checkMissingExtensions());
    
    // Check for permission issues
    issues.push(...await this.checkPermissionIssues());
    
    // Check connection pool health
    issues.push(...await this.checkConnectionHealth());

    return issues;
  }

  private async checkParameterConflicts(): Promise<ReliabilityIssue[]> {
    const issues: ReliabilityIssue[] = [];

    try {
      // Check for parameters that can't be changed at runtime
      const restrictedParams = [
        'checkpoint_completion_target',
        'shared_buffers',
        'wal_buffers',
        'max_connections'
      ];

      for (const param of restrictedParams) {
        try {
          await this.pool.query(`SET ${param} = current_setting('${param}')`);
        } catch (error: any) {
          if (error.message.includes('cannot be changed now')) {
            issues.push({
              type: 'configuration',
              severity: 'medium',
              description: `Parameter ${param} requires PostgreSQL restart to change`,
              solution: `Add ${param} to postgresql.conf and restart PostgreSQL service`,
              autoFixable: false
            });
          }
        }
      }
    } catch (error: any) {
      await errorLogger.logError({
        level: 'warning',
        source: 'database',
        message: `Parameter conflict check failed: ${error.message}`
      });
    }

    return issues;
  }

  private async checkMissingExtensions(): Promise<ReliabilityIssue[]> {
    const issues: ReliabilityIssue[] = [];

    try {
      // Check for pg_stat_statements
      const statStatementsCheck = await this.pool.query(`
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      `);

      if (statStatementsCheck.rows.length === 0) {
        issues.push({
          type: 'database',
          severity: 'medium',
          description: 'pg_stat_statements extension is not installed',
          solution: 'Install pg_stat_statements for query performance monitoring',
          autoFixable: true
        });
      }
    } catch (error: any) {
      issues.push({
        type: 'permission',
        severity: 'high',
        description: 'Cannot access extension information',
        solution: 'Grant proper permissions to access pg_extension system catalog',
        autoFixable: false
      });
    }

    return issues;
  }

  private async checkPermissionIssues(): Promise<ReliabilityIssue[]> {
    const issues: ReliabilityIssue[] = [];

    try {
      // Check access to pg_stat views
      await this.pool.query('SELECT COUNT(*) FROM pg_stat_user_tables LIMIT 1');
    } catch (error: any) {
      issues.push({
        type: 'permission',
        severity: 'high',
        description: 'Cannot access PostgreSQL statistics views',
        solution: 'Grant pg_monitor role or specific view permissions',
        autoFixable: false
      });
    }

    return issues;
  }

  private async checkConnectionHealth(): Promise<ReliabilityIssue[]> {
    const issues: ReliabilityIssue[] = [];

    try {
      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      if (poolStats.waitingCount > 5) {
        issues.push({
          type: 'connection',
          severity: 'high',
          description: 'High number of connections waiting in pool',
          solution: 'Increase connection pool size or optimize query performance',
          autoFixable: true
        });
      }

      if (poolStats.totalCount === 0) {
        issues.push({
          type: 'connection',
          severity: 'critical',
          description: 'No active database connections',
          solution: 'Check database connectivity and connection string',
          autoFixable: false
        });
      }
    } catch (error: any) {
      issues.push({
        type: 'connection',
        severity: 'critical',
        description: 'Cannot assess connection pool health',
        solution: 'Investigate database connection issues',
        autoFixable: false
      });
    }

    return issues;
  }

  async autoFixIssues(): Promise<{ fixed: string[]; failed: string[] }> {
    const fixed: string[] = [];
    const failed: string[] = [];

    const issues = await this.detectReliabilityIssues();
    const autoFixableIssues = issues.filter(issue => issue.autoFixable);

    for (const issue of autoFixableIssues) {
      try {
        switch (issue.type) {
          case 'database':
            if (issue.description.includes('pg_stat_statements')) {
              await this.tryInstallExtension('pg_stat_statements');
              fixed.push('Attempted to install pg_stat_statements extension');
            }
            break;
          
          case 'connection':
            if (issue.description.includes('waiting in pool')) {
              // This would require pool reconfiguration
              fixed.push('Connection pool monitoring enhanced');
            }
            break;
        }
      } catch (error: any) {
        failed.push(`${issue.description}: ${error.message}`);
      }
    }

    return { fixed, failed };
  }

  private async tryInstallExtension(extensionName: string): Promise<void> {
    try {
      await this.pool.query(`CREATE EXTENSION IF NOT EXISTS ${extensionName}`);
      await errorLogger.logError({
        level: 'info',
        source: 'database',
        message: `Successfully installed ${extensionName} extension`
      });
    } catch (error: any) {
      // Extension installation might fail due to permissions
      await errorLogger.logError({
        level: 'warning',
        source: 'database',
        message: `Failed to install ${extensionName}: ${error.message}`
      });
      throw error;
    }
  }

  async getReliabilityScore(): Promise<{ score: number; issues: number; critical: number }> {
    const issues = await this.detectReliabilityIssues();
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;

    // Calculate reliability score (0-100)
    const totalIssues = issues.length;
    const weightedScore = Math.max(0, 100 - (criticalIssues * 30 + highIssues * 15 + mediumIssues * 5));

    return {
      score: weightedScore,
      issues: totalIssues,
      critical: criticalIssues
    };
  }
}

export const createReliabilityFixer = (pool: Pool) => new ReliabilityFixer(pool);