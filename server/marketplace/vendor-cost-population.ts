import { db, pool } from '../db';
import { marketplaceOrderItems, marketplaceOrders, marketplaceListings, products } from '@shared/schema';
import { eq, and, sql, isNull, isNotNull } from 'drizzle-orm';

const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] [Vendor Cost] ${message}`);
};

export interface VendorCostResult {
  totalItems: number;
  matched: number;
  matchedByUpc: number;
  matchedByUsin: number;
  matchedByMpn: number;
  alreadyPopulated: number;
  unmatched: number;
  totalCostPopulated: number;
}

export async function populateVendorCosts(monthsBack: number = 3): Promise<VendorCostResult> {
  const result: VendorCostResult = {
    totalItems: 0,
    matched: 0,
    matchedByUpc: 0,
    matchedByUsin: 0,
    matchedByMpn: 0,
    alreadyPopulated: 0,
    unmatched: 0,
    totalCostPopulated: 0,
  };

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

  const itemsQuery = await pool.query(`
    SELECT moi.id, moi.marketplace_sku, moi.vendor_cost_in_cents, moi.upc as item_upc,
           mo.marketplace, mo.order_date
    FROM marketplace_order_items moi
    JOIN marketplace_orders mo ON mo.id = moi.order_id
    WHERE mo.order_date >= $1
      AND mo.status != 'cancelled'
    ORDER BY mo.order_date DESC
  `, [cutoffDate.toISOString()]);

  const items = itemsQuery.rows;
  result.totalItems = items.length;

  const alreadyPopulated = items.filter(i => i.vendor_cost_in_cents != null && i.vendor_cost_in_cents > 0);
  result.alreadyPopulated = alreadyPopulated.length;

  const needsCost = items.filter(i => i.vendor_cost_in_cents == null || i.vendor_cost_in_cents === 0);
  if (needsCost.length === 0) {
    log(`All ${result.totalItems} items already have vendor costs`);
    return result;
  }

  log(`Processing ${needsCost.length} items without vendor costs (${result.alreadyPopulated} already populated)`);

  const uniqueSkus = [...new Set(needsCost.map(i => i.marketplace_sku).filter(Boolean))];

  const listingMap = new Map<string, { upc: string | null; productType: string | null }>();
  if (uniqueSkus.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < uniqueSkus.length; i += CHUNK) {
      const chunk = uniqueSkus.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
      const listingResult = await pool.query(
        `SELECT marketplace_sku, upc, product_type FROM marketplace_listings WHERE marketplace_sku IN (${placeholders})`,
        chunk
      );
      for (const row of listingResult.rows) {
        if (row.upc) {
          listingMap.set(row.marketplace_sku, { upc: row.upc, productType: row.product_type });
        }
      }
    }
  }
  log(`Found ${listingMap.size} listings with UPCs for ${uniqueSkus.length} unique SKUs`);

  const allUpcs = [...new Set([...listingMap.values()].map(v => v.upc).filter(Boolean))] as string[];

  const upcToCost = new Map<string, { cost: number; supplierName: string; usin: string | null }>();
  if (allUpcs.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < allUpcs.length; i += CHUNK) {
      const chunk = allUpcs.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
      const productResult = await pool.query(
        `SELECT p.upc, p.cost, p.usin, COALESCE(s.name, 'Unknown') as supplier_name
         FROM products p
         LEFT JOIN product_suppliers ps ON ps.product_id = p.id
         LEFT JOIN suppliers s ON s.id = ps.supplier_id
         WHERE p.upc IN (${placeholders}) AND p.cost IS NOT NULL AND p.cost != ''
         ORDER BY p.updated_at DESC`,
        chunk
      );
      for (const row of productResult.rows) {
        if (row.upc && row.cost && !upcToCost.has(row.upc)) {
          const costNum = parseFloat(row.cost);
          if (!isNaN(costNum) && costNum > 0) {
            upcToCost.set(row.upc, { cost: Math.round(costNum * 100), supplierName: row.supplier_name, usin: row.usin });
          }
        }
      }
    }
  }
  log(`Found ${upcToCost.size} product costs matched by UPC`);

  const usinSkus = needsCost
    .filter(i => i.marketplace_sku && !listingMap.has(i.marketplace_sku))
    .map(i => {
      const sku = i.marketplace_sku;
      if (sku.startsWith('ING-')) return sku.replace('ING-', '');
      return null;
    })
    .filter(Boolean) as string[];

  const usinToCost = new Map<string, { cost: number; supplierName: string }>();
  if (usinSkus.length > 0) {
    const uniqueUsins = [...new Set(usinSkus)];
    const CHUNK = 500;
    for (let i = 0; i < uniqueUsins.length; i += CHUNK) {
      const chunk = uniqueUsins.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
      const usinResult = await pool.query(
        `SELECT p.usin, p.cost, COALESCE(s.name, 'Ingram Micro') as supplier_name
         FROM products p
         LEFT JOIN product_suppliers ps ON ps.product_id = p.id
         LEFT JOIN suppliers s ON s.id = ps.supplier_id
         WHERE p.usin IN (${placeholders}) AND p.cost IS NOT NULL AND p.cost != ''`,
        chunk
      );
      for (const row of usinResult.rows) {
        if (row.usin && row.cost) {
          const costNum = parseFloat(row.cost);
          if (!isNaN(costNum) && costNum > 0) {
            usinToCost.set(row.usin, { cost: Math.round(costNum * 100), supplierName: row.supplier_name });
          }
        }
      }
    }
  }
  log(`Found ${usinToCost.size} product costs matched by USIN (Ingram Part Number)`);

  const updates: { id: number; vendorCostInCents: number; vendorName: string; method: string }[] = [];

  for (const item of needsCost) {
    const sku = item.marketplace_sku;
    if (!sku) continue;

    const listing = listingMap.get(sku);
    if (listing?.upc) {
      const costData = upcToCost.get(listing.upc);
      if (costData) {
        updates.push({ id: item.id, vendorCostInCents: costData.cost, vendorName: costData.supplierName, method: 'upc' });
        result.matchedByUpc++;
        continue;
      }
    }

    if (sku.startsWith('ING-')) {
      const ingramPart = sku.replace('ING-', '');
      const costData = usinToCost.get(ingramPart);
      if (costData) {
        updates.push({ id: item.id, vendorCostInCents: costData.cost, vendorName: costData.supplierName, method: 'usin' });
        result.matchedByUsin++;
        continue;
      }
    }

    result.unmatched++;
  }

  result.matched = updates.length;
  log(`Matched ${result.matched} items: ${result.matchedByUpc} by UPC, ${result.matchedByUsin} by USIN, ${result.matchedByMpn} by MPN`);

  if (updates.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      for (const update of batch) {
        await pool.query(
          `UPDATE marketplace_order_items 
           SET vendor_cost_in_cents = $1, vendor_name = $2, updated_at = NOW()
           WHERE id = $3 AND (vendor_cost_in_cents IS NULL OR vendor_cost_in_cents = 0)`,
          [update.vendorCostInCents, update.vendorName, update.id]
        );
        result.totalCostPopulated += update.vendorCostInCents;
      }
    }
    log(`Updated ${updates.length} items with vendor costs (total: $${(result.totalCostPopulated / 100).toFixed(2)})`);
  }

  return result;
}
