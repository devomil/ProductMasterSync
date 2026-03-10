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
  fieldCounts: { upc: 0, dimensions: 0, weight: 0 },
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

async function lookupFromAmazon(mpn: string, brand: string): Promise<LookupResult | null> {
  try {
    const { searchCatalogItemsByMPN } = await import('../marketplace/amazon-spapi-service');
    const results = await searchCatalogItemsByMPN(mpn, brand);

    if (results.length === 0) return null;

    const item = results[0];
    let upc: string | undefined;
    let ean: string | undefined;

    if (item.identifiers) {
      for (const marketplaceIds of item.identifiers) {
        for (const id of marketplaceIds.identifiers || []) {
          if (id.identifierType === 'UPC' || id.identifierType === 'EAN') {
            const code = id.identifier;
            if (id.identifierType === 'UPC') upc = code;
            if (id.identifierType === 'EAN') ean = code;
          }
        }
      }
    }

    let weight: string | undefined;
    let dimensions: { length?: string; width?: string; height?: string } | undefined;
    if (item.dimensions) {
      const dim = item.dimensions;
      if (dim.package || dim.item) {
        const d = dim.package || dim.item;
        if (d.length?.value) dimensions = {
          length: String(d.length.value),
          width: d.width?.value ? String(d.width.value) : undefined,
          height: d.height?.value ? String(d.height.value) : undefined,
        };
        if (d.weight?.value) weight = String(d.weight.value);
      }
    }

    if (!upc && !ean && !weight && !dimensions) return null;

    return { upc, ean, asin: item.asin, weight, dimensions, source: 'amazon' };
  } catch (error: any) {
    if (error.response?.status === 429) throw error;
    console.error(`[Enrichment] Amazon lookup error for ${mpn}:`, error.message);
    return null;
  }
}

async function lookupFromWalmart(mpn: string, brand: string): Promise<LookupResult | null> {
  try {
    const { searchWalmartCatalogByMPN } = await import('../utils/walmart-api');
    const results = await searchWalmartCatalogByMPN(mpn, brand);

    if (results.length === 0) return null;

    const item = results[0] as any;
    const upc = item.upc || item.gtin || undefined;
    const weight = item.shippingWeight ? String(item.shippingWeight) : undefined;
    let dimensions: { length?: string; width?: string; height?: string } | undefined;
    if (item.shippingLength || item.shippingWidth || item.shippingHeight) {
      dimensions = {
        length: item.shippingLength ? String(item.shippingLength) : undefined,
        width: item.shippingWidth ? String(item.shippingWidth) : undefined,
        height: item.shippingHeight ? String(item.shippingHeight) : undefined,
      };
    }

    if (!upc && !weight && !dimensions) return null;

    return { upc, gtin: item.gtin, weight, dimensions, source: 'walmart' };
  } catch (error: any) {
    if (error.response?.status === 429) throw error;
    console.error(`[Enrichment] Walmart lookup error for ${mpn}:`, error.message);
    return null;
  }
}

