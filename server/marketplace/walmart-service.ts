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
  bulkInsertWalmartTaxonomy
} from './walmart-repository';
import {
  searchWalmartCatalogByUPC,
  getWalmartItem,
  getWalmartTaxonomy,
  getBulkWalmartItemsByUPC,
  searchWalmartBySKU
} from '../utils/walmart-api';

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
        // Save Walmart product
        const walmartProduct = await upsertWalmartProduct({
          walmartItemId: item.walmartItemId,
          sku: item.sku,
          upc: item.upc || upc,
          gtin: item.gtin,
          brand: item.brand,
          title: item.title,
          description: item.description,
          keyFeatures: item.keyFeatures || [],
          imageUrls: item.imageUrls || [],
          primaryImageUrl: item.imageUrls?.[0],
          categoryPath: item.categoryPath || [],
          variants: item.variants || [],
          currentPrice: item.price ? Math.round(item.price.amount * 100) : null,
          listPrice: item.listPrice ? Math.round(item.listPrice.amount * 100) : null,
          availabilityStatus: item.availabilityStatus,
          lifecycleStatus: item.lifecycleStatus,
          publishedStatus: item.publishedStatus,
          sellerName: item.sellerName,
          sellerMarketplace: item.sellerMarketplace,
          averageRating: item.averageRating,
          totalReviews: item.totalReviews,
          attributes: item.attributes || {},
          createdDate: item.createdDate ? new Date(item.createdDate) : null,
          lastUpdatedDate: item.lastUpdatedDate ? new Date(item.lastUpdatedDate) : null
        });
        
        // Save market intelligence data
        const marketData = await saveWalmartMarketData({
          walmartItemId: item.walmartItemId,
          currentPrice: item.price ? Math.round(item.price.amount * 100) : null,
          listPrice: item.listPrice ? Math.round(item.listPrice.amount * 100) : null,
          rating: item.averageRating,
          reviewCount: item.totalReviews,
          inStock: item.availabilityStatus === 'IN_STOCK',
          dataFetchedAt: new Date()
        });
        
        // Create mapping between our product and Walmart item
        try {
          await createProductWalmartMapping({
            productId,
            walmartItemId: item.walmartItemId,
            mappingSource: 'upc',
            matchMethod: 'upc_exact_match',
            matchConfidence: 1.0,
            isActive: true,
            isVerified: false
          });
        } catch (error: any) {
          // Mapping might already exist - that's okay
          if (!error.message?.includes('duplicate key')) {
            throw error;
          }
        }
        
        savedItems.push({
          walmartProduct,
          marketData
        });
        
        console.log(`[Walmart Service] ✅ Saved Walmart item: ${item.walmartItemId}`);
      } catch (error) {
        console.error(`[Walmart Service] Error saving item ${item.walmartItemId}:`, error);
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
 * Sync products with Walmart marketplace
 */
export async function syncProductsWithWalmart(limit: number = 100) {
  try {
    console.log(`[Walmart Service] Starting Walmart sync for up to ${limit} products`);
    
    // Get products that need Walmart sync
    const productsToSync = await getProductsForWalmartSync(limit);
    
    if (productsToSync.length === 0) {
      console.log('[Walmart Service] No products need Walmart sync');
      return {
        totalProducts: 0,
        synced: 0,
        failed: 0
      };
    }
    
    console.log(`[Walmart Service] Found ${productsToSync.length} products to sync`);
    
    let synced = 0;
    let failed = 0;
    
    for (const product of productsToSync) {
      try {
        const upc = product.upc || product.gtin;
        
        if (!upc) {
          console.log(`[Walmart Service] Product ${product.id} has no UPC/GTIN, skipping`);
          failed++;
          continue;
        }
        
        const results = await fetchWalmartDataByUpc(product.id, upc);
        
        if (results.length > 0) {
          synced++;
          console.log(`[Walmart Service] ✅ Synced product ${product.id} (${results.length} Walmart items)`);
        } else {
          failed++;
          console.log(`[Walmart Service] ❌ No Walmart items found for product ${product.id}`);
        }
        
        // Rate limiting: wait 500ms between products
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Walmart Service] Error syncing product ${product.id}:`, error);
        failed++;
      }
    }
    
    console.log(`[Walmart Service] ✅ Sync complete: ${synced} synced, ${failed} failed`);
    
    return {
      totalProducts: productsToSync.length,
      synced,
      failed
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
