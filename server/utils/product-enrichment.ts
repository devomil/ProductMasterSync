import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface EnrichmentSource {
  amazon: boolean;
  walmart: boolean;
  upcitemdb: boolean;
  aiExtraction: boolean;
}

export interface EnrichmentFields {
  upc: boolean;
  dimensions: boolean;
  weight: boolean;
}

export interface EnrichmentJobStatus {
  status: 'idle' | 'running' | 'completed' | 'error' | 'stopped';
  supplierId: number | null;
  supplierName: string;
  totalProducts: number;
  processed: number;
  enriched: number;
  errors: number;
  skipped: number;
  sourceCounts: {
    amazon: number;
    walmart: number;
    upcitemdb: number;
    ai: number;
  };
  fieldCounts: {
    upc: number;
    gtin: number;
    ean: number;
    dimensions: number;
    weight: number;
  };
  recentResults: Array<{
    productName: string;
    mpn: string;
    status: 'found' | 'not_found' | 'error';
    source?: string;
    upc?: string;
  }>;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export let enrichmentJob: EnrichmentJobStatus = {
  status: 'idle',
  supplierId: null,
  supplierName: '',
  totalProducts: 0,
  processed: 0,
  enriched: 0,
  errors: 0,
  skipped: 0,
  sourceCounts: { amazon: 0, walmart: 0, upcitemdb: 0, ai: 0 },
  fieldCounts: { upc: 0, gtin: 0, ean: 0, dimensions: 0, weight: 0 },
  recentResults: [],
  startedAt: null,
  completedAt: null,
  errorMessage: null,
};

export function validateGTIN(code: string): { valid: boolean; type: string; normalized: string } {
  const cleaned = code.replace(/[^0-9]/g, '');

  if (cleaned.length < 8 || cleaned.length > 14) {
    return { valid: false, type: 'unknown', normalized: cleaned };
  }

  let padded = cleaned;
  if (cleaned.length === 8) padded = cleaned;
  else if (cleaned.length <= 12) padded = cleaned.padStart(12, '0');
  else if (cleaned.length === 13) padded = cleaned;
  else padded = cleaned.padStart(14, '0');

  const digits = padded.split('').map(Number);
  const checkDigit = digits.pop()!;
  let sum = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    sum += digits[i] * ((len - i) % 2 === 0 ? 1 : 3);
  }
  const expectedCheck = (10 - (sum % 10)) % 10;

  const typeMap: Record<number, string> = {
    8: 'GTIN-8',
    12: 'UPC-A',
    13: 'EAN-13',
    14: 'GTIN-14',
  };

  return {
    valid: expectedCheck === checkDigit,
    type: typeMap[padded.length] || 'unknown',
    normalized: padded,
  };
}

export function normalizeUPC(code: string): string {
  const cleaned = code.replace(/[^0-9]/g, '');
  if (cleaned.length <= 12) return cleaned.padStart(12, '0');
  return cleaned;
}

interface LookupResult {
  upc?: string;
  gtin?: string;
  ean?: string;
  asin?: string;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  source: string;
}

interface MergedResult {
  upc?: string;
  gtin?: string;
  ean?: string;
  asin?: string;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  sources: string[];
}

