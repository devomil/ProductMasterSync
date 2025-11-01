/**
 * Purchasing AI Job Scheduler
 * 
 * Lightweight in-process scheduler for 24/7 automated analysis
 * No external dependencies (Redis, BullMQ) - runs within the application
 * 
 * Features:
 * - Priority-based job queue (high, medium, low)
 * - Resumable jobs with checkpoint tracking
 * - Event-driven triggers (Amazon sync completion)
 * - Configurable scheduling (interval-based)
 * - Graceful shutdown handling
 */

import { db } from "../../db";
import { 
  purchasingAnalysisJobs, 
  purchasingAnalysisRuns, 
  purchasingSettings,
  products,
  productAsinMapping,
  amazonMarketIntelligence,
  type PurchasingAnalysisJob,
  type PurchasingAnalysisRun,
} from "@shared/schema";
import { eq, and, lte, isNull, isNotNull, or, sql, desc, inArray } from "drizzle-orm";
import { analyzePurchasingOpportunity } from "../analyzer";

interface SchedulerConfig {
  enabled: boolean;
  checkInterval: number; // ms between job queue checks
  maxConcurrentJobs: number;
}

class PurchasingAIScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private activeJobs: Set<number> = new Set();
  private shuttingDown: boolean = false;
  private config: SchedulerConfig = {
    enabled: false,
    checkInterval: 60000, // Check every 60 seconds
    maxConcurrentJobs: 1, // Run one job at a time to respect rate limits
  };

  constructor() {
    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.intervalId) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] 🚀 Starting Purchasing AI job scheduler');
    
    // Load configuration from database
    await this.loadConfig();
    
    if (!this.config.enabled) {
      console.log('[Scheduler] ℹ️ Automated analysis disabled in settings');
      return;
    }

    // Start interval-based job processor
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.config.checkInterval);

    // Run initial check
    await this.processQueue();
    
    console.log(`[Scheduler] ✅ Scheduler started (checking every ${this.config.checkInterval / 1000}s)`);
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Scheduler stopped');
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown() {
    if (this.shuttingDown) return;
    
    this.shuttingDown = true;
    console.log('[Scheduler] Shutting down gracefully...');
    
    await this.stop();
    
    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
      console.log(`[Scheduler] Waiting for ${this.activeJobs.size} active job(s) to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('[Scheduler] Shutdown complete');
  }

  /**
   * Load scheduler configuration from database
   */
  private async loadConfig() {
    try {
      const settings = await db.select().from(purchasingSettings).limit(1);
      
      if (settings.length > 0) {
        const s = settings[0];
        this.config.enabled = s.autoAnalysisEnabled || false;
        this.config.checkInterval = (s.analysisInterval || 3600) * 1000; // Convert to ms
      }
    } catch (error) {
      console.error('[Scheduler] Error loading config:', error);
    }
  }

  /**
   * Process the job queue
   */
  private async processQueue() {
    if (this.shuttingDown) return;
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      return; // At capacity
    }

    try {
      // Find pending jobs ordered by priority and next run time
      const now = new Date();
      const pendingJobs = await db
        .select()
        .from(purchasingAnalysisJobs)
        .where(
          and(
            eq(purchasingAnalysisJobs.status, 'pending'),
            or(
              isNull(purchasingAnalysisJobs.nextRunAt),
              lte(purchasingAnalysisJobs.nextRunAt, now)
            )
          )
        )
        .orderBy(
          sql`
            CASE ${purchasingAnalysisJobs.priority}
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
            END
          `,
          purchasingAnalysisJobs.nextRunAt
        )
        .limit(this.config.maxConcurrentJobs - this.activeJobs.size);

      for (const job of pendingJobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing queue:', error);
    }
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: PurchasingAnalysisJob) {
    if (this.activeJobs.has(job.id)) return;
    
    this.activeJobs.add(job.id);
    
    try {
      console.log(`[Scheduler] Executing job ${job.id}: ${job.name}`);
      
      // Mark job as running
      await db
        .update(purchasingAnalysisJobs)
        .set({
          status: 'running',
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchasingAnalysisJobs.id, job.id));

      // Create a run record
      const [run] = await db
        .insert(purchasingAnalysisRuns)
        .values({
          jobId: job.id,
          status: 'running',
          startedAt: new Date(),
        })
        .returning();

      const startTime = Date.now();
      
      // Execute the job
      const result = await this.runAnalysisJob(job, run.id);
      
      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Update run record with results
      await db
        .update(purchasingAnalysisRuns)
        .set({
          status: 'completed',
          completedAt: new Date(),
          duration,
          processedCount: result.processed,
          successCount: result.successes,
          failureCount: result.failures,
          opportunitiesFound: result.opportunities,
          apiCallsMade: result.apiCalls,
        })
        .where(eq(purchasingAnalysisRuns.id, run.id));

      // Mark job as completed or schedule next run
      if (job.scheduleType === 'auto') {
        // Reschedule for next interval
        const settings = await db.select().from(purchasingSettings).limit(1);
        const interval = settings[0]?.analysisInterval || 3600;
        const nextRun = new Date(Date.now() + interval * 1000);
        
        await db
          .update(purchasingAnalysisJobs)
          .set({
            status: 'pending',
            nextRunAt: nextRun,
            processedProducts: 0, // Reset for next run
            failedProducts: 0,
            updatedAt: new Date(),
          })
          .where(eq(purchasingAnalysisJobs.id, job.id));
          
        console.log(`[Scheduler] Job ${job.id} rescheduled for ${nextRun.toISOString()}`);
      } else {
        // One-time job - mark as completed
        await db
          .update(purchasingAnalysisJobs)
          .set({
            status: 'completed',
            completedAt: new Date(),
            processedProducts: result.processed,
            failedProducts: result.failures,
            updatedAt: new Date(),
          })
          .where(eq(purchasingAnalysisJobs.id, job.id));
          
        console.log(`[Scheduler] Job ${job.id} completed successfully`);
      }
    } catch (error) {
      console.error(`[Scheduler] Error executing job ${job.id}:`, error);
      
      // Mark job as failed
      await db
        .update(purchasingAnalysisJobs)
        .set({
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          retryCount: (job.retryCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(purchasingAnalysisJobs.id, job.id));
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Run the actual analysis for a job
   */
  private async runAnalysisJob(job: PurchasingAnalysisJob, runId: number): Promise<{
    processed: number;
    successes: number;
    failures: number;
    opportunities: number;
    apiCalls: number;
  }> {
    let processed = 0;
    let successes = 0;
    let failures = 0;
    let opportunities = 0;
    let apiCalls = 0;

    // Get products to analyze based on job scope
    const settings = await db.select().from(purchasingSettings).limit(1);
    const batchSize = settings[0]?.batchSize || 100;
    
    // Build where conditions - DO NOT filter by buy box price (missing data = monopoly opportunity!)
    const whereConditions: any[] = [];
    
    // Filter by staleness if job.onlyStale
    if (job.onlyStale) {
      whereConditions.push(
        or(
          isNull(products.lastAnalysisAt),
          lte(products.analysisStaleAt!, new Date())
        ) as any
      );
    }
    
    // Filter by specific products if provided
    if (job.productIds && job.productIds.length > 0) {
      whereConditions.push(inArray(products.id, job.productIds) as any);
    }
    
    const productsToAnalyze = await db
      .select({
        id: products.id,
        lastAnalysisAt: products.lastAnalysisAt,
        analysisStaleAt: products.analysisStaleAt,
      })
      .from(products)
      .innerJoin(
        productAsinMapping,
        and(
          eq(products.id, productAsinMapping.productId),
          eq(productAsinMapping.isActive, true)
        )
      )
      .leftJoin(
        amazonMarketIntelligence,
        eq(productAsinMapping.asin, amazonMarketIntelligence.asin)
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(batchSize);

    console.log(`[Scheduler] Found ${productsToAnalyze.length} products to analyze`);

    // Process each product
    for (const product of productsToAnalyze) {
      try {
        const opportunity = await analyzePurchasingOpportunity(product.id);
        
        if (opportunity) {
          processed++;
          successes++;
          apiCalls++; // Increment for Product Fees API call
          
          if (opportunity.recommendation !== 'no_opportunity') {
            opportunities++;
          }

          // Update product analysis tracking
          const stalenessThreshold = settings[0]?.stalenessThreshold || 86400;
          await db
            .update(products)
            .set({
              lastAnalysisAt: new Date(),
              lastAnalysisScore: opportunity.opportunityScore || 0,
              analysisStaleAt: new Date(Date.now() + stalenessThreshold * 1000),
              updatedAt: new Date(),
            })
            .where(eq(products.id, product.id));
        }
        
        // Update job progress
        await db
          .update(purchasingAnalysisJobs)
          .set({
            processedProducts: processed,
            updatedAt: new Date(),
          })
          .where(eq(purchasingAnalysisJobs.id, job.id));

        // Update run progress checkpoint
        await db
          .update(purchasingAnalysisRuns)
          .set({
            lastProductId: product.id,
            processedCount: processed,
            successCount: successes,
            failureCount: failures,
          })
          .where(eq(purchasingAnalysisRuns.id, runId));
          
      } catch (error) {
        console.error(`[Scheduler] Error analyzing product ${product.id}:`, error);
        failures++;
        
        await db
          .update(purchasingAnalysisJobs)
          .set({
            failedProducts: failures,
            updatedAt: new Date(),
          })
          .where(eq(purchasingAnalysisJobs.id, job.id));
      }
    }

    return { processed, successes, failures, opportunities, apiCalls };
  }

  /**
   * Create a new analysis job
   */
  async createJob(config: {
    name: string;
    priority?: 'high' | 'medium' | 'low';
    scheduleType: 'manual' | 'auto' | 'event_triggered';
    productIds?: number[];
    supplierId?: number;
    onlyStale?: boolean;
    nextRunAt?: Date;
  }): Promise<number> {
    const [job] = await db
      .insert(purchasingAnalysisJobs)
      .values({
        name: config.name,
        priority: config.priority || 'medium',
        scheduleType: config.scheduleType,
        status: 'pending',
        productIds: config.productIds,
        supplierId: config.supplierId,
        onlyStale: config.onlyStale ?? true,
        nextRunAt: config.nextRunAt || new Date(),
      })
      .returning();

    console.log(`[Scheduler] Created job ${job.id}: ${job.name}`);
    
    // Trigger immediate queue processing if high priority
    if (config.priority === 'high') {
      setTimeout(() => this.processQueue(), 0);
    }

    return job.id;
  }

  /**
   * Pause a job
   */
  async pauseJob(jobId: number) {
    await db
      .update(purchasingAnalysisJobs)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(purchasingAnalysisJobs.id, jobId));
    
    console.log(`[Scheduler] Job ${jobId} paused`);
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: number) {
    await db
      .update(purchasingAnalysisJobs)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(purchasingAnalysisJobs.id, jobId));
    
    console.log(`[Scheduler] Job ${jobId} resumed`);
    
    // Trigger queue processing
    setTimeout(() => this.processQueue(), 0);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: number) {
    await db
      .update(purchasingAnalysisJobs)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(purchasingAnalysisJobs.id, jobId));
    
    console.log(`[Scheduler] Job ${jobId} cancelled`);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.intervalId !== null,
      enabled: this.config.enabled,
      checkInterval: this.config.checkInterval,
      activeJobs: Array.from(this.activeJobs),
      maxConcurrentJobs: this.config.maxConcurrentJobs,
    };
  }
}

// Export singleton instance
export const purchasingAIScheduler = new PurchasingAIScheduler();
