/**
 * Walmart Pricing Insights Service
 * 
 * Fetches pricing data from Walmart's /v3/price/getPricingInsights API
 * Includes: buyBoxBasePrice, buyBoxTotalPrice, competitorPrice, inDemand, traffic, priceCompetitive, etc.
 * 
 * Features:
 * - Resumable sync with job tracking in database
 * - Automatic retry with exponential backoff for rate limits
 * - Active-only filtering to skip inactive listings
 * - Progress tracking and reporting
 */

import axios from 'axios';
import { getWalmartConfig } from '../utils/walmart-api';
import { db } from '../db';
import { marketplaceListings, walmartListingDetails, marketplaceSyncJobs } from '../../shared/schema';
import { eq, and, sql, isNull, or, lt, desc } from 'drizzle-orm';
import * as listingsRepo from './listings-repository';

let tokenCache: { access_token: string; expires_at: number } | null = null;

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  const config = await getWalmartConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await axios.post(
    `${config.apiUrl}/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId()
      }
    }
  );

  tokenCache = {
    access_token: response.data.access_token,
    expires_at: Date.now() + ((response.data.expires_in || 900) * 1000) - 60000
  };

  return tokenCache.access_token;
}

interface PricingInsightItem {
  itemName?: string;
  sku: string;
  currentPrice?: number | null;
  buyBoxBasePrice?: number | null;
  buyBoxTotalPrice?: number | null;
  buyBoxWinRate?: string;
  competitorPrice?: number | null;
  comparisonPrice?: number | null;
  fulfillment?: string | null;
  inventoryCount?: number | null;
  repricerStrategyType?: string | null;
  repricerStrategyName?: string | null;
  repricerStatus?: string | null;
  repricerMinPrice?: number | null;
  repricerMaxPrice?: number | null;
  priceCompetitiveScore?: number;
  promoStatus?: string | null;
  potentialGmvLift?: number | null;
  gmv30?: number;
  inDemand?: boolean;
  priceDifferential?: string | null;
  traffic?: string | null;
  priceCompetitive?: boolean;
  reducedReferralStatus?: string | null;
  walmartFundedStatus?: string | null;
}

interface PricingInsightsResponse {
  pageContext?: {
    pageNo: number;
    currentPageCount: number;
    totalCount: number;
    totalPages: number;
  };
  pricingInsightsResponseList?: PricingInsightItem[];
}

/**
 * Fetch pricing insights from Walmart API with retry logic
 * Uses POST /v3/price/getPricingInsights with pagination
 */
async function fetchPricingInsights(pageNumber: number = 0, maxRetries: number = 3): Promise<PricingInsightsResponse> {
  const config = await getWalmartConfig();
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const accessToken = await getAccessToken();

      console.log(`[Pricing Insights] Fetching page ${pageNumber}${attempt > 0 ? ` (retry ${attempt})` : ''}...`);

      const response = await axios.post(
        `${config.apiUrl}/price/getPricingInsights`,
        {
          pageNumber
        },
        {
          headers: {
            'WM_SEC.ACCESS_TOKEN': accessToken,
            'WM_SVC.NAME': config.serviceName,
            'WM_QOS.CORRELATION_ID': generateCorrelationId(),
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      // Handle nested 'data' property in response (Walmart API wraps response in 'data')
      const responsePayload = response.data?.data || response.data;
      const items = responsePayload?.pricingInsightsResponseList || [];
      const pageContext = responsePayload?.pageContext;
      
      console.log(`[Pricing Insights] Page ${pageNumber}: ${items.length} items received`);
      
      return {
        pageContext,
        pricingInsightsResponseList: items
      };
    } catch (error: any) {
      const isRateLimit = error.response?.status === 429;
      const isLastAttempt = attempt === maxRetries;
      
      if (isRateLimit && !isLastAttempt) {
        // Parse replenishment time from headers if available
        const replenishTime = error.response?.headers?.['x-next-replenishment-time'];
        let waitMs = 60000; // Default: 60 seconds
        
        if (replenishTime) {
          const replenishDate = parseInt(replenishTime, 10);
          waitMs = Math.max(replenishDate - Date.now() + 1000, 30000); // At least 30 seconds
        }
        
        console.log(`[Pricing Insights] Rate limited (429). Waiting ${Math.round(waitMs / 1000)}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      
      if (isLastAttempt) {
        console.error(`[Pricing Insights] Failed after ${maxRetries + 1} attempts:`, error.response?.data || error.message);
      }
      throw error;
    }
  }
  
  return { pricingInsightsResponseList: [] };
}

/**
 * Convert dollars to cents
 */
function dollarsToCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

/**
 * Get all active Walmart listing SKUs from the database
 */
