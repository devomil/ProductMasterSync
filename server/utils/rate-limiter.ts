/**
 * Rate Limiter for Amazon SP-API
 * 
 * This utility manages the token bucket rate limiting to ensure
 * that we stay within Amazon's rate limits:
 * - 20 requests/second (steady state)
 * - 40 requests burst
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per ms
}

export class AmazonRateLimiter {
  private bucket: TokenBucket;
  private readonly MAX_WAIT_TIME = 10000; // 10 seconds maximum wait

  constructor(rateLimit = 20, burstLimit = 40) {
    // Initialize with a full bucket
    this.bucket = {
      tokens: burstLimit,
      lastRefill: Date.now(),
      capacity: burstLimit,
      refillRate: rateLimit / 1000 // Convert to tokens per ms
    };
  }

  /**
   * Refreshes the token bucket based on time elapsed since last refill
   */
  private refillBucket(): void {
    const now = Date.now();
    const timePassed = now - this.bucket.lastRefill;
    
    // Calculate tokens to add based on time passed
    const tokensToAdd = timePassed * this.bucket.refillRate;
    
    if (tokensToAdd > 0) {
      this.bucket.tokens = Math.min(this.bucket.capacity, this.bucket.tokens + tokensToAdd);
      this.bucket.lastRefill = now;
    }
  }

  /**
   * Checks if a request can be made based on available tokens
   * @returns boolean indicating if request can proceed
   */
  public canProceed(): boolean {
    this.refillBucket();
    return this.bucket.tokens >= 1;
  }

  /**
   * Consumes a token for a request
   * @returns void
   */
  public consumeToken(): void {
    if (this.canProceed()) {
      this.bucket.tokens -= 1;
    } else {
      throw new Error('Rate limit exceeded - no tokens available');
    }
  }

  /**
   * Calculates wait time until a token becomes available
   * @returns number of milliseconds to wait
   */
  public getWaitTime(): number {
    this.refillBucket();
    
    if (this.bucket.tokens >= 1) {
      return 0;
    }

    // Calculate time to get one token
    const timeForOneToken = (1 - this.bucket.tokens) / this.bucket.refillRate;
    
    // Cap at maximum wait time
    return Math.min(timeForOneToken, this.MAX_WAIT_TIME);
  }

  /**
   * Waits until a token is available and then consumes it
   * @returns Promise that resolves when a token becomes available and is consumed
   */
  public async waitAndConsume(): Promise<void> {
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.consumeToken();
  }
}

// Singleton instance for the application to use
export const amazonRateLimiter = new AmazonRateLimiter();