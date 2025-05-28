import { db } from '../db';
import { products, productSuppliers } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';

interface DeduplicationResult {
  action: 'created' | 'updated' | 'skipped';
  productId: number;
  reason?: string;
  matchedFields?: string[];
}

interface ProductData {
  sku?: string;
  usin?: string;
  upc?: string;
  manufacturerPartNumber?: string;
  name?: string;
  supplierId: number;
  [key: string]: any;
}

export class AdvancedDeduplicationEngine {
  /**
   * Advanced deduplication with multiple matching strategies
   */
  async processProduct(productData: ProductData): Promise<DeduplicationResult> {
    // Strategy 1: Exact USIN match (highest priority)
    if (productData.usin) {
      const exactUsinMatch = await this.findByUsin(productData.usin);
      if (exactUsinMatch) {
        await this.updateProduct(exactUsinMatch.id, productData);
        return {
          action: 'updated',
          productId: exactUsinMatch.id,
          reason: 'Exact USIN match found',
          matchedFields: ['usin']
        };
      }
    }

    // Strategy 2: UPC + Manufacturer Part Number match
    if (productData.upc && productData.manufacturerPartNumber) {
      const upcMpnMatch = await this.findByUpcAndMpn(
        productData.upc, 
        productData.manufacturerPartNumber
      );
      if (upcMpnMatch) {
        await this.updateProduct(upcMpnMatch.id, productData);
        return {
          action: 'updated',
          productId: upcMpnMatch.id,
          reason: 'UPC + MPN match found',
          matchedFields: ['upc', 'manufacturerPartNumber']
        };
      }
    }

    // Strategy 3: Fuzzy name matching with same supplier
    if (productData.name && productData.supplierId) {
      const fuzzyNameMatch = await this.findByFuzzyNameAndSupplier(
        productData.name,
        productData.supplierId
      );
      if (fuzzyNameMatch) {
        await this.updateProduct(fuzzyNameMatch.id, productData);
        return {
          action: 'updated',
          productId: fuzzyNameMatch.id,
          reason: 'Fuzzy name match with same supplier',
          matchedFields: ['name', 'supplier']
        };
      }
    }

    // Strategy 4: Create new product if no matches found
    const newProduct = await this.createProduct(productData);
    return {
      action: 'created',
      productId: newProduct.id,
      reason: 'No duplicates found - new product created'
    };
  }

  /**
   * Find product by exact USIN match
   */
  private async findByUsin(usin: string) {
    return await db.query.products.findFirst({
      where: eq(products.usin, usin)
    });
  }

  /**
   * Find product by UPC and Manufacturer Part Number combination
   */
  private async findByUpcAndMpn(upc: string, mpn: string) {
    return await db.query.products.findFirst({
      where: and(
        eq(products.upc, upc),
        eq(products.manufacturerPartNumber, mpn)
      )
    });
  }

  /**
   * Find product by fuzzy name matching within same supplier
   */
  private async findByFuzzyNameAndSupplier(name: string, supplierId: number) {
    // Clean and normalize product name for comparison
    const cleanName = this.cleanProductName(name);
    
    // Use PostgreSQL's similarity function for fuzzy matching
    const results = await db.execute(sql`
      SELECT p.* FROM products p
      INNER JOIN product_suppliers ps ON p.id = ps.product_id
      WHERE ps.supplier_id = ${supplierId}
      AND similarity(lower(regexp_replace(p.name, '[^a-zA-Z0-9 ]', '', 'g')), ${cleanName}) > 0.8
      ORDER BY similarity(lower(regexp_replace(p.name, '[^a-zA-Z0-9 ]', '', 'g')), ${cleanName}) DESC
      LIMIT 1
    `);

    return results.rows.length > 0 ? results.rows[0] : null;
  }

  /**
   * Clean product name for comparison
   */
  private cleanProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .trim();
  }

  /**
   * Update existing product with new data
   */
  private async updateProduct(productId: number, productData: ProductData) {
    const updateData: any = {
      updatedAt: new Date()
    };

    // Only update fields that have meaningful values
    if (productData.name) updateData.name = productData.name;
    if (productData.upc) updateData.upc = productData.upc;
    if (productData.price !== undefined) updateData.price = productData.price;
    if (productData.cost !== undefined) updateData.cost = productData.cost;
    if (productData.description) updateData.description = productData.description;
    if (productData.categoryId) updateData.categoryId = productData.categoryId;
    if (productData.manufacturerName) updateData.manufacturerName = productData.manufacturerName;
    if (productData.manufacturerPartNumber) updateData.manufacturerPartNumber = productData.manufacturerPartNumber;
    if (productData.weight) updateData.weight = productData.weight;
    if (productData.imageUrl) updateData.imageUrl = productData.imageUrl;
    if (productData.imageUrlLarge) updateData.imageUrlLarge = productData.imageUrlLarge;
    if (productData.status) updateData.status = productData.status;

    await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, productId));

    // Update or create supplier relationship
    await this.updateSupplierRelationship(productId, productData);

    return { id: productId };
  }

  /**
   * Create new product
   */
  private async createProduct(productData: ProductData) {
    const [newProduct] = await db
      .insert(products)
      .values({
        sku: productData.sku || `AUTO-${Date.now()}`,
        usin: productData.usin,
        name: productData.name || 'Unnamed Product',
        upc: productData.upc,
        price: productData.price,
        cost: productData.cost,
        description: productData.description,
        categoryId: productData.categoryId,
        manufacturerName: productData.manufacturerName,
        manufacturerPartNumber: productData.manufacturerPartNumber,
        weight: productData.weight,
        imageUrl: productData.imageUrl,
        imageUrlLarge: productData.imageUrlLarge,
        status: productData.status || 'active'
      })
      .returning();

    // Create supplier relationship
    await this.updateSupplierRelationship(newProduct.id, productData);

    return newProduct;
  }

  /**
   * Update or create supplier relationship
   */
  private async updateSupplierRelationship(productId: number, productData: ProductData) {
    if (!productData.supplierId) return;

    const supplierData = {
      productId,
      supplierId: productData.supplierId,
      supplierSku: productData.supplierSku || productData.sku,
      cost: productData.supplierCost || productData.cost,
      stock: productData.supplierStock || 0,
      leadTimeDays: productData.supplierLeadTime || 1,
      updatedAt: new Date()
    };

    await db
      .insert(productSuppliers)
      .values(supplierData)
      .onConflictDoUpdate({
        target: [productSuppliers.productId, productSuppliers.supplierId],
        set: {
          cost: supplierData.cost,
          stock: supplierData.stock,
          leadTimeDays: supplierData.leadTimeDays,
          updatedAt: supplierData.updatedAt
        }
      });
  }

  /**
   * Batch process multiple products with deduplication
   */
  async batchProcessProducts(productsData: ProductData[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
    results: DeduplicationResult[];
  }> {
    const results: DeduplicationResult[] = [];
    let created = 0, updated = 0, skipped = 0;

    for (const productData of productsData) {
      try {
        const result = await this.processProduct(productData);
        results.push(result);

        switch (result.action) {
          case 'created': created++; break;
          case 'updated': updated++; break;
          case 'skipped': skipped++; break;
        }
      } catch (error) {
        console.error('Error processing product:', error);
        results.push({
          action: 'skipped',
          productId: -1,
          reason: `Error: ${error.message}`
        });
        skipped++;
      }
    }

    return { created, updated, skipped, results };
  }

  /**
   * Get deduplication statistics
   */
  async getDeduplicationStats() {
    const totalProducts = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
    const duplicatesByUpc = await db.execute(sql`
      SELECT upc, COUNT(*) as count 
      FROM products 
      WHERE upc IS NOT NULL AND upc != ''
      GROUP BY upc 
      HAVING COUNT(*) > 1
    `);
    const duplicatesByMpn = await db.execute(sql`
      SELECT manufacturer_part_number, COUNT(*) as count 
      FROM products 
      WHERE manufacturer_part_number IS NOT NULL AND manufacturer_part_number != ''
      GROUP BY manufacturer_part_number 
      HAVING COUNT(*) > 1
    `);

    return {
      totalProducts: totalProducts.rows[0].count,
      potentialUpcDuplicates: duplicatesByUpc.rows.length,
      potentialMpnDuplicates: duplicatesByMpn.rows.length
    };
  }
}

export const deduplicationEngine = new AdvancedDeduplicationEngine();