function mergeResult(merged: MergedResult, result: LookupResult): boolean {
  let added = false;

  if (result.upc && !merged.upc) {
    const cleaned = result.upc.replace(/[^0-9]/g, '');
    if (cleaned.length >= 8 && cleaned.length <= 14) {
      merged.upc = cleaned.length <= 12 ? cleaned.padStart(12, '0') : cleaned;
      added = true;
    }
  }
  if (result.gtin && !merged.gtin) {
    const cleaned = result.gtin.replace(/[^0-9]/g, '');
    if (cleaned.length >= 8) { merged.gtin = cleaned; added = true; }
  }
  if (result.ean && !merged.ean) {
    const cleaned = result.ean.replace(/[^0-9]/g, '');
    if (cleaned.length >= 8) { merged.ean = cleaned; added = true; }
  }
  if (result.asin && !merged.asin) { merged.asin = result.asin; added = true; }
  if (result.weight && !merged.weight) { merged.weight = result.weight; added = true; }
  if (result.dimensions) {
    if (!merged.dimensions) merged.dimensions = {};
    if (result.dimensions.length && !merged.dimensions.length) { merged.dimensions.length = result.dimensions.length; added = true; }
    if (result.dimensions.width && !merged.dimensions.width) { merged.dimensions.width = result.dimensions.width; added = true; }
    if (result.dimensions.height && !merged.dimensions.height) { merged.dimensions.height = result.dimensions.height; added = true; }
  }

  if (added && !merged.sources.includes(result.source)) {
    merged.sources.push(result.source);
  }
  return added;
}

function isMergedComplete(merged: MergedResult, needsUPC: boolean, needsWeight: boolean, needsDims: boolean): boolean {
  if (needsUPC && !merged.upc) return false;
  if (needsWeight && !merged.weight) return false;
  if (needsDims && (!merged.dimensions?.length || !merged.dimensions?.width || !merged.dimensions?.height)) return false;
  return true;
}

async function lookupFromAmazon(mpn: string, brand: string): Promise<LookupResult | null> {
  try {
    const { createSpApiClient, getAmazonConfig, rateLimiter } = await import('../marketplace/amazon-spapi-service');
    const client = await createSpApiClient();
    const config = await getAmazonConfig();

    const keywordsList = brand ? [brand, mpn] : [mpn];
    await rateLimiter.waitForRateLimit('searchCatalogItems');

    const response = await client.searchCatalogItems({
      marketplaceIds: [config.marketplaceId],
      keywords: keywordsList,
      includedData: ['summaries', 'identifiers', 'dimensions']
    });

    const items = response?.data?.items || response?.items || [];
    if (items.length === 0) return null;

    for (const item of items) {
      let upc: string | undefined;
      let ean: string | undefined;
      let gtin: string | undefined;

      if (item.identifiers) {
        for (const marketplaceIds of item.identifiers) {
          for (const id of (marketplaceIds.identifiers || [])) {
            const code = id.identifier;
            const type = id.identifierType;
            if (type === 'UPC' && !upc) upc = code;
            else if (type === 'EAN' && !ean) ean = code;
            else if (type === 'GTIN' && !gtin) gtin = code;
          }
        }
      }

      if (!upc && !ean && !gtin) continue;

      let weight: string | undefined;
      let dimensions: { length?: string; width?: string; height?: string } | undefined;
      if (item.dimensions) {
        const dim = item.dimensions;
        for (const key of ['package', 'item']) {
          const d = (dim as any)[key];
          if (d) {
            if (d.length?.value && !dimensions) dimensions = {
              length: String(d.length.value),
              width: d.width?.value ? String(d.width.value) : undefined,
              height: d.height?.value ? String(d.height.value) : undefined,
            };
            if (d.weight?.value && !weight) weight = String(d.weight.value);
          }
        }
      }

      return { upc, ean, gtin, asin: item.asin, weight, dimensions, source: 'amazon' };
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 429) throw error;
    console.error(`[Enrichment] Amazon lookup error for ${mpn}:`, error.message);
    return null;
  }
}

async function lookupFromWalmart(mpn: string, brand: string): Promise<LookupResult | null> {
  return null;
}

let upcitemdbRateLimited = false;

async function lookupFromUPCitemdb(mpn: string, brand: string): Promise<LookupResult | null> {
  if (upcitemdbRateLimited) return null;

  try {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const query = encodeURIComponent(`${brand} ${mpn}`.trim());
    const { default: axios } = await import('axios');
    const response = await axios.get(`https://api.upcitemdb.com/prod/trial/search?s=${query}&type=keyword`, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (response.data?.items?.length > 0) {
      const item = response.data.items[0];
      const upc = item.upc || undefined;
      const ean = item.ean || undefined;
      const gtin = item.gtin || undefined;
      if (!upc && !ean && !gtin) return null;

      return { upc, ean, gtin, source: 'upcitemdb' };
    }
    return null;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('[Enrichment] UPCitemdb rate limited, pausing UPCitemdb for this run');
      upcitemdbRateLimited = true;
    } else if (error.response?.status === 404) {
      return null;
    } else {
      console.error(`[Enrichment] UPCitemdb lookup error for ${mpn}:`, error.message);
    }
    return null;
  }
}

