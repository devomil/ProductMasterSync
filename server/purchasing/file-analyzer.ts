import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { fileUploads, fileAnalysisResults, purchasingSettings, amazonMarketIntelligence, amazonAsins, marketplaceListings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { searchCatalogItemsByUPC, searchCatalogByKeyword, getCompetitivePricing, getListingRestrictions } from '../utils/amazon-spapi';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';
import { getProductFees } from '../services/amazon-product-fees';
import { saveAmazonMarketData } from '../marketplace/repository';
import { searchWalmartCatalogWithFallback, getWalmartPricingInsights } from '../utils/walmart-api';
import { calculateReferralFee } from '../marketplace/walmart-referral-fees';

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
          if (!isNaN(numericUpc) && numericUpc > 0) {
            let upcStr = Math.round(numericUpc).toString();
            if (upcStr.length > 13) {
              upcStr = upcStr.slice(0, 13);
            }
            upc = upcStr.length <= 12 ? upcStr.padStart(12, '0') : upcStr;
          }
        } else {
          const cleanUpc = upcValue.replace(/[^0-9]/g, '');
          if (cleanUpc.length > 0 && cleanUpc.length <= 14) {
            upc = cleanUpc.length <= 12 ? cleanUpc.padStart(12, '0') : cleanUpc;
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

interface AsinMatch {
  asin: string;
  matchMethod: 'upc' | 'mpn' | 'keyword';
  confidence: number;
  imageUrl?: string;
}

function extractImageFromCatalogItem(item: any, fallbackUrl?: string | null): string | undefined {
  if (item.attributes?.main_product_image_locator) {
    const imgData = item.attributes.main_product_image_locator;
    if (Array.isArray(imgData) && imgData[0]?.media_location) {
      return imgData[0].media_location;
    }
  }
  if (item.attributes?.image) {
    const imgArr = Array.isArray(item.attributes.image) ? item.attributes.image : [item.attributes.image];
    if (imgArr[0]?.link) return imgArr[0].link;
  }
  return fallbackUrl || undefined;
}

function isApiAccessError(error: any): boolean {
  const msg = error?.message || '';
  const status = error?.response?.status;
  return status === 403 || status === 401 || 
    msg.includes('403') || msg.includes('Access') || 
    msg.includes('Unauthorized') || msg.includes('access denied') ||
    msg.includes('AccessDeniedException');
}

async function findAsinForProduct(product: {
  upc?: string | null;
  mpn?: string | null;
  brand?: string | null;
  description?: string | null;
  model?: string | null;
  imageUrl?: string | null;
}): Promise<AsinMatch | null> {
  const config = await getAmazonConfigFromDb();
  if (!config.marketplaceId) {
    throw new Error('Amazon marketplace ID not configured');
  }

  const apiConfig = {
    ...config,
    marketplaceId: config.marketplaceId,
    endpoint: config.endpoint || 'https://sellingpartnerapi-na.amazon.com'
  };

  let hadApiAccessError = false;
  const strategiesTried: string[] = [];

  // Strategy 1: UPC lookup (100% confidence)
  if (product.upc && product.upc.length >= 10) {
    strategiesTried.push(`UPC: ${product.upc}`);
    try {
      console.log(`[File Analyzer] Strategy 1: UPC lookup for ${product.upc}`);
      const items = await searchCatalogItemsByUPC(product.upc, apiConfig);
      if (items && items.length > 0) {
        const item = items[0];
        const imageUrl = extractImageFromCatalogItem(item, product.imageUrl);
        console.log(`[File Analyzer] ✓ UPC ${product.upc} → ASIN ${item.asin} (100% confidence)`);
        return { asin: item.asin, matchMethod: 'upc', confidence: 100, imageUrl };
      }
      console.log(`[File Analyzer] UPC ${product.upc}: no results from catalog API`);
    } catch (error: any) {
      if (isApiAccessError(error)) {
        hadApiAccessError = true;
        console.error(`[File Analyzer] UPC lookup 403 ACCESS DENIED for ${product.upc}`);
      } else {
        console.error(`[File Analyzer] UPC lookup failed for ${product.upc}:`, error.message);
      }
    }
    await sleep(500);
  }

  // Strategy 2: MPN/SKU/Model keyword search (75% confidence)
  const mpnTerms = [...new Set([product.mpn, product.model].filter(Boolean))];
  for (const term of mpnTerms) {
    if (!term) continue;
    const searchTerm = product.brand ? `${product.brand} ${term}` : term;
    strategiesTried.push(`MPN: ${term}`);
    try {
      console.log(`[File Analyzer] Strategy 2: MPN/SKU search for "${searchTerm}"`);
      const items = await searchCatalogByKeyword(searchTerm, apiConfig);
      if (items && items.length > 0) {
        const item = items[0];
        const imageUrl = extractImageFromCatalogItem(item, product.imageUrl);
        console.log(`[File Analyzer] ✓ MPN "${term}" → ASIN ${item.asin} (75% confidence)`);
        return { asin: item.asin, matchMethod: 'mpn', confidence: 75, imageUrl };
      }
    } catch (error: any) {
      if (isApiAccessError(error)) hadApiAccessError = true;
      console.error(`[File Analyzer] MPN search failed for "${term}":`, error.message);
    }
    await sleep(500);
  }

  // Strategy 3: Description/brand keyword search (50% confidence)
  if (product.description || product.brand) {
    let searchTerms = '';
    if (product.brand && product.description) {
      const descWords = product.description.split(/\s+/).slice(0, 5).join(' ');
      searchTerms = `${product.brand} ${descWords}`;
    } else if (product.description) {
      searchTerms = product.description.split(/\s+/).slice(0, 6).join(' ');
    } else if (product.brand) {
      searchTerms = product.brand;
    }

    if (searchTerms.length >= 3) {
      strategiesTried.push(`Keywords: "${searchTerms.substring(0, 30)}..."`);
      try {
        console.log(`[File Analyzer] Strategy 3: Keyword search for "${searchTerms}"`);
        const items = await searchCatalogByKeyword(searchTerms, apiConfig);
        if (items && items.length > 0) {
          const item = items[0];
          const imageUrl = extractImageFromCatalogItem(item, product.imageUrl);
          console.log(`[File Analyzer] ✓ Keywords → ASIN ${item.asin} (50% confidence)`);
          return { asin: item.asin, matchMethod: 'keyword', confidence: 50, imageUrl };
        }
      } catch (error: any) {
        if (isApiAccessError(error)) hadApiAccessError = true;
        console.error(`[File Analyzer] Keyword search failed:`, error.message);
      }
    }
  }

  if (hadApiAccessError) {
    throw new Error(`Amazon SP-API access denied (403) — check API credentials/permissions. Tried: ${strategiesTried.join(', ')}`);
  }

  throw new Error(`No ASIN found after trying: ${strategiesTried.join(', ')}`);
}

interface WalmartProductResult {
  walmartItemId: string;
  price: number | null;
  buyBoxPrice: number | null;
  referralFee: number | null;
  matchMethod: string;
  availability: string;
  imageUrl?: string;
  title?: string;
  productType?: string;
  customerRating?: string;
  variantCount?: number;
  listingSku?: string;
}

async function searchWalmartForProduct(product: {
  upc?: string | null;
  mpn?: string | null;
  brand?: string | null;
}): Promise<WalmartProductResult | null> {
  try {
    const { items, matchMethod } = await searchWalmartCatalogWithFallback(
      product.upc || undefined,
      product.mpn || undefined,
      product.brand || undefined
    );

    if (items.length === 0) return null;

    const item: any = items[0];
    const imageUrl = item.images?.[0]?.url || item.imageUrls?.[0] || item.mainImageUrl || null;
    const variantCount = parseInt(item.properties?.variantItemsNum || '0') || 0;

    const availableVariants = item.properties?.variants?.variantData?.filter((v: any) => v.isAvailable === 'Y')?.length || 0;
    const totalVariants = item.properties?.variants?.variantData?.length || 0;
    const availability = availableVariants > 0 ? `${availableVariants}/${totalVariants} in stock` : 
                         totalVariants > 0 ? 'out_of_stock' : (item.availabilityStatus || 'unknown');

    let price: number | null = null;
    let buyBoxPrice: number | null = null;
    let referralFee: number | null = null;
    let listingSku: string | undefined;
    const categoryPath = item.properties?.categories || null;
    const productType = item.productType || null;

    if (product.upc) {
      try {
        const [listing] = await db.select()
          .from(marketplaceListings)
          .where(and(
            eq(marketplaceListings.marketplace, 'walmart'),
            eq(marketplaceListings.upc, product.upc)
          ))
          .limit(1);

        if (listing && listing.priceInCents) {
          price = listing.priceInCents / 100;
          listingSku = listing.marketplaceSku || listing.listingId;
          console.log(`[File Analyzer] Found in active listings: UPC ${product.upc} → SKU ${listingSku}, price $${price}`);

          if (listingSku) {
            try {
              const insights = await getWalmartPricingInsights(0, undefined, {
                searchValue: listingSku
              });
              if (insights.pricingInsightsResponseList.length > 0) {
                const pi = insights.pricingInsightsResponseList[0];
                buyBoxPrice = pi.buyBoxBasePrice || pi.buyBoxTotalPrice || null;
                if (pi.currentPrice && pi.currentPrice > 0) {
                  price = pi.currentPrice;
                }
                console.log(`[File Analyzer] Pricing Insights: buyBox=$${buyBoxPrice}, current=$${price}`);
              }
            } catch (piError: any) {
              console.log(`[File Analyzer] Pricing Insights lookup failed for SKU ${listingSku}: ${piError.message}`);
            }
          }
        }
      } catch (listingError: any) {
        console.log(`[File Analyzer] Active listings lookup failed: ${listingError.message}`);
      }
    }

    const effectivePrice = buyBoxPrice || price;
    if (effectivePrice && effectivePrice > 0) {
      try {
        const feeResult = calculateReferralFee(
          Math.round(effectivePrice * 100),
          categoryPath,
          productType
        );
        referralFee = feeResult.feeInCents / 100;
        console.log(`[File Analyzer] Referral fee: $${referralFee.toFixed(2)} (${feeResult.feePercentageEffective}% - ${feeResult.contractCategoryName})`);
      } catch (feeError: any) {
        referralFee = effectivePrice * 0.15;
        console.log(`[File Analyzer] Fee calc failed, using 15% estimate: $${referralFee.toFixed(2)}`);
      }
    }

    console.log(`[File Analyzer] Walmart match: "${item.title}" (ID: ${item.itemId}), type: ${productType}, buyBox: $${buyBoxPrice || 'N/A'}, price: $${price || 'N/A'}, fee: $${referralFee || 'N/A'}, availability: ${availability}`);

    return {
      walmartItemId: item.itemId || item.walmartItemId || '',
      price,
      buyBoxPrice,
      referralFee,
      matchMethod: matchMethod === 'upc' ? 'walmart_upc' : 'walmart_mpn',
      availability,
      imageUrl: imageUrl || undefined,
      title: item.title,
      productType,
      customerRating: item.customerRating,
      variantCount,
      listingSku,
    };
  } catch (error: any) {
    console.error(`[File Analyzer] Walmart search error:`, error.message);
    return null;
  }
}

export async function analyzeUploadedFile(uploadId: number): Promise<void> {
  try {
    const [upload] = await db.select().from(fileUploads).where(eq(fileUploads.id, uploadId));
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const targetMarketplaces: string[] = (upload.targetMarketplaces as string[]) || ['amazon', 'walmart'];
    const amazonEnabled = targetMarketplaces.includes('amazon');
    const walmartEnabled = targetMarketplaces.includes('walmart');

    console.log(`[File Analyzer] Starting analysis for upload ${uploadId} (marketplaces: ${targetMarketplaces.join(', ')})`);

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
        let asin = result.asin;
        let matchMethod: string | null = null;
        let matchConfidence: number = 0;
        let productImageUrl: string | null = result.imageUrl || null;
        let amazonSuccess = false;
        let walmartSuccess = false;

        let walmartData: WalmartProductResult | null = null;
        let marketData: MarketData | null = null;

        if (amazonEnabled) {
          try {
            if (!asin || asin === '') {
              const match = await findAsinForProduct({
                upc: result.upc,
                mpn: result.model,
                brand: result.brand,
                description: result.description,
                model: result.model,
                imageUrl: result.imageUrl,
              });

              if (match) {
                asin = match.asin;
                matchMethod = match.matchMethod;
                matchConfidence = match.confidence;
                if (match.imageUrl) productImageUrl = match.imageUrl;
              }
            } else {
              matchMethod = 'direct';
              matchConfidence = 100;
            }

            if (asin && asin !== '') {
              marketData = await getMarketDataForAsin(asin);
              amazonSuccess = true;
            }
          } catch (amazonError: any) {
            console.error(`[File Analyzer] Amazon error for product ${result.id}:`, amazonError.message);
            if (!walmartEnabled) {
              throw amazonError;
            }
          }
        }

        if (walmartEnabled) {
          try {
            walmartData = await searchWalmartForProduct({
              upc: result.upc,
              mpn: result.model,
              brand: result.brand,
            });
            if (walmartData) {
              walmartSuccess = true;
              if (!productImageUrl && walmartData.imageUrl) {
                productImageUrl = walmartData.imageUrl;
              }
              if (!matchMethod) {
                matchMethod = walmartData.matchMethod;
                matchConfidence = walmartData.matchMethod === 'walmart_upc' ? 95 : 70;
              }
            }
          } catch (walmartError: any) {
            console.error(`[File Analyzer] Walmart error for product ${result.id}:`, walmartError.message);
          }
        }

        if (!amazonSuccess && !walmartSuccess) {
          if (!amazonEnabled && !walmartEnabled) {
            throw new Error('No marketplaces enabled for analysis');
          }
          const strategies = [];
          if (result.upc) strategies.push(`UPC: ${result.upc}`);
          if (result.model) strategies.push(`MPN: ${result.model}`);
          if (result.description) strategies.push(`Keywords: "${result.description?.substring(0, 30)}..."`);
          const marketplaceList = targetMarketplaces.join(' & ');
          throw new Error(`No match found on ${marketplaceList} after trying: ${strategies.join(', ') || 'no identifiers available'}`);
        }

        let dropshipMargin: number | null = null;
        let warehouseMargin: number | null = null;
        let isOpportunity = false;
        let opportunityType: string | null = null;
        let estimatedFees: number | null = null;

        const walmartBuyBox = walmartData?.buyBoxPrice ?? null;
        const walmartPrice = walmartData?.price ?? null;
        const bestPrice = marketData?.buyBoxPrice ?? marketData?.amazonPrice ?? marketData?.lowestFbaPrice ?? walmartBuyBox ?? walmartPrice;

        if (bestPrice && bestPrice > 0) {
          estimatedFees = marketData?.estimatedFees ?? walmartData?.referralFee ?? bestPrice * 0.15;
        }

        if (result.supplierPrice && bestPrice && bestPrice > 0 && estimatedFees !== null) {
          const supplierCost = result.supplierPrice;

          dropshipMargin = ((bestPrice - supplierCost - estimatedFees) / bestPrice) * 100;
          warehouseMargin = ((bestPrice - supplierCost - estimatedFees - 10) / bestPrice) * 100;

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

          if (isOpportunity) opportunitiesFound++;
        }

        const updateData: Record<string, any> = {
          dropshipMargin,
          warehouseMargin,
          isOpportunity,
          opportunityType,
          estimatedFees,
          confidenceScore: matchConfidence,
          matchMethod,
          imageUrl: productImageUrl,
          errorMessage: null,
        };

        if (asin && asin !== '') updateData.asin = asin;

        if (amazonSuccess && marketData) {
          updateData.buyBoxPrice = marketData.buyBoxPrice;
          updateData.amazonPrice = marketData.amazonPrice;
          updateData.lowestFbaPrice = marketData.lowestFbaPrice;
          updateData.lowestFbmPrice = marketData.lowestFbmPrice;
          if (marketData.estimatedFees) updateData.estimatedFees = marketData.estimatedFees;
          updateData.isRestricted = marketData.isRestricted;
          updateData.restrictionReasons = marketData.restrictionReasons;
        }

        if (walmartSuccess && walmartData) {
          updateData.walmartItemId = walmartData.walmartItemId;
          updateData.walmartPrice = walmartBuyBox || walmartPrice;
          updateData.walmartMatchMethod = walmartData.matchMethod;
          updateData.walmartAvailability = walmartData.availability;
          if (walmartBuyBox && !marketData?.buyBoxPrice) {
            updateData.buyBoxPrice = walmartBuyBox;
          }
          if (walmartData.title && (!result.description || result.description.length < 10)) {
            updateData.description = walmartData.title;
          }
        }

        await db
          .update(fileAnalysisResults)
          .set(updateData)
          .where(eq(fileAnalysisResults.id, result.id));

        successCount++;
      } catch (error) {
        console.error(`[File Analyzer] Error analyzing product ${result.id}:`, error);
        
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

    const completionTime = new Date();
    console.log(`[File Analyzer] Setting upload ${uploadId} to completed at ${completionTime.toISOString()}`);
    
    await db
      .update(fileUploads)
      .set({
        status: 'completed',
        processedRows: results.length,
        successRows: successCount,
        failedRows: failedCount,
        opportunitiesFound,
        completedAt: completionTime,
        analysisResults: {
          totalRows: results.length,
          successRows: successCount,
          failedRows: failedCount,
          opportunitiesFound,
          avgMargin: 0,
        },
      })
      .where(eq(fileUploads.id, uploadId));

    console.log(`[File Analyzer] ✅ Completed analysis for upload ${uploadId}: ${successCount} success, ${failedCount} failed, ${opportunitiesFound} opportunities`);
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