async function lookupFromUPCitemdb(mpn: string, brand: string): Promise<LookupResult | null> {
  try {
    const query = encodeURIComponent(`${brand} ${mpn}`.trim());
    const { default: axios } = await import('axios');
    const response = await axios.get(`https://api.upcitemdb.com/prod/trial/search?s=${query}&type=keyword`, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (response.data?.items?.length > 0) {
      const item = response.data.items[0];
      const upc = item.upc || item.ean || undefined;
      if (!upc) return null;

      return {
        upc,
        ean: item.ean || undefined,
        gtin: item.gtin || undefined,
        source: 'upcitemdb',
      };
    }
    return null;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('[Enrichment] UPCitemdb daily limit reached');
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
{"upc":"","weight_lbs":"","length_in":"","width_in":"","height_in":""}
Leave empty string for unknown values. UPC must be a valid 12-digit UPC-A code.`
        }]
      }]
    });

    const text = response.content[0];
    if (text.type !== 'text') return null;

    const cleaned = text.text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    let upc: string | undefined;
    if (parsed.upc && parsed.upc.length >= 8) {
      const validation = validateGTIN(parsed.upc);
      if (validation.valid) upc = validation.normalized;
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

    if (!upc && !weight && !dimensions) return null;

    return { upc, weight, dimensions, source: 'ai' };
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
    fieldCounts: { upc: 0, dimensions: 0, weight: 0 },
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
      SELECT p.id, p.name, p.sku, p.upc, p.manufacturer_part_number as mpn, 
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

    let upcitemdbCount = 0;
    const UPCITEMDB_DAILY_LIMIT = 95;

    for (let i = 0; i < products.length; i++) {
      if (enrichmentJob.status !== 'running') break;

      const product = products[i];
      const mpn = product.mpn || '';
      const brand = product.brand || '';
      const needsUPC = fields.upc && (!product.upc || product.upc === '');
      const needsWeight = fields.weight && (!product.weight || product.weight === '' || product.weight === '0');

      let foundResult: LookupResult | null = null;

      try {
        if (sources.amazon && !foundResult) {
          foundResult = await lookupFromAmazon(mpn, brand);
          if (foundResult) enrichmentJob.sourceCounts.amazon++;
        }

        if (!foundResult && sources.walmart) {
          foundResult = await lookupFromWalmart(mpn, brand);
          if (foundResult) enrichmentJob.sourceCounts.walmart++;
        }

        if (!foundResult && sources.upcitemdb && needsUPC && upcitemdbCount < UPCITEMDB_DAILY_LIMIT) {
          foundResult = await lookupFromUPCitemdb(mpn, brand);
          upcitemdbCount++;
          if (foundResult) enrichmentJob.sourceCounts.upcitemdb++;
        }

        if (!foundResult && sources.aiExtraction && product.description) {
          foundResult = await extractSpecsFromAI(product.name || '', product.description || '', brand, mpn);
          if (foundResult) enrichmentJob.sourceCounts.ai++;
        }

        if (foundResult) {
          const updates: string[] = [];
          const values: any[] = [];
          let paramIdx = 1;

          if (foundResult.upc && needsUPC) {
            const validation = validateGTIN(foundResult.upc);
            if (validation.valid) {
              updates.push(`upc = $${paramIdx++}`);
              values.push(validation.normalized);
              enrichmentJob.fieldCounts.upc++;
            }
          }

          if (foundResult.weight && needsWeight) {
            updates.push(`weight = $${paramIdx++}`);
            values.push(foundResult.weight);
            enrichmentJob.fieldCounts.weight++;
          }

          if (foundResult.dimensions && fields.dimensions) {
            if (foundResult.dimensions.length && (!product.box_length)) {
              updates.push(`box_length = $${paramIdx++}`);
              values.push(foundResult.dimensions.length);
            }
            if (foundResult.dimensions.width && (!product.box_width)) {
              updates.push(`box_width = $${paramIdx++}`);
              values.push(foundResult.dimensions.width);
            }
            if (foundResult.dimensions.height && (!product.box_height)) {
              updates.push(`box_height = $${paramIdx++}`);
              values.push(foundResult.dimensions.height);
            }
            if (foundResult.dimensions.length || foundResult.dimensions.width || foundResult.dimensions.height) {
              enrichmentJob.fieldCounts.dimensions++;
            }
          }

          const attrUpdate = `attributes = (COALESCE(attributes::text::jsonb, '{}'::jsonb) || $${paramIdx++}::jsonb)::json`;
          updates.push(attrUpdate);
          values.push(JSON.stringify({
            enrichment: {
              source: foundResult.source,
              enrichedAt: new Date().toISOString(),
              asin: foundResult.asin || undefined,
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
            source: foundResult.source,
            upc: foundResult.upc,
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
