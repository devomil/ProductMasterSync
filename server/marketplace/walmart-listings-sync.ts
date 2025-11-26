/**
 * Walmart Listings Sync Service
 * 
 * Syncs seller's active Walmart listings to the marketplace_listings table
 * Uses Walmart Marketplace API v3/items endpoint with cursor-based pagination
 * 
 * API Reference:
 * - GET /v3/items - Get all items with nextCursor pagination
 * - GET /v3/inventory?sku={sku} - Get inventory for a specific SKU
 */

import axios from 'axios';
import { getWalmartConfig } from '../utils/walmart-api';
import * as listingsRepo from './listings-repository';
import { calculateReferralFee, getContractCategory } from './walmart-referral-fees';
import type { InsertMarketplaceListing, InsertWalmartListingDetails } from '../../shared/schema';

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

/**
 * Walmart Item from the v3/items API
 * Based on actual API response structure
 */
interface WalmartListingItem {
  sku: string;
  wpid?: string;
  productName: string;
  price?: {
    currency?: string;
    amount?: number;
  };
  upc?: string;
  gtin?: string;
  productType?: string;
  shelf?: string;
  brand?: string;
  condition?: string;
  availability?: string;
  lifecycleStatus?: string;
  publishedStatus?: string;
  unpublishedReasons?: {
    reason?: string[];
  };
  variantGroupId?: string;
  variantGroupInfo?: any;
  additionalAttributes?: any;
  isCustomerFavorite?: boolean;
  isDuplicate?: boolean;
  duplicateItemInfo?: any;
}

interface WalmartItemsResponse {
  ItemResponse?: WalmartListingItem[];
  nextCursor?: string;
  totalItems?: number;
}

interface WalmartInventoryResponse {
  sku: string;
  quantity?: {
    unit: string;
    amount: number;
  };
  inventoryAvailableDate?: string;
}

/**
 * Fetch items from Walmart API with cursor-based pagination
 * Uses nextCursor=* for initial request, then the returned cursor for subsequent pages
 */
async function fetchWalmartItems(
  nextCursor?: string
): Promise<WalmartItemsResponse> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();

  const params: any = {
    nextCursor: nextCursor || '*',
    limit: 200
  };

  console.log(`[Walmart Sync] Fetching items with cursor: ${nextCursor || '*'}`);

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
 * Fetch inventory for a specific SKU
 */
async function fetchInventoryForSKU(sku: string): Promise<WalmartInventoryResponse | null> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(`${config.apiUrl}/inventory`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': accessToken,
        'WM_SVC.NAME': config.serviceName,
        'WM_QOS.CORRELATION_ID': generateCorrelationId(),
        'Accept': 'application/json'
      },
      params: { sku: encodeURIComponent(sku) }
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`[Walmart Sync] Error fetching inventory for SKU ${sku}:`, error.message);
    return null;
  }
}

/**
 * Transform Walmart item to marketplace listing format
 */
function transformToListing(item: WalmartListingItem, inventoryQuantity?: number): {
  listing: InsertMarketplaceListing;
  details: Partial<InsertWalmartListingDetails>;
} {
  const categoryPath: string[] = [];
  
  if (item.shelf) {
    categoryPath.push(...item.shelf.split('/').map(s => s.trim()).filter(Boolean));
  }
  
  const productType = item.productType || 
    (categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null);
  
  const priceInCents = item.price?.amount ? Math.round(item.price.amount * 100) : null;
  
  let referralFeeInCents = null;
  let contractCategory = null;
  if (priceInCents) {
    // Pass productType for accurate fee calculation based on Walmart's fee schedule
    const feeResult = calculateReferralFee(priceInCents, categoryPath.length > 0 ? categoryPath : null, productType);
    referralFeeInCents = feeResult.feeInCents;
    contractCategory = feeResult.contractCategoryName;
  }

  type ListingStatus = 'pending' | 'active' | 'inactive' | 'retired' | 'unpublished' | 'suppressed';
  
  const mapStatus = (lifecycle?: string, published?: string, availability?: string): ListingStatus => {
    if (lifecycle === 'ACTIVE' && published === 'PUBLISHED') return 'active';
    if (lifecycle === 'ACTIVE' && published === 'UNPUBLISHED') return 'unpublished';
    if (lifecycle === 'RETIRED') return 'retired';
    if (lifecycle === 'ARCHIVED') return 'inactive';
    return 'pending';
  };

  const listing: InsertMarketplaceListing = {
    marketplace: 'walmart',
    listingId: item.sku,
    marketplaceSku: item.sku,
    upc: item.upc || null,
    gtin: item.gtin || null,
    title: item.productName,
    brand: item.brand || null,
    status: mapStatus(item.lifecycleStatus, item.publishedStatus, item.availability),
    lifecycleStatus: item.lifecycleStatus || null,
    publishedStatus: item.publishedStatus || null,
    quantity: inventoryQuantity ?? 0,
    priceInCents,
    referralFeeInCents,
    productType,
    category: categoryPath.length > 0 ? categoryPath[0] : null,
    categoryPath: categoryPath as any,
    contractCategory,
    fulfillmentMethod: item.condition === 'New' ? 'SELLER' : 'SELLER',
    rawSnapshot: item as any,
  };

  const details: Partial<InsertWalmartListingDetails> = {
    wpid: item.wpid || null,
    walmartLifecycleStatus: item.lifecycleStatus || null,
    walmartPublishStatus: item.publishedStatus || null,
  };

  return { listing, details };
}

