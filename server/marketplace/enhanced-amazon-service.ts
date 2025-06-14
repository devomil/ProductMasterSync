/**
 * Enhanced Amazon Marketplace Service
 * 
 * Comprehensive competitive intelligence system supporting:
 * - UPC and MFG# fallback searches
 * - Multiple ASIN discovery per product
 * - Full marketplace data collection
 * - AI-ready profitability analysis
 */

import { searchCatalogItemsByUPC, getAmazonConfig } from '../utils/amazon-spapi';
import { amazonRateLimiter } from '../utils/rate-limiter';
import { db } from '../db';
import { 
  productAmazonLookup, 
  amazonAsins, 
  amazonMarketIntelligence, 
  amazonPriceHistory,
  productAsinMapping,
  products
} from '../../shared/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';

export interface AmazonSearchResult {
  success: boolean;
  method: string;
  asinsFound: number;
  asins: string[];
  message?: string;
  error?: string;
}

export interface ProfitabilityMetrics {
  estimatedMonthlySales: number;
  estimatedRevenue: number;
  profitMarginPercent: number;
  roiPercent: number;
  competitionLevel: 'low' | 'medium' | 'high';
  opportunityScore: number; // 1-100
}

/**
 * Comprehensive Amazon product search with UPC → MFG# fallback
 */
export async function searchAmazonProduct(productId: number): Promise<AmazonSearchResult> {
  // Get product details
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!product) {
    return { success: false, method: 'none', asinsFound: 0, asins: [], error: 'Product not found' };
  }

  // Check if we already have a lookup record
  let [lookupRecord] = await db
    .select()
    .from(productAmazonLookup)
    .where(eq(productAmazonLookup.productId, productId));

  if (!lookupRecord) {
    // Create new lookup record
    [lookupRecord] = await db
      .insert(productAmazonLookup)
      .values({
        productId,
        upc: product.upc,
        manufacturerPartNumber: product.manufacturerPartNumber,
        searchMethod: 'pending',
        searchStatus: 'pending'
      })
      .returning();
  }

  // Strategy 1: Search by UPC
  if (product.upc && (!lookupRecord.searchMethod || lookupRecord.searchMethod === 'pending')) {
    const upcResult = await searchByUPC(product.upc, lookupRecord.id);
    if (upcResult.success && upcResult.asinsFound > 0) {
      await updateLookupRecord(lookupRecord.id, 'upc', 'found', upcResult.asinsFound);
      return upcResult;
    }
    await updateLookupRecord(lookupRecord.id, 'upc', 'not_found', 0, 'mfg_number');
  }

  // Strategy 2: Search by Manufacturer Part Number
  if (product.manufacturerPartNumber && 
      (lookupRecord.nextSearchMethod === 'mfg_number' || 
       (!lookupRecord.searchMethod && !product.upc))) {
    
    const mfgResult = await searchByManufacturerPart(
      product.manufacturerPartNumber, 
      product.name || '',
      lookupRecord.id
    );
    
    if (mfgResult.success && mfgResult.asinsFound > 0) {
      await updateLookupRecord(lookupRecord.id, 'mfg_number', 'found', mfgResult.asinsFound);
      return mfgResult;
    }
    await updateLookupRecord(lookupRecord.id, 'mfg_number', 'not_found', 0, 'manual');
  }

  // Strategy 3: Intelligent keyword search combining product name + brand
  if (product.name) {
    const keywordResult = await searchByIntelligentKeywords(
      product.name,
      product.brand || '',
      lookupRecord.id
    );
    
    if (keywordResult.success && keywordResult.asinsFound > 0) {
      await updateLookupRecord(lookupRecord.id, 'keyword_intelligent', 'found', keywordResult.asinsFound);
      return keywordResult;
    }
    await updateLookupRecord(lookupRecord.id, 'keyword_intelligent', 'not_found', 0);
  }

  await updateLookupRecord(lookupRecord.id, 'exhausted', 'not_found', 0);
  return { 
    success: false, 
    method: 'exhausted', 
    asinsFound: 0, 
    asins: [], 
    message: 'No ASINs found using UPC, MFG#, or intelligent keyword search' 
  };
}

