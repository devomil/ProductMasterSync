import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { fileUploads, fileAnalysisResults, purchasingSettings, amazonMarketIntelligence } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { searchCatalogItemsByUPC } from '../utils/amazon-spapi';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';

interface CSVRow {
  ASIN?: string;
  UPC?: string;
  Description?: string;
  DESCRIPTION?: string;
  Brand?: string;
  'BRAND NAME'?: string;
  Model?: string;
  Color?: string;
  Qty?: string;
  AVAILABLE?: string;
  'Retail Price'?: string;
  PRICE?: string;
}

interface ParsedProduct {
  asin: string;
  upc?: string;
  description?: string;
  brand?: string;
  model?: string;
  color?: string;
  quantity?: number;
  supplierPrice?: number;
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

async function getMarketDataForAsin(asin: string): Promise<MarketData> {
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
      // Extract ASIN or UPC - at least one must be present
      const asin = row.ASIN?.trim();
      
      // Normalize UPC - handle scientific notation (e.g., 6.97068E+12) and ensure 12-digit format
      let upc: string | undefined;
      if (row.UPC) {
        const upcValue = row.UPC.trim();
        
        // Check if it's in scientific notation
        if (upcValue.includes('E') || upcValue.includes('e')) {
          // Parse scientific notation to number, then convert to string
          const numericUpc = Number(upcValue);
          if (!isNaN(numericUpc)) {
            // Convert to string and pad to 12 digits (UPC-A standard)
            upc = Math.floor(numericUpc).toString().padStart(12, '0');
          }
        } else {
          // Regular UPC - remove any non-digits and pad to 12 digits
          const cleanUpc = upcValue.replace(/[^0-9]/g, '');
          if (cleanUpc.length > 0) {
            upc = cleanUpc.padStart(12, '0');
          }
        }
      }
      
      if ((!asin || asin === '') && (!upc || upc === '')) {
        continue;
      }

      // Extract description - support multiple column name formats
      const description = row.Description?.trim() || row.DESCRIPTION?.trim();
      
      // Extract brand - support multiple column name formats
      const brand = row.Brand?.trim() || row['BRAND NAME']?.trim();

      // Parse retail price - handle multiple column names and formats
      let supplierPrice: number | undefined;
      const priceStr = row['Retail Price'] || row.PRICE;
      if (priceStr) {
        const cleanPrice = priceStr.replace(/[$,\s]/g, '');
        const parsed = parseFloat(cleanPrice);
        if (!isNaN(parsed) && parsed > 0) {
          supplierPrice = parsed;
        }
      }

      // Parse quantity - support multiple column names
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
        asin: asin || '',  // Will be populated from UPC lookup if empty
        upc,
        description,
        brand,
        model: row.Model?.trim(),
        color: row.Color?.trim(),
        quantity,
        supplierPrice,
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

        if (result.supplierPrice && marketData.buyBoxPrice) {
          const supplierCost = result.supplierPrice;
          const buyBoxPrice = marketData.buyBoxPrice ?? marketData.amazonPrice ?? marketData.lowestFbaPrice;

          if (buyBoxPrice && buyBoxPrice > 0) {
            const fees = marketData.estimatedFees ?? buyBoxPrice * 0.15;

            dropshipMargin = ((buyBoxPrice - supplierCost - fees) / buyBoxPrice) * 100;
            warehouseMargin = ((buyBoxPrice - supplierCost - fees) / buyBoxPrice) * 100;

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
