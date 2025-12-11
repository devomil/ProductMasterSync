/**
 * Walmart Marketplace Service
 * 
 * Implements the core functionality for syncing product data with Walmart Marketplace API
 */

import {
  upsertWalmartProduct,
  saveWalmartMarketData,
  saveWalmartTaxonomy,
  createProductWalmartMapping,
  getProductsForWalmartSync,
  getProductsForWalmartSyncWithPresence,
  recordMarketplacePresence,
  bulkInsertWalmartTaxonomy,
  bulkUpsertPricingInsights,
  getPricingInsights,
  getPricingInsightsStats,
  getHighDemandInsights,
  getPricingInsightsForCatalog,
  getPricingInsightBySku
} from './walmart-repository';
import { 
  updatePricingInsights,
  getListingBySku,
  getWalmartListingsForPricingSync
} from './listings-repository';
import {
  searchWalmartCatalogByUPC,
  searchWalmartCatalogByMPN,
  searchWalmartCatalogWithFallback,
  getWalmartItem,
  getWalmartTaxonomy,
  getBulkWalmartItemsByUPC,
  searchWalmartBySKU,
  getWalmartPricingInsights,
  getAllWalmartPricingInsights,
  type WalmartPricingInsightItem
} from '../utils/walmart-api';
import { db } from '../db';
import { productWalmartMapping, walmartPricingInsights } from '../../shared/schema';

/**
 * Fetch Walmart data by UPC and save to database
 */
export async function fetchWalmartDataByUpc(productId: number, upc: string) {
  try {
    console.log(`[Walmart Service] Fetching data for UPC: ${upc}`);
    
    // Search Walmart catalog by UPC
    const items = await searchWalmartCatalogByUPC(upc);
    
    if (!items || items.length === 0) {
      console.log(`[Walmart Service] No Walmart items found for UPC ${upc}`);
      return [];
    }
    
    const savedItems = [];
    
    for (const item of items) {
      try {
        // Map Walmart API response to our schema
        // Walmart API returns: itemId, images[{url}], price{amount, currency}, customerRating, properties{num_reviews, categories}
        const imageUrls = item.images?.map((img: any) => img.url) || [];
        const categoryPath = item.properties?.categories || [];
        // Extract product type - the final level in the category hierarchy (determines referral fee)
        const productType = categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null;
        
        // Save Walmart product
        const walmartProduct = await upsertWalmartProduct({
          walmartItemId: item.itemId, // API returns 'itemId' not 'walmartItemId'
          sku: item.sku,
          upc: item.upc || upc,
          gtin: item.gtin,
          brand: item.brand,
          title: item.title,
          description: item.description,
          keyFeatures: item.keyFeatures || [],
          imageUrls: imageUrls,
          primaryImageUrl: imageUrls[0] || null,
          categoryPath: categoryPath,
          productType: productType,
          variants: item.variants || [],
          currentPrice: item.price?.amount ? Math.round(parseFloat(item.price.amount) * 100) : null,
          listPrice: item.listPrice?.amount ? Math.round(parseFloat(item.listPrice.amount) * 100) : null,
          availabilityStatus: item.availabilityStatus,
          lifecycleStatus: item.lifecycleStatus,
          publishedStatus: item.publishedStatus,
          sellerName: item.sellerName,
          sellerMarketplace: item.isMarketPlaceItem || false,
          averageRating: item.customerRating ? parseFloat(item.customerRating) : null,
          totalReviews: item.properties?.num_reviews ? parseInt(item.properties.num_reviews) : null,
          attributes: item.properties || {},
          createdDate: item.createdDate ? new Date(item.createdDate) : null,
          lastUpdatedDate: item.lastUpdatedDate ? new Date(item.lastUpdatedDate) : null
        });
        
        // Save market intelligence data
        // TODO: Fix walmart_market_intelligence schema alignment - skipping for now to unblock product sync
        let marketData = null;
        /*
        const marketData = await saveWalmartMarketData({
          walmartItemId: item.itemId,
          currentPrice: item.price?.amount ? Math.round(parseFloat(item.price.amount) * 100) : null,
          listPrice: item.listPrice?.amount ? Math.round(parseFloat(item.listPrice.amount) * 100) : null,
          avgRating: item.customerRating ? parseFloat(item.customerRating) : null,
          numReviews: item.properties?.num_reviews ? parseInt(item.properties.num_reviews) : null,
          inStock: item.availabilityStatus === 'IN_STOCK',
          dataFetchedAt: new Date()
        });
        */
        
        // Create mapping between our product and Walmart item
        // Only insert fields that exist in database to avoid column mismatch errors
        try {
          await db.insert(productWalmartMapping).values({
            productId,
            walmartItemId: item.itemId,
            mappingSource: 'upc',
            matchConfidence: 1.0,
            isActive: true,
            isVerified: false
          });
          console.log(`[Walmart Service] Created mapping: Product ${productId} -> Walmart ${item.itemId}`);
        } catch (error: any) {
          // Mapping might already exist - that's okay
          if (!error.message?.includes('duplicate key')) {
            console.error(`[Walmart Service] Error creating mapping:`, error);
            throw error;
          }
        }
        
        savedItems.push({
          walmartProduct,
          marketData
        });
        
        console.log(`[Walmart Service] ✅ Saved Walmart item: ${item.itemId}`);
      } catch (error) {
        console.error(`[Walmart Service] Error saving item ${item.itemId}:`, error);
        // Continue with next item
      }
    }
    
    return savedItems;
  } catch (error) {
    console.error(`[Walmart Service] Error fetching Walmart data for UPC ${upc}:`, error);
    throw error;
  }
}

