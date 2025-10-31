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
    // Loop until we successfully consume a token
    while (true) {
      this.refillBucket();
      
      if (this.bucket.tokens >= 1) {
        // We have a token, consume it and return
        this.bucket.tokens -= 1;
        return;
      }
      
      // Calculate wait time for one token
      const timeForOneToken = (1 - this.bucket.tokens) / this.bucket.refillRate;
      const waitTime = Math.min(Math.ceil(timeForOneToken), this.MAX_WAIT_TIME);
      
      // Wait for the token to become available
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

// Singleton instances for different Amazon SP-API endpoints
// Based on official Amazon SP-API documentation:
// https://developer-docs.amazon.com/sp-api/docs/

/**
 * Amazon Catalog Items API 2022-04-01
 * Documentation: https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-rate-limits
 * - searchCatalogItems: 2 requests per second, 2 burst
 * - getCatalogItem: 2 requests per second, 2 burst
 */
export const amazonCatalogRateLimiter = new AmazonRateLimiter(2, 2);

/**
 * Amazon Product Pricing API v0
 * Documentation: https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-rate-limits
 * - getPricing: 0.5 requests per second, 1 burst
 * - getCompetitivePricing: 0.5 requests per second, 1 burst
 * - getItemOffers: 0.5 requests per second, 1 burst
 */
export const amazonPricingRateLimiter = new AmazonRateLimiter(0.5, 1);

/**
 * Amazon Listings API
 * - getListingOffers: 1 request per second, 2 burst
 */
export const amazonListingsRateLimiter = new AmazonRateLimiter(1, 2);

/**
 * Amazon Product Fees API
 * Documentation: https://developer-docs.amazon.com/sp-api/docs/product-fees-api-rate-limits
 * - getMyFeesEstimate: 1 request per second, 1 burst
 */
export const amazonFeesRateLimiter = new AmazonRateLimiter(1, 1);

/**
 * Amazon Listings Restrictions API
 * Documentation: https://developer-docs.amazon.com/sp-api/docs/listings-restrictions-api-rate-limits
 * - getListingsRestrictions: 5 requests per second, 10 burst
 */
export const amazonListingsRestrictionsRateLimiter = new AmazonRateLimiter(5, 10);

// Backward compatibility - default to catalog rate limiter
export const amazonRateLimiter = amazonCatalogRateLimiter;