/**
 * Search Amazon by UPC
 */
async function searchByUPC(upc: string, lookupId: number): Promise<AmazonSearchResult> {
  try {
    const config = getAmazonConfig();
    await amazonRateLimiter.waitAndConsume();
    
    const catalogItems = await searchCatalogItemsByUPC(upc, config);
    
    if (catalogItems.length === 0) {
      return { success: false, method: 'upc', asinsFound: 0, asins: [] };
    }

    const asins = await processFoundASINs(catalogItems, 'upc');
    
    return {
      success: true,
      method: 'upc',
      asinsFound: asins.length,
      asins,
      message: `Found ${asins.length} ASINs using UPC ${upc}`
    };
  } catch (error) {
    console.error('UPC search error:', error);
    return { 
      success: false, 
      method: 'upc', 
      asinsFound: 0, 
      asins: [], 
      error: (error as Error).message 
    };
  }
}

/**
 * Search Amazon by Manufacturer Part Number
 */
async function searchByManufacturerPart(partNumber: string, productName: string, lookupId: number): Promise<AmazonSearchResult> {
  try {
    const config = getAmazonConfig();
    await amazonRateLimiter.waitAndConsume();
    
    // Try exact part number match first
    let catalogItems = await searchCatalogItemsByKeywords(`"${partNumber}"`, config);
    
    // If no results, try part number + product name
    if (catalogItems.length === 0 && productName) {
      await amazonRateLimiter.waitAndConsume();
      catalogItems = await searchCatalogItemsByKeywords(`"${partNumber}" ${productName}`, config);
    }
    
    if (catalogItems.length === 0) {
      return { success: false, method: 'mfg_number', asinsFound: 0, asins: [] };
    }

    const asins = await processFoundASINs(catalogItems, 'mfg_number');
    
    return {
      success: true,
      method: 'mfg_number',
      asinsFound: asins.length,
      asins,
      message: `Found ${asins.length} ASINs using MFG# ${partNumber}`
    };
  } catch (error) {
    console.error('MFG# search error:', error);
    return { 
      success: false, 
      method: 'mfg_number', 
      asinsFound: 0, 
      asins: [], 
      error: (error as Error).message 
    };
  }
}

/**
 * Intelligent keyword search using product name and brand
 */
async function searchByIntelligentKeywords(productName: string, brand: string, lookupId: number): Promise<AmazonSearchResult> {
  try {
    const config = getAmazonConfig();
    
    // Clean and optimize search terms
    const cleanName = productName
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    const searchQueries = [
      // Brand + product name
      brand ? `${brand} ${cleanName}` : cleanName,
      // Just the most important keywords
      cleanName.split(' ').slice(0, 4).join(' ')
    ].filter(Boolean);

    let allCatalogItems: any[] = [];
    
    for (const query of searchQueries) {
      await amazonRateLimiter.waitAndConsume();
      const items = await searchCatalogItemsByKeywords(query, config);
      allCatalogItems.push(...items);
      
      if (allCatalogItems.length >= 20) break; // Limit to prevent overwhelming results
    }
    
    // Remove duplicates by ASIN
    const uniqueItems = allCatalogItems.filter((item, index, self) => 
      index === self.findIndex(i => i.asin === item.asin)
    );
    
    if (uniqueItems.length === 0) {
      return { success: false, method: 'keyword_intelligent', asinsFound: 0, asins: [] };
    }

    const asins = await processFoundASINs(uniqueItems, 'keyword_intelligent');
    
    return {
      success: true,
      method: 'keyword_intelligent',
      asinsFound: asins.length,
      asins,
      message: `Found ${asins.length} ASINs using intelligent keyword search`
    };
  } catch (error) {
    console.error('Keyword search error:', error);
    return { 
      success: false, 
      method: 'keyword_intelligent', 
      asinsFound: 0, 
      asins: [], 
      error: (error as Error).message 
    };
  }
}

/**
 * Process found ASINs and save comprehensive data
 */