/**
 * Fetch Walmart data with MPN fallback - tries UPC first, then MPN
 * Supports matching products without UPCs using manufacturer part numbers
 */
export async function fetchWalmartDataWithFallback(
  productId: number, 
  upc?: string, 
  mpn?: string, 
  brand?: string
): Promise<{ items: any[], matchMethod: 'upc' | 'mpn' | 'none' }> {
  try {
    console.log(`[Walmart Service] Fetching data for product ${productId} - UPC: ${upc || 'none'}, MPN: ${mpn || 'none'}`);
    
    // Use the fallback search function
    const { items, matchMethod } = await searchWalmartCatalogWithFallback(upc, mpn, brand);
    
    if (!items || items.length === 0) {
      console.log(`[Walmart Service] No Walmart items found for product ${productId}`);
      return { items: [], matchMethod: 'none' };
    }
    
    const savedItems = [];
    
    for (const item of items) {
      try {
        // Map Walmart API response to our schema
        const imageUrls = item.images?.map((img: any) => img.url) || [];
        const categoryPath = item.properties?.categories || [];
        const productType = categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null;
        
        // Save Walmart product
        const walmartProduct = await upsertWalmartProduct({
          walmartItemId: item.itemId,
          sku: item.sku,
          upc: item.upc || upc,
          gtin: item.gtin,
          brand: item.brand,
          title: item.title,
          description: item.description,
          keyFeatures: item.keyFeatures || [],
          imageUrls: imageUrls,
          primaryImageUrl: imageUrls[0] || null,
          categoryPath: categoryPath,
          productType: productType,
          variants: item.variants || [],
          currentPrice: item.price?.amount ? Math.round(parseFloat(item.price.amount) * 100) : null,
          listPrice: item.listPrice?.amount ? Math.round(parseFloat(item.listPrice.amount) * 100) : null,
          availabilityStatus: item.availabilityStatus,
          lifecycleStatus: item.lifecycleStatus,
          publishedStatus: item.publishedStatus,
          sellerName: item.sellerName,
          sellerMarketplace: item.isMarketPlaceItem || false,
          averageRating: item.customerRating ? parseFloat(item.customerRating) : null,
          totalReviews: item.properties?.num_reviews ? parseInt(item.properties.num_reviews) : null,
          attributes: item.properties || {},
          createdDate: item.createdDate ? new Date(item.createdDate) : null,
          lastUpdatedDate: item.lastUpdatedDate ? new Date(item.lastUpdatedDate) : null
        });
        
        // Create mapping between our product and Walmart item
        try {
          await db.insert(productWalmartMapping).values({
            productId,
            walmartItemId: item.itemId,
            mappingSource: matchMethod, // Use the match method (upc or mpn)
            matchConfidence: matchMethod === 'upc' ? 1.0 : 0.8, // Lower confidence for MPN matches
            isActive: true,
            isVerified: false
          });
          console.log(`[Walmart Service] Created ${matchMethod} mapping: Product ${productId} -> Walmart ${item.itemId}`);
        } catch (error: any) {
          if (!error.message?.includes('duplicate key')) {
            console.error(`[Walmart Service] Error creating mapping:`, error);
            throw error;
          }
        }
        
        savedItems.push({
          walmartProduct,
          matchMethod
        });
        
        console.log(`[Walmart Service] ✅ Saved Walmart item: ${item.itemId} (matched via ${matchMethod})`);
      } catch (error) {
        console.error(`[Walmart Service] Error saving item ${item.itemId}:`, error);
      }
    }
    
    return { items: savedItems, matchMethod };
  } catch (error) {
    console.error(`[Walmart Service] Error in fetchWalmartDataWithFallback:`, error);
    throw error;
  }
}

