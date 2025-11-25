/**
 * Walmart Listings Sync Service
 * 
 * Syncs seller's active Walmart listings to the marketplace_listings table
 * Uses Walmart Marketplace API v3/items endpoint with cursor-based pagination
 */

import axios from 'axios';
import { getWalmartConfig } from '../utils/walmart-api';
import * as listingsRepo from './listings-repository';
import { calculateReferralFee, getContractCategory } from './walmart-referral-fees';
import type { InsertMarketplaceListing, InsertWalmartListingDetails } from '../../shared/schema';

// Token cache shared with walmart-api.ts
let tokenCache: { access_token: string; expires_at: number } | null = null;

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Get access token for Walmart API
 */
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

/**
 * Walmart Item from the v3/items API
 */
interface WalmartListingItem {
  sku: string;
  wpid?: string;
  productName: string;
  price?: {
    currency?: string;
    amount?: number;
  };
  inventory?: {
    quantity?: number;
  };
  upc?: string;
  gtin?: string;
  productType?: string;
  brand?: string;
  category?: string[];
  lifecycleStatus?: string;
  publishedStatus?: string;
  unpublishedReasons?: any;
  shippingWeight?: number;
  shippingWeightUnit?: string;
  primaryImageUrl?: string;
  fulfillmentLagTime?: number;
  itemId?: string;
  variants?: any[];
  offerStartDate?: string;
  offerEndDate?: string;
  priceDisplayCodes?: string;
  shippingProgramType?: string;
  additionalAttributes?: any;
}

interface WalmartItemsResponse {
  ItemResponse?: WalmartListingItem[];
  nextCursor?: string;
  totalItems?: number;
}

/**
 * Fetch items from Walmart API with pagination
 */
async function fetchWalmartItems(
  limit: number = 200,
  nextCursor?: string
): Promise<WalmartItemsResponse> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();

  const params: any = { limit };
  if (nextCursor) {
    params.nextCursor = nextCursor;
  }

  console.log(`[Walmart Sync] Fetching items with cursor: ${nextCursor || 'initial'}`);

  const response = await axios.get(`${config.apiUrl}/items`, {
    headers: {
      'WM_SEC.ACCESS_TOKEN': accessToken,
      'WM_SVC.NAME': config.serviceName,
      'WM_QOS.CORRELATION_ID': generateCorrelationId(),
      'Accept': 'application/json'
    },
    params
  });

  return response.data;
}

/**
 * Transform Walmart item to marketplace listing format
 */
function transformToListing(item: WalmartListingItem): {
  listing: InsertMarketplaceListing;
  details: Partial<InsertWalmartListingDetails>;
} {
  const categoryPath = item.category || [];
  const productType = categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null;
  const contractCategoryKey = getContractCategory(categoryPath.length > 0 ? categoryPath : null);
  
  const priceInCents = item.price?.amount ? Math.round(item.price.amount * 100) : null;
  
  let referralFeeInCents = null;
  let contractCategory = null;
  if (priceInCents) {
    const feeResult = calculateReferralFee(priceInCents, categoryPath.length > 0 ? categoryPath : null);
    referralFeeInCents = feeResult.feeInCents;
    contractCategory = feeResult.contractCategoryName;
  }

  const listing: InsertMarketplaceListing = {
    marketplace: 'walmart',
    listingId: item.sku,
    marketplaceSku: item.sku,
    upc: item.upc || null,
    gtin: item.gtin || null,
    title: item.productName,
    brand: item.brand || null,
    status: item.lifecycleStatus === 'ACTIVE' ? 'active' : 
            item.lifecycleStatus === 'RETIRED' ? 'retired' :
            item.lifecycleStatus === 'ARCHIVED' ? 'inactive' : 'pending',
    lifecycleStatus: item.lifecycleStatus || null,
    publishedStatus: item.publishedStatus || null,
    quantity: item.inventory?.quantity ?? 0,
    priceInCents,
    referralFeeInCents,
    productType,
    category: categoryPath.length > 0 ? categoryPath[0] : null,
    categoryPath: categoryPath as any,
    contractCategory,
    fulfillmentMethod: item.shippingProgramType || 'SELLER',
    rawSnapshot: item as any,
  };

  const details: Partial<InsertWalmartListingDetails> = {
    walmartItemId: item.itemId || null,
    wpid: item.wpid || null,
    walmartLifecycleStatus: item.lifecycleStatus || null,
    walmartPublishStatus: item.publishedStatus || null,
    shippingWeight: item.shippingWeight || null,
    shippingWeightUnit: item.shippingWeightUnit || 'LB',
    fulfillmentLagTime: item.fulfillmentLagTime || null,
  };

  return { listing, details };
}

/**
 * Start a full sync of Walmart listings
 */
export async function startWalmartListingsSync(jobId: number): Promise<void> {
  console.log(`[Walmart Sync] Starting sync job ${jobId}...`);

  try {
    await listingsRepo.startSyncJob(jobId);

    let nextCursor: string | undefined;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    let hasMore = true;
    let totalItems = 0;

    while (hasMore) {
      try {
        const response = await fetchWalmartItems(200, nextCursor);
        const items = response.ItemResponse || [];
        
        if (response.totalItems && totalItems === 0) {
          totalItems = response.totalItems;
          await listingsRepo.updateSyncJob(jobId, { totalItems });
        }

        console.log(`[Walmart Sync] Processing ${items.length} items...`);

        for (const item of items) {
          try {
            const { listing, details } = transformToListing(item);
            
            const savedListing = await listingsRepo.upsertMarketplaceListing(listing);
            
            if (Object.keys(details).some(k => details[k as keyof typeof details] !== null)) {
              await listingsRepo.upsertWalmartListingDetails({
                marketplaceListingId: savedListing.id,
                ...details
              } as InsertWalmartListingDetails);
            }
            
            successCount++;
          } catch (err) {
            console.error(`[Walmart Sync] Error processing item ${item.sku}:`, err);
            errorCount++;
          }
          totalProcessed++;
        }

        await listingsRepo.updateSyncJob(jobId, {
          processedItems: totalProcessed,
          successItems: successCount,
          failedItems: errorCount
        });

        nextCursor = response.nextCursor;
        hasMore = !!nextCursor && items.length > 0;

        console.log(`[Walmart Sync] Progress: ${totalProcessed}/${totalItems || 'unknown'} (success: ${successCount}, errors: ${errorCount})`);

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`[Walmart Sync] Error fetching page:`, err);
        
        if (totalProcessed === 0) {
          throw err;
        }
        
        break;
      }
    }

    await listingsRepo.completeSyncJob(jobId, {
      processedItems: totalProcessed,
      successItems: successCount,
      failedItems: errorCount
    });

    console.log(`[Walmart Sync] Job ${jobId} completed: ${successCount} success, ${errorCount} errors`);

  } catch (error) {
    console.error(`[Walmart Sync] Job ${jobId} failed:`, error);
    await listingsRepo.failSyncJob(jobId, (error as Error).message, { stack: (error as Error).stack });
    throw error;
  }
}

/**
 * Get sync status for a job
 */
export async function getSyncStatus(jobId: number) {
  return listingsRepo.getSyncJob(jobId);
}

/**
 * Check if a sync is currently running
 */
export async function isSyncRunning(): Promise<boolean> {
  const runningJob = await listingsRepo.getRunningSync('walmart');
  return !!runningJob;
}