async function extractSpecsFromAI(name: string, description: string, brand: string, mpn: string): Promise<LookupResult | null> {
  try {
    if (!description || description.length < 20) return null;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: `Extract product identifiers and shipping specs from this product data. Only return values you are confident about.

Product: ${name}
Brand: ${brand}
MPN: ${mpn}
Description: ${description.substring(0, 500)}

Return ONLY a JSON object (no markdown):
{"upc":"","ean":"","gtin":"","weight_lbs":"","length_in":"","width_in":"","height_in":""}
Leave empty string for unknown values. UPC must be a valid 12-digit UPC-A code. EAN must be 13 digits. GTIN must be 14 digits.`
        }]
      }]
    });

    const text = response.content[0];
    if (text.type !== 'text') return null;

    const cleaned = text.text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    let upc: string | undefined;
    let ean: string | undefined;
    let gtin: string | undefined;

    if (parsed.upc && parsed.upc.length >= 8) {
      const validation = validateGTIN(parsed.upc);
      if (validation.valid) upc = validation.normalized;
    }
    if (parsed.ean && parsed.ean.length >= 8) {
      const validation = validateGTIN(parsed.ean);
      if (validation.valid) ean = validation.normalized;
    }
    if (parsed.gtin && parsed.gtin.length >= 8) {
      const validation = validateGTIN(parsed.gtin);
      if (validation.valid) gtin = validation.normalized;
    }

    const weight = parsed.weight_lbs && parsed.weight_lbs !== '' ? parsed.weight_lbs : undefined;
    let dimensions: { length?: string; width?: string; height?: string } | undefined;
    if (parsed.length_in || parsed.width_in || parsed.height_in) {
      dimensions = {
        length: parsed.length_in || undefined,
        width: parsed.width_in || undefined,
        height: parsed.height_in || undefined,
      };
    }

    if (!upc && !ean && !gtin && !weight && !dimensions) return null;

    return { upc, ean, gtin, weight, dimensions, source: 'ai' };
  } catch (error: any) {
    console.error(`[Enrichment] AI extraction error:`, error.message);
    return null;
  }
}

function addRecentResult(result: EnrichmentJobStatus['recentResults'][0]) {
  enrichmentJob.recentResults.unshift(result);
  if (enrichmentJob.recentResults.length > 10) {
    enrichmentJob.recentResults = enrichmentJob.recentResults.slice(0, 10);
  }
}