/**
 * Start a full sync of Walmart listings
 * 
 * Fetches all items using cursor-based pagination from GET /v3/items
 * Then fetches inventory for each item from GET /v3/inventory
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
    let pageCount = 0;

    const allItems: { item: WalmartListingItem; inventoryQuantity: number }[] = [];

    console.log(`[Walmart Sync] Phase 1: Fetching all items from Walmart API...`);

    while (hasMore) {
      try {
        const response = await fetchWalmartItems(nextCursor);
        const items = response.ItemResponse || [];
        pageCount++;
        
        if (response.totalItems && totalItems === 0) {
          totalItems = response.totalItems;
          await listingsRepo.updateSyncJob(jobId, { totalItems });
          console.log(`[Walmart Sync] Total items to sync: ${totalItems}`);
        }

        console.log(`[Walmart Sync] Page ${pageCount}: Received ${items.length} items`);

        for (const item of items) {
          allItems.push({ item, inventoryQuantity: 0 });
        }

        nextCursor = response.nextCursor;
        hasMore = !!nextCursor && items.length > 0;

        await listingsRepo.updateSyncJob(jobId, {
          processedItems: allItems.length,
          nextCursor: nextCursor || undefined
        });

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err: any) {
        console.error(`[Walmart Sync] Error fetching page ${pageCount}:`, err.message);
        
        if (allItems.length === 0) {
          throw err;
        }
        
        console.log(`[Walmart Sync] Continuing with ${allItems.length} items collected`);
        break;
      }
    }

    console.log(`[Walmart Sync] Phase 1 complete: ${allItems.length} items fetched`);
    console.log(`[Walmart Sync] Phase 2: Fetching inventory for each item...`);

    await listingsRepo.updateSyncJob(jobId, {
      totalItems: allItems.length
    });

    let inventoryFetched = 0;
    for (const entry of allItems) {
      try {
        const inventory = await fetchInventoryForSKU(entry.item.sku);
        if (inventory?.quantity?.amount !== undefined) {
          entry.inventoryQuantity = inventory.quantity.amount;
        }
        inventoryFetched++;
        
        if (inventoryFetched % 100 === 0) {
          console.log(`[Walmart Sync] Inventory progress: ${inventoryFetched}/${allItems.length}`);
          await listingsRepo.updateSyncJob(jobId, {
            lastProcessedId: `inventory_${inventoryFetched}/${allItems.length}`
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`[Walmart Sync] Error fetching inventory for ${entry.item.sku}:`, err);
      }
    }

    console.log(`[Walmart Sync] Phase 2 complete: Inventory fetched for ${inventoryFetched} items`);
    console.log(`[Walmart Sync] Phase 3: Saving listings to database...`);

    await listingsRepo.updateSyncJob(jobId, {
      lastProcessedId: 'phase_saving_listings'
    });

    const batchSize = 50;
    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, i + batchSize);
      
      for (const { item, inventoryQuantity } of batch) {
        try {
          const { listing, details } = transformToListing(item, inventoryQuantity);
          
          const savedListing = await listingsRepo.upsertMarketplaceListing(listing);
          
          if (Object.keys(details).some(k => details[k as keyof typeof details] !== null)) {
            await listingsRepo.upsertWalmartListingDetails({
              marketplaceListingId: savedListing.id,
              ...details
            } as InsertWalmartListingDetails);
          }
          
          successCount++;
        } catch (err) {
          console.error(`[Walmart Sync] Error saving item ${item.sku}:`, err);
          errorCount++;
        }
        totalProcessed++;
      }

      await listingsRepo.updateSyncJob(jobId, {
        processedItems: totalProcessed,
        successItems: successCount,
        failedItems: errorCount
      });

      if (totalProcessed % 500 === 0) {
        console.log(`[Walmart Sync] Save progress: ${totalProcessed}/${allItems.length} (success: ${successCount}, errors: ${errorCount})`);
      }
    }

    await listingsRepo.completeSyncJob(jobId, {
      processedItems: totalProcessed,
      successItems: successCount,
      failedItems: errorCount
    });

    console.log(`[Walmart Sync] ✅ Job ${jobId} completed: ${successCount} success, ${errorCount} errors`);

  } catch (error) {
    console.error(`[Walmart Sync] Job ${jobId} failed:`, error);
    await listingsRepo.failSyncJob(jobId, (error as Error).message, { stack: (error as Error).stack });
    throw error;
  }
}

/**
 * Start sync without fetching inventory (faster for initial import)
 * Useful when you just want to get item metadata without quantity
 * 
 * @param jobId - The sync job ID
 * @param resumeFromCursor - Optional cursor to resume from (for interrupted syncs)
 * @param resumeProcessedCount - Number of items already processed (for accurate progress tracking)
 */