async function processFoundASINs(catalogItems: any[], searchMethod: string): Promise<string[]> {
  const processedAsins: string[] = [];
  
  for (const item of catalogItems) {
    try {
      // Save ASIN record
      const asinData = {
        asin: item.asin,
        title: item.itemName || '',
        brand: item.brand || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        partNumber: item.partNumber || '',
        upc: item.upc || null,
        ean: item.ean || null,
        category: item.productGroup || '',
        subcategory: item.productTypeName || '',
        browseNodes: item.browseNodes || [],
        categoryPath: item.categoryPath || '',
        productGroup: item.productGroup || '',
        productType: item.productTypeName || '',
        dimensions: item.itemDimensions || {},
        weight: item.packageWeight || '',
        color: item.color || '',
        size: item.size || '',
        primaryImageUrl: item.smallImage?.url || '',
        additionalImages: item.imageSet || [],
        features: item.features || [],
        description: item.editorialReviews?.[0]?.content || '',
        technicalDetails: item.itemAttributes || {},
        parentAsin: item.parentAsin || null,
        variationType: item.variationType || null,
        variationValue: item.variationValue || null,
        childAsins: item.variations || []
      };
      
      // Insert or update ASIN record
      await db
        .insert(amazonAsins)
        .values(asinData)
        .onConflictDoUpdate({
          target: amazonAsins.asin,
          set: {
            ...asinData,
            lastUpdatedAt: new Date(),
            updatedAt: new Date()
          }
        });

      // Save market intelligence data
      const intelligenceData = {
        asin: item.asin,
        currentPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
        listPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
        currencyCode: item.listPrice?.currencyCode || 'USD',
        salesRank: item.salesRank?.rank || null,
        categoryRank: item.salesRank?.productCategoryId ? item.salesRank.rank : null,
        rating: item.customerReviews?.averageRating ? item.customerReviews.averageRating : null,
        reviewCount: item.customerReviews?.totalReviewCount || 0,
        isPrime: item.isPrimeEligible || false,
        fulfillmentMethod: item.merchant?.name === 'Amazon.com' ? 'FBA' : 'FBM',
        inStock: item.availability !== 'OutOfStock',
        stockLevel: item.availability === 'InStock' ? 'high' : 'low'
      };

      await db
        .insert(amazonMarketIntelligence)
        .values(intelligenceData)
        .onConflictDoUpdate({
          target: amazonMarketIntelligence.asin,
          set: {
            ...intelligenceData,
            updatedAt: new Date()
          }
        });

      processedAsins.push(item.asin);
    } catch (error) {
      console.error(`Error processing ASIN ${item.asin}:`, error);
    }
  }
  
  return processedAsins;
}

/**
 * Update lookup record with search results
 */
async function updateLookupRecord(
  lookupId: number, 
  method: string, 
  status: string, 
  asinsFound: number, 
  nextMethod?: string
): Promise<void> {
  await db
    .update(productAmazonLookup)
    .set({
      searchMethod: method,
      searchStatus: status,
      asinsFound,
      nextSearchMethod: nextMethod || null,
      lastSearchAt: new Date(),
      shouldRetryAt: nextMethod ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // Retry in 24 hours
      updatedAt: new Date()
    })
    .where(eq(productAmazonLookup.id, lookupId));
}

/**
 * Link discovered ASINs to a product
 */
export async function linkASINsToProduct(
  productId: number, 
  asins: string[], 
  searchMethod: string,
  confidence: number = 0.8
): Promise<void> {
  for (const asin of asins) {
    try {
      await db
        .insert(productAsinMapping)
        .values({
          productId,
          asin,
          matchMethod: searchMethod,
          matchConfidence: confidence,
          isVerified: false,
          isDirectCompetitor: true
        })
        .onConflictDoNothing();
    } catch (error) {
      console.error(`Error linking ASIN ${asin} to product ${productId}:`, error);
    }
  }
}

/**
 * Calculate profitability metrics for an ASIN
 */
