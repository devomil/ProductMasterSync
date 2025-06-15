/**
 * Automated Batch ASIN Discovery Processor
 * 
 * Processes the entire catalog to find multiple ASINs per product using:
 * - UPC codes and manufacturer part numbers
 * - Proper SP-API rate limiting with token bucket algorithm
 * - Database storage for ASIN mappings with listing restrictions
 * - Robust error handling and retry logic
 */

import { Pool } from 'pg';
import { rateLimiter } from './rate-limiter';
import { searchAmazonCatalog } from '../utils/amazon-spapi';
import { getListingRestrictions } from '../utils/amazon-spapi';
import { pool } from '../db';

interface Product {
  id: number;
  sku: string;
  name: string;
  upc: string | null;
  manufacturer_part_number: string | null;
}

interface ASINDiscoveryResult {
  asin: string;
  title?: string;
  brand?: string;
  upc?: string;
  manufacturerPartNumber?: string;
  searchMethod: 'upc' | 'manufacturer_part_number' | 'combined';
  canList?: boolean;
  hasListingRestrictions?: boolean;
  restrictionReasonCodes?: string[];
  restrictionMessages?: string[];
}

interface BatchProcessingStats {
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  totalASINsFound: number;
  averageASINsPerProduct: number;
  processingTimeMs: number;
  rateLimitHits: number;
  errors: string[];
}

export class BatchASINProcessor {
  private db: Pool;
  private batchId: string;
  private stats: BatchProcessingStats;
  private isProcessing: boolean = false;

  constructor(dbPool?: Pool) {
    this.db = dbPool || pool;
    this.batchId = `batch_${Date.now()}`;
    this.stats = {
      totalProducts: 0,
      processedProducts: 0,
      successfulProducts: 0,
      failedProducts: 0,
      totalASINsFound: 0,
      averageASINsPerProduct: 0,
      processingTimeMs: 0,
      rateLimitHits: 0,
      errors: []
    };
  }

  /**
   * Start automated batch processing for the entire catalog
   */
  async startBatchProcessing(options: {
    batchSize?: number;
    maxConcurrency?: number;
    skipRecentlyProcessed?: boolean;
    onlyWithUPCOrMPN?: boolean;
  } = {}): Promise<BatchProcessingStats> {
    
    if (this.isProcessing) {
      throw new Error('Batch processing is already running');
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log(`[BatchProcessor] Starting batch processing with ID: ${this.batchId}`);
      
      // Get products to process
      const products = await this.getProductsToProcess(options);
      this.stats.totalProducts = products.length;

      console.log(`[BatchProcessor] Found ${products.length} products to process`);

      // Process products in controlled batches
      const batchSize = options.batchSize || 50;
      const maxConcurrency = options.maxConcurrency || 3;

      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        console.log(`[BatchProcessor] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
        
        // Process batch with controlled concurrency
        await this.processBatch(batch, maxConcurrency);
        
        // Log progress
        const progress = ((i + batch.length) / products.length * 100).toFixed(1);
        console.log(`[BatchProcessor] Progress: ${progress}% (${this.stats.processedProducts}/${this.stats.totalProducts})`);
      }

      this.stats.processingTimeMs = Date.now() - startTime;
      this.stats.averageASINsPerProduct = this.stats.totalASINsFound / Math.max(this.stats.successfulProducts, 1);

      console.log(`[BatchProcessor] Batch processing completed:`, this.stats);
      
      // Log batch completion to database
      await this.logBatchCompletion();

      return this.stats;

    } catch (error: any) {
      console.error(`[BatchProcessor] Batch processing failed:`, error);
      this.stats.errors.push(`Batch processing failed: ${error.message}`);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get products that need ASIN discovery
   */
  private async getProductsToProcess(options: any): Promise<Product[]> {
    let query = `
      SELECT id, sku, name, upc, manufacturer_part_number as "manufacturerPartNumber"
      FROM products 
      WHERE status = 'active'
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.onlyWithUPCOrMPN) {
      conditions.push(`(upc IS NOT NULL OR manufacturer_part_number IS NOT NULL)`);
    }

    if (options.skipRecentlyProcessed) {
      conditions.push(`
        id NOT IN (
          SELECT DISTINCT product_id 
          FROM product_amazon_lookup 
          WHERE last_search_at > NOW() - INTERVAL '24 hours'
          AND search_status = 'found'
        )
      `);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY id LIMIT 10000`; // Safety limit

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Process a batch of products with controlled concurrency
   */
  private async processBatch(products: Product[], maxConcurrency: number): Promise<void> {
    const processProduct = async (product: Product): Promise<void> => {
      try {
        await this.processProduct(product);
        this.stats.successfulProducts++;
      } catch (error: any) {
        console.error(`[BatchProcessor] Failed to process product ${product.id}:`, error);
        this.stats.failedProducts++;
        this.stats.errors.push(`Product ${product.id}: ${error.message}`);
      } finally {
        this.stats.processedProducts++;
      }
    };

    // Process products with simple concurrency control
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < products.length; i += maxConcurrency) {
      const batch = products.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(product => processProduct(product));
      
      // Wait for this batch to complete before starting the next
      await Promise.all(batchPromises);
    }
  }

  /**
   * Process a single product to find ASINs
   */
  public async processProduct(product: Product): Promise<void> {
    console.log(`[BatchProcessor] Processing product ${product.id}: ${product.name}`);

    // Track search in database
    await this.updateProductLookupStatus(product.id, 'pending', 'Starting ASIN discovery');

    const asinsFound: ASINDiscoveryResult[] = [];
    
    try {
      // Search by UPC if available
      if (product.upc) {
        try {
          const upcResults = await this.searchByUPC(product.upc);
          asinsFound.push(...upcResults.map(asin => ({ 
            ...asin, 
            searchMethod: 'upc' as const,
            upc: product.upc 
          })));
        } catch (error: any) {
          console.warn(`[BatchProcessor] UPC search failed for product ${product.id}:`, error.message);
        }
      }

      // Search by manufacturer part number if available
      if (product.manufacturerPartNumber) {
        try {
          const mpnResults = await this.searchByManufacturerPartNumber(product.manufacturerPartNumber);
          // Filter out duplicates from UPC search
          const newResults = mpnResults.filter(mpnAsin => 
            !asinsFound.some(existingAsin => existingAsin.asin === mpnAsin.asin)
          );
          asinsFound.push(...newResults.map(asin => ({ 
            ...asin, 
            searchMethod: 'manufacturer_part_number' as const,
            manufacturerPartNumber: product.manufacturerPartNumber 
          })));
        } catch (error: any) {
          console.warn(`[BatchProcessor] MPN search failed for product ${product.id}:`, error.message);
        }
      }

      // Get listing restrictions for each ASIN found
      for (const asinResult of asinsFound) {
        try {
          const restrictions = await this.getASINListingRestrictions(asinResult.asin);
          asinResult.canList = restrictions.canList;
          asinResult.hasListingRestrictions = restrictions.hasListingRestrictions;
          asinResult.restrictionReasonCodes = restrictions.restrictionReasonCodes;
          asinResult.restrictionMessages = restrictions.restrictionMessages;
        } catch (error: any) {
          console.warn(`[BatchProcessor] Failed to get restrictions for ASIN ${asinResult.asin}:`, error.message);
          // Continue without restriction data
        }
      }

      // Store results in database
      if (asinsFound.length > 0) {
        await this.storeASINMappings(product, asinsFound);
        await this.updateProductLookupStatus(product.id, 'found', `Found ${asinsFound.length} ASINs`);
        this.stats.totalASINsFound += asinsFound.length;
        
        console.log(`[BatchProcessor] Found ${asinsFound.length} ASINs for product ${product.id}`);
      } else {
        await this.updateProductLookupStatus(product.id, 'not_found', 'No ASINs found');
        console.log(`[BatchProcessor] No ASINs found for product ${product.id}`);
      }

    } catch (error: any) {
      await this.updateProductLookupStatus(product.id, 'error', error.message);
      throw error;
    }
  }

  /**
   * Search Amazon catalog by UPC
   */
  private async searchByUPC(upc: string): Promise<ASINDiscoveryResult[]> {
    return await rateLimiter.executeWithRateLimit('searchCatalogItems', async () => {
      const results = await searchAmazonCatalog(upc);
      
      return results.map((item: any) => ({
        asin: item.asin,
        title: item.summaries?.[0]?.itemName,
        brand: item.summaries?.[0]?.brand,
        upc: upc,
        manufacturerPartNumber: undefined,
        searchMethod: 'upc' as const,
        canList: undefined,
        hasListingRestrictions: undefined,
        restrictionReasonCodes: undefined,
        restrictionMessages: undefined
      }));
    });
  }

  /**
   * Search Amazon catalog by manufacturer part number
   */
  private async searchByManufacturerPartNumber(mpn: string): Promise<ASINDiscoveryResult[]> {
    return await rateLimiter.executeWithRateLimit('searchCatalogItems', async () => {
      const results = await searchAmazonCatalog(mpn);
      
      return results.map((item: any) => ({
        asin: item.asin,
        title: item.summaries?.[0]?.itemName,
        brand: item.summaries?.[0]?.brand,
        upc: undefined,
        manufacturerPartNumber: mpn,
        searchMethod: 'manufacturer_part_number' as const,
        canList: undefined,
        hasListingRestrictions: undefined,
        restrictionReasonCodes: undefined,
        restrictionMessages: undefined
      }));
    });
  }

  /**
   * Get listing restrictions for an ASIN
   */
  private async getASINListingRestrictions(asin: string): Promise<{
    canList: boolean;
    hasListingRestrictions: boolean;
    restrictionReasonCodes: string[];
    restrictionMessages: string[];
  }> {
    return await rateLimiter.executeWithRateLimit('getListingsRestrictions', async () => {
      const restrictions = await getListingRestrictions(asin);
      
      return {
        canList: !restrictions.restrictions || restrictions.restrictions.length === 0,
        hasListingRestrictions: restrictions.restrictions && restrictions.restrictions.length > 0,
        restrictionReasonCodes: restrictions.restrictions?.map((r: any) => r.reasonCode) || [],
        restrictionMessages: restrictions.restrictions?.map((r: any) => r.message) || []
      };
    });
  }

  /**
   * Store ASIN mappings in database
   */
  private async storeASINMappings(product: Product, asins: ASINDiscoveryResult[]): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (const asin of asins) {
        // Insert or update UPC-ASIN mapping
        await client.query(`
          INSERT INTO upc_asin_mappings (
            upc, manufacturer_part_number, asin, 
            can_list, has_listing_restrictions, 
            restriction_reason_codes, restriction_messages,
            search_method, source, marketplace_id,
            discovered_at, last_verified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sp_api', 'ATVPDKIKX0DER', NOW(), NOW())
          ON CONFLICT (upc, asin, marketplace_id) 
          DO UPDATE SET
            manufacturer_part_number = EXCLUDED.manufacturer_part_number,
            can_list = EXCLUDED.can_list,
            has_listing_restrictions = EXCLUDED.has_listing_restrictions,
            restriction_reason_codes = EXCLUDED.restriction_reason_codes,
            restriction_messages = EXCLUDED.restriction_messages,
            search_method = EXCLUDED.search_method,
            last_verified_at = NOW(),
            updated_at = NOW()
        `, [
          product.upc,
          product.manufacturerPartNumber,
          asin.asin,
          asin.canList || true,
          asin.hasListingRestrictions || false,
          asin.restrictionReasonCodes || [],
          asin.restrictionMessages || [],
          asin.searchMethod
        ]);

        // Log the discovery
        await client.query(`
          INSERT INTO amazon_sync_logs (
            product_id, batch_id, result, upc, asin,
            sync_started_at, sync_completed_at
          ) VALUES ($1, $2, 'success', $3, $4, NOW(), NOW())
        `, [product.id, this.batchId, product.upc, asin.asin]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update product lookup status
   */
  private async updateProductLookupStatus(
    productId: number, 
    status: string, 
    message?: string
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO product_amazon_lookup (
        product_id, lookup_status, last_lookup_at, asins_found
      ) VALUES ($1, $2, NOW(), 0)
      ON CONFLICT (product_id)
      DO UPDATE SET
        lookup_status = EXCLUDED.lookup_status,
        last_lookup_at = NOW(),
        updated_at = NOW()
    `, [productId, status]);
  }

  /**
   * Log batch completion to database
   */
  private async logBatchCompletion(): Promise<void> {
    const status = this.stats.errors.length === 0 ? 'success' : 'partial_success';
    const errorDetails = this.stats.errors.length > 0 ? 
      JSON.stringify({ errors: this.stats.errors.slice(0, 10), count: this.stats.errors.length }) : 
      null;

    await this.db.query(`
      INSERT INTO amazon_sync_logs (
        batch_id, sync_status, error_message, sync_started_at, sync_completed_at, result
      ) VALUES ($1, $2, $3, NOW() - INTERVAL '${this.stats.processingTimeMs} milliseconds', NOW(), $4)
    `, [
      this.batchId,
      status,
      errorDetails,
      JSON.stringify(this.stats)
    ]);
  }

  /**
   * Get current processing statistics
   */
  getStats(): BatchProcessingStats {
    return { ...this.stats };
  }

  /**
   * Check if processor is currently running
   */
  isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Stop processing (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (this.isProcessing) {
      console.log('[BatchProcessor] Stopping batch processing...');
      this.isProcessing = false;
    }
  }
}

// Global processor instance
let globalProcessor: BatchASINProcessor | null = null;

export function getGlobalProcessor(db: Pool): BatchASINProcessor {
  if (!globalProcessor) {
    globalProcessor = new BatchASINProcessor(db);
  }
  return globalProcessor;
}