export async function runProductEnrichment(
  supplierId: number,
  supplierName: string,
  sources: EnrichmentSource,
  fields: EnrichmentFields,
  delayMs: number = 600
) {
  const { pool } = await import('../db');
  upcitemdbRateLimited = false;

  enrichmentJob = {
    status: 'running',
    supplierId,
    supplierName,
    totalProducts: 0,
    processed: 0,
    enriched: 0,
    errors: 0,
    skipped: 0,
    sourceCounts: { amazon: 0, walmart: 0, upcitemdb: 0, ai: 0 },
    fieldCounts: { upc: 0, gtin: 0, ean: 0, dimensions: 0, weight: 0 },
    recentResults: [],
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
  };

  try {
    const conditions: string[] = [];
    if (fields.upc) conditions.push("(p.upc IS NULL OR p.upc = '')");
    if (fields.weight) conditions.push("(p.weight IS NULL OR p.weight = '' OR p.weight = '0')");

    if (conditions.length === 0) {
      enrichmentJob.status = 'completed';
      enrichmentJob.completedAt = new Date();
      return;
    }

    const whereClause = conditions.join(' OR ');

    const productsResult = await pool.query(`
      SELECT DISTINCT p.id, p.name, p.sku, p.upc, p.ean, p.gtin,
             p.manufacturer_part_number as mpn, 
             p.manufacturer_name as brand, p.description, p.weight,
             p.box_length, p.box_width, p.box_height
      FROM products p
      JOIN product_suppliers ps ON ps.product_id = p.id
      WHERE ps.supplier_id = $1
      AND p.manufacturer_part_number IS NOT NULL AND p.manufacturer_part_number != ''
      AND (${whereClause})
      ORDER BY p.id
    `, [supplierId]);

    const products = productsResult.rows;
    enrichmentJob.totalProducts = products.length;
    console.log(`[Enrichment] Starting enrichment for ${products.length} products from ${supplierName}`);
    if (sources.walmart) {
      console.log(`[Enrichment] Note: Walmart Marketplace search API does not return UPC/GTIN data — Walmart source will be skipped`);
    }

    let upcitemdbCount = 0;
    const UPCITEMDB_DAILY_LIMIT = 95;

    for (let i = 0; i < products.length; i++) {
      if (enrichmentJob.status !== 'running') break;

      const product = products[i];
      const mpn = product.mpn || '';
      const brand = product.brand || '';
      const needsUPC = fields.upc && (!product.upc || product.upc === '');
      const needsWeight = fields.weight && (!product.weight || product.weight === '' || product.weight === '0');
      const needsDims = fields.dimensions && (!product.box_length || !product.box_width || !product.box_height);

      const merged: MergedResult = { sources: [] };

      try {
        const logPrefix = `[Enrichment #${i+1}/${products.length}] ${brand} ${mpn}`;

        if (sources.amazon && !isMergedComplete(merged, needsUPC, needsWeight, needsDims)) {
          try {
            const result = await lookupFromAmazon(mpn, brand);
            if (result) {
              const mergeOk = mergeResult(merged, result);
              enrichmentJob.sourceCounts.amazon++;
              console.log(`${logPrefix} — Amazon: UPC=${result.upc || 'none'}, weight=${result.weight || 'none'}, merged=${mergeOk}`);
            } else {
              console.log(`${logPrefix} — Amazon: no results`);
            }
          } catch (err: any) {
            console.error(`${logPrefix} — Amazon ERROR: ${err.message}`);
            if (err.response?.status === 429) throw err;
          }
        }

        if (sources.walmart && !isMergedComplete(merged, needsUPC, needsWeight, needsDims)) {
          const wResult = await lookupFromWalmart(mpn, brand);
          if (wResult) {
            mergeResult(merged, wResult);
            enrichmentJob.sourceCounts.walmart++;
          }
        }

        if (sources.upcitemdb && !isMergedComplete(merged, needsUPC, needsWeight, needsDims) && needsUPC && !merged.upc && upcitemdbCount < UPCITEMDB_DAILY_LIMIT) {
          try {
            const uResult = await lookupFromUPCitemdb(mpn, brand);
            upcitemdbCount++;
            if (uResult) {
              const mergeOk = mergeResult(merged, uResult);
              enrichmentJob.sourceCounts.upcitemdb++;
              console.log(`${logPrefix} — UPCitemdb: UPC=${uResult.upc || 'none'}, merged=${mergeOk}`);
            } else {
              console.log(`${logPrefix} — UPCitemdb: no results`);
            }
          } catch (err: any) {
            console.error(`${logPrefix} — UPCitemdb ERROR: ${err.message}`);
          }
        }

        if (sources.aiExtraction && !isMergedComplete(merged, needsUPC, needsWeight, needsDims) && product.description) {
          try {
            const aiResult = await extractSpecsFromAI(product.name || '', product.description || '', brand, mpn);
            if (aiResult) {
              const mergeOk = mergeResult(merged, aiResult);
              enrichmentJob.sourceCounts.ai++;
              console.log(`${logPrefix} — AI: UPC=${aiResult.upc || 'none'}, merged=${mergeOk}`);
            } else {
              console.log(`${logPrefix} — AI: no results`);
            }
          } catch (err: any) {
            console.error(`${logPrefix} — AI ERROR: ${err.message}`);
          }
        }

        if (merged.sources.length > 0) {
          const updates: string[] = [];
          const values: any[] = [];
          let paramIdx = 1;

          if (merged.upc && needsUPC) {
            updates.push(`upc = $${paramIdx++}`);
            values.push(merged.upc);
            enrichmentJob.fieldCounts.upc++;
          }

          if (merged.ean && (!product.ean || product.ean === '')) {
            updates.push(`ean = $${paramIdx++}`);
            values.push(merged.ean);
            enrichmentJob.fieldCounts.ean++;
          }

          if (merged.gtin && (!product.gtin || product.gtin === '')) {
            updates.push(`gtin = $${paramIdx++}`);
            values.push(merged.gtin);
            enrichmentJob.fieldCounts.gtin++;
          }

          if (merged.weight && needsWeight) {
            updates.push(`weight = $${paramIdx++}`);
            values.push(merged.weight);
            enrichmentJob.fieldCounts.weight++;
          }

          if (merged.dimensions && fields.dimensions) {
            if (merged.dimensions.length && !product.box_length) {
              updates.push(`box_length = $${paramIdx++}`);
              values.push(merged.dimensions.length);
            }
            if (merged.dimensions.width && !product.box_width) {
              updates.push(`box_width = $${paramIdx++}`);
              values.push(merged.dimensions.width);
            }
            if (merged.dimensions.height && !product.box_height) {
              updates.push(`box_height = $${paramIdx++}`);
              values.push(merged.dimensions.height);
            }
            if (merged.dimensions.length || merged.dimensions.width || merged.dimensions.height) {
              enrichmentJob.fieldCounts.dimensions++;
            }
          }

          const attrUpdate = `attributes = (COALESCE(attributes::text::jsonb, '{}'::jsonb) || $${paramIdx++}::jsonb)::json`;
          updates.push(attrUpdate);
          values.push(JSON.stringify({
            enrichment: {
              sources: merged.sources,
              enrichedAt: new Date().toISOString(),
              asin: merged.asin || undefined,
            }
          }));

          if (updates.length > 1) {
            values.push(product.id);
            await pool.query(
              `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
              values
            );
            enrichmentJob.enriched++;
          }

          addRecentResult({
            productName: (product.name || '').substring(0, 50),
            mpn,
            status: 'found',
            source: merged.sources.join('+'),
            upc: merged.upc,
          });
        } else {
          enrichmentJob.skipped++;
          addRecentResult({
            productName: (product.name || '').substring(0, 50),
            mpn,
            status: 'not_found',
          });
        }
      } catch (error: any) {
        enrichmentJob.errors++;
        console.error(`[Enrichment] Product #${i+1} ${mpn} outer error: ${error.message}`);
        addRecentResult({
          productName: (product.name || '').substring(0, 50),
          mpn,
          status: 'error',
        });

        if (error.response?.status === 429) {
          console.log(`[Enrichment] Rate limited, backing off 5s`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          i--;
          continue;
        }
      }

      enrichmentJob.processed++;

      if (i < products.length - 1 && enrichmentJob.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (enrichmentJob.status === 'running') {
      enrichmentJob.status = 'completed';
    }
    enrichmentJob.completedAt = new Date();
    console.log(`[Enrichment] Completed: ${enrichmentJob.enriched} enriched, ${enrichmentJob.skipped} skipped, ${enrichmentJob.errors} errors`);
  } catch (error: any) {
    enrichmentJob.status = 'error';
    enrichmentJob.errorMessage = error.message;
    enrichmentJob.completedAt = new Date();
    console.error(`[Enrichment] Fatal error:`, error);
  }
}
