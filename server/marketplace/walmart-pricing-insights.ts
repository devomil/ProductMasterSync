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
 * Fetch pricing insights from Walmart API
 * Uses POST /v3/price/getPricingInsights with pagination
 */
async function fetchPricingInsights(pageNumber: number = 0): Promise<PricingInsightsResponse> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();

  console.log(`[Pricing Insights] Fetching page ${pageNumber}...`);

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
}

/**
 * Convert dollars to cents
 */
function dollarsToCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

/**
 * Start a full sync of pricing insights for all Walmart listings
 */
export async function startPricingInsightsSync(): Promise<{
  message: string;
  totalProcessed: number;
  updated: number;
  errors: number;
}> {
  console.log('[Pricing Insights] Starting pricing insights sync...');
  
  let totalProcessed = 0;
  let updated = 0;
  let errors = 0;
  let pageNumber = 0;
  let hasMore = true;

  try {
    while (hasMore) {
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

      // Rate limiting - 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[Pricing Insights] Sync complete: ${totalProcessed} processed, ${updated} updated, ${errors} errors`);
    
    return {
      message: 'Pricing insights sync completed',
      totalProcessed,
      updated,
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
