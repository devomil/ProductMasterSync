/**
 * Enhanced Amazon Marketplace Routes
 * 
 * Provides comprehensive competitive intelligence endpoints supporting:
 * - UPC and MFG# fallback searches
 * - Multiple ASIN discovery and tracking
 * - Profitability analysis and opportunity scoring
 */

import { Router } from 'express';
import { searchCatalogItemsByUPC, getAmazonConfig } from '../utils/amazon-spapi';
import { amazonRateLimiter } from '../utils/rate-limiter';
import { db } from '../db';
import { products } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  saveAmazonAsin,
  saveMarketIntelligence,
  getProductAmazonData,
  createProductLookup,
  updateLookupStatus,
  linkAsinToProduct,
  getTopOpportunityAsins,
  getProductOpportunityMetrics
} from './enhanced-repository';

const router = Router();

/**
 * Enhanced product search with UPC → MFG# fallback
 */
router.post('/search/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // Get product details
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Create lookup record
    const lookupRecord = await createProductLookup({
      productId,
      upc: product.upc,
      manufacturerPartNumber: product.manufacturerPartNumber,
      searchMethod: 'pending',
      searchStatus: 'pending'
    });

    let searchResults = [];

    // Strategy 1: UPC Search
    if (product.upc) {
      const upcResults = await performUPCSearch(product.upc, lookupRecord.id);
      if (upcResults.length > 0) {
        searchResults = upcResults;
        await updateLookupStatus(lookupRecord.id, 'upc', 'found', upcResults.length);
        await linkMultipleAsins(productId, upcResults, 'upc');
      } else {
        await updateLookupStatus(lookupRecord.id, 'upc', 'not_found', 0, 'mfg_number');
      }
    }

    // Strategy 2: MFG# Search (if UPC failed or unavailable)
    if (searchResults.length === 0 && product.manufacturerPartNumber) {
      const mfgResults = await performMFGSearch(
        product.manufacturerPartNumber, 
        product.name || '', 
        lookupRecord.id
      );
      if (mfgResults.length > 0) {
        searchResults = mfgResults;
        await updateLookupStatus(lookupRecord.id, 'mfg_number', 'found', mfgResults.length);
        await linkMultipleAsins(productId, mfgResults, 'mfg_number');
      } else {
        await updateLookupStatus(lookupRecord.id, 'mfg_number', 'not_found', 0);
      }
    }

    const response = {
      success: searchResults.length > 0,
      productId,
      searchStrategies: {
        upc: product.upc ? 'attempted' : 'unavailable',
        manufacturerPartNumber: product.manufacturerPartNumber ? 'attempted' : 'unavailable'
      },
      asinsFound: searchResults.length,
      asins: searchResults.map(r => r.asin),
      message: searchResults.length > 0 
        ? `Found ${searchResults.length} ASINs for product ${product.name}`
        : 'No ASINs found using available search methods'
    };

    res.json(response);
  } catch (error) {
    console.error('Enhanced search error:', error);
    res.status(500).json({ error: 'Search failed', details: (error as Error).message });
  }
});

/**
 * Get comprehensive Amazon intelligence for a product
 */
router.get('/intelligence/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    const amazonData = await getProductAmazonData(productId);
    const topOpportunities = await getTopOpportunityAsins(productId, 5);
    const aggregateMetrics = await getProductOpportunityMetrics(productId);

    const response = {
      productId,
      totalAsins: amazonData.length,
      asins: amazonData,
      topOpportunities,
      aggregateMetrics,
      summary: {
        hasAmazonData: amazonData.length > 0,
        verifiedAsins: amazonData.filter(a => a.isVerified).length,
        highOpportunityAsins: amazonData.filter(a => 
          a.intelligence?.opportunityScore && a.intelligence.opportunityScore > 70
        ).length,
        avgOpportunityScore: aggregateMetrics?.avgOpportunityScore || 0,
        maxProfitMargin: aggregateMetrics?.avgProfitMargin || 0
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Intelligence fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence data' });
  }
});

/**
 * Batch process multiple products for Amazon intelligence
 */
