import { db, pool } from './db';
import { queryCache } from './query-cache';

// Performance-optimized database queries using raw SQL for speed
export class PerformanceOptimizedQueries {
  
  // Fast product listing with minimal fields using raw SQL
  static async getProductsOptimized(): Promise<any[]> {
    const cacheKey = 'products:optimized';
    const cached = queryCache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Optimized SQL query for faster performance
    const productsQuery = `
      SELECT p.id, p.sku, p.usin, p.name, p.description,
             p.category_id as "categoryId",
             p.manufacturer_name as "manufacturerName",
             p.manufacturer_part_number as "manufacturerPartNumber",
             p.upc, p.price, p.cost, p.weight, p.status,
             p.is_remanufactured as "isRemanufactured",
             p.is_closeout as "isCloseout", 
             p.is_on_sale as "isOnSale",
             p.has_rebate as "hasRebate",
             p.has_free_shipping as "hasFreeShipping",
             p.inventory_quantity as "inventoryQuantity",
             p.image_url as "imageUrl",
             p.image_url_large as "imageUrlLarge",
             p.last_amazon_sync as "lastAmazonSync",
             p.amazon_sync_status as "amazonSyncStatus",
             p.created_at as "createdAt",
             p.updated_at as "updatedAt"
      FROM products p
      ORDER BY p.id DESC
      LIMIT 5000
    `;

    const result = await pool.query(productsQuery);
    const products = result.rows;

    queryCache.set(cacheKey, products, 20000); // 20 second cache
    return products;
  }

  // Fast category listing with product counts using raw SQL
  static async getCategoriesOptimized(): Promise<any[]> {
    const cacheKey = 'categories:optimized';
    const cached = queryCache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categoriesQuery = `
      SELECT c.id, c.name, c.code, c.parent_id as "parentId",
             c.level, c.path, c.created_at as "createdAt",
             c.updated_at as "updatedAt", c.attributes::text as attributes,
             COALESCE(COUNT(p.id), 0)::int as "productCount"
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.code, c.parent_id, c.level, c.path, c.created_at, c.updated_at, c.attributes
      ORDER BY c.level, c.name
    `;

    const result = await pool.query(categoriesQuery);
    const categories = result.rows;

    queryCache.set(cacheKey, categories, 30000); // 30 second cache
    return categories;
  }

  // Fast supplier listing using raw SQL
  static async getSuppliersOptimized(): Promise<any[]> {
    const cacheKey = 'suppliers:optimized';
    const cached = queryCache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const suppliersQuery = `
      SELECT id, name, code, active, contact_name as "contactName",
             contact_email as "contactEmail", contact_phone as "contactPhone",
             data_sources as "dataSource", notes, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM suppliers
      ORDER BY name
    `;

    const result = await pool.query(suppliersQuery);
    const suppliers = result.rows;

    queryCache.set(cacheKey, suppliers, 30000); // 30 second cache
    return suppliers;
  }

  // Cache invalidation helpers
  static invalidateProductCache(): void {
    queryCache.invalidate('products');
  }

  static invalidateCategoryCache(): void {
    queryCache.invalidate('categories');
  }

  static invalidateSupplierCache(): void {
    queryCache.invalidate('suppliers');
  }

  static invalidateAllCache(): void {
    queryCache.clear();
  }
}