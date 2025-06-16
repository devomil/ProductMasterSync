/**
 * Optimized Rate Limiter for Amazon SP-API Bulk Processing
 * 
 * This service implements intelligent rate limiting with:
 * - Dynamic quota management
 * - Exponential backoff with jitter
 * - Batch processing optimization
 * - Priority queue management
 * - Circuit breaker pattern
 */

import { EventEmitter } from 'events';

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxBurstRequests: number;
  retryDelayMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  batchSize: number;
  priorityLevels: number;
}

export interface QueuedRequest {
  id: string;
  priority: number;
  timestamp: number;
  retryCount: number;
  request: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class OptimizedRateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private tokenBucket: number;
  private lastRefill: number;
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Set<string> = new Set();
  private circuitBreakerOpenUntil: number = 0;
  private failureCount: number = 0;
  private processing: boolean = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    super();
    
    // Default configuration optimized for Amazon SP-API
    this.config = {
      maxRequestsPerSecond: 2, // Conservative rate for SP-API
      maxBurstRequests: 5,
      retryDelayMs: 1000,
      maxRetries: 3,
      circuitBreakerThreshold: 10,
      batchSize: 10,
      priorityLevels: 3,
      ...config
    };

    this.tokenBucket = this.config.maxBurstRequests;
    this.lastRefill = Date.now();
    
