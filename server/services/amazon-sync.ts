import { db } from '../db';
import { products, amazonAsins, amazonMarketIntelligence, productAsinMapping } from '../../shared/schema';
import { amazonSPAPI } from './amazon-sp-api';
import { eq, inArray, and, isNull, or, isNotNull, sql } from 'drizzle-orm';

interface ProductSyncResult {
  productId: string;
  asinsFound: number;
  asinsUpdated: number;
  errors: string[];
}

export class AmazonSyncService {
  private rateLimitDelay = 300; // 300ms between calls to respect Amazon rate limits

  async syncProductByUpcAndMfg(productId: string): Promise<ProductSyncResult> {
    const result: ProductSyncResult = {
      productId,
      asinsFound: 0,
      asinsUpdated: 0,
      errors: []
    };

    try {
      // Get product from database
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, parseInt(productId)));

      if (!product) {
        result.errors.push('Product not found');
        return result;
      }

      const foundAsins: string[] = [];

      // Search by UPC first
      if (product.upc) {
        try {
          console.log(`Searching Amazon for UPC: ${product.upc}`);
          const upcProducts = await amazonSPAPI.searchByUPC(product.upc);
          foundAsins.push(...upcProducts.map(p => p.asin));
          
          // Store ASIN data
          for (const amazonProduct of upcProducts) {
            await this.storeAsinData(amazonProduct);
          }
          
          await this.delay(this.rateLimitDelay);
        } catch (error) {
          result.errors.push(`UPC search failed: ${error}`);
        }
      }

      // Search by MFG# if no UPC results or as fallback
      if (product.manufacturerPartNumber && (foundAsins.length === 0 || product.upc)) {
        try {
          console.log(`Searching Amazon for MFG#: ${product.manufacturerPartNumber}`);
          // Using catalog search as manufacturer-specific search isn't available in current API
          const mfgProducts = await amazonSPAPI.searchByUPC(product.manufacturerPartNumber);
          const newAsins = mfgProducts.filter(p => !foundAsins.includes(p.asin));
          foundAsins.push(...newAsins.map(p => p.asin));
          
          // Store ASIN data
          for (const amazonProduct of mfgProducts) {
            await this.storeAsinData(amazonProduct);
          }
          
          await this.delay(this.rateLimitDelay);
        } catch (error) {
          result.errors.push(`MFG# search failed: ${error}`);
        }
      }

      result.asinsFound = foundAsins.length;

      if (foundAsins.length > 0) {
        // Create product-ASIN mappings
        for (const asin of foundAsins) {
          await db
            .insert(productAsinMapping)
            .values({
              productId: product.id,
              asin,
              mappingSource: product.upc && foundAsins.includes(asin) ? 'upc' : 'mfg_number',
              isActive: true
            })
            .onConflictDoNothing();
        }

        // Fetch comprehensive market data for all ASINs
        result.asinsUpdated = await this.syncMarketDataForAsins(foundAsins);
      }

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
    }

    return result;
  }

  private async storeAsinData(amazonProduct: any): Promise<void> {
    try {
      await db
        .insert(amazonAsins)
        .values({
          asin: amazonProduct.asin,
          title: amazonProduct.title || '',
          brand: amazonProduct.brand || null,
          manufacturer: amazonProduct.manufacturer || null,
          primaryImageUrl: amazonProduct.imageUrl || null,
          dataFetchedAt: new Date(),
          lastUpdatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: amazonAsins.asin,
          set: {
            title: amazonProduct.title || '',
            brand: amazonProduct.brand || null,
            manufacturer: amazonProduct.manufacturer || null,
            primaryImageUrl: amazonProduct.imageUrl || null,
            lastUpdatedAt: new Date(),
            updatedAt: new Date()
          }
        });
      
      console.log(`✅ Stored ASIN data for ${amazonProduct.asin}`);
    } catch (error) {
      console.error(`❌ Failed to store ASIN data for ${amazonProduct.asin}:`, error);
      throw error;
    }
  }

  private async syncMarketDataForAsins(asins: string[]): Promise<number> {
    let updatedCount = 0;

    try {
      // Get pricing data for all ASINs
      console.log(`Fetching pricing for ${asins.length} ASINs`);
      // Get pricing data for each ASIN individually due to API limitations
      const pricingData = [];
      for (const asin of asins) {
        const pricing = await amazonSPAPI.getPricing(asin);
        if (pricing.success) {
          pricingData.push({ asin, price: pricing.price, offers: pricing.offers });
        }
        await this.delay(this.rateLimitDelay);
      }
      await this.delay(this.rateLimitDelay);

      // Get ranking data for all ASINs
      console.log(`Fetching rankings for ${asins.length} ASINs`);
      // Ranking data would require additional API endpoints not currently implemented
      const rankingData = [];

      // Combine pricing and ranking data
      for (const asin of asins) {
        const pricing = pricingData.find(p => p.asin === asin);
        const ranking = rankingData.find((r: any) => r.asin === asin);

        if (pricing || ranking) {
          await db
            .insert(amazonMarketIntelligence)
            .values({
              asin,
              currentPrice: pricing?.currentPrice,
              listPrice: pricing?.listPrice,
              currencyCode: pricing?.currencyCode || 'USD',
              salesRank: ranking?.salesRank,
              categoryRank: ranking?.categoryRank,
              inStock: pricing?.availability !== 'OutOfStock',
              fulfillmentMethod: pricing?.fulfillmentChannel,
              isPrime: pricing?.isPrime || false,
              dataFetchedAt: new Date(),
              lastPriceCheck: new Date(),
              lastRankCheck: new Date()
            })
            .onConflictDoUpdate({
              target: amazonMarketIntelligence.asin,
              set: {
                currentPrice: pricing?.currentPrice,
                listPrice: pricing?.listPrice,
                salesRank: ranking?.salesRank,
                categoryRank: ranking?.categoryRank,
                inStock: pricing?.availability !== 'OutOfStock',
                fulfillmentMethod: pricing?.fulfillmentChannel,
                isPrime: pricing?.isPrime || false,
                dataFetchedAt: new Date(),
                lastPriceCheck: new Date(),
                lastRankCheck: new Date(),
                updatedAt: new Date()
              }
            });

          updatedCount++;
        }
      }

    } catch (error) {
      console.error('Market data sync failed:', error);
    }

    return updatedCount;
  }

  async syncAllProductsWithoutAsins(limit: number = 10): Promise<ProductSyncResult[]> {
    // Get products with UPC or MFG# that don't have ASIN mappings
    const allProducts = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        upc: products.upc,
        manufacturerPartNumber: products.manufacturerPartNumber
      })
      .from(products)
      .where(
        or(
          isNotNull(products.upc),
          isNotNull(products.manufacturerPartNumber)
        )
      )
      .limit(limit * 2);

    // Check which products already have ASIN mappings
    const existingMappings = await db
      .select({ productId: productAsinMapping.productId })
      .from(productAsinMapping)
      .where(inArray(productAsinMapping.productId, allProducts.map(p => p.id)));

    const mappedProductIds = new Set(existingMappings.map(m => m.productId));
    const productsWithoutAsins = allProducts
      .filter(p => !mappedProductIds.has(p.id))
      .slice(0, limit);

    console.log(`Found ${productsWithoutAsins.length} products without ASIN mappings`);

    const results: ProductSyncResult[] = [];
    
    for (const product of productsWithoutAsins) {
      console.log(`Syncing product: ${product.sku} - ${product.name}`);
      const result = await this.syncProductByUpcAndMfg(product.id.toString());
      results.push(result);
      
      // Rate limiting between products
      await this.delay(this.rateLimitDelay * 2);
    }

    return results;
  }

  async refreshMarketDataForExistingAsins(limit: number = 50): Promise<number> {
    // Get ASINs that haven't been updated recently
    const staleAsins = await db
      .select({ asin: amazonMarketIntelligence.asin })
      .from(amazonMarketIntelligence)
      .where(
        or(
          isNull(amazonMarketIntelligence.lastPriceCheck),
          // More than 24 hours old
          eq(amazonMarketIntelligence.lastPriceCheck, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .limit(limit);

    if (staleAsins.length === 0) {
      return 0;
    }

    console.log(`Refreshing market data for ${staleAsins.length} ASINs`);
    
    const asinList = staleAsins.map(a => a.asin);
    return await this.syncMarketDataForAsins(asinList);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isAmazonConfigured(): boolean {
    return amazonService.isConfigured();
  }
}

export const amazonSyncService = new AmazonSyncService();