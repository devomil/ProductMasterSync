/**
 * Amazon Bulk Processor with Advanced Rate Limiting
 * 
 * Handles large-scale product processing (thousands of products) with:
 * - Intelligent rate limiting
 * - Exponential backoff on errors
 * - Progress tracking and resumption
 * - Queue management
 */

import { amazonRateLimiter } from '../utils/rate-limiter';
import { fetchAmazonDataByUpc } from './amazon-service';
import { createSyncLog, updateProductAmazonSyncStatus } from './repository';

interface BulkProcessingJob {
  id: string;
  productIds: number[];
  processedCount: number;
  totalCount: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  errors: ProcessingError[];
  successfulSyncs: number;
  failedSyncs: number;
}

interface ProcessingError {
  productId: number;
  upc: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

interface ProcessingOptions {
  batchSize: number;
  maxConcurrent: number;
  retryAttempts: number;
  pauseBetweenBatches: number; // milliseconds
  exponentialBackoff: boolean;
}

export class AmazonBulkProcessor {
  private activeJobs = new Map<string, BulkProcessingJob>();
  private defaultOptions: ProcessingOptions = {
    batchSize: 50,           // Process 50 products at a time
    maxConcurrent: 3,        // Maximum 3 concurrent requests
    retryAttempts: 3,        // Retry failed requests 3 times
    pauseBetweenBatches: 2000, // 2 second pause between batches
    exponentialBackoff: true
  };

  /**
   * Start bulk processing job for large product sets
   */
  async startBulkProcessing(
    productData: Array<{id: number, upc: string}>,
    options: Partial<ProcessingOptions> = {}
  ): Promise<string> {
    const jobId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const config = { ...this.defaultOptions, ...options };
    
    const job: BulkProcessingJob = {
      id: jobId,
      productIds: productData.map(p => p.id),
      processedCount: 0,
      totalCount: productData.length,
      status: 'pending',
      errors: [],
      successfulSyncs: 0,
      failedSyncs: 0
    };

    this.activeJobs.set(jobId, job);
    
    console.log(`Starting bulk processing job ${jobId} for ${productData.length} products`);
    
    // Start processing asynchronously
    this.processBulkJob(jobId, productData, config).catch(error => {
      console.error(`Bulk job ${jobId} failed:`, error);
      job.status = 'failed';
      job.completedAt = new Date();
    });

    return jobId;
  }

  /**
   * Process bulk job with advanced rate limiting and error handling
   */
  private async processBulkJob(
    jobId: string, 
    productData: Array<{id: number, upc: string}>,
    options: ProcessingOptions
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.status = 'running';
    job.startedAt = new Date();

    try {
      // Process products in batches
      for (let i = 0; i < productData.length; i += options.batchSize) {
        // Check if job should be paused or stopped
        if (job.status !== 'running') {
          console.log(`Job ${jobId} status changed to ${job.status}, stopping processing`);
          return;
        }

        const batch = productData.slice(i, i + options.batchSize);
        console.log(`Processing batch ${Math.floor(i / options.batchSize) + 1} of ${Math.ceil(productData.length / options.batchSize)} (${batch.length} products)`);

        await this.processBatch(jobId, batch, options);
        job.processedCount = Math.min(i + options.batchSize, productData.length);

        // Pause between batches to be respectful to Amazon's servers
        if (i + options.batchSize < productData.length) {
          console.log(`Pausing ${options.pauseBetweenBatches}ms before next batch...`);
          await this.sleep(options.pauseBetweenBatches);
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();
      
      console.log(`Bulk job ${jobId} completed successfully!`);
      console.log(`Results: ${job.successfulSyncs} successful, ${job.failedSyncs} failed`);

    } catch (error) {
      console.error(`Error in bulk job ${jobId}:`, error);
      job.status = 'failed';
      job.completedAt = new Date();
    }
  }

  /**
   * Process a batch of products with concurrent request limiting
   */
  private async processBatch(
    jobId: string,
    batch: Array<{id: number, upc: string}>,
    options: ProcessingOptions
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Process batch with controlled concurrency
    const semaphore = new Semaphore(options.maxConcurrent);
    
    const promises = batch.map(async (product) => {
      const release = await semaphore.acquire();
      
      try {
        await this.processProductWithRetry(jobId, product, options);
      } finally {
        release();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Process single product with retry logic and exponential backoff
   */
  private async processProductWithRetry(
    jobId: string,
    product: {id: number, upc: string},
    options: ProcessingOptions,
    attemptNumber: number = 1
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      // Wait for rate limiter
      await amazonRateLimiter.waitAndConsume();
      
      // Process the product
      await fetchAmazonDataByUpc(product.id, product.upc);
      job.successfulSyncs++;
      
      console.log(`✓ Successfully processed product ${product.id} (UPC: ${product.upc})`);
      
    } catch (error) {
      console.error(`✗ Failed to process product ${product.id} (attempt ${attemptNumber}):`, error);
      
      // Handle specific Amazon API errors
      const errorMessage = error.message || '';
      if (errorMessage.includes('QuotaExceeded') || errorMessage.includes('429')) {
        // For rate limit errors, wait longer before retry
        const rateLimitBackoff = 5000 + (attemptNumber * 2000); // 5-11 seconds
        console.log(`Rate limit hit for product ${product.id}, waiting ${rateLimitBackoff}ms...`);
        await this.sleep(rateLimitBackoff);
      } else if (errorMessage.includes('InvalidInput') || errorMessage.includes('Missing required')) {
        // Skip products with invalid UPCs - don't retry
        console.log(`Skipping product ${product.id} due to invalid UPC`);
        job.failedSyncs++;
        return;
      }
      
      if (attemptNumber < options.retryAttempts) {
        // Calculate backoff time
        const backoffTime = options.exponentialBackoff 
          ? Math.min(2000 * Math.pow(2, attemptNumber - 1), 60000) // Max 60 seconds, start at 2s
          : 2000;
        
        console.log(`Retrying product ${product.id} in ${backoffTime}ms...`);
        await this.sleep(backoffTime);
        
        return this.processProductWithRetry(jobId, product, options, attemptNumber + 1);
      } else {
        // Max retries reached, log error
        job.failedSyncs++;
        job.errors.push({
          productId: product.id,
          upc: product.upc,
          error: (error as Error).message,
          timestamp: new Date(),
          retryCount: attemptNumber - 1
        });
      }
    }
  }

  /**
   * Get job status and progress
   */
  getJobStatus(jobId: string): BulkProcessingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Pause a running job
   */
  pauseJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume a paused job
   */
  resumeJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'paused') {
      job.status = 'running';
      return true;
    }
    return false;
  }

  /**
   * Get all active jobs
   */
  getAllJobs(): BulkProcessingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Utility function for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for controlling concurrent operations
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}

// Singleton instance
export const amazonBulkProcessor = new AmazonBulkProcessor();