async function getActiveWalmartSkuSet(): Promise<Set<string>> {
  const listings = await db
    .select({
      sku: marketplaceListings.marketplaceSku
    })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.marketplace, 'walmart'),
      eq(marketplaceListings.status, 'active')
    ));

  return new Set(listings.filter(l => l.sku !== null).map(l => l.sku as string));
}

// ============================================================================
// JOB TRACKING FUNCTIONS
// ============================================================================

interface SyncJobInfo {
  id: number;
  status: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  lastProcessedId: string | null; // Stores last page number
  startedAt: Date | null;
  completedAt: Date | null;
}

/**
 * Create a new pricing insights sync job
 */
async function createSyncJob(totalItems: number = 0): Promise<number> {
  const [job] = await db
    .insert(marketplaceSyncJobs)
    .values({
      marketplace: 'walmart',
      jobType: 'pricing_insights',
      status: 'running',
      totalItems,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      startedAt: new Date(),
      lastProcessedId: '0' // Starting page
    })
    .returning({ id: marketplaceSyncJobs.id });
  
  return job.id;
}

/**
 * Update sync job progress
 */
async function updateJobProgress(
  jobId: number, 
  processed: number, 
  success: number, 
  failed: number, 
  lastPage: number
): Promise<void> {
  await db
    .update(marketplaceSyncJobs)
    .set({
      processedItems: processed,
      successItems: success,
      failedItems: failed,
      lastProcessedId: String(lastPage),
      updatedAt: new Date()
    })
    .where(eq(marketplaceSyncJobs.id, jobId));
}

/**
 * Mark sync job as completed
 */
async function completeJob(jobId: number, status: 'completed' | 'failed' | 'cancelled' = 'completed', errorMessage?: string): Promise<void> {
  const [job] = await db
    .select({ startedAt: marketplaceSyncJobs.startedAt })
    .from(marketplaceSyncJobs)
    .where(eq(marketplaceSyncJobs.id, jobId));
  
  const duration = job?.startedAt 
    ? Math.floor((Date.now() - new Date(job.startedAt).getTime()) / 1000)
    : null;

  await db
    .update(marketplaceSyncJobs)
    .set({
      status,
      completedAt: new Date(),
      duration,
      errorMessage,
      updatedAt: new Date()
    })
    .where(eq(marketplaceSyncJobs.id, jobId));
}

/**
 * Get the most recent pricing insights sync job
 */
async function getLatestSyncJob(): Promise<SyncJobInfo | null> {
  const [job] = await db
    .select()
    .from(marketplaceSyncJobs)
    .where(and(
      eq(marketplaceSyncJobs.marketplace, 'walmart'),
      eq(marketplaceSyncJobs.jobType, 'pricing_insights')
    ))
    .orderBy(desc(marketplaceSyncJobs.createdAt))
    .limit(1);
  
  return job ? {
    id: job.id,
    status: job.status || 'pending',
    totalItems: job.totalItems || 0,
    processedItems: job.processedItems || 0,
    successItems: job.successItems || 0,
    failedItems: job.failedItems || 0,
    lastProcessedId: job.lastProcessedId,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  } : null;
}

/**
 * Get a sync job by ID
 */
export async function getSyncJobById(jobId: number): Promise<SyncJobInfo | null> {
  const [job] = await db
    .select()
    .from(marketplaceSyncJobs)
    .where(eq(marketplaceSyncJobs.id, jobId))
    .limit(1);
  
  return job ? {
    id: job.id,
    status: job.status || 'pending',
    totalItems: job.totalItems || 0,
    processedItems: job.processedItems || 0,
    successItems: job.successItems || 0,
    failedItems: job.failedItems || 0,
    lastProcessedId: job.lastProcessedId,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  } : null;
}

export interface SyncOptions {
  activeOnly?: boolean;
  maxPages?: number;
  delayMs?: number;
  resumeJobId?: number; // Resume from existing job
  pagesPerChunk?: number; // How many pages before pausing (for long syncs)
}

export interface SyncResult {
  message: string;
  jobId: number;
  status: 'running' | 'completed' | 'paused' | 'failed';
  totalActive: number;
  totalPages: number;
  currentPage: number;
  totalProcessed: number;
  updated: number;
  skipped: number;
  errors: number;
  canResume: boolean;
  estimatedTimeRemaining?: string;
}

/**
 * Start or resume a pricing insights sync for ACTIVE Walmart listings
 * 
 * For full catalog sync (~1,680 pages at 35s each = 16 hours):
 * - Use pagesPerChunk to run in batches (e.g., 100 pages = ~1 hour)
 * - Call again with resumeJobId to continue from where it left off
 * - Progress is saved after each page
 */
