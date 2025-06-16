/**
 * Bulk ASIN Processing Service
 * 
 * Handles large-scale CSV/Excel uploads with intelligent processing,
 * progress tracking, and optimized rate limiting for Amazon SP-API
 */

import { optimizedRateLimiter } from './optimized-rate-limiter';
import { searchCatalogItemsByUPC, searchByManufacturerNumber, searchProductMultipleWays } from '../utils/amazon-spapi';
import { EventEmitter } from 'events';

export interface BulkProcessingJob {
  id: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successfulSearches: number;
  failedSearches: number;
  startTime: Date;
  endTime?: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  results: BulkProcessingResult[];
  progress: number;
  estimatedTimeRemaining?: number;
}

export interface BulkProcessingResult {
  row: number;
  searchCriteria: {
    upc?: string;
    manufacturerNumber?: string;
    asin?: string;
    description?: string;
    brand?: string;
    model?: string;
  };
  foundASINs: Array<{
    asin: string;
    title: string;
    brand: string;
    imageUrl?: string;
    category: string;
    salesRank?: number;
    manufacturerNumber?: string;
  }>;
  searchMethod: 'upc' | 'mpn' | 'asin' | 'description' | 'keyword';
  processingTime: number;
  error?: string;
  success: boolean;
}

export interface ProcessingOptions {
  batchSize?: number;
  maxConcurrentRequests?: number;
  retryFailedRows?: boolean;
  prioritizeUPC?: boolean;
  fallbackToDescription?: boolean;
  progressCallback?: (job: BulkProcessingJob) => void;
}

export class BulkASINProcessor extends EventEmitter {
  private activeJobs: Map<string, BulkProcessingJob> = new Map();
  private jobQueue: string[] = [];
  private isProcessing: boolean = false;

  constructor() {
    super();
    
    // Listen to rate limiter events for better progress tracking
    optimizedRateLimiter.on('requestSuccess', (data) => {
      this.emit('apiRequestSuccess', data);
    });
    
    optimizedRateLimiter.on('requestFailure', (data) => {
      this.emit('apiRequestFailure', data);
    });
    
    optimizedRateLimiter.on('circuitBreakerOpen', (data) => {
      this.emit('rateLimitExceeded', data);
    });
  }

  /**
   * Process CSV data in bulk with optimized rate limiting
   */
  async processBulkData(
    csvData: Array<Record<string, string>>,
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<BulkProcessingJob> {
    const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BulkProcessingJob = {
      id: jobId,
      filename,
      totalRows: csvData.length,
      processedRows: 0,
      successfulSearches: 0,
      failedSearches: 0,
      startTime: new Date(),
      status: 'queued',
      results: [],
      progress: 0
    };

    // Store the actual CSV data with the job for processing
    (job as any).csvData = csvData;

    this.activeJobs.set(jobId, job);
    this.jobQueue.push(jobId);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processJobQueue();
    }

    return job;
  }

  /**
   * Process job queue
   */
  private async processJobQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const jobId = this.jobQueue.shift();
      if (!jobId) continue;

      const job = this.activeJobs.get(jobId);
      if (!job) continue;

