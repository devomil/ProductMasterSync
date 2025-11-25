/**
 * Marketplace Listings Repository
 * 
 * Handles all database operations for active marketplace listings tracking
 */

import { db } from '../db';
import { 
  marketplaceListings, 
  walmartListingDetails,
  marketplaceSyncJobs,
  products
} from '../../shared/schema';
import type {
  MarketplaceListing,
  WalmartListingDetails,
  MarketplaceSyncJob,
  InsertMarketplaceListing,
  InsertWalmartListingDetails,
  InsertMarketplaceSyncJob
} from '../../shared/schema';
import { eq, and, sql, desc, asc, count, ilike, or, gte, lte, isNull, inArray } from 'drizzle-orm';

// ============================================================================
// MARKETPLACE LISTINGS CRUD
// ============================================================================

export interface ListingsFilters {
  marketplace?: 'walmart' | 'amazon' | 'ebay' | 'target' | 'home_depot';
  status?: string;
  quantity?: 'zero' | 'in_stock';
  search?: string;
  productType?: string;
  hasProductMatch?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListingsResult {
  listings: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalListings: number;
    activeListings: number;
    zeroQuantityListings: number;
    withProductMatch: number;
  };
}

/**
 * Get marketplace listings with pagination and filters
 */
export async function getMarketplaceListings(filters: ListingsFilters = {}): Promise<ListingsResult> {
  const {
    marketplace,
    status,
    quantity,
    search,
    productType,
    hasProductMatch,
    page = 1,
    pageSize = 50,
    sortBy = 'lastSeenAt',
    sortOrder = 'desc'
  } = filters;

  // Build where conditions
  const conditions: any[] = [];
  
  if (marketplace) {
    conditions.push(eq(marketplaceListings.marketplace, marketplace));
  }
  
  if (status) {
    conditions.push(eq(marketplaceListings.status, status as any));
  }
  
  if (quantity === 'zero') {
    conditions.push(eq(marketplaceListings.quantity, 0));
  } else if (quantity === 'in_stock') {
    conditions.push(sql`${marketplaceListings.quantity} > 0`);
  }
  
  if (search) {
    conditions.push(
      or(
        ilike(marketplaceListings.title, `%${search}%`),
        ilike(marketplaceListings.listingId, `%${search}%`),
        ilike(marketplaceListings.upc, `%${search}%`),
        ilike(marketplaceListings.marketplaceSku, `%${search}%`)
      )
    );
  }
  
  if (productType) {
    conditions.push(eq(marketplaceListings.productType, productType));
  }
  
  if (hasProductMatch === true) {
    conditions.push(sql`${marketplaceListings.productId} IS NOT NULL`);
  } else if (hasProductMatch === false) {
    conditions.push(isNull(marketplaceListings.productId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(marketplaceListings)
    .where(whereClause);
  
  const total = Number(countResult?.count || 0);

  // Get sort column
  const sortColumn = sortBy === 'title' ? marketplaceListings.title
    : sortBy === 'quantity' ? marketplaceListings.quantity
    : sortBy === 'priceInCents' ? marketplaceListings.priceInCents
    : sortBy === 'status' ? marketplaceListings.status
    : sortBy === 'productType' ? marketplaceListings.productType
    : marketplaceListings.lastSeenAt;

  // Get listings with pagination
  const listings = await db
    .select()
    .from(marketplaceListings)
    .where(whereClause)
    .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Get stats - using separate queries to avoid complexity
  const [totalStats] = await db
    .select({ count: count() })
    .from(marketplaceListings)
    .where(marketplace ? eq(marketplaceListings.marketplace, marketplace) : undefined);

  const [activeStats] = await db
    .select({ count: count() })
    .from(marketplaceListings)
    .where(and(
      marketplace ? eq(marketplaceListings.marketplace, marketplace) : undefined,
      eq(marketplaceListings.status, 'active')
    ));

  const [zeroQuantityStats] = await db
    .select({ count: count() })
    .from(marketplaceListings)
    .where(and(
      marketplace ? eq(marketplaceListings.marketplace, marketplace) : undefined,
      eq(marketplaceListings.quantity, 0)
    ));

  const [productMatchStats] = await db
    .select({ count: count() })
    .from(marketplaceListings)
    .where(and(
      marketplace ? eq(marketplaceListings.marketplace, marketplace) : undefined,
      sql`${marketplaceListings.productId} IS NOT NULL`
    ));

  return {
    listings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: {
      totalListings: Number(totalStats?.count || 0),
      activeListings: Number(activeStats?.count || 0),
      zeroQuantityListings: Number(zeroQuantityStats?.count || 0),
      withProductMatch: Number(productMatchStats?.count || 0)
    }
  };
}

/**
 * Get a single marketplace listing by ID
 */
export async function getMarketplaceListing(id: number): Promise<MarketplaceListing | null> {
  const [listing] = await db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, id));
  
  return listing || null;
}

/**
 * Get a marketplace listing by marketplace and listing ID
 */
export async function getListingByMarketplaceId(
  marketplace: string, 
  listingId: string
): Promise<MarketplaceListing | null> {
  const [listing] = await db
    .select()
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.marketplace, marketplace as any),
      eq(marketplaceListings.listingId, listingId)
    ));
  
  return listing || null;
}