export async function startPricingInsightsSync(options?: SyncOptions): Promise<SyncResult> {
  const activeOnly = options?.activeOnly ?? true;
  const maxPages = options?.maxPages ?? 2000;
  const delayMs = options?.delayMs ?? 35000; // 35 seconds between pages (rate limiting)
  const pagesPerChunk = options?.pagesPerChunk; // If set, pause after this many pages

  let jobId: number;
  let startPage = 0;
  let totalProcessed = 0;
  let updated = 0;
  let skipped = 0; 
  let errors = 0;
  let totalPages = 0;

  // Resume existing job or create new one
  if (options?.resumeJobId) {
    const existingJob = await getSyncJobById(options.resumeJobId);
    if (!existingJob) {
      throw new Error(`Job ${options.resumeJobId} not found`);
    }
    if (existingJob.status === 'completed') {
      return {
        message: 'Job already completed',
        jobId: existingJob.id,
        status: 'completed',
        totalActive: existingJob.totalItems,
        totalPages: 0,
        currentPage: parseInt(existingJob.lastProcessedId || '0'),
        totalProcessed: existingJob.processedItems,
        updated: existingJob.successItems,
        skipped: existingJob.failedItems,
        errors: 0,
        canResume: false
      };
    }
    
    jobId = existingJob.id;
    // Resume from NEXT page after lastProcessedId (which is the last completed page)
    const lastCompletedPage = parseInt(existingJob.lastProcessedId || '0');
    startPage = lastCompletedPage + 1;
    totalProcessed = existingJob.processedItems;
    updated = existingJob.successItems;
    errors = existingJob.failedItems;
    
    // Mark as running again
    await db
      .update(marketplaceSyncJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(marketplaceSyncJobs.id, jobId));
    
    console.log(`[Pricing Insights] Resuming job ${jobId} from page ${startPage} (last completed: ${lastCompletedPage})...`);
  } else {
    jobId = await createSyncJob(0);
    console.log(`[Pricing Insights] Created new job ${jobId}`);
  }

  console.log(`[Pricing Insights] Starting sync (activeOnly: ${activeOnly}, maxPages: ${maxPages}, startPage: ${startPage})...`);

  let pageNumber = startPage;
  let hasMore = true;
  let pagesProcessedThisChunk = 0;

  try {
    // Get active SKUs for filtering
    let activeSkuSet: Set<string> | null = null;
    if (activeOnly) {
      activeSkuSet = await getActiveWalmartSkuSet();
      console.log(`[Pricing Insights] Loaded ${activeSkuSet.size} active SKUs for filtering`);
      
      // Update job with total items
      await db
        .update(marketplaceSyncJobs)
        .set({ totalItems: activeSkuSet.size })
        .where(eq(marketplaceSyncJobs.id, jobId));
    }

    while (hasMore && pageNumber < maxPages) {
      // Check if we should pause for this chunk
      if (pagesPerChunk && pagesProcessedThisChunk >= pagesPerChunk) {
        const remainingPages = totalPages - pageNumber;
        const estimatedSecondsRemaining = remainingPages * (delayMs / 1000 + 2);
        const estimatedTimeRemaining = formatDuration(estimatedSecondsRemaining);
        
        console.log(`[Pricing Insights] Pausing at page ${pageNumber} (chunk of ${pagesPerChunk} complete). Resume with jobId: ${jobId}`);
        
        return {
          message: `Sync paused at page ${pageNumber}. Resume with jobId: ${jobId}`,
          jobId,
          status: 'paused',
          totalActive: activeSkuSet?.size ?? 0,
          totalPages,
          currentPage: pageNumber,
          totalProcessed,
          updated,
          skipped,
          errors,
          canResume: true,
          estimatedTimeRemaining
        };
      }

      const response = await fetchPricingInsights(pageNumber);
      const items = response.pricingInsightsResponseList || [];
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const pageContext = response.pageContext;
      // Calculate totalPages from totalCount if not provided (25 items per page)
      const itemsPerPage = 25;
      if (pageContext?.totalCount && pageContext.totalCount > 0) {
        totalPages = Math.ceil(pageContext.totalCount / itemsPerPage);
      } else if (pageContext?.totalPages && pageContext.totalPages > 0) {
        totalPages = pageContext.totalPages;
      }
      console.log(`[Pricing Insights] Page ${pageNumber}/${totalPages}: ${items.length} items (totalCount: ${pageContext?.totalCount || 'unknown'})`);

      for (const item of items) {
        try {
          if (activeOnly && activeSkuSet && !activeSkuSet.has(item.sku)) {
            skipped++;
            continue;
          }

          const [listing] = await db
            .select({ id: marketplaceListings.id })
            .from(marketplaceListings)
            .where(and(
              eq(marketplaceListings.marketplace, 'walmart'),
              eq(marketplaceListings.marketplaceSku, item.sku)
            ))
            .limit(1);

          if (listing) {
            await listingsRepo.updatePricingInsights(listing.id, {
              buyBoxBasePriceInCents: dollarsToCents(item.buyBoxBasePrice),
              buyBoxTotalPriceInCents: dollarsToCents(item.buyBoxTotalPrice),
              competitorPriceInCents: dollarsToCents(item.competitorPrice),
              priceCompetitive: item.priceCompetitive ?? null,
              priceCompetitiveScore: item.priceCompetitiveScore ?? null,
              inDemand: item.inDemand ?? null,
              trafficLevel: item.traffic ?? null,
              gmv30InCents: dollarsToCents(item.gmv30),
              insightsRaw: item
            });
            updated++;
          }
          
          totalProcessed++;
        } catch (err) {
          console.error(`[Pricing Insights] Error processing SKU ${item.sku}:`, err);
          errors++;
        }
      }

      // Save progress after each page
      await updateJobProgress(jobId, totalProcessed, updated, errors, pageNumber);

      // Check for more pages - use calculated totalPages or item count
      if (totalPages > 0) {
        hasMore = pageNumber < totalPages - 1;
      } else {
        // Fallback: if we got a full page, there might be more
        hasMore = items.length >= 25;
      }

      pageNumber++;
      pagesProcessedThisChunk++;

      // Rate limiting
      if (hasMore && pageNumber < maxPages) {
        console.log(`[Pricing Insights] Waiting ${delayMs / 1000}s before next page...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Sync completed successfully
    await completeJob(jobId, 'completed');
    
    const totalActive = activeSkuSet?.size ?? 0;
    console.log(`[Pricing Insights] Sync complete: ${totalActive} active, ${totalProcessed} processed, ${updated} updated, ${skipped} skipped, ${errors} errors`);
    
    return {
      message: 'Pricing insights sync completed',
      jobId,
      status: 'completed',
      totalActive,
      totalPages,
      currentPage: pageNumber,
      totalProcessed,
      updated,
      skipped,
      errors,
      canResume: false
    };
  } catch (error: any) {
    console.error('[Pricing Insights] Sync failed:', error);
    await completeJob(jobId, 'failed', error.message);
    
    return {
      message: `Sync failed: ${error.message}. Resume with jobId: ${jobId}`,
      jobId,
      status: 'failed',
      totalActive: 0,
      totalPages,
      currentPage: pageNumber,
      totalProcessed,
      updated,
      skipped,
      errors,
      canResume: true
    };
  }
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get the status of the latest pricing insights sync job
 */
export async function getPricingInsightsSyncStatus(): Promise<SyncJobInfo | null> {
  return getLatestSyncJob();
}

/**
 * Fetch pricing insights for a specific SKU
 */
export async function fetchSingleSkuPricingInsights(sku: string): Promise<PricingInsightItem | null> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `${config.apiUrl}/price/getPricingInsights`,
      {
        searchCriteria: {
          sku: [sku]
        },
        pageNumber: 0
      },
      {
        headers: {
          'WM_SEC.ACCESS_TOKEN': accessToken,
          'WM_SVC.NAME': config.serviceName,
          'WM_QOS.CORRELATION_ID': generateCorrelationId(),
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const items = response.data?.pricingInsightsResponseList || [];
    return items.find((item: PricingInsightItem) => item.sku === sku) || null;
  } catch (error) {
    console.error(`[Pricing Insights] Error fetching insights for SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Get listings that need pricing insights update
 * Returns listings where insights are null or older than specified hours
 */
export async function getListingsNeedingInsightsUpdate(
  maxAgeHours: number = 24,
  limit: number = 100
): Promise<Array<{ id: number; sku: string }>> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const listings = await db
    .select({
      id: marketplaceListings.id,
      sku: marketplaceListings.marketplaceSku
    })
    .from(marketplaceListings)
    .leftJoin(
      walmartListingDetails,
      eq(marketplaceListings.id, walmartListingDetails.marketplaceListingId)
    )
    .where(and(
      eq(marketplaceListings.marketplace, 'walmart'),
      eq(marketplaceListings.status, 'active'),
      or(
        isNull(walmartListingDetails.pricingInsightsFetchedAt),
        lt(walmartListingDetails.pricingInsightsFetchedAt, cutoffTime)
      )
    ))
    .limit(limit);

  return listings.filter(l => l.sku !== null) as Array<{ id: number; sku: string }>;
}