/**
 * Sync products with Walmart marketplace (with presence tracking)
 */
export async function syncProductsWithWalmart(limit: number = 100) {
  try {
    console.log(`[Walmart Service] Starting Walmart sync for up to ${limit} products`);
    
    // Get products that need Walmart sync (excluding recently checked ones)
    const productsToSync = await getProductsForWalmartSyncWithPresence(limit);
    
    if (productsToSync.length === 0) {
      console.log('[Walmart Service] No products need Walmart sync');
      return {
        totalProducts: 0,
        synced: 0,
        notFound: 0,
        errors: 0
      };
    }
    
    console.log(`[Walmart Service] Found ${productsToSync.length} products to sync`);
    
    let synced = 0;
    let notFound = 0;
    let errors = 0;
    
    for (const product of productsToSync) {
      try {
        const upc = product.upc;
        const mpn = (product as any).manufacturerPartNumber || (product as any).mpn;
        const brand = (product as any).manufacturerName || (product as any).brand;
        
        // Skip if neither UPC nor MPN is available
        if (!upc && !mpn) {
          console.log(`[Walmart Service] Product ${product.id} has no UPC or MPN, skipping`);
          errors++;
          continue;
        }
        
        // Use fallback function that tries UPC first, then MPN
        const { items: results, matchMethod } = await fetchWalmartDataWithFallback(product.id, upc, mpn, brand);
        
        if (results.length > 0) {
          synced++;
          await recordMarketplacePresence(product.id, 'walmart', 'available', `Found ${results.length} Walmart item(s) via ${matchMethod}`);
          console.log(`[Walmart Service] ✅ Synced product ${product.id} (${results.length} Walmart items via ${matchMethod})`);
        } else {
          notFound++;
          const identifier = upc || mpn;
          await recordMarketplacePresence(product.id, 'walmart', 'not_found', `${upc ? 'UPC' : 'MPN'} not in Walmart catalog`);
          console.log(`[Walmart Service] ⚠️ Product ${product.id} not available on Walmart (${upc ? 'UPC: ' + upc : 'MPN: ' + mpn})`);
        }
        
        // Rate limiting: wait 500ms between products
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Walmart Service] Error syncing product ${product.id}:`, error);
        await recordMarketplacePresence(product.id, 'walmart', 'error', (error as Error).message);
        errors++;
      }
    }
    
    console.log(`[Walmart Service] ✅ Sync complete: ${synced} synced, ${notFound} not found, ${errors} errors`);
    
    return {
      totalProducts: productsToSync.length,
      synced,
      notFound,
      errors
    };
  } catch (error) {
    console.error('[Walmart Service] Error in syncProductsWithWalmart:', error);
    throw error;
  }
}

/**
 * Fetch and save Walmart taxonomy
 */
export async function syncWalmartTaxonomy() {
  try {
    console.log('[Walmart Service] Fetching Walmart taxonomy...');
    
    const taxonomyResponse = await getWalmartTaxonomy('5.0');
    
    if (!taxonomyResponse) {
      console.log('[Walmart Service] No taxonomy data returned');
      return { categories: 0 };
    }
    
    const taxonomyRecords: any[] = [];
    
    // Process taxonomy response based on version 5.0 structure
    if (taxonomyResponse.payload && Array.isArray(taxonomyResponse.payload)) {
      // Version 5.0 structure with subcategories
      for (const category of taxonomyResponse.payload) {
        // Add main category
        if (category.category) {
          taxonomyRecords.push({
            categoryId: category.category,
            categoryName: category.category,
            parentCategoryId: null,
            categoryPath: [category.category],
            level: 1
          });
        }
        
        // Add subcategories
        if (category.subcategory && Array.isArray(category.subcategory)) {
          for (const sub of category.subcategory) {
            taxonomyRecords.push({
              categoryId: sub.subCategoryId,
              categoryName: sub.subCategoryName,
              parentCategoryId: category.category,
              categoryPath: [category.category, sub.subCategoryName],
              level: 2
            });
          }
        }
      }
    } else if (taxonomyResponse.itemTaxonomy) {
      // Version 4.1 structure with category/productTypeGroup/productType
      const itemTax = taxonomyResponse.itemTaxonomy;
      
      if (Array.isArray(itemTax.category)) {
        for (const cat of itemTax.category) {
          const categoryName = cat.category || cat.categoryName;
          
          // Add category
          taxonomyRecords.push({
            categoryId: categoryName,
            categoryName: categoryName,
            description: cat.description,
            parentCategoryId: null,
            categoryPath: [categoryName],
            level: 1
          });
          
          // Add product type groups
          if (cat.productTypeGroup && Array.isArray(cat.productTypeGroup)) {
            for (const ptg of cat.productTypeGroup) {
              const groupName = ptg.productTypeGroupName;
              
              taxonomyRecords.push({
                categoryId: `${categoryName}::${groupName}`,
                categoryName: groupName,
                parentCategoryId: categoryName,
                productTypeGroupName: groupName,
                description: ptg.description,
                categoryPath: [categoryName, groupName],
                level: 2
              });
              
              // Add product types
              if (ptg.productType && Array.isArray(ptg.productType)) {
                for (const pt of ptg.productType) {
                  const typeName = pt.productTypeName;
                  
                  taxonomyRecords.push({
                    categoryId: `${categoryName}::${groupName}::${typeName}`,
                    categoryName: typeName,
                    parentCategoryId: `${categoryName}::${groupName}`,
                    productTypeGroupName: groupName,
                    productTypeName: typeName,
                    description: pt.description,
                    categoryPath: [categoryName, groupName, typeName],
                    level: 3
                  });
                }
              }
              
              // Add departments
              if (ptg.department && Array.isArray(ptg.department)) {
                for (const dept of ptg.department) {
                  taxonomyRecords.push({
                    categoryId: `${categoryName}::${groupName}::${dept.departmentName}`,
                    categoryName: dept.departmentName,
                    parentCategoryId: `${categoryName}::${groupName}`,
                    productTypeGroupName: groupName,
                    departmentName: dept.departmentName,
                    departmentNumber: dept.departmentNumber,
                    categoryPath: [categoryName, groupName, dept.departmentName],
                    level: 3
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Bulk insert taxonomy records
    if (taxonomyRecords.length > 0) {
      await bulkInsertWalmartTaxonomy(taxonomyRecords);
      console.log(`[Walmart Service] ✅ Saved ${taxonomyRecords.length} taxonomy records`);
    }
    
    return {
      categories: taxonomyRecords.length
    };
  } catch (error) {
    console.error('[Walmart Service] Error syncing taxonomy:', error);
    throw error;
  }
}

/**
 * Calculate profit opportunity for Walmart item
 */
export function calculateWalmartOpportunity(
  supplierCost: number, // in cents
  walmartPrice: number, // in cents
  walmartFees: number = 0, // in cents
  shippingCost: number = 0 // in cents
) {
  const totalCosts = supplierCost + walmartFees + shippingCost;
  const profit = walmartPrice - totalCosts;
  const profitMargin = walmartPrice > 0 ? (profit / walmartPrice) * 100 : 0;
  const roi = supplierCost > 0 ? (profit / supplierCost) * 100 : 0;
  
  // Calculate opportunity score (0-100)
  let opportunityScore = 0;
  
  if (profitMargin >= 25) {
    opportunityScore += 50; // High profit margin
  } else if (profitMargin >= 15) {
    opportunityScore += 30; // Medium profit margin
  } else if (profitMargin >= 10) {
    opportunityScore += 10; // Low profit margin
  }
  
  if (roi >= 100) {
    opportunityScore += 30; // Excellent ROI
  } else if (roi >= 50) {
    opportunityScore += 20; // Good ROI
  } else if (roi >= 25) {
    opportunityScore += 10; // Fair ROI
  }
  
  // Add bonus for in-stock items (inferred from context)
  opportunityScore += 20;
  
  return {
    profit,
    profitMargin,
    roi,
    opportunityScore: Math.min(100, opportunityScore)
  };
}

// ============================================================================
// PRICING INSIGHTS SERVICE FUNCTIONS
// ============================================================================

/**
 * Sync all pricing insights from Walmart API
 * Fetches all pages and saves to database
 */
export async function syncAllPricingInsights(maxPages: number = 50) {
  try {
    console.log('[Walmart Service] Starting full Pricing Insights sync...');
    
    const startTime = Date.now();
    
    // Fetch all pricing insights from API
    const allInsights = await getAllWalmartPricingInsights(maxPages);
    
    if (allInsights.length === 0) {
      console.log('[Walmart Service] No pricing insights returned from API');
      return {
        fetched: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        durationMs: Date.now() - startTime
      };
    }
    
    console.log(`[Walmart Service] Fetched ${allInsights.length} pricing insights, saving to database...`);
    
    // Save to database
    const { inserted, updated, errors } = await bulkUpsertPricingInsights(allInsights);
    
    const durationMs = Date.now() - startTime;
    
    console.log(`[Walmart Service] ✅ Pricing Insights sync complete in ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`[Walmart Service] Results: ${inserted} inserted, ${updated} updated, ${errors} errors`);
    
    return {
      fetched: allInsights.length,
      inserted,
      updated,
      errors,
      durationMs
    };
  } catch (error) {
    console.error('[Walmart Service] Error syncing pricing insights:', error);
    throw error;
  }
}

