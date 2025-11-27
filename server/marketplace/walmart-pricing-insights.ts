/**
 * Walmart Pricing Insights Service
 * 
 * Fetches pricing data from Walmart's /v3/price/getPricingInsights API
 * Includes: buyBoxBasePrice, buyBoxTotalPrice, competitorPrice, inDemand, traffic, priceCompetitive, etc.
 */

import axios from 'axios';
import { getWalmartConfig } from '../utils/walmart-api';
import { db } from '../db';
import { marketplaceListings, walmartListingDetails } from '../../shared/schema';
import { eq, and, sql, isNull, or, lt } from 'drizzle-orm';
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

      return response.data;
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

/**
 * Start a sync of pricing insights for ACTIVE Walmart listings only
 * Uses pagination to fetch all data, then filters to only update active listings
 */
export async function startPricingInsightsSync(options?: { 
  activeOnly?: boolean;
  maxPages?: number;
  delayMs?: number;
}): Promise<{
  message: string;
  totalActive: number;
  totalProcessed: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const activeOnly = options?.activeOnly ?? true;
  const maxPages = options?.maxPages ?? 2000; // Max pages to fetch
  const delayMs = options?.delayMs ?? 30000; // 30 seconds between pages (rate limiting)

  console.log(`[Pricing Insights] Starting pricing insights sync (activeOnly: ${activeOnly}, maxPages: ${maxPages})...`);
  
  let totalProcessed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let pageNumber = 0;
  let hasMore = true;

  try {
    // If filtering for active only, get the set of active SKUs first
    let activeSkuSet: Set<string> | null = null;
    if (activeOnly) {
      activeSkuSet = await getActiveWalmartSkuSet();
      console.log(`[Pricing Insights] Loaded ${activeSkuSet.size} active SKUs for filtering`);
    }

    while (hasMore && pageNumber < maxPages) {
      const response = await fetchPricingInsights(pageNumber);
      const items = response.pricingInsightsResponseList || [];
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const pageContext = response.pageContext;
      console.log(`[Pricing Insights] Page ${pageNumber}: ${items.length} items (total: ${pageContext?.totalCount})`);

      for (const item of items) {
        try {
          // If filtering for active only, skip non-active SKUs
          if (activeOnly && activeSkuSet && !activeSkuSet.has(item.sku)) {
            skipped++;
            continue;
          }

          // Find the listing by SKU
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

      // Check if there are more pages
      if (pageContext) {
        hasMore = pageNumber < pageContext.totalPages - 1;
      } else {
        hasMore = items.length > 0;
      }

      pageNumber++;

      // Rate limiting - 30 seconds between requests
      if (hasMore && pageNumber < maxPages) {
        console.log(`[Pricing Insights] Waiting ${delayMs / 1000}s before next page...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const totalActive = activeSkuSet?.size ?? 0;
    console.log(`[Pricing Insights] Sync complete: ${totalActive} active, ${totalProcessed} processed, ${updated} updated, ${skipped} skipped, ${errors} errors`);
    
    return {
      message: activeOnly ? 'Pricing insights sync completed (active only)' : 'Pricing insights sync completed',
      totalActive,
      totalProcessed,
      updated,
      skipped,
      errors
    };
  } catch (error) {
    console.error('[Pricing Insights] Sync failed:', error);
    throw error;
  }
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