/**
 * Upsert a marketplace listing (insert or update)
 */
export async function upsertMarketplaceListing(
  listingData: InsertMarketplaceListing
): Promise<MarketplaceListing> {
  const existing = await getListingByMarketplaceId(
    listingData.marketplace, 
    listingData.listingId
  );

  if (existing) {
    // Update existing listing
    const [updated] = await db
      .update(marketplaceListings)
      .set({
        ...listingData,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(marketplaceListings.id, existing.id))
      .returning();
    
    return updated;
  } else {
    // Insert new listing
    const [inserted] = await db
      .insert(marketplaceListings)
      .values({
        ...listingData,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      })
      .returning();
    
    return inserted;
  }
}

/**
 * Bulk upsert marketplace listings
 */
export async function bulkUpsertMarketplaceListings(
  listings: InsertMarketplaceListing[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    
    for (const listing of batch) {
      try {
        const existing = await getListingByMarketplaceId(
          listing.marketplace,
          listing.listingId
        );

        if (existing) {
          await db
            .update(marketplaceListings)
            .set({
              ...listing,
              lastSeenAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(marketplaceListings.id, existing.id));
          updated++;
        } else {
          await db
            .insert(marketplaceListings)
            .values({
              ...listing,
              firstSeenAt: new Date(),
              lastSeenAt: new Date()
            });
          inserted++;
        }
      } catch (error) {
        console.error(`[Listings Repo] Error upserting listing ${listing.listingId}:`, error);
        errors++;
      }
    }
  }

  return { inserted, updated, errors };
}

/**
 * Update listing quantity
 */
export async function updateListingQuantity(id: number, quantity: number): Promise<MarketplaceListing | null> {
  const [updated] = await db
    .update(marketplaceListings)
    .set({ 
      quantity, 
      lastSeenAt: new Date(),
      updatedAt: new Date() 
    })
    .where(eq(marketplaceListings.id, id))
    .returning();
  
  return updated || null;
}

/**
 * Delete a marketplace listing
 */
export async function deleteMarketplaceListing(id: number): Promise<boolean> {
  const [deleted] = await db
    .delete(marketplaceListings)
    .where(eq(marketplaceListings.id, id))
    .returning();
  
  return !!deleted;
}

// ============================================================================
// WALMART LISTING DETAILS
// ============================================================================

/**
 * Get Walmart listing details by marketplace listing ID
 */
export async function getWalmartListingDetails(
  marketplaceListingId: number
): Promise<WalmartListingDetails | null> {
  const [details] = await db
    .select()
    .from(walmartListingDetails)
    .where(eq(walmartListingDetails.marketplaceListingId, marketplaceListingId));
  
  return details || null;
}

/**
 * Upsert Walmart listing details
 */
export async function upsertWalmartListingDetails(
  detailsData: InsertWalmartListingDetails
): Promise<WalmartListingDetails> {
  const existing = await getWalmartListingDetails(detailsData.marketplaceListingId);

  if (existing) {
    const [updated] = await db
      .update(walmartListingDetails)
      .set({
        ...detailsData,
        updatedAt: new Date()
      })
      .where(eq(walmartListingDetails.id, existing.id))
      .returning();
    
    return updated;
  } else {
    const [inserted] = await db
      .insert(walmartListingDetails)
      .values(detailsData)
      .returning();
    
    return inserted;
  }
}

// ============================================================================
// SYNC JOBS MANAGEMENT
// ============================================================================

/**
 * Create a new sync job
 */
export async function createSyncJob(
  jobData: InsertMarketplaceSyncJob
): Promise<MarketplaceSyncJob> {
  const [job] = await db
    .insert(marketplaceSyncJobs)
    .values(jobData)
    .returning();
  
  return job;
}

/**
 * Get sync job by ID
 */
export async function getSyncJob(id: number): Promise<MarketplaceSyncJob | null> {
  const [job] = await db
    .select()
    .from(marketplaceSyncJobs)
    .where(eq(marketplaceSyncJobs.id, id));
  
  return job || null;
}

/**
 * Get recent sync jobs for a marketplace (or all marketplaces if not specified)
 */
export async function getRecentSyncJobs(
  marketplace?: string,
  limit: number = 10
): Promise<MarketplaceSyncJob[]> {
  const query = db
    .select()
    .from(marketplaceSyncJobs);
  
  if (marketplace) {
    return await query
      .where(eq(marketplaceSyncJobs.marketplace, marketplace as any))
      .orderBy(desc(marketplaceSyncJobs.createdAt))
      .limit(limit);
  }
  
  return await query
    .orderBy(desc(marketplaceSyncJobs.createdAt))
    .limit(limit);
}

/**
 * Get currently running sync job for a marketplace
 */
export async function getRunningSync(marketplace: string): Promise<MarketplaceSyncJob | null> {
  const [job] = await db
    .select()
    .from(marketplaceSyncJobs)
    .where(and(
      eq(marketplaceSyncJobs.marketplace, marketplace as any),
      eq(marketplaceSyncJobs.status, 'running')
    ))
    .limit(1);
  
  return job || null;
}

/**
 * Update sync job status and progress
 */
export async function updateSyncJob(
  id: number,
  updates: Partial<{
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalItems: number;
    processedItems: number;
    successItems: number;
    failedItems: number;
    startedAt: Date;
    completedAt: Date;
    duration: number;
    nextCursor: string;
    lastProcessedId: string;
    errorMessage: string;
    errorDetails: any;
  }>
): Promise<MarketplaceSyncJob | null> {
  const [updated] = await db
    .update(marketplaceSyncJobs)
    .set({
      ...updates,
      updatedAt: new Date()
    })
    .where(eq(marketplaceSyncJobs.id, id))
    .returning();
  
  return updated || null;
}

/**
 * Mark sync job as started
 */
export async function startSyncJob(id: number): Promise<MarketplaceSyncJob | null> {
  return updateSyncJob(id, {
    status: 'running',
    startedAt: new Date()
  });
}

/**
 * Mark sync job as completed
 */
export async function completeSyncJob(
  id: number,
  stats: { successItems: number; failedItems: number; processedItems: number }
): Promise<MarketplaceSyncJob | null> {
  const job = await getSyncJob(id);
  if (!job) return null;

  const startTime = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
  const duration = Math.round((Date.now() - startTime) / 1000);

  return updateSyncJob(id, {
    status: 'completed',
    completedAt: new Date(),
    duration,
    ...stats
  });
}

/**
 * Mark sync job as failed
 */
export async function failSyncJob(
  id: number,
  errorMessage: string,
  errorDetails?: any
): Promise<MarketplaceSyncJob | null> {
  const job = await getSyncJob(id);
  if (!job) return null;

  const startTime = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
  const duration = Math.round((Date.now() - startTime) / 1000);

  return updateSyncJob(id, {
    status: 'failed',
    completedAt: new Date(),
    duration,
    errorMessage,
    errorDetails
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get distinct product types for a marketplace
 */
export async function getDistinctProductTypes(marketplace: string): Promise<string[]> {
  const results = await db
    .selectDistinct({ productType: marketplaceListings.productType })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.marketplace, marketplace as any),
      sql`${marketplaceListings.productType} IS NOT NULL`
    ))
    .orderBy(asc(marketplaceListings.productType));
  
  return results.map(r => r.productType).filter(Boolean) as string[];
}

/**
 * Link listings to products by UPC
 */
export async function linkListingsToProducts(marketplace: string): Promise<{ linked: number }> {
  let linked = 0;

  // Get all listings without product match that have a UPC
  const unmatchedListings = await db
    .select()
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.marketplace, marketplace as any),
      isNull(marketplaceListings.productId),
      sql`${marketplaceListings.upc} IS NOT NULL`
    ));

  for (const listing of unmatchedListings) {
    if (!listing.upc) continue;

    // Try to find matching product by UPC
    const [matchingProduct] = await db
      .select()
      .from(products)
      .where(eq(products.upc, listing.upc))
      .limit(1);

    if (matchingProduct) {
      await db
        .update(marketplaceListings)
        .set({ productId: matchingProduct.id, updatedAt: new Date() })
        .where(eq(marketplaceListings.id, listing.id));
      linked++;
    }
  }

  return { linked };
}