/**
 * Sync a single page of pricing insights
 * Useful for testing or incremental updates
 */
export async function syncPricingInsightsPage(pageNumber: number = 0) {
  try {
    console.log(`[Walmart Service] Syncing Pricing Insights page ${pageNumber}...`);
    
    const response = await getWalmartPricingInsights(pageNumber);
    
    if (response.pricingInsightsResponseList.length === 0) {
      return {
        fetched: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        pageContext: response.pageContext
      };
    }
    
    const { inserted, updated, errors } = await bulkUpsertPricingInsights(response.pricingInsightsResponseList);
    
    console.log(`[Walmart Service] ✅ Page ${pageNumber} synced: ${inserted} inserted, ${updated} updated`);
    
    return {
      fetched: response.pricingInsightsResponseList.length,
      inserted,
      updated,
      errors,
      pageContext: response.pageContext
    };
  } catch (error) {
    console.error(`[Walmart Service] Error syncing pricing insights page ${pageNumber}:`, error);
    throw error;
  }
}

/**
 * Get pricing insights with enhanced analysis for Purchasing AI
 */
export async function getPricingInsightsWithAnalysis(page: number = 1, limit: number = 50) {
  try {
    const result = await getPricingInsights(page, limit);
    
    // Enhance with profit analysis where we have product cost data
    const enhancedInsights = result.insights.map(insight => {
      // Add calculated fields
      const buyBoxPrice = insight.buyBoxTotalPrice || insight.buyBoxBasePrice || insight.currentPrice || 0;
      const competitorPrice = insight.competitorPrice || 0;
      
      // Calculate price gap
      let priceGap = 0;
      let priceGapPercent = 0;
      if (buyBoxPrice > 0 && competitorPrice > 0) {
        priceGap = buyBoxPrice - competitorPrice;
        priceGapPercent = (priceGap / buyBoxPrice) * 100;
      }
      
      return {
        ...insight,
        buyBoxPrice,
        priceGap,
        priceGapPercent,
        opportunityLevel: getOpportunityLevel(insight)
      };
    });
    
    return {
      ...result,
      insights: enhancedInsights
    };
  } catch (error) {
    console.error('[Walmart Service] Error getting pricing insights with analysis:', error);
    throw error;
  }
}

