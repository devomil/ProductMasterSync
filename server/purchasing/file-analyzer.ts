import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { fileUploads, fileAnalysisResults, purchasingSettings, amazonMarketIntelligence, amazonAsins } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { searchCatalogItemsByUPC, getCompetitivePricing, getListingRestrictions } from '../utils/amazon-spapi';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';
import { getProductFees } from '../services/amazon-product-fees';
import { saveAmazonMarketData } from '../marketplace/repository';

// Rate limiting helper - adds delay between API calls
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface CSVRow {
  ASIN?: string;
  UPC?: string;
  Description?: string;
  DESCRIPTION?: string;
  'Item Description'?: string;
  Brand?: string;
  'BRAND NAME'?: string;
  Manufacturer?: string;
  Model?: string;
  'Item #'?: string;
  Color?: string;
  Qty?: string;
  AVAILABLE?: string;
  'Retail Price'?: string;
  'Unit Retail'?: string;
  PRICE?: string;
  Condition?: string;
  Category?: string;
  'Seller Category'?: string;
  'Image URL'?: string;
  Packaging?: string;
  MPN?: string;
  'Manufacturer Part Number'?: string;
  Keywords?: string;
}

interface ParsedProduct {
  asin: string;
  upc?: string;
  mpn?: string;
  description?: string;
  brand?: string;
  model?: string;
  color?: string;
  quantity?: number;
  supplierPrice?: number;
  category?: string;
  condition?: string;
  imageUrl?: string;
  itemNumber?: string;
  keywords?: string;
}

interface MarketData {
  buyBoxPrice: number | null;
  amazonPrice: number | null;
  lowestFbaPrice: number | null;
  lowestFbmPrice: number | null;
  estimatedFees: number | null;
  isRestricted: boolean;
  restrictionReasons: string[];
}

async function ensureAsinExists(asin: string): Promise<void> {
  // Check if ASIN already exists
  const [existing] = await db.select().from(amazonAsins).where(eq(amazonAsins.asin, asin)).limit(1);
  
  if (!existing) {
    // Create minimal ASIN record
    await db.insert(amazonAsins).values({
      asin,
      marketplace: 'amazon.com',
      isActive: true,
    }).onConflictDoNothing();
    console.log(`[File Analyzer] Created ASIN record for ${asin}`);
  }
}

async function fetchAndPersistMarketData(asin: string): Promise<void> {
  try {
    console.log(`[File Analyzer] Fetching Amazon market data for ASIN ${asin}...`);
    
    // Ensure ASIN exists in database first (required for foreign key constraint)
    await ensureAsinExists(asin);
    
    // Fetch competitive pricing
    const pricingData = await getCompetitivePricing([asin]);
    const pricing = pricingData[0];
    
    let buyBoxPrice: number | null = null;
    let currentPrice: number | null = null;
    
    if (pricing?.Product?.CompetitivePricing?.CompetitivePrices) {
      const competitivePrices = pricing.Product.CompetitivePricing.CompetitivePrices;
      
      // Find the buy box price (CompetitivePriceId "1" is usually buy box)
      const buyBoxOffer = competitivePrices.find((cp: any) => cp.CompetitivePriceId === "1");
      if (buyBoxOffer?.Price?.ListingPrice?.Amount) {
        buyBoxPrice = Math.round(parseFloat(buyBoxOffer.Price.ListingPrice.Amount) * 100);
        currentPrice = buyBoxPrice; // Use buy box as current price
        console.log(`[File Analyzer] Found buy box price for ${asin}: $${buyBoxOffer.Price.ListingPrice.Amount}`);
      }
      
      // If no buy box, try to find any competitive price
      if (!buyBoxPrice && competitivePrices.length > 0) {
        const firstPrice = competitivePrices[0]?.Price?.ListingPrice?.Amount;
        if (firstPrice) {
          currentPrice = Math.round(parseFloat(firstPrice) * 100);
          console.log(`[File Analyzer] Found competitive price for ${asin}: $${firstPrice}`);
        }
      }
    }
    
    if (!buyBoxPrice && !currentPrice) {
      console.log(`[File Analyzer] No pricing data available for ASIN ${asin}`);
    }
    
    // Rate limiting: wait 2 seconds between pricing and fees API calls
    await sleep(2000);
    
    // Fetch fees if we have a price
    let totalFees: number | null = null;
    let referralFee: number | null = null;
    let fbaFee: number | null = null;
    
    if (buyBoxPrice && buyBoxPrice > 0) {
      try {
        const feesData = await getProductFees({
          asin,
          price: buyBoxPrice / 100, // Convert cents to dollars
          isAmazonFulfilled: true, // Assume FBA for fees calculation
        });
        
        if (feesData) {
          totalFees = feesData.totalFees ? Math.round(feesData.totalFees * 100) : null;
          referralFee = feesData.referralFee ? Math.round(feesData.referralFee * 100) : null;
          fbaFee = feesData.fbaFee ? Math.round(feesData.fbaFee * 100) : null;
        }
      } catch (error) {
        console.log(`[File Analyzer] Could not fetch fees for ASIN ${asin}:`, error);
      }
    }
    
    // Rate limiting: wait 2 seconds between fees and restrictions API calls
    await sleep(2000);
    
    // Fetch listing restrictions
    let canList: boolean | null = null;
    let listingRestrictions: string[] = [];
    
    try {
      const restrictions = await getListingRestrictions(asin);
      canList = restrictions.canList;
      listingRestrictions = restrictions.messages || [];
    } catch (error) {
      console.log(`[File Analyzer] Could not fetch restrictions for ASIN ${asin}:`, error);
    }
    
    // Save to database
    await saveAmazonMarketData({
      asin,
      buyBoxPrice,
      currentPrice,
      totalFees,
      referralFee,
      fbaFee,
      canList,
      listingRestrictions: listingRestrictions.length > 0 ? listingRestrictions : null,
      lastFeeCheck: new Date(),
    });
    
    console.log(`[File Analyzer] Saved market data for ASIN ${asin}`);
  } catch (error) {
    console.error(`[File Analyzer] Error fetching market data for ASIN ${asin}:`, error);
    throw error;
  }
}