export async function calculateProfitabilityMetrics(
  asin: string, 
  ourCost: number, 
  ourPrice: number
): Promise<ProfitabilityMetrics> {
  const [intelligence] = await db
    .select()
    .from(amazonMarketIntelligence)
    .where(eq(amazonMarketIntelligence.asin, asin));

  if (!intelligence) {
    return {
      estimatedMonthlySales: 0,
      estimatedRevenue: 0,
      profitMarginPercent: 0,
      roiPercent: 0,
      competitionLevel: 'high',
      opportunityScore: 0
    };
  }

  // Estimate monthly sales based on BSR (simplified calculation)
  const estimatedMonthlySales = intelligence.salesRank ? 
    Math.max(1, Math.floor(1000000 / intelligence.salesRank)) : 0;
  
  const estimatedRevenue = estimatedMonthlySales * (ourPrice || 0);
  const profitMarginPercent = ourPrice ? ((ourPrice - ourCost) / ourPrice) * 100 : 0;
  const roiPercent = ourCost ? ((ourPrice - ourCost) / ourCost) * 100 : 0;
  
  // Determine competition level based on total sellers and price competitiveness
  let competitionLevel: 'low' | 'medium' | 'high' = 'medium';
  if (intelligence.totalSellers && intelligence.totalSellers < 5) {
    competitionLevel = 'low';
  } else if (intelligence.totalSellers && intelligence.totalSellers > 20) {
    competitionLevel = 'high';
  }
  
  // Calculate opportunity score (1-100)
  let opportunityScore = 50; // Base score
  
  // Adjust for profitability
  if (profitMarginPercent > 30) opportunityScore += 20;
  else if (profitMarginPercent > 15) opportunityScore += 10;
  else if (profitMarginPercent < 5) opportunityScore -= 20;
  
  // Adjust for sales volume
  if (estimatedMonthlySales > 100) opportunityScore += 15;
  else if (estimatedMonthlySales > 50) opportunityScore += 10;
  else if (estimatedMonthlySales < 10) opportunityScore -= 15;
  
  // Adjust for competition
  if (competitionLevel === 'low') opportunityScore += 15;
  else if (competitionLevel === 'high') opportunityScore -= 10;
  
  // Adjust for restrictions
  if (intelligence.isRestrictedBrand) opportunityScore -= 25;
  if (intelligence.hasGating) opportunityScore -= 15;
  if (intelligence.requiresApproval) opportunityScore -= 10;
  
  opportunityScore = Math.max(0, Math.min(100, opportunityScore));

  return {
    estimatedMonthlySales,
    estimatedRevenue,
    profitMarginPercent,
    roiPercent,
    competitionLevel,
    opportunityScore
  };
}

/**
 * Get comprehensive Amazon data for a product
 */
export async function getProductAmazonIntelligence(productId: number) {
  // Get all linked ASINs for this product
  const mappings = await db
    .select({
      asin: productAsinMapping.asin,
      matchMethod: productAsinMapping.matchMethod,
      matchConfidence: productAsinMapping.matchConfidence,
      isVerified: productAsinMapping.isVerified,
      asinData: amazonAsins,
      intelligence: amazonMarketIntelligence
    })
    .from(productAsinMapping)
    .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
    .leftJoin(amazonMarketIntelligence, eq(productAsinMapping.asin, amazonMarketIntelligence.asin))
    .where(eq(productAsinMapping.productId, productId));

  return mappings;
}

/**
 * Batch process multiple products for Amazon intelligence
 */
export async function batchProcessAmazonIntelligence(limit: number = 10): Promise<void> {
  // Get products that need Amazon intelligence
  const productsToProcess = await db
    .select()
    .from(products)
    .leftJoin(productAmazonLookup, eq(products.id, productAmazonLookup.productId))
    .where(
      or(
        isNull(productAmazonLookup.id),
        and(
          eq(productAmazonLookup.searchStatus, 'not_found'),
          lt(productAmazonLookup.shouldRetryAt, new Date())
        )
      )
    )
    .limit(limit);

  for (const { products: product } of productsToProcess) {
    try {
      console.log(`Processing Amazon intelligence for product ${product.id}: ${product.name}`);
      const result = await searchAmazonProduct(product.id);
      
      if (result.success && result.asins.length > 0) {
        await linkASINsToProduct(product.id, result.asins, result.method);
        console.log(`✓ Found ${result.asins.length} ASINs for product ${product.id}`);
      } else {
        console.log(`✗ No ASINs found for product ${product.id}`);
      }
      
      // Rate limiting between products
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing product ${product.id}:`, error);
    }
  }
}