/**
 * Determine opportunity level based on pricing insights
 */
function getOpportunityLevel(insight: any): 'high' | 'medium' | 'low' | 'none' {
  let score = 0;
  
  // High demand = good opportunity
  if (insight.inDemand) score += 30;
  
  // High traffic = good visibility
  if (insight.traffic === 'High') score += 25;
  else if (insight.traffic === 'Medium') score += 15;
  
  // Price competitive = well-positioned
  if (insight.priceCompetitive) score += 20;
  
  // High GMV = proven demand
  const gmv30 = insight.gmv30 || 0;
  if (gmv30 > 100000) score += 25; // >$1000/month
  else if (gmv30 > 50000) score += 15; // >$500/month
  else if (gmv30 > 10000) score += 5; // >$100/month
  
  // High potential GMV lift = upside potential
  const potentialLift = insight.potentialGmvLift || 0;
  if (potentialLift > 10000) score += 15;
  else if (potentialLift > 5000) score += 10;
  
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

/**
 * Get pricing insights statistics for dashboard
 */
export async function getPricingInsightsDashboard() {
  try {
    const stats = await getPricingInsightsStats();
    const highDemand = await getHighDemandInsights(10);
    
    return {
      stats: {
        totalItems: Number(stats.total_items) || 0,
        inDemandCount: Number(stats.in_demand_count) || 0,
        priceCompetitiveCount: Number(stats.price_competitive_count) || 0,
        highTrafficCount: Number(stats.high_traffic_count) || 0,
        mediumTrafficCount: Number(stats.medium_traffic_count) || 0,
        lowTrafficCount: Number(stats.low_traffic_count) || 0,
        totalGmv30: Number(stats.total_gmv30) || 0,
        totalPotentialGmvLift: Number(stats.total_potential_gmv_lift) || 0,
        avgPriceCompetitiveScore: Number(stats.avg_price_competitive_score) || 0,
        lastSyncAt: stats.last_sync_at
      },
      topOpportunities: highDemand
    };
  } catch (error) {
    console.error('[Walmart Service] Error getting pricing insights dashboard:', error);
    throw error;
  }
}

/**
 * Sync pricing insights from walmart_pricing_insights table to walmart_listing_details
 * This links the pricing data to the Active Listings UI
 * 
 * Optimized to only sync listings that have pricing insights data
 */
export async function syncPricingInsightsToListings() {
  try {
    console.log('[Walmart Service] Starting pricing insights to listings sync...');
    
    // Get all pricing insights that have been fetched
    const allInsights = await db
      .select({
        sku: walmartPricingInsights.sku,
        buyBoxBasePrice: walmartPricingInsights.buyBoxBasePrice,
        buyBoxTotalPrice: walmartPricingInsights.buyBoxTotalPrice,
        competitorPrice: walmartPricingInsights.competitorPrice,
        priceCompetitive: walmartPricingInsights.priceCompetitive,
        priceCompetitiveScore: walmartPricingInsights.priceCompetitiveScore,
        inDemand: walmartPricingInsights.inDemand,
        traffic: walmartPricingInsights.traffic,
        gmv30: walmartPricingInsights.gmv30
      })
      .from(walmartPricingInsights);
    
    console.log(`[Walmart Service] Found ${allInsights.length} pricing insights to sync`);
    
    if (allInsights.length === 0) {
      return { total: 0, synced: 0, skipped: 0, errors: 0 };
    }
    
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each insight and find matching listing
    for (const insight of allInsights) {
      try {
        // Find the listing by SKU
        const listing = await getListingBySku(insight.sku, 'walmart');
        
        if (!listing) {
          skipped++;
          continue;
        }
        
        // Update the listing details with pricing insights
        await updatePricingInsights(listing.id, {
          buyBoxBasePriceInCents: insight.buyBoxBasePrice,
          buyBoxTotalPriceInCents: insight.buyBoxTotalPrice,
          competitorPriceInCents: insight.competitorPrice,
          priceCompetitive: insight.priceCompetitive,
          priceCompetitiveScore: insight.priceCompetitiveScore,
          inDemand: insight.inDemand,
          trafficLevel: insight.traffic,
          gmv30InCents: insight.gmv30
        });
        
        synced++;
      } catch (error) {
        console.error(`[Walmart Service] Error syncing insight for SKU ${insight.sku}:`, error);
        errors++;
      }
    }
    
    console.log(`[Walmart Service] ✅ Pricing insights sync to listings complete`);
    console.log(`[Walmart Service] Results: ${synced} synced, ${skipped} skipped (no matching listing), ${errors} errors`);
    
    return {
      total: allInsights.length,
      synced,
      skipped,
      errors
    };
  } catch (error) {
    console.error('[Walmart Service] Error syncing pricing insights to listings:', error);
    throw error;
  }
}

// Re-export repository functions for direct access
export {
  getPricingInsights,
  getPricingInsightsStats,
  getHighDemandInsights,
  getPricingInsightsForCatalog,
  getPricingInsightBySku
};