    // Start token refill process
    this.startTokenRefill();
    
    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Add request to queue with priority
   */
  async executeRequest<T>(
    requestFn: () => Promise<T>,
    priority: number = 1,
    requestId?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedRequest: QueuedRequest = {
        id,
        priority,
        timestamp: Date.now(),
        retryCount: 0,
        request: requestFn,
        resolve,
        reject
      };

      // Insert request based on priority (higher priority first)
      const insertIndex = this.requestQueue.findIndex(req => req.priority < priority);
      if (insertIndex === -1) {
        this.requestQueue.push(queuedRequest);
      } else {
        this.requestQueue.splice(insertIndex, 0, queuedRequest);
      }

      this.emit('requestQueued', { id, priority, queueLength: this.requestQueue.length });
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Execute batch of requests with intelligent spacing
   */
  async executeBatch<T>(
    requests: Array<{ fn: () => Promise<T>; priority?: number; id?: string }>,
    progressCallback?: (processed: number, total: number, failed: number) => void
  ): Promise<Array<{ success: boolean; data?: T; error?: string; id?: string }>> {
    const results: Array<{ success: boolean; data?: T; error?: string; id?: string }> = [];
    let processed = 0;
    let failed = 0;

    // Process requests in batches
    for (let i = 0; i < requests.length; i += this.config.batchSize) {
      const batch = requests.slice(i, i + this.config.batchSize);
      
      // Execute batch with proper spacing
      const batchPromises = batch.map(async (req, index) => {
        try {
          // Add staggered delay within batch to spread load
          if (index > 0) {
            await this.delay(100 * index);
          }
          
          const data = await this.executeRequest(req.fn, req.priority || 1, req.id);
          processed++;
          
          if (progressCallback) {
            progressCallback(processed, requests.length, failed);
          }
          
          return { success: true, data, id: req.id };
        } catch (error) {
          failed++;
          processed++;
          
          if (progressCallback) {
            progressCallback(processed, requests.length, failed);
          }
          
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            id: req.id 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add inter-batch delay to prevent overwhelming the API
      if (i + this.config.batchSize < requests.length) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Start token bucket refill process
   */
  private startTokenRefill(): void {
    setInterval(() => {
      const now = Date.now();
      const timePassed = (now - this.lastRefill) / 1000;
      const tokensToAdd = Math.floor(timePassed * this.config.maxRequestsPerSecond);
      
      if (tokensToAdd > 0) {
        this.tokenBucket = Math.min(
          this.config.maxBurstRequests,
          this.tokenBucket + tokensToAdd
        );
        this.lastRefill = now;
        
        if (this.tokenBucket > 0 && this.requestQueue.length > 0) {
          this.processQueue();
        }
      }
    }, 100); // Check every 100ms for smooth operation
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    this.processQueue();
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        await this.delay(this.config.retryDelayMs * 2);
        continue;
      }

      // Check if we have tokens available
      if (this.tokenBucket <= 0) {
        await this.delay(100);
        continue;
      }

      const request = this.requestQueue.shift();
      if (!request) continue;

      // Consume token
      this.tokenBucket--;
      this.activeRequests.add(request.id);

      try {
        const result = await this.executeWithRetry(request);
        request.resolve(result);
        this.onRequestSuccess(request);
      } catch (error) {
        this.onRequestFailure(request, error);
      } finally {
        this.activeRequests.delete(request.id);
      }

      // Add small delay between requests
      await this.delay(50);
    }

    this.processing = false;
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(request: QueuedRequest): Promise<any> {
    try {
      return await request.request();
    } catch (error: any) {
      // Check if it's a rate limit error
      if (this.isRateLimitError(error) && request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        
        // Calculate exponential backoff with jitter
        const baseDelay = this.config.retryDelayMs * Math.pow(2, request.retryCount - 1);
        const jitter = Math.random() * 0.3 * baseDelay;
        const delay = baseDelay + jitter;
        
        this.emit('requestRetry', { 
          id: request.id, 
          attempt: request.retryCount, 
          delay 
        });
        
        await this.delay(delay);
        
        // Re-queue the request with same priority
        const insertIndex = this.requestQueue.findIndex(req => req.priority < request.priority);
        if (insertIndex === -1) {
          this.requestQueue.push(request);
        } else {
          this.requestQueue.splice(insertIndex, 0, request);
        }
        
        throw new Error('Request queued for retry');
      }
      
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onRequestSuccess(request: QueuedRequest): void {
    this.failureCount = Math.max(0, this.failureCount - 1);
    this.emit('requestSuccess', { id: request.id, retryCount: request.retryCount });
  }

  /**
   * Handle failed request
   */
  private onRequestFailure(request: QueuedRequest, error: any): void {
    this.failureCount++;
    
    if (this.isRateLimitError(error)) {
      // Trigger circuit breaker for rate limit errors
      if (this.failureCount >= this.config.circuitBreakerThreshold) {
        this.openCircuitBreaker();
      }
    }
    
    request.reject(error);
    this.emit('requestFailure', { 
      id: request.id, 
      error: error.message, 
      retryCount: request.retryCount 
    });
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.response?.status;
    
    return (
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('too many requests') ||
      message.includes('throttled')
    );
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(): void {
    this.circuitBreakerOpenUntil = Date.now() + (this.config.retryDelayMs * 10);
    this.emit('circuitBreakerOpen', { 
      openUntil: this.circuitBreakerOpenUntil,
      failureCount: this.failureCount 
    });
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (Date.now() > this.circuitBreakerOpenUntil) {
      if (this.circuitBreakerOpenUntil > 0) {
        this.circuitBreakerOpenUntil = 0;
        this.failureCount = 0;
        this.emit('circuitBreakerClosed');
      }
      return false;
    }
    return this.circuitBreakerOpenUntil > 0;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus(): {
    queueLength: number;
    activeRequests: number;
    tokenBucket: number;
    circuitBreakerOpen: boolean;
    failureCount: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      tokenBucket: this.tokenBucket,
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      failureCount: this.failureCount
    };
  }

  /**
   * Clear queue (useful for testing or emergency stops)
   */
  clearQueue(): void {
    const clearedRequests = this.requestQueue.splice(0);
    clearedRequests.forEach(req => {
      req.reject(new Error('Request cleared from queue'));
    });
    this.emit('queueCleared', { clearedCount: clearedRequests.length });
  }
}

// Export singleton instance
export const optimizedRateLimiter = new OptimizedRateLimiter({
  maxRequestsPerSecond: 1.5, // Conservative for Amazon SP-API
  maxBurstRequests: 3,
  retryDelayMs: 2000,
  maxRetries: 5,
  circuitBreakerThreshold: 5,
  batchSize: 5,
  priorityLevels: 3
});