      await this.processJob(job);
    }

    this.isProcessing = false;
  }

  /**
   * Process individual job
   */
  private async processJob(job: BulkProcessingJob): Promise<void> {
    job.status = 'processing';
    this.emit('jobStarted', job);

    try {
      // Get CSV data for this job (in real implementation, you'd store this)
      // For now, we'll process based on the job structure
      
      const startTime = Date.now();
      let lastProgressUpdate = startTime;

      // Create processing requests with intelligent search strategy
      const processingRequests = await this.createProcessingRequests(job);

      // Execute requests in batches with progress tracking
      const results = await optimizedRateLimiter.executeBatch(
        processingRequests,
        (processed, total, failed) => {
          job.processedRows = processed;
          job.successfulSearches = processed - failed;
          job.failedSearches = failed;
          job.progress = (processed / total) * 100;

          // Calculate estimated time remaining
          const elapsed = Date.now() - startTime;
          const rate = processed / (elapsed / 1000);
          const remaining = total - processed;
          job.estimatedTimeRemaining = remaining / rate;

          // Emit progress updates (throttled to every 2 seconds)
          const now = Date.now();
          if (now - lastProgressUpdate > 2000) {
            this.emit('jobProgress', job);
            lastProgressUpdate = now;
          }
        }
      );

      // Process results and update job
      job.results = results.map((result, index) => ({
        row: index + 1,
        searchCriteria: processingRequests[index].searchCriteria,
        foundASINs: result.success ? result.data?.foundASINs || [] : [],
        searchMethod: processingRequests[index].searchMethod as 'upc' | 'mpn' | 'asin' | 'description' | 'keyword',
        processingTime: 0, // Would be calculated per request
        error: result.error,
        success: result.success
      }));

      job.endTime = new Date();
      job.status = 'completed';
      job.progress = 100;

      this.emit('jobCompleted', job);

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      this.emit('jobFailed', { job, error });
    }
  }

  /**
   * Create processing requests with intelligent search strategy
   */
  private async createProcessingRequests(job: BulkProcessingJob): Promise<Array<{
    fn: () => Promise<any>;
    priority: number;
    id: string;
    searchCriteria: any;
    searchMethod: string;
  }>> {
    const requests = [];
    const csvData = (job as any).csvData || [];

    for (let i = 0; i < csvData.length; i++) {
      const rowData = csvData[i];
      
      // Clean UPC value - remove quotes and whitespace
      const cleanUpc = rowData.upc ? rowData.upc.replace(/[",\s]/g, '') : '';
      
      // Extract actual data from CSV row
      const searchData = {
        upc: cleanUpc,
        asin: rowData.asin || '',
        description: rowData.item_description || rowData.description || rowData.title || rowData.name || '',
        brand: rowData.brand || rowData.manufacturer || '',
        model: rowData.model || rowData.model_number || '',
        manufacturerPartNumber: rowData.model || rowData.mpn || rowData.manufacturer_part_number || ''
      };

      const request = this.createSearchRequest(searchData, i);
      if (request) {
        requests.push(request);
      }
    }

    return requests;
  }

  /**
   * Create individual search request with fallback strategy
   */
  private createSearchRequest(
    rowData: Record<string, string>,
    rowIndex: number
  ): {
    fn: () => Promise<any>;
    priority: number;
    id: string;
    searchCriteria: any;
    searchMethod: string;
  } | null {
    const searchCriteria = {
      upc: rowData.upc || rowData.UPC,
      manufacturerNumber: rowData.manufacturerNumber || rowData.mpn || rowData.MPN,
      asin: rowData.asin || rowData.ASIN,
      description: rowData.description || rowData.title || rowData.name,
      brand: rowData.brand || rowData.Brand,
      model: rowData.model || rowData.Model
    };

    // Determine search method and priority
    let searchMethod: string;
    let priority: number;
    let searchFunction: () => Promise<any>;

    if (searchCriteria.upc) {
      searchMethod = 'upc';
      priority = 3; // Highest priority for UPC searches
      searchFunction = () => this.searchByUPCWithFallback(searchCriteria);
    } else if (searchCriteria.manufacturerNumber) {
      searchMethod = 'mpn';
      priority = 2;
      searchFunction = () => this.searchByMPNWithFallback(searchCriteria);
    } else if (searchCriteria.description) {
      searchMethod = 'description';
      priority = 1;
      searchFunction = () => this.searchByDescriptionWithFallback(searchCriteria);
    } else {
      return null; // Skip rows without searchable data
    }

    return {
      fn: searchFunction,
      priority,
      id: `row_${rowIndex}`,
      searchCriteria,
      searchMethod
    };
  }

  /**
   * Search by UPC with fallback to other methods
   */
  private async searchByUPCWithFallback(criteria: any): Promise<any> {
    try {
      const results = await searchProductMultipleWays(criteria.upc);
      if (results && results.length > 0) {
        return { foundASINs: results };
      }
    } catch (error) {
      // UPC search failed, try manufacturer number
      if (criteria.manufacturerNumber) {
        try {
          const mpnResults = await searchByManufacturerNumber(criteria.manufacturerNumber);
          if (mpnResults && mpnResults.length > 0) {
            return { foundASINs: mpnResults };
          }
        } catch (mpnError) {
          // Continue to description search
        }
      }
    }

    // Final fallback to description search
    if (criteria.description) {
      try {
        const { searchCatalogItemsByUPC } = await import('../utils/amazon-spapi');
        const descResults = await searchCatalogItemsByUPC(criteria.description, {});
        return { foundASINs: descResults || [] };
      } catch (error) {
        console.error('Description search failed:', error);
      }
    }

    return { foundASINs: [] };
  }

  /**
   * Search by manufacturer number with fallback
   */
  private async searchByMPNWithFallback(criteria: any): Promise<any> {
    try {
      const results = await searchByManufacturerNumber(criteria.manufacturerNumber);
      if (results && results.length > 0) {
        return { foundASINs: results };
      }
    } catch (error) {
      // Fallback to description search
      if (criteria.description) {
        try {
          const { searchCatalogItemsByUPC } = await import('../utils/amazon-spapi');
          const descResults = await searchCatalogItemsByUPC(criteria.description);
          return { foundASINs: descResults || [] };
        } catch (descError) {
          console.error('Description fallback search failed:', descError);
        }
      }
    }
    return { foundASINs: [] };
  }

  /**
   * Search by description with keyword optimization
   */
  private async searchByDescriptionWithFallback(criteria: any): Promise<any> {
    // Optimize description for better search results
    let searchTerm = criteria.description;
    
    // Add brand and model if available
    if (criteria.brand && !searchTerm.toLowerCase().includes(criteria.brand.toLowerCase())) {
      searchTerm = `${criteria.brand} ${searchTerm}`;
    }
    
    if (criteria.model && !searchTerm.toLowerCase().includes(criteria.model.toLowerCase())) {
      searchTerm = `${searchTerm} ${criteria.model}`;
    }

    try {
      const { searchCatalogItemsByUPC } = await import('../utils/amazon-spapi');
      const results = await searchCatalogItemsByUPC(searchTerm, {});
      return { foundASINs: results || [] };
    } catch (error) {
      console.error('Keyword search failed:', error);
      return { foundASINs: [] };
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BulkProcessingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getAllJobs(): BulkProcessingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Pause job processing
   */
  pauseJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'paused';
      this.emit('jobPaused', job);
      return true;
    }
    return false;
  }

  /**
   * Resume job processing
   */
  resumeJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'paused') {
      job.status = 'queued';
      this.jobQueue.push(jobId);
      if (!this.isProcessing) {
        this.processJobQueue();
      }
      this.emit('jobResumed', job);
      return true;
    }
    return false;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.endTime = new Date();
      this.emit('jobCancelled', job);
      return true;
    }
    return false;
  }

  /**
   * Clean up completed jobs (keep last 10)
   */
  cleanupCompletedJobs(): void {
    const completedJobs = Array.from(this.activeJobs.entries())
      .filter(([_, job]) => job.status === 'completed' || job.status === 'failed')
      .sort(([_, a], [__, b]) => b.startTime.getTime() - a.startTime.getTime());

    // Keep only the 10 most recent completed jobs
    const toDelete = completedJobs.slice(10);
    toDelete.forEach(([jobId]) => {
      this.activeJobs.delete(jobId);
    });

    if (toDelete.length > 0) {
      this.emit('jobsCleanedUp', { count: toDelete.length });
    }
  }
}

// Export singleton instance
export const bulkASINProcessor = new BulkASINProcessor();