export async function startWalmartListingsSyncItemsOnly(
  jobId: number,
  resumeFromCursor?: string,
  resumeProcessedCount: number = 0
): Promise<void> {
  const isResuming = !!resumeFromCursor;
  console.log(`[Walmart Sync] Starting items-only sync job ${jobId}${isResuming ? ` (resuming from cursor, already processed: ${resumeProcessedCount})` : ''}...`);

  try {
    await listingsRepo.startSyncJob(jobId);

    let nextCursor: string | undefined = resumeFromCursor;
    let totalProcessed = resumeProcessedCount;
    let successCount = resumeProcessedCount; // Assume previous items were successful
    let errorCount = 0;
    let hasMore = true;
    let totalItems = 0;
    let pageCount = isResuming ? Math.floor(resumeProcessedCount / 200) : 0;

    while (hasMore) {
      try {
        const response = await fetchWalmartItems(nextCursor);
        const items = response.ItemResponse || [];
        pageCount++;
        
        if (response.totalItems && totalItems === 0) {
          totalItems = response.totalItems;
          await listingsRepo.updateSyncJob(jobId, { totalItems });
        }

        console.log(`[Walmart Sync] Page ${pageCount}: Processing ${items.length} items...`);

        for (const item of items) {
          try {
            const { listing, details } = transformToListing(item, 0);
            
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

        nextCursor = response.nextCursor;
        hasMore = !!nextCursor && items.length > 0;

        // Save progress AND cursor for resumability
        await listingsRepo.updateSyncJob(jobId, {
          processedItems: totalProcessed,
          successItems: successCount,
          failedItems: errorCount,
          nextCursor: nextCursor || undefined  // Save cursor for resume capability
        });

        console.log(`[Walmart Sync] Progress: ${totalProcessed}/${totalItems || 'unknown'} (success: ${successCount}, errors: ${errorCount})`);

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err: any) {
        console.error(`[Walmart Sync] Error fetching page:`, err.message);
        
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

    console.log(`[Walmart Sync] ✅ Job ${jobId} completed: ${successCount} success, ${errorCount} errors`);

  } catch (error) {
    console.error(`[Walmart Sync] Job ${jobId} failed:`, error);
    await listingsRepo.failSyncJob(jobId, (error as Error).message, { stack: (error as Error).stack });
    throw error;
  }
}

export async function getSyncStatus(jobId: number) {
  return listingsRepo.getSyncJob(jobId);
}

export async function isSyncRunning(): Promise<boolean> {
  const runningJob = await listingsRepo.getRunningSync('walmart');
  return !!runningJob;
}
