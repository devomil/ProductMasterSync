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
import type { InsertMarketplaceListing, InsertWalmartListingDetails, InsertMarketplaceOrder, InsertMarketplaceOrderItem } from '../../shared/schema';
import { db } from '../db';
import { marketplaceOrders, marketplaceOrderItems } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

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
 * Bulk inventory response from /v3/inventories endpoint
 */
interface BulkInventoryResponse {
  elements?: Array<{
    sku: string;
    quantity?: {
      unit?: string;
      amount?: number;
    };
    fulfillmentLagTime?: number;
    shipNodes?: Array<{
      shipNodeId?: string;
      availToSellQty?: number;
    }>;
  }>;
  totalCount?: number;
  nextCursor?: string;
}

/**
 * Fetch all inventory in bulk using /v3/inventories endpoint
 * Much faster than individual SKU calls - uses cursor-based pagination
 * Returns a map of SKU -> quantity
 */
async function fetchBulkInventory(jobId: number): Promise<Map<string, number>> {
  const config = await getWalmartConfig();
  const inventoryMap = new Map<string, number>();
  
  let nextCursor: string | undefined = undefined; // Don't pass cursor on first request
  let isFirstRequest = true;
  const limit = 50; // Walmart API max is 50 for inventories endpoint
  let pageCount = 0;
  const maxPages = 5000; // Safety limit - need more pages with smaller limit
  
  console.log(`[Walmart Sync] Starting bulk inventory fetch using /v3/inventories...`);
  
  while ((isFirstRequest || nextCursor) && pageCount < maxPages) {
    try {
      const accessToken = await getAccessToken();
      
      const params: Record<string, any> = { limit };
      if (nextCursor) {
        params.nextCursor = nextCursor;
      }
      isFirstRequest = false;
      
      const response = await axios.get<BulkInventoryResponse>(`${config.apiUrl}/inventories`, {
        headers: {
          'WM_SEC.ACCESS_TOKEN': accessToken,
          'WM_SVC.NAME': config.serviceName,
          'WM_QOS.CORRELATION_ID': generateCorrelationId(),
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        params
      });
      
      pageCount++;
      
      // Response structure: { meta: { totalCount, nextCursor }, elements: { inventories: [...] } }
      // Each inventory item: { sku, nodes: [{ shipNode, availToSellQty: { amount } }] }
      const inventories = response.data.elements?.inventories || [];
      
      for (const item of Array.isArray(inventories) ? inventories : []) {
        if (item.sku && item.nodes && item.nodes.length > 0) {
          // Sum up available quantity from all ship nodes
          let totalQty = 0;
          for (const node of item.nodes) {
            if (node.availToSellQty?.amount !== undefined) {
              totalQty += node.availToSellQty.amount;
            }
          }
          inventoryMap.set(item.sku, totalQty);
        }
      }
      
      // Update cursor for next page - cursor is in meta
      nextCursor = response.data.meta?.nextCursor;
      
      if (pageCount % 10 === 0 || !nextCursor) {
        console.log(`[Walmart Sync] Bulk inventory page ${pageCount}: ${inventoryMap.size} SKUs loaded`);
        await listingsRepo.updateSyncJob(jobId, {
          lastProcessedId: `bulk_inventory_${inventoryMap.size}`
        });
      }
      
      // No more pages if cursor is empty or no inventories returned
      if (!nextCursor || inventories.length === 0) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`[Walmart Sync] Error fetching bulk inventory at page ${pageCount}:`, error.message);
      if (error.response?.data) {
        console.error(`[Walmart Sync] API Error Response:`, JSON.stringify(error.response.data, null, 2));
      }
      if (inventoryMap.size === 0) {
        throw error;
      }
      console.log(`[Walmart Sync] Continuing with ${inventoryMap.size} inventory entries collected`);
      break;
    }
  }
  
  if (pageCount >= maxPages) {
    console.warn(`[Walmart Sync] Reached max page limit (${maxPages}), inventory may be incomplete`);
  }
  
  console.log(`[Walmart Sync] Bulk inventory fetch complete: ${inventoryMap.size} SKUs with inventory data`);
  return inventoryMap;
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
 * 
 * @param jobId - The sync job ID
 * @param resumeFromCursor - Optional cursor to resume from (for interrupted syncs)
 * @param resumeProcessedCount - Number of items already processed (for accurate progress tracking)
 */
export async function startWalmartListingsSync(
  jobId: number,
  resumeFromCursor?: string,
  resumeProcessedCount: number = 0
): Promise<void> {
  const isResuming = !!resumeFromCursor;
  console.log(`[Walmart Sync] Starting sync job ${jobId}${isResuming ? ` (resuming from cursor, already processed: ${resumeProcessedCount})` : ''}...`);

  try {
    await listingsRepo.startSyncJob(jobId);

    let nextCursor: string | undefined = resumeFromCursor;
    let totalProcessed = resumeProcessedCount;
    let successCount = resumeProcessedCount;
    let errorCount = 0;
    let hasMore = true;
    let totalItems = 0;
    let pageCount = isResuming ? Math.floor(resumeProcessedCount / 200) : 0;

    const allItems: { item: WalmartListingItem; inventoryQuantity: number }[] = [];

    console.log(`[Walmart Sync] Phase 1: Fetching all items from Walmart API${isResuming ? ` (starting from page ${pageCount + 1})` : ''}...`);

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
    
    // Count published items that need inventory
    const publishedItems = allItems.filter(
      entry => entry.item.lifecycleStatus === 'ACTIVE' && entry.item.publishedStatus === 'PUBLISHED'
    );
    console.log(`[Walmart Sync] Phase 2: Fetching bulk inventory (${publishedItems.length} published items)...`);

    await listingsRepo.updateSyncJob(jobId, {
      totalItems: allItems.length
    });

    // Use bulk inventory API for efficiency
    const inventoryMap = await fetchBulkInventory(jobId);
    
    // Apply inventory to all items
    let inventoryApplied = 0;
    for (const entry of allItems) {
      const quantity = inventoryMap.get(entry.item.sku);
      if (quantity !== undefined) {
        entry.inventoryQuantity = quantity;
        inventoryApplied++;
      }
    }

    console.log(`[Walmart Sync] Phase 2 complete: Inventory applied to ${inventoryApplied} items`);
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

/**
 * Standalone inventory fetch - fetches inventory and updates existing listings
 * Use this when catalog sync completed but inventory fetch failed
 */
export async function runInventoryFetchOnly(): Promise<{ jobId: number }> {
  // Check for running sync
  if (await isSyncRunning()) {
    throw new Error('A sync is already running. Please wait for it to complete.');
  }

  // Create a new job for inventory fetch
  const job = await listingsRepo.createSyncJob({
    marketplace: 'walmart',
    jobType: 'inventory_fetch',
    status: 'running',
    triggeredBy: 'manual'
  });
  const jobId = job.id;

  // Run async in background
  (async () => {
    try {
      console.log(`[Walmart Sync] Job ${jobId}: Starting standalone inventory fetch...`);
      
      // Fetch bulk inventory
      const inventoryMap = await fetchBulkInventory(jobId);
      console.log(`[Walmart Sync] Job ${jobId}: Fetched ${inventoryMap.size} inventory entries`);
      
      // Update existing listings with inventory data
      let updated = 0;
      let notFound = 0;
      
      const entries = Array.from(inventoryMap.entries());
      for (const [sku, quantity] of entries) {
        try {
          const result = await listingsRepo.updateListingInventoryBySku('walmart', sku, quantity);
          if (result) {
            updated++;
          } else {
            notFound++;
          }
        } catch (err) {
          console.error(`[Walmart Sync] Error updating inventory for SKU ${sku}:`, err);
        }
        
        if (updated % 1000 === 0) {
          console.log(`[Walmart Sync] Job ${jobId}: Updated ${updated} listings with inventory`);
          await listingsRepo.updateSyncJob(jobId, {
            processedItems: updated,
            successItems: updated
          });
        }
      }
      
      await listingsRepo.completeSyncJob(jobId, {
        processedItems: inventoryMap.size,
        successItems: updated,
        failedItems: notFound
      });
      
      console.log(`[Walmart Sync] Job ${jobId}: ✅ Inventory fetch complete - ${updated} listings updated, ${notFound} SKUs not found in listings`);
      
    } catch (error) {
      console.error(`[Walmart Sync] Job ${jobId} failed:`, error);
      await listingsRepo.failSyncJob(jobId, (error as Error).message, { stack: (error as Error).stack });
    }
  })();

  return { jobId };
}

/**
 * ============================================
 * ORDERS SYNC FUNCTIONALITY
 * ============================================
 */

interface WalmartOrderLine {
  lineNumber: string;
  item: {
    productName: string;
    sku: string;
  };
  charges?: {
    charge: {
      chargeType: string;
      chargeName: string;
      chargeAmount: { currency: string; amount: number };
    }[];
  };
  orderLineQuantity: {
    unitOfMeasurement: string;
    amount: string;
  };
  statusDate?: string;
  orderLineStatuses?: {
    orderLineStatus: {
      status: string;
      statusQuantity: { unitOfMeasurement: string; amount: string };
      trackingInfo?: {
        shipDateTime?: string;
        carrierName?: {
          carrier?: string;
        };
        trackingNumber?: string;
      };
    }[];
  };
}

interface WalmartOrderResponse {
  purchaseOrderId: string;
  customerOrderId: string;
  customerEmailId?: string;
  orderType?: string;
  orderDate: string;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  shippingInfo: {
    postalAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    phone: string;
    estimatedDeliveryDate?: string;
    estimatedShipDate?: string;
  };
  orderLines: {
    orderLine: WalmartOrderLine[];
  };
}

interface WalmartOrdersApiResponse {
  list?: {
    elements?: {
      order?: WalmartOrderResponse[];
    };
    meta?: {
      totalCount?: number;
      limit?: number;
      nextCursor?: string;
    };
  };
}

/**
 * Fetch orders from Walmart API
 */
async function fetchWalmartOrders(
  createdStartDate?: string,
  createdEndDate?: string,
  status?: string,
  nextCursor?: string
): Promise<{ orders: WalmartOrderResponse[]; nextCursor?: string; totalCount?: number }> {
  const config = await getWalmartConfig();
  const accessToken = await getAccessToken();
  
  const params: Record<string, string> = {
    limit: '200'
  };
  
  if (createdStartDate) params.createdStartDate = createdStartDate;
  if (createdEndDate) params.createdEndDate = createdEndDate;
  if (status) params.status = status;
  if (nextCursor) params.nextCursor = nextCursor;
  
  console.log(`[Walmart Orders] Fetching orders with params:`, params);
  
  const response = await axios.get<WalmartOrdersApiResponse>(`${config.apiUrl}/orders`, {
    headers: {
      'WM_SEC.ACCESS_TOKEN': accessToken,
      'WM_SVC.NAME': config.serviceName,
      'WM_QOS.CORRELATION_ID': generateCorrelationId(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    params
  });
  
  const orders = response.data.list?.elements?.order || [];
  const meta = response.data.list?.meta;
  
  console.log(`[Walmart Orders] Fetched ${orders.length} orders, totalCount: ${meta?.totalCount || 'N/A'}`);
  
  return {
    orders,
    nextCursor: meta?.nextCursor,
    totalCount: meta?.totalCount
  };
}

/**
 * Transform Walmart order to our schema format
 */
function transformWalmartOrder(order: WalmartOrderResponse): {
  order: InsertMarketplaceOrder;
  items: Omit<InsertMarketplaceOrderItem, 'orderId'>[];
} {
  const orderLines = order.orderLines?.orderLine || [];
  
  let totalInCents = 0;
  let overallStatus: string | null = null;
  
  const statusPriority: Record<string, number> = {
    'Shipped': 1,
    'Acknowledged': 2,
    'Created': 3,
    'Cancelled': 4
  };
  
  let shipmentInfo: { trackingNumber?: string; carrier?: string; shippedAt?: Date } = {};
  
  for (const line of orderLines) {
    if (line.charges?.charge) {
      for (const charge of line.charges.charge) {
        if (charge.chargeType === 'PRODUCT' && charge.chargeAmount?.amount) {
          totalInCents += Math.round(charge.chargeAmount.amount * 100);
        }
      }
    }
    
    if (line.orderLineStatuses?.orderLineStatus) {
      for (const lineStatus of line.orderLineStatuses.orderLineStatus) {
        const status = lineStatus.status;
        const currentPriority = overallStatus ? statusPriority[overallStatus] : Infinity;
        const newPriority = statusPriority[status] ?? Infinity;
        
        if (newPriority < currentPriority) {
          overallStatus = status;
        }
        
        if (lineStatus.trackingInfo) {
          shipmentInfo.trackingNumber = lineStatus.trackingInfo.trackingNumber;
          shipmentInfo.carrier = lineStatus.trackingInfo.carrierName?.carrier;
          if (lineStatus.trackingInfo.shipDateTime) {
            shipmentInfo.shippedAt = new Date(lineStatus.trackingInfo.shipDateTime);
          }
        }
      }
    }
  }
  
  const statusMap: Record<string, 'pending' | 'unshipped' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold'> = {
    'Created': 'pending',
    'Acknowledged': 'unshipped',
    'Shipped': 'shipped',
    'Delivered': 'delivered',
    'Cancelled': 'cancelled'
  };
  
  const mappedStatus = (overallStatus && statusMap[overallStatus]) || 'pending';
  
  const orderData: InsertMarketplaceOrder = {
    marketplace: 'walmart',
    marketplaceOrderId: order.purchaseOrderId,
    orderNumber: order.customerOrderId,
    status: mappedStatus,
    orderType: order.orderType === 'REPLACEMENT' ? 'standard' : 'standard',
    customerEmail: order.customerEmailId,
    customerName: order.shippingInfo?.postalAddress?.name,
    shippingTrackingNumber: shipmentInfo.trackingNumber,
    shippingCarrier: shipmentInfo.carrier,
    shippedAt: shipmentInfo.shippedAt,
    orderDate: new Date(order.orderDate),
    shipByDate: order.estimatedShipDate ? new Date(order.estimatedShipDate) : undefined,
    promisedDeliveryDate: order.shippingInfo?.estimatedDeliveryDate ? new Date(order.shippingInfo.estimatedDeliveryDate) : undefined,
    totalInCents,
    currencyCode: 'USD',
    rawData: order
  };
  
  const items: Omit<InsertMarketplaceOrderItem, 'orderId'>[] = orderLines.map(line => {
    let unitPriceInCents = 0;
    if (line.charges?.charge) {
      for (const charge of line.charges.charge) {
        if (charge.chargeType === 'PRODUCT' && charge.chargeAmount?.amount) {
          unitPriceInCents = Math.round(charge.chargeAmount.amount * 100);
        }
      }
    }
    
    return {
      marketplaceSku: line.item.sku,
      title: line.item.productName,
      quantity: parseInt(line.orderLineQuantity?.amount || '1'),
      unitPriceInCents
    };
  });
  
  return { order: orderData, items };
}

/**
 * Sync Walmart orders to database
 */
export async function syncWalmartOrders(
  daysBack: number = 30
): Promise<{ synced: number; updated: number; errors: number }> {
  console.log(`[Walmart Orders] Starting orders sync for last ${daysBack} days...`);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  const formatDate = (date: Date) => date.toISOString();
  
  let allOrders: WalmartOrderResponse[] = [];
  let nextCursor: string | undefined;
  let pageCount = 0;
  const maxPages = 50;
  
  do {
    try {
      const result = await fetchWalmartOrders(
        formatDate(startDate),
        formatDate(endDate),
        undefined,
        nextCursor
      );
      
      allOrders = allOrders.concat(result.orders);
      nextCursor = result.nextCursor;
      pageCount++;
      
      console.log(`[Walmart Orders] Page ${pageCount}: ${result.orders.length} orders, total: ${allOrders.length}`);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`[Walmart Orders] No orders found for date range`);
        break;
      }
      throw error;
    }
  } while (nextCursor && pageCount < maxPages);
  
  console.log(`[Walmart Orders] Fetched ${allOrders.length} total orders`);
  
  let synced = 0;
  let updated = 0;
  let errors = 0;
  
  for (const walmartOrder of allOrders) {
    try {
      const { order: orderData, items } = transformWalmartOrder(walmartOrder);
      
      const existing = await db
        .select()
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.marketplace, 'walmart'),
            eq(marketplaceOrders.marketplaceOrderId, walmartOrder.purchaseOrderId)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        await db
          .update(marketplaceOrders)
          .set({
            ...orderData,
            lastSyncedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(marketplaceOrders.id, existing[0].id));
        updated++;
      } else {
        const [insertedOrder] = await db
          .insert(marketplaceOrders)
          .values({
            ...orderData,
            lastSyncedAt: new Date()
          })
          .returning({ id: marketplaceOrders.id });
        
        if (items.length > 0) {
          await db.insert(marketplaceOrderItems).values(
            items.map(item => ({
              ...item,
              orderId: insertedOrder.id
            }))
          );
        }
        synced++;
      }
      
    } catch (error) {
      console.error(`[Walmart Orders] Error syncing order ${walmartOrder.purchaseOrderId}:`, error);
      errors++;
    }
  }
  
  console.log(`[Walmart Orders] ✅ Sync complete - New: ${synced}, Updated: ${updated}, Errors: ${errors}`);
  
  return { synced, updated, errors };
}