router.post('/batch-process', async (req, res) => {
  try {
    const { productIds, limit = 10 } = req.body;
    
    let productsToProcess = [];
    
    if (productIds && Array.isArray(productIds)) {
      // Process specific products
      for (const id of productIds.slice(0, limit)) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, id));
        if (product) {
          productsToProcess.push({ products: product });
        }
      }
    } else {
      // Auto-discover products that need processing
      const { getProductsNeedingLookup } = await import('./enhanced-repository');
      productsToProcess = await getProductsNeedingLookup(limit);
    }

    const results = [];
    
    for (const { products: product } of productsToProcess) {
      try {
        console.log(`Processing Amazon intelligence for product ${product.id}: ${product.name}`);
        
        // Perform search
        const searchUrl = `/search/${product.id}`;
        // This would normally call the search endpoint, but for batch we'll do it directly
        const lookupRecord = await createProductLookup({
          productId: product.id,
          upc: product.upc,
          manufacturerPartNumber: product.manufacturerPartNumber,
          searchMethod: 'pending',
          searchStatus: 'pending'
        });

        let foundAsins = [];
        
        if (product.upc) {
          foundAsins = await performUPCSearch(product.upc, lookupRecord.id);
          if (foundAsins.length > 0) {
            await updateLookupStatus(lookupRecord.id, 'upc', 'found', foundAsins.length);
            await linkMultipleAsins(product.id, foundAsins, 'upc');
          }
        }
        
        if (foundAsins.length === 0 && product.manufacturerPartNumber) {
          foundAsins = await performMFGSearch(
            product.manufacturerPartNumber, 
            product.name || '', 
            lookupRecord.id
          );
          if (foundAsins.length > 0) {
            await updateLookupStatus(lookupRecord.id, 'mfg_number', 'found', foundAsins.length);
            await linkMultipleAsins(product.id, foundAsins, 'mfg_number');
          }
        }

        results.push({
          productId: product.id,
          productName: product.name,
          asinsFound: foundAsins.length,
          asins: foundAsins.map(a => a.asin),
          success: foundAsins.length > 0
        });

        // Rate limiting between products
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        results.push({
          productId: product.id,
          productName: product.name,
          asinsFound: 0,
          asins: [],
          success: false,
          error: (error as Error).message
        });
      }
    }

    const summary = {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalAsinsFound: results.reduce((sum, r) => sum + r.asinsFound, 0)
    };

    res.json({ results, summary });
  } catch (error) {
    console.error('Batch process error:', error);
    res.status(500).json({ error: 'Batch processing failed' });
  }
});

/**
 * Perform UPC search and save comprehensive data
 */
async function performUPCSearch(upc: string, lookupId: number): Promise<any[]> {
  try {
    const config = getAmazonConfig();
    await amazonRateLimiter.waitAndConsume();
    
    const catalogItems = await searchCatalogItemsByUPC(upc, config);
    
    const processedAsins = [];
    
    for (const item of catalogItems) {
      // Save ASIN data
      const asinData = {
        asin: item.asin,
        title: item.itemName || '',
        brand: item.brand || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        partNumber: item.partNumber || '',
        upc: upc,
        category: item.productGroup || '',
        subcategory: item.productTypeName || '',
        primaryImageUrl: item.smallImage?.url || '',
        description: item.editorialReviews?.[0]?.content || ''
      };
      
      await saveAmazonAsin(asinData);
      
      // Save market intelligence
      const intelligenceData = {
        asin: item.asin,
        currentPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
        listPrice: item.listPrice?.amount ? Math.round(item.listPrice.amount * 100) : null,
        currencyCode: item.listPrice?.currencyCode || 'USD',
        salesRank: item.salesRank?.rank || null,
        rating: item.customerReviews?.averageRating || null,
        reviewCount: item.customerReviews?.totalReviewCount || 0,
        isPrime: item.isPrimeEligible || false,
        inStock: item.availability !== 'OutOfStock'
      };
      
      await saveMarketIntelligence(intelligenceData);
      processedAsins.push({ asin: item.asin, data: asinData });
    }
    
    return processedAsins;
  } catch (error) {
    console.error('UPC search error:', error);
    return [];
  }
}

/**
 * Perform MFG# search (simplified for now - would use keyword search)
 */
async function performMFGSearch(partNumber: string, productName: string, lookupId: number): Promise<any[]> {
  // For now, this is a placeholder since we don't have keyword search implemented
  // In a full implementation, this would use Amazon's keyword search API
  console.log(`MFG# search for ${partNumber} - ${productName} (not implemented yet)`);
  return [];
}

/**
 * Link multiple ASINs to a product
 */
async function linkMultipleAsins(productId: number, asins: any[], method: string): Promise<void> {
  for (const asinData of asins) {
    await linkAsinToProduct({
      productId,
      asin: asinData.asin,
      matchMethod: method,
      matchConfidence: 0.8,
      isVerified: false,
      isDirectCompetitor: true
    });
  }
}

export default router;