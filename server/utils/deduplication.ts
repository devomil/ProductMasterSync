import { db } from '../db';
import { products, productSuppliers } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface DuplicateGroup {
  name: string;
  manufacturerPartNumber: string;
  products: Array<{
    id: number;
    sku: string;
    price: number | null;
    cost: number | null;
    weight: number | null;
    description: string | null;
  }>;
}

export async function deduplicateProducts(): Promise<{
  success: boolean;
  deduplicatedCount: number;
  consolidatedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deduplicatedCount = 0;
  let consolidatedCount = 0;

  try {
    // Find duplicate groups by name and manufacturer part number
    const duplicateGroups = await db
      .select({
        name: products.name,
        manufacturerPartNumber: products.manufacturerPartNumber,
        productIds: sql<string>`string_agg(${products.id}::text, ',')`,
        skus: sql<string>`string_agg(${products.sku}, ',')`,
        count: sql<number>`count(*)`,
      })
      .from(products)
      .where(and(
        sql`${products.name} IS NOT NULL`,
        sql`${products.manufacturerPartNumber} IS NOT NULL`
      ))
      .groupBy(products.name, products.manufacturerPartNumber)
      .having(sql`count(*) > 1`);

    console.log(`Found ${duplicateGroups.length} duplicate groups`);

    for (const group of duplicateGroups) {
      const productIds = group.productIds.split(',').map(id => parseInt(id));
      
      // Get full product details for this group
      const duplicateProducts = await db
        .select()
        .from(products)
        .where(sql`${products.id} = ANY(${productIds})`);

      if (duplicateProducts.length <= 1) continue;

      // Choose the "master" product (first one with lowest ID)
      const masterProduct = duplicateProducts.sort((a, b) => a.id - b.id)[0];
      const duplicatesToRemove = duplicateProducts.slice(1);

      console.log(`Consolidating ${duplicateProducts.length} products into master: ${masterProduct.sku}`);

      // Update product-supplier relationships to point to master product
      for (const duplicate of duplicatesToRemove) {
        try {
          await db
            .update(productSuppliers)
            .set({ productId: masterProduct.id })
            .where(eq(productSuppliers.productId, duplicate.id));

          // Delete the duplicate product
          await db
            .delete(products)
            .where(eq(products.id, duplicate.id));

          deduplicatedCount++;
        } catch (error) {
          errors.push(`Failed to process duplicate product ${duplicate.sku}: ${error}`);
        }
      }

      consolidatedCount++;
    }

    return {
      success: true,
      deduplicatedCount,
      consolidatedCount,
      errors
    };

  } catch (error) {
    errors.push(`Deduplication failed: ${error}`);
    return {
      success: false,
      deduplicatedCount,
      consolidatedCount,
      errors
    };
  }
}

export async function findDuplicateStats(): Promise<{
  totalProducts: number;
  duplicateGroups: number;
  duplicateProducts: number;
}> {
  try {
    const totalProducts = await db
      .select({ count: sql<number>`count(*)` })
      .from(products);

    const duplicateGroups = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(
        db
          .select({
            name: products.name,
            manufacturerPartNumber: products.manufacturerPartNumber,
            productCount: sql<number>`count(*)`,
          })
          .from(products)
          .where(and(
            sql`${products.name} IS NOT NULL`,
            sql`${products.manufacturerPartNumber} IS NOT NULL`
          ))
          .groupBy(products.name, products.manufacturerPartNumber)
          .having(sql`count(*) > 1`)
          .as('duplicates')
      );

    const duplicateProducts = await db
      .select({
        totalDuplicates: sql<number>`sum(dup_count - 1)`,
      })
      .from(
        db
          .select({
            dupCount: sql<number>`count(*) as dup_count`,
          })
          .from(products)
          .where(and(
            sql`${products.name} IS NOT NULL`,
            sql`${products.manufacturerPartNumber} IS NOT NULL`
          ))
          .groupBy(products.name, products.manufacturerPartNumber)
          .having(sql`count(*) > 1`)
          .as('dups')
      );

    return {
      totalProducts: totalProducts[0]?.count || 0,
      duplicateGroups: duplicateGroups[0]?.count || 0,
      duplicateProducts: duplicateProducts[0]?.totalDuplicates || 0,
    };
  } catch (error) {
    console.error('Error calculating duplicate stats:', error);
    return {
      totalProducts: 0,
      duplicateGroups: 0,
      duplicateProducts: 0,
    };
  }
}