async function getMarketDataForAsin(asin: string): Promise<MarketData> {
  // Check cache first
  const [cached] = await db
    .select()
    .from(amazonMarketIntelligence)
    .where(eq(amazonMarketIntelligence.asin, asin))
    .limit(1);

  if (cached) {
    const buyBoxPrice = cached.buyBoxPrice ? cached.buyBoxPrice / 100 : null;
    const amazonPrice = cached.currentPrice ? cached.currentPrice / 100 : null;
    const estimatedFees = cached.totalFees ? cached.totalFees / 100 : null;

    return {
      buyBoxPrice,
      amazonPrice,
      lowestFbaPrice: null,
      lowestFbmPrice: null,
      estimatedFees,
      isRestricted: cached.canList === false,
      restrictionReasons: Array.isArray(cached.listingRestrictions) ? cached.listingRestrictions : [],
    };
  }

  // NOT cached - fetch from Amazon APIs
  try {
    await fetchAndPersistMarketData(asin);
    
    // Now fetch from cache
    const [freshData] = await db
      .select()
      .from(amazonMarketIntelligence)
      .where(eq(amazonMarketIntelligence.asin, asin))
      .limit(1);
    
    if (freshData) {
      const buyBoxPrice = freshData.buyBoxPrice ? freshData.buyBoxPrice / 100 : null;
      const amazonPrice = freshData.currentPrice ? freshData.currentPrice / 100 : null;
      const estimatedFees = freshData.totalFees ? freshData.totalFees / 100 : null;

      return {
        buyBoxPrice,
        amazonPrice,
        lowestFbaPrice: null,
        lowestFbmPrice: null,
        estimatedFees,
        isRestricted: freshData.canList === false,
        restrictionReasons: Array.isArray(freshData.listingRestrictions) ? freshData.listingRestrictions : [],
      };
    }
  } catch (error) {
    console.error(`[File Analyzer] Failed to fetch market data for ASIN ${asin}:`, error);
  }

  // Fallback to nulls if fetch failed
  return {
    buyBoxPrice: null,
    amazonPrice: null,
    lowestFbaPrice: null,
    lowestFbmPrice: null,
    estimatedFees: null,
    isRestricted: false,
    restrictionReasons: [],
  };
}

export async function parseCSVFile(fileContent: string): Promise<ParsedProduct[]> {
  try {
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as CSVRow[];

    const products: ParsedProduct[] = [];

    for (const row of records) {
      const asin = row.ASIN?.trim();
      
      let upc: string | undefined;
      if (row.UPC) {
        const upcValue = row.UPC.trim();
        if (upcValue.includes('E') || upcValue.includes('e')) {
          const numericUpc = Number(upcValue);
          if (!isNaN(numericUpc)) {
            upc = Math.floor(numericUpc).toString().padStart(12, '0');
          }
        } else {
          const cleanUpc = upcValue.replace(/[^0-9]/g, '');
          if (cleanUpc.length > 0) {
            upc = cleanUpc.padStart(12, '0');
          }
        }
      }

      const mpn = row.MPN?.trim() || row['Manufacturer Part Number']?.trim() || row['Item #']?.trim();
      
      if ((!asin || asin === '') && (!upc || upc === '') && (!mpn || mpn === '')) {
        continue;
      }

      const description = row.Description?.trim() || row.DESCRIPTION?.trim() || row['Item Description']?.trim();
      const brand = row.Brand?.trim() || row['BRAND NAME']?.trim() || row.Manufacturer?.trim();
      const category = row.Category?.trim() || row['Seller Category']?.trim();
      const condition = row.Condition?.trim();
      const imageUrl = row['Image URL']?.trim();

      let supplierPrice: number | undefined;
      const priceStr = row['Retail Price'] || row['Unit Retail'] || row.PRICE;
      if (priceStr) {
        const cleanPrice = priceStr.replace(/[$,\s]/g, '');
        const parsed = parseFloat(cleanPrice);
        if (!isNaN(parsed) && parsed > 0) {
          supplierPrice = parsed;
        }
      }

      let quantity: number | undefined;
      const qtyStr = row.Qty || row.AVAILABLE;
      if (qtyStr) {
        const cleanQty = qtyStr.replace(/[,\s]/g, '');
        const parsed = parseInt(cleanQty, 10);
        if (!isNaN(parsed) && parsed > 0) {
          quantity = parsed;
        }
      }

      products.push({
        asin: asin || '',
        upc,
        mpn,
        description,
        brand,
        model: row.Model?.trim(),
        color: row.Color?.trim(),
        quantity,
        supplierPrice,
        category,
        condition,
        imageUrl,
        itemNumber: row['Item #']?.trim(),
        keywords: row.Keywords?.trim(),
      });
    }

    return products;
  } catch (error) {
    console.error('[File Analyzer] CSV parsing error:', error);
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function convertUpcToAsin(upc: string): Promise<string | null> {
  try {
    console.log(`[File Analyzer] Converting UPC ${upc} to ASIN...`);
    const config = await getAmazonConfigFromDb();
    
    // Ensure config has required fields
    if (!config.marketplaceId) {
      console.error('[File Analyzer] Amazon marketplace ID not configured');
      return null;
    }
    
    const items = await searchCatalogItemsByUPC(upc, {
      ...config,
      marketplaceId: config.marketplaceId,
      endpoint: config.endpoint || 'https://sellingpartnerapi-na.amazon.com'
    });
    
    if (items && items.length > 0) {
      const asin = items[0].asin;
      console.log(`[File Analyzer] UPC ${upc} → ASIN ${asin}`);
      return asin;
    }
    
    console.log(`[File Analyzer] No ASIN found for UPC ${upc}`);
    return null;
  } catch (error) {
    console.error(`[File Analyzer] Error converting UPC ${upc}:`, error);
    return null;
  }
}

export async function analyzeUploadedFile(uploadId: number): Promise<void> {
  try {
    const [upload] = await db.select().from(fileUploads).where(eq(fileUploads.id, uploadId));
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    console.log(`[File Analyzer] Starting analysis for upload ${uploadId}`);

    const [settings] = await db.select().from(purchasingSettings).limit(1);
    const dropshipThreshold = upload.dropshipThreshold ?? settings?.dropshipMinMargin ?? 12.0;
    const warehouseThreshold = upload.warehouseThreshold ?? settings?.warehouseMinMargin ?? 25.0;

    const results = await db.select().from(fileAnalysisResults).where(eq(fileAnalysisResults.uploadId, uploadId));

    let processed = 0;
    let successCount = 0;
    let failedCount = 0;
    let opportunitiesFound = 0;

    console.log(`[File Analyzer] Analyzing ${results.length} products...`);

    for (const result of results) {
      try {
        // Convert UPC to ASIN if ASIN is not provided
        let asin = result.asin;
        if ((!asin || asin === '') && result.upc) {
          asin = await convertUpcToAsin(result.upc);
          if (!asin) {
            throw new Error(`Could not find ASIN for UPC ${result.upc}`);
          }
          
          // Update the result with the found ASIN
          await db
            .update(fileAnalysisResults)
            .set({ asin })
            .where(eq(fileAnalysisResults.id, result.id));
        }

        if (!asin) {
          throw new Error('No ASIN or UPC provided');
        }

        const marketData = await getMarketDataForAsin(asin);

        let dropshipMargin: number | null = null;
        let warehouseMargin: number | null = null;
        let isOpportunity = false;
        let opportunityType: string | null = null;

        if (result.supplierPrice) {
          const supplierCost = result.supplierPrice;
          const buyBoxPrice = marketData.buyBoxPrice ?? marketData.amazonPrice ?? marketData.lowestFbaPrice;

          if (buyBoxPrice && buyBoxPrice > 0) {
            const fees = marketData.estimatedFees ?? buyBoxPrice * 0.15;

            // DROPSHIP: ZERO shipping cost (supplier ships directly to customer)
            const dropshipShipping = 0;
            dropshipMargin = ((buyBoxPrice - supplierCost - fees - dropshipShipping) / buyBoxPrice) * 100;

            // WAREHOUSE: Shipping cost to get product to our warehouse
            // Default to $10 for now (can be customized per supplier later)
            const warehouseShipping = 10;
            warehouseMargin = ((buyBoxPrice - supplierCost - fees - warehouseShipping) / buyBoxPrice) * 100;

            // Determine opportunity type based on thresholds
            if (dropshipMargin >= dropshipThreshold && warehouseMargin >= warehouseThreshold) {
              opportunityType = 'both';
              isOpportunity = true;
            } else if (warehouseMargin >= warehouseThreshold) {
              opportunityType = 'warehouse';
              isOpportunity = true;
            } else if (dropshipMargin >= dropshipThreshold) {
              opportunityType = 'dropship';
              isOpportunity = true;
            }

            if (isOpportunity) {
              opportunitiesFound++;
            }
          }
        }

        await db
          .update(fileAnalysisResults)
          .set({
            buyBoxPrice: marketData.buyBoxPrice,
            amazonPrice: marketData.amazonPrice,
            lowestFbaPrice: marketData.lowestFbaPrice,
            lowestFbmPrice: marketData.lowestFbmPrice,
            estimatedFees: marketData.estimatedFees,
            isRestricted: marketData.isRestricted,
            restrictionReasons: marketData.restrictionReasons,
            dropshipMargin,
            warehouseMargin,
            isOpportunity,
            opportunityType,
            confidenceScore: marketData.buyBoxPrice ? 85.0 : 0.0,
            errorMessage: null,
          })
          .where(eq(fileAnalysisResults.id, result.id));

        successCount++;
      } catch (error) {
        console.error(`[File Analyzer] Error analyzing ASIN ${result.asin}:`, error);
        
        await db
          .update(fileAnalysisResults)
          .set({
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(fileAnalysisResults.id, result.id));

        failedCount++;
      }

      processed++;

      await db
        .update(fileUploads)
        .set({
          processedRows: processed,
          successRows: successCount,
          failedRows: failedCount,
          opportunitiesFound,
        })
        .where(eq(fileUploads.id, uploadId));

      if (processed % 10 === 0) {
        console.log(`[File Analyzer] Progress: ${processed}/${results.length} (${Math.round(processed / results.length * 100)}%)`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await db
      .update(fileUploads)
      .set({
        status: 'completed',
        completedAt: new Date(),
        analysisResults: {
          totalRows: results.length,
          successRows: successCount,
          failedRows: failedCount,
          opportunitiesFound,
          avgMargin: 0,
        },
      })
      .where(eq(fileUploads.id, uploadId));

    console.log(`[File Analyzer] Completed analysis for upload ${uploadId}: ${opportunitiesFound} opportunities found`);
  } catch (error) {
    console.error(`[File Analyzer] Fatal error analyzing upload ${uploadId}:`, error);
    
    await db
      .update(fileUploads)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(fileUploads.id, uploadId));
  }
}
