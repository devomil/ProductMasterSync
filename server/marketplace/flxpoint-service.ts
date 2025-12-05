import { db } from '../db';
import { flxpointVariants, flxpointSyncRuns, marketplaceListings, walmartListingDetails } from '@shared/schema';
import { eq, sql, and, isNotNull, desc } from 'drizzle-orm';
import { createFlxpointClient, FlxpointVariantResponse, FlxpointUpdatePayload, FlxpointCustomField } from './flxpoint-client';
import { calculateReferralFee } from './walmart-referral-fees';
import crypto from 'crypto';

interface SyncProgress {
  jobId: number;
  status: 'running' | 'completed' | 'failed';
  totalVariants: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  requestCount: number;
}

interface PullOptions {
  fullSync?: boolean;
  maxPages?: number;
  perPage?: number;
}

interface PushOptions {
  dryRun?: boolean;
  batchSize?: number;
  onlyChanged?: boolean;
}

export class FlxpointService {
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const client = createFlxpointClient();
    if (!client) {
      return { success: false, message: 'Flxpoint API token not configured' };
    }
    return client.testConnection();
  }

  async startPullJob(options: PullOptions = {}): Promise<number> {
    const { fullSync = true, maxPages = 1000, perPage = 100 } = options;
    
    const [syncRun] = await db.insert(flxpointSyncRuns).values({
      jobType: 'pull',
      status: 'running',
    }).returning();
    
    this.executePullJob(syncRun.id, { fullSync, maxPages, perPage }).catch(err => {
      console.error('[Flxpoint] Pull job error:', err);
      this.updateSyncRunStatus(syncRun.id, 'failed', err.message);
    });
    
    return syncRun.id;
  }

  private async executePullJob(jobId: number, options: PullOptions): Promise<void> {
    const client = createFlxpointClient();
    if (!client) {
      throw new Error('Flxpoint API token not configured');
    }
    
    const { maxPages = 1000, perPage = 100 } = options;
    let page = 1;
    let hasMore = true;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let requestCount = 0;
    const errors: any[] = [];
    
    console.log(`[Flxpoint] Starting pull job ${jobId} (using inventory/variants endpoint)`);
    
    while (hasMore && page <= maxPages) {
      try {
        // Use inventory/variants endpoint instead of product/variants
        // This is where the tens of thousands of variants actually live
        const response = await client.getInventoryVariants(page, perPage);
        requestCount++;
        
        const variants = response?.data || [];
        const meta = response?.meta || { total_count: 0, total_pages: 1, current_page: 1 };
        
        console.log(`[Flxpoint] Page ${page} response: ${variants.length} variants, meta:`, meta);
        
        if (!Array.isArray(variants)) {
          console.warn(`[Flxpoint] Invalid response on page ${page}: variants is not an array`);
          errors.push({ page, error: 'Invalid response: variants is not an array' });
          hasMore = false;
          break;
        }
        
        // Update total count estimate on first page if available
        if (page === 1 && meta.total_count !== undefined && meta.total_count > 0) {
          await db.update(flxpointSyncRuns)
            .set({ totalVariants: meta.total_count })
            .where(eq(flxpointSyncRuns.id, jobId));
        }
        
        for (const variant of variants) {
          try {
            await this.upsertVariant(variant);
            successCount++;
          } catch (err: any) {
            errorCount++;
            errors.push({ sku: variant?.sku || 'unknown', error: err.message });
          }
          processedCount++;
        }
        
        await db.update(flxpointSyncRuns).set({
          processedCount,
          successCount,
          errorCount,
          requestCount,
          lastProcessedPage: page,
        }).where(eq(flxpointSyncRuns.id, jobId));
        
        // Determine if there are more pages:
        // 1. If we have total_pages info from API, use it
        // 2. Otherwise, if we got a full page of results (50 is Flxpoint's max), assume there are more
        // 3. Stop if we got fewer than 50 results or empty results
        const FLXPOINT_MAX_PAGE_SIZE = 50;
        const gotFullPage = variants.length >= FLXPOINT_MAX_PAGE_SIZE;
        const knownTotalPages = meta.total_pages > 0 ? meta.total_pages : (gotFullPage ? page + 1 : page);
        
        hasMore = variants.length > 0 && gotFullPage;
        
        const totalEstimate = meta.total_count > 0 ? meta.total_count : (hasMore ? '?' : processedCount);
        console.log(`[Flxpoint] Processed page ${page}/${knownTotalPages}, ${processedCount}/${totalEstimate} variants, hasMore: ${hasMore}, gotFullPage: ${gotFullPage}`);
        
        page++;
        
      } catch (err: any) {
        console.error(`[Flxpoint] Error on page ${page}:`, err);
        errors.push({ page, error: err.message });
        errorCount++;
        
        if (err.response?.status === 429) {
          console.log('[Flxpoint] Rate limited, waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        hasMore = false;
      }
    }
    
    const hasFailed = successCount === 0 && errorCount > 0;
    const finalStatus = hasFailed ? 'failed' : 'completed';
    
    await db.update(flxpointSyncRuns).set({
      status: finalStatus,
      processedCount,
      successCount,
      errorCount,
      requestCount,
      finishedAt: new Date(),
      errors: errors.length > 0 ? errors.slice(0, 100) : null,
    }).where(eq(flxpointSyncRuns.id, jobId));
    
    console.log(`[Flxpoint] Pull job ${jobId} ${finalStatus}: ${successCount} success, ${errorCount} errors`);
  }

  private async upsertVariant(variant: FlxpointVariantResponse): Promise<void> {
    const parentSku = variant.parent_sku || variant.sku;
    
    const existingVariant = await db.select()
      .from(flxpointVariants)
      .where(eq(flxpointVariants.parentSku, parentSku))
      .limit(1);
    
    const variantData = {
      flxVariantId: variant.id,
      parentSku,
      sourceSku: variant.source_sku,
      asin: variant.asin,
      walmartId: variant.walmart_id,
      flxpointData: variant,
      lastPulledAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (existingVariant.length > 0) {
      await db.update(flxpointVariants)
        .set(variantData)
        .where(eq(flxpointVariants.id, existingVariant[0].id));
    } else {
      await db.insert(flxpointVariants).values({
        ...variantData,
        syncStatus: 'pending',
      });
    }
  }

  async startPushJob(options: PushOptions = {}): Promise<number> {
    const { dryRun = false, batchSize = 50, onlyChanged = true } = options;
    
    const [syncRun] = await db.insert(flxpointSyncRuns).values({
      jobType: 'push',
      status: 'running',
    }).returning();
    
    this.executePushJob(syncRun.id, { dryRun, batchSize, onlyChanged }).catch(err => {
      console.error('[Flxpoint] Push job error:', err);
      this.updateSyncRunStatus(syncRun.id, 'failed', err.message);
    });
    
    return syncRun.id;
  }

  private async executePushJob(jobId: number, options: PushOptions): Promise<void> {
    const client = createFlxpointClient();
    if (!client) {
      throw new Error('Flxpoint API token not configured');
    }
    
    const { dryRun = false, batchSize = 50, onlyChanged = true } = options;
    
    console.log(`[Flxpoint] Starting push job ${jobId} (dryRun: ${dryRun})`);
    
    const variantsToUpdate = await this.getVariantsForPush(onlyChanged);
    
    await db.update(flxpointSyncRuns)
      .set({ totalVariants: variantsToUpdate.length })
      .where(eq(flxpointSyncRuns.id, jobId));
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let requestCount = 0;
    const errors: any[] = [];
    
    for (let i = 0; i < variantsToUpdate.length; i += batchSize) {
      const batch = variantsToUpdate.slice(i, i + batchSize);
      
      const updatePayloads: FlxpointUpdatePayload[] = [];
      
      for (const variant of batch) {
        const payload = await this.buildUpdatePayload(variant);
        
        if (payload) {
          const payloadHash = this.hashPayload(payload);
          
          if (onlyChanged && variant.payloadHash === payloadHash) {
            skippedCount++;
            processedCount++;
            continue;
          }
          
          updatePayloads.push(payload);
        }
      }
      
      if (updatePayloads.length > 0 && !dryRun) {
        try {
          const result = await client.updateInventoryVariants(updatePayloads);
          requestCount++;
          
          if (result.success) {
            successCount += updatePayloads.length;
            
            for (const payload of updatePayloads) {
              const payloadHash = this.hashPayload(payload);
              await db.update(flxpointVariants)
                .set({
                  syncStatus: 'synced',
                  lastPushedAt: new Date(),
                  payloadHash,
                  updatedAt: new Date(),
                })
                .where(eq(flxpointVariants.parentSku, payload.sku));
            }
          } else {
            errorCount += updatePayloads.length;
            errors.push(...result.errors);
          }
        } catch (err: any) {
          errorCount += updatePayloads.length;
          errors.push({ batch: i / batchSize, error: err.message });
        }
      } else if (dryRun) {
        successCount += updatePayloads.length;
        console.log(`[Flxpoint] Dry run - would update ${updatePayloads.length} variants`);
      }
      
      processedCount += batch.length;
      
      await db.update(flxpointSyncRuns).set({
        processedCount,
        successCount,
        errorCount,
        skippedCount,
        requestCount,
      }).where(eq(flxpointSyncRuns.id, jobId));
      
      console.log(`[Flxpoint] Pushed batch ${Math.floor(i / batchSize) + 1}, ${processedCount}/${variantsToUpdate.length}`);
    }
    
    await db.update(flxpointSyncRuns).set({
      status: 'completed',
      processedCount,
      successCount,
      errorCount,
      skippedCount,
      requestCount,
      finishedAt: new Date(),
      errors: errors.length > 0 ? errors.slice(0, 100) : null,
    }).where(eq(flxpointSyncRuns.id, jobId));
    
    console.log(`[Flxpoint] Push job ${jobId} completed: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);
  }

  private async getVariantsForPush(onlyChanged: boolean): Promise<any[]> {
    if (onlyChanged) {
      return db.select()
        .from(flxpointVariants)
        .where(
          sql`${flxpointVariants.syncStatus} = 'pending' OR ${flxpointVariants.syncStatus} = 'error'`
        );
    }
    
    return db.select().from(flxpointVariants);
  }

  private async buildUpdatePayload(variant: any): Promise<FlxpointUpdatePayload | null> {
    const client = createFlxpointClient();
    if (!client) return null;
    
    const payload: FlxpointUpdatePayload = {
      sku: variant.parentSku,
    };
    
    let hasData = false;
    
    if (variant.wmCommissionRate) {
      payload.wm_comm_rate = variant.wmCommissionRate;
      hasData = true;
    }
    
    if (variant.amzCommissionRate) {
      payload.amz_comm_rate = variant.amzCommissionRate;
      hasData = true;
    }
    
    if (variant.wmProductType) {
      payload.wm_product_type = variant.wmProductType;
      hasData = true;
    }
    
    if (variant.wmBuyBoxPrice) {
      payload.wm_buybox_price = variant.wmBuyBoxPrice;
      hasData = true;
    }
    
    if (variant.amzBuyBoxPrice) {
      payload.amz_buybox_price = variant.amzBuyBoxPrice;
      hasData = true;
    }
    
    if (!hasData) {
      return null;
    }
    
    return payload;
  }

  private hashPayload(payload: FlxpointUpdatePayload): string {
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = (payload as any)[key];
        return acc;
      }, {} as any);
    
    return crypto.createHash('md5').update(JSON.stringify(sortedPayload)).digest('hex');
  }

  private async updateSyncRunStatus(jobId: number, status: string, errorMessage?: string): Promise<void> {
    await db.update(flxpointSyncRuns).set({
      status,
      finishedAt: new Date(),
      errors: errorMessage ? [{ error: errorMessage }] : null,
    }).where(eq(flxpointSyncRuns.id, jobId));
  }

  async getSyncProgress(jobId: number): Promise<SyncProgress | null> {
    const [run] = await db.select()
      .from(flxpointSyncRuns)
      .where(eq(flxpointSyncRuns.id, jobId));
    
    if (!run) return null;
    
    return {
      jobId: run.id,
      status: run.status as 'running' | 'completed' | 'failed',
      totalVariants: run.totalVariants || 0,
      processedCount: run.processedCount || 0,
      successCount: run.successCount || 0,
      errorCount: run.errorCount || 0,
      skippedCount: run.skippedCount || 0,
      requestCount: run.requestCount || 0,
    };
  }

  async getRecentSyncRuns(limit: number = 10): Promise<any[]> {
    return db.select()
      .from(flxpointSyncRuns)
      .orderBy(desc(flxpointSyncRuns.createdAt))
      .limit(limit);
  }

  async getVariants(options: {
    page?: number;
    limit?: number;
    syncStatus?: string;
    hasAsin?: boolean;
    hasWalmartId?: boolean;
  } = {}): Promise<{ variants: any[]; total: number }> {
    const { page = 1, limit = 50, syncStatus, hasAsin, hasWalmartId } = options;
    const offset = (page - 1) * limit;
    
    let query = db.select().from(flxpointVariants);
    
    const conditions = [];
    
    if (syncStatus) {
      conditions.push(eq(flxpointVariants.syncStatus, syncStatus as any));
    }
    
    if (hasAsin === true) {
      conditions.push(isNotNull(flxpointVariants.asin));
    } else if (hasAsin === false) {
      conditions.push(sql`${flxpointVariants.asin} IS NULL`);
    }
    
    if (hasWalmartId === true) {
      conditions.push(isNotNull(flxpointVariants.walmartId));
    } else if (hasWalmartId === false) {
      conditions.push(sql`${flxpointVariants.walmartId} IS NULL`);
    }
    
    const variants = await db.select()
      .from(flxpointVariants)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(flxpointVariants.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return { variants, total: count };
  }

  async enrichVariantFromMarketplace(variantId: number): Promise<void> {
    const [variant] = await db.select()
      .from(flxpointVariants)
      .where(eq(flxpointVariants.id, variantId));
    
    if (!variant) return;
    
    const updates: any = {};
    
    if (variant.walmartId) {
      const [walmartListing] = await db.select()
        .from(marketplaceListings)
        .innerJoin(walmartListingDetails, eq(marketplaceListings.id, walmartListingDetails.marketplaceListingId))
        .where(
          and(
            eq(marketplaceListings.marketplace, 'walmart'),
            eq(marketplaceListings.listingId, variant.walmartId)
          )
        );
      
      if (walmartListing) {
        updates.wmBuyBoxPrice = walmartListing.walmart_listing_details.buyBoxTotalPriceInCents;
        updates.wmProductType = walmartListing.marketplace_listings.productType;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      updates.syncStatus = 'pending';
      await db.update(flxpointVariants)
        .set(updates)
        .where(eq(flxpointVariants.id, variantId));
    }
  }

  async enrichAllVariantsFromMarketplace(): Promise<{ updated: number }> {
    const variants = await db.select().from(flxpointVariants);
    let updated = 0;
    
    for (const variant of variants) {
      await this.enrichVariantFromMarketplace(variant.id);
      updated++;
    }
    
    return { updated };
  }

  async updateVariantCommissionRates(variantId: number, rates: {
    wmCommissionRate?: number;
    amzCommissionRate?: number;
    wmProductType?: string;
  }): Promise<void> {
    const updates: any = {
      syncStatus: 'pending',
      updatedAt: new Date(),
    };
    
    if (rates.wmCommissionRate !== undefined) {
      updates.wmCommissionRate = rates.wmCommissionRate;
    }
    
    if (rates.amzCommissionRate !== undefined) {
      updates.amzCommissionRate = rates.amzCommissionRate;
    }
    
    if (rates.wmProductType !== undefined) {
      updates.wmProductType = rates.wmProductType;
    }
    
    await db.update(flxpointVariants)
      .set(updates)
      .where(eq(flxpointVariants.id, variantId));
  }

  async getStats(): Promise<{
    totalVariants: number;
    pendingSync: number;
    synced: number;
    withErrors: number;
    withAsin: number;
    withWalmartId: number;
    withUpc: number;
    matchedWalmart: number;
    lastPullRun: any;
    lastPushRun: any;
    lastEnrichRun: any;
  }> {
    const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(flxpointVariants);
    const [pendingResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(eq(flxpointVariants.syncStatus, 'pending'));
    const [syncedResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(eq(flxpointVariants.syncStatus, 'synced'));
    const [errorResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(eq(flxpointVariants.syncStatus, 'error'));
    const [asinResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(isNotNull(flxpointVariants.asin));
    const [walmartResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(isNotNull(flxpointVariants.walmartId));
    
    const [upcResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(sql`${flxpointVariants.flxpointData}->>'upc' IS NOT NULL AND ${flxpointVariants.flxpointData}->>'upc' != 'null' AND ${flxpointVariants.flxpointData}->>'upc' != ''`);
    
    const [matchedResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(isNotNull(flxpointVariants.wmCommissionRate));
    
    const [lastPullRun] = await db.select()
      .from(flxpointSyncRuns)
      .where(eq(flxpointSyncRuns.jobType, 'pull'))
      .orderBy(desc(flxpointSyncRuns.createdAt))
      .limit(1);
    
    const [lastPushRun] = await db.select()
      .from(flxpointSyncRuns)
      .where(eq(flxpointSyncRuns.jobType, 'push'))
      .orderBy(desc(flxpointSyncRuns.createdAt))
      .limit(1);
    
    const [lastEnrichRun] = await db.select()
      .from(flxpointSyncRuns)
      .where(eq(flxpointSyncRuns.jobType, 'enrich'))
      .orderBy(desc(flxpointSyncRuns.createdAt))
      .limit(1);
    
    return {
      totalVariants: totalResult.count,
      pendingSync: pendingResult.count,
      synced: syncedResult.count,
      withErrors: errorResult.count,
      withAsin: asinResult.count,
      withWalmartId: walmartResult.count,
      withUpc: upcResult.count,
      matchedWalmart: matchedResult.count,
      lastPullRun,
      lastPushRun,
      lastEnrichRun,
    };
  }

  private normalizeUpc(upc: string | null | undefined): string | null {
    if (!upc || upc === 'null' || upc === '') return null;
    return upc.replace(/^0+/, '');
  }

  async startEnrichmentJob(): Promise<number> {
    const [syncRun] = await db.insert(flxpointSyncRuns).values({
      jobType: 'enrich',
      status: 'running',
    }).returning();
    
    this.executeEnrichmentJob(syncRun.id).catch(err => {
      console.error('[Flxpoint] Enrichment job error:', err);
      this.updateSyncRunStatus(syncRun.id, 'failed', err.message);
    });
    
    return syncRun.id;
  }

  private async executeEnrichmentJob(jobId: number): Promise<void> {
    console.log(`[Flxpoint] Starting enrichment job ${jobId}`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];
    
    const variants = await db.select()
      .from(flxpointVariants)
      .where(sql`${flxpointVariants.flxpointData}->>'upc' IS NOT NULL AND ${flxpointVariants.flxpointData}->>'upc' != 'null' AND ${flxpointVariants.flxpointData}->>'upc' != ''`);
    
    console.log(`[Flxpoint] Found ${variants.length} variants with UPC to enrich`);
    
    await db.update(flxpointSyncRuns)
      .set({ totalVariants: variants.length })
      .where(eq(flxpointSyncRuns.id, jobId));
    
    const walmartListingsMap = await this.buildWalmartUpcMap();
    console.log(`[Flxpoint] Built Walmart UPC map with ${walmartListingsMap.size} entries`);
    
    for (const variant of variants) {
      try {
        const flxUpc = (variant.flxpointData as any)?.upc;
        const normalizedUpc = this.normalizeUpc(flxUpc);
        
        if (!normalizedUpc) {
          skippedCount++;
          processedCount++;
          continue;
        }
        
        const walmartData = walmartListingsMap.get(normalizedUpc);
        
        if (!walmartData) {
          skippedCount++;
          processedCount++;
          continue;
        }
        
        const updates: any = {
          walmartId: walmartData.listingId,
          wmProductType: walmartData.productType,
          wmBuyBoxPrice: walmartData.buyBoxPrice,
          wmCommissionRate: walmartData.commissionRate,
          syncStatus: 'pending',
          updatedAt: new Date(),
        };
        
        await db.update(flxpointVariants)
          .set(updates)
          .where(eq(flxpointVariants.id, variant.id));
        
        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push({ variantId: variant.id, error: err.message });
      }
      
      processedCount++;
      
      if (processedCount % 500 === 0) {
        await db.update(flxpointSyncRuns).set({
          processedCount,
          successCount,
          errorCount,
          skippedCount,
        }).where(eq(flxpointSyncRuns.id, jobId));
        
        console.log(`[Flxpoint] Enrichment progress: ${processedCount}/${variants.length}, matched: ${successCount}`);
      }
    }
    
    await db.update(flxpointSyncRuns).set({
      status: 'completed',
      processedCount,
      successCount,
      errorCount,
      skippedCount,
      finishedAt: new Date(),
      errors: errors.length > 0 ? errors.slice(0, 100) : null,
    }).where(eq(flxpointSyncRuns.id, jobId));
    
    console.log(`[Flxpoint] Enrichment job ${jobId} completed: ${successCount} matched, ${skippedCount} skipped, ${errorCount} errors`);
  }

  private async buildWalmartUpcMap(): Promise<Map<string, {
    listingId: string;
    productType: string | null;
    buyBoxPrice: number | null;
    commissionRate: number | null;
  }>> {
    const upcMap = new Map<string, {
      listingId: string;
      productType: string | null;
      buyBoxPrice: number | null;
      commissionRate: number | null;
    }>();
    
    const walmartListings = await db.select({
      listingId: marketplaceListings.listingId,
      upc: marketplaceListings.upc,
      productType: marketplaceListings.productType,
      priceInCents: marketplaceListings.priceInCents,
      categoryPath: marketplaceListings.categoryPath,
      contractCategory: marketplaceListings.contractCategory,
      buyBoxPrice: walmartListingDetails.buyBoxTotalPriceInCents,
    })
    .from(marketplaceListings)
    .innerJoin(walmartListingDetails, eq(marketplaceListings.id, walmartListingDetails.marketplaceListingId))
    .where(
      and(
        eq(marketplaceListings.marketplace, 'walmart'),
        isNotNull(marketplaceListings.upc),
        eq(walmartListingDetails.walmartLifecycleStatus, 'ACTIVE'),
        eq(walmartListingDetails.walmartPublishStatus, 'PUBLISHED')
      )
    );
    
    for (const listing of walmartListings) {
      if (!listing.upc) continue;
      
      const normalizedUpc = this.normalizeUpc(listing.upc);
      if (!normalizedUpc) continue;
      
      let commissionRate: number | null = null;
      
      if (listing.priceInCents) {
        try {
          const categoryPathArray = Array.isArray(listing.categoryPath) 
            ? listing.categoryPath as string[]
            : null;
          const feeResult = calculateReferralFee(
            listing.priceInCents,
            categoryPathArray,
            listing.productType
          );
          commissionRate = 1 + (feeResult.feePercentageEffective / 100);
        } catch (err) {
          console.warn(`[Flxpoint] Failed to calculate fee for ${listing.listingId}:`, err);
        }
      }
      
      upcMap.set(normalizedUpc, {
        listingId: listing.listingId,
        productType: listing.productType,
        buyBoxPrice: listing.buyBoxPrice ? listing.buyBoxPrice / 100 : null,
        commissionRate,
      });
    }
    
    return upcMap;
  }

  async startCustomFieldsPushJob(): Promise<number> {
    const [syncRun] = await db.insert(flxpointSyncRuns).values({
      jobType: 'push',
      status: 'running',
    }).returning();
    
    this.executeCustomFieldsPushJob(syncRun.id).catch(err => {
      console.error('[Flxpoint] Push job error:', err);
      this.updateSyncRunStatus(syncRun.id, 'failed', err.message);
    });
    
    return syncRun.id;
  }

  private async executeCustomFieldsPushJob(jobId: number): Promise<void> {
    const client = createFlxpointClient();
    if (!client) {
      throw new Error('Flxpoint API token not configured');
    }
    
    console.log(`[Flxpoint] Starting custom fields push job ${jobId}`);
    
    const variantsToUpdate = await db.select()
      .from(flxpointVariants)
      .where(
        and(
          eq(flxpointVariants.syncStatus, 'pending'),
          isNotNull(flxpointVariants.wmCommissionRate)
        )
      );
    
    console.log(`[Flxpoint] Found ${variantsToUpdate.length} variants to push`);
    
    await db.update(flxpointSyncRuns)
      .set({ totalVariants: variantsToUpdate.length })
      .where(eq(flxpointSyncRuns.id, jobId));
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let requestCount = 0;
    const errors: any[] = [];
    
    for (const variant of variantsToUpdate) {
      try {
        const sku = (variant.flxpointData as any)?.sku || variant.parentSku;
        
        if (!sku) {
          errorCount++;
          errors.push({ variantId: variant.id, error: 'No SKU found' });
          processedCount++;
          continue;
        }
        
        const customFields = client.buildCustomFieldsForCommission({
          wmCommRate: variant.wmCommissionRate || undefined,
          wmProductType: variant.wmProductType || undefined,
          wmBuyBoxPrice: variant.wmBuyBoxPrice || undefined,
        });
        
        if (customFields.length === 0) {
          processedCount++;
          continue;
        }
        
        const result = await client.updateProductVariantCustomFields(sku, customFields);
        requestCount++;
        
        if (result.success) {
          const payloadHash = this.hashPayload({ sku, ...customFields.reduce((acc, f) => ({ ...acc, [f.name]: f.value }), {}) });
          
          await db.update(flxpointVariants)
            .set({
              syncStatus: 'synced',
              lastPushedAt: new Date(),
              payloadHash,
              updatedAt: new Date(),
            })
            .where(eq(flxpointVariants.id, variant.id));
          
          successCount++;
        } else {
          await db.update(flxpointVariants)
            .set({
              syncStatus: 'error',
              updatedAt: new Date(),
            })
            .where(eq(flxpointVariants.id, variant.id));
          
          errorCount++;
          errors.push({ sku, error: result.error });
        }
      } catch (err: any) {
        errorCount++;
        errors.push({ variantId: variant.id, error: err.message });
      }
      
      processedCount++;
      
      if (processedCount % 50 === 0) {
        await db.update(flxpointSyncRuns).set({
          processedCount,
          successCount,
          errorCount,
          requestCount,
        }).where(eq(flxpointSyncRuns.id, jobId));
        
        console.log(`[Flxpoint] Push progress: ${processedCount}/${variantsToUpdate.length}, success: ${successCount}, errors: ${errorCount}`);
      }
    }
    
    await db.update(flxpointSyncRuns).set({
      status: 'completed',
      processedCount,
      successCount,
      errorCount,
      requestCount,
      finishedAt: new Date(),
      errors: errors.length > 0 ? errors.slice(0, 100) : null,
    }).where(eq(flxpointSyncRuns.id, jobId));
    
    console.log(`[Flxpoint] Push job ${jobId} completed: ${successCount} success, ${errorCount} errors`);
  }

  async getMatchingStats(): Promise<{
    flxpointWithUpc: number;
    walmartActiveWithUpc: number;
    matchedByUpc: number;
    enrichedWithCommission: number;
    readyToPush: number;
    alreadyPushed: number;
  }> {
    const [flxUpcResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(sql`${flxpointVariants.flxpointData}->>'upc' IS NOT NULL AND ${flxpointVariants.flxpointData}->>'upc' != 'null' AND ${flxpointVariants.flxpointData}->>'upc' != ''`);
    
    const [walmartUpcResult] = await db.select({ count: sql<number>`count(DISTINCT ${marketplaceListings.upc})::int` })
      .from(marketplaceListings)
      .innerJoin(walmartListingDetails, eq(marketplaceListings.id, walmartListingDetails.marketplaceListingId))
      .where(
        and(
          eq(marketplaceListings.marketplace, 'walmart'),
          isNotNull(marketplaceListings.upc),
          eq(walmartListingDetails.walmartLifecycleStatus, 'ACTIVE')
        )
      );
    
    const [matchedResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(isNotNull(flxpointVariants.walmartId));
    
    const [enrichedResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(isNotNull(flxpointVariants.wmCommissionRate));
    
    const [readyResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(
        and(
          eq(flxpointVariants.syncStatus, 'pending'),
          isNotNull(flxpointVariants.wmCommissionRate)
        )
      );
    
    const [pushedResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(flxpointVariants)
      .where(eq(flxpointVariants.syncStatus, 'synced'));
    
    return {
      flxpointWithUpc: flxUpcResult.count,
      walmartActiveWithUpc: walmartUpcResult.count,
      matchedByUpc: matchedResult.count,
      enrichedWithCommission: enrichedResult.count,
      readyToPush: readyResult.count,
      alreadyPushed: pushedResult.count,
    };
  }
}

export const flxpointService = new FlxpointService();
