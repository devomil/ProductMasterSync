/**
 * Amazon SP-API Rate Limiter using Token Bucket Algorithm
 * 
 * Implements the official SP-API rate limiting strategy as documented:
 * - Token bucket algorithm with configurable rate and burst limits
 * - Separate buckets per operation type and marketplace
 * - Automatic token replenishment
 * - Rate limit header parsing for dynamic adjustment
 */

interface TokenBucket {
  tokens: number;
  maxTokens: number; // Burst limit
  refillRate: number; // Tokens per second
  lastRefill: number; // Timestamp of last refill
}

interface RateLimitConfig {
  rateLimit: number; // Requests per second
  burstLimit: number; // Maximum burst requests
}

interface APIOperation {
  name: string;
  config: RateLimitConfig;
}

// Default rate limits for Amazon SP-API operations
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Catalog Items API
  'searchCatalogItems': { rateLimit: 2, burstLimit: 6 },
  'getCatalogItem': { rateLimit: 2, burstLimit: 6 },
  
  // Product Pricing API  
  'getItemOffers': { rateLimit: 0.5, burstLimit: 5 },
  'getItemOffersBatch': { rateLimit: 0.1, burstLimit: 1 },
  
  // Listings Restrictions API
  'getListingsRestrictions': { rateLimit: 5, burstLimit: 10 },
  
  // Reports API
  'createReport': { rateLimit: 0.0167, burstLimit: 15 }, // 1 request per minute
  'getReport': { rateLimit: 2, burstLimit: 15 },
  
  // Default for unknown operations
  'default': { rateLimit: 1, burstLimit: 5 }
};

export class SPAPIRateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private operationConfigs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Initialize with default rate limits
    Object.entries(DEFAULT_RATE_LIMITS).forEach(([operation, config]) => {
      this.operationConfigs.set(operation, config);
    });
  }

  /**
   * Get or create a token bucket for the given operation and marketplace
   */
  private getBucket(operation: string, marketplaceId: string = 'default'): TokenBucket {
    const bucketKey = `${operation}:${marketplaceId}`;
    
    if (!this.buckets.has(bucketKey)) {
      const config = this.operationConfigs.get(operation) || this.operationConfigs.get('default')!;
      
      const bucket: TokenBucket = {
        tokens: config.burstLimit, // Start with full bucket
        maxTokens: config.burstLimit,
        refillRate: config.rateLimit,
        lastRefill: Date.now()
      };
      
      this.buckets.set(bucketKey, bucket);
    }
    
    return this.buckets.get(bucketKey)!;
  }

  /**
   * Refill tokens in the bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Check if a request can be made for the given operation
   */
  canMakeRequest(operation: string, marketplaceId: string = 'default'): boolean {
    const bucket = this.getBucket(operation, marketplaceId);
    this.refillBucket(bucket);
    
    return bucket.tokens >= 1;
  }

  /**
   * Consume a token for making a request
   * Returns true if token was available, false if rate limited
   */
  consumeToken(operation: string, marketplaceId: string = 'default'): boolean {
    const bucket = this.getBucket(operation, marketplaceId);
    this.refillBucket(bucket);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Get time to wait before next request can be made (in milliseconds)
   */
  getWaitTime(operation: string, marketplaceId: string = 'default'): number {
    const bucket = this.getBucket(operation, marketplaceId);
    this.refillBucket(bucket);
    
    if (bucket.tokens >= 1) {
      return 0;
    }
    
    // Calculate time needed to get 1 token
    const timeForOneToken = 1000 / bucket.refillRate; // milliseconds
    return Math.ceil(timeForOneToken);
  }

  /**
   * Update rate limits based on response headers from Amazon
   */
  updateRateLimits(operation: string, headers: Record<string, string>): void {
    const rateLimit = headers['x-amzn-ratelimit-limit'];
    const remaining = headers['x-amzn-ratelimit-remaining'];
    
    if (rateLimit && remaining) {
      const parsedRateLimit = parseFloat(rateLimit);
      const parsedRemaining = parseFloat(remaining);
      
      if (!isNaN(parsedRateLimit) && !isNaN(parsedRemaining)) {
        // Update configuration based on actual rate limits
        const burstLimit = Math.max(10, Math.ceil(parsedRateLimit * 2)); // Estimate burst limit
        
        this.operationConfigs.set(operation, {
          rateLimit: parsedRateLimit,
          burstLimit: burstLimit
        });
        
        console.log(`[RateLimiter] Updated ${operation}: rate=${parsedRateLimit}, burst=${burstLimit}`);
      }
    }
  }

  /**
   * Wait for token availability with exponential backoff
   */
  async waitForToken(operation: string, marketplaceId: string = 'default'): Promise<void> {
    let waitTime = this.getWaitTime(operation, marketplaceId);
    let attempt = 0;
    
    while (waitTime > 0 && attempt < 10) {
      const backoffTime = Math.min(waitTime * Math.pow(1.5, attempt), 30000); // Max 30 seconds
      
      console.log(`[RateLimiter] Waiting ${backoffTime}ms for ${operation} token (attempt ${attempt + 1})`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      waitTime = this.getWaitTime(operation, marketplaceId);
      attempt++;
    }
    
    if (waitTime > 0) {
      throw new Error(`Rate limit exceeded for operation ${operation}. Max retries reached.`);
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async executeWithRateLimit<T>(
    operation: string,
    fn: () => Promise<T>,
    marketplaceId: string = 'default'
  ): Promise<T> {
    // Wait for token availability
    await this.waitForToken(operation, marketplaceId);
    
    // Consume token
    if (!this.consumeToken(operation, marketplaceId)) {
      throw new Error(`Failed to consume token for operation ${operation}`);
    }
    
    try {
      const result = await fn();
      return result;
    } catch (error: any) {
      // Check if it's a rate limit error and adjust accordingly
      if (error?.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          const waitMs = parseInt(retryAfter) * 1000;
          console.log(`[RateLimiter] Rate limited by server. Waiting ${waitMs}ms`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
      
      throw error;
    }
  }

  /**
   * Get current bucket status for monitoring
   */
  getBucketStatus(operation: string, marketplaceId: string = 'default'): {
    tokens: number;
    maxTokens: number;
    refillRate: number;
    canMakeRequest: boolean;
    waitTime: number;
  } {
    const bucket = this.getBucket(operation, marketplaceId);
    this.refillBucket(bucket);
    
    return {
      tokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
      canMakeRequest: bucket.tokens >= 1,
      waitTime: this.getWaitTime(operation, marketplaceId)
    };
  }

  /**
   * Reset all buckets (useful for testing or configuration changes)
   */
  resetBuckets(): void {
    this.buckets.clear();
    console.log('[RateLimiter] All token buckets reset');
  }
}

// Global rate limiter instance
export const rateLimiter = new SPAPIRateLimiter();