/**
 * Amazon Product Data Service
 * Dedicated service for storing and retrieving complete Amazon product data
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface AmazonProductData {
  asin: string;
  title: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  upc?: string;
  ean?: string;
  partNumber?: string;
  primaryImageUrl?: string;
  additionalImages?: string[];
  features?: string[];
  description?: string;
  categoryPath?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
  };
  pricing?: {
    currentPrice?: number;
    listPrice?: number;
    dealPrice?: number;
  };
  salesRank?: number;
  categoryRank?: number;
  availability?: string;
  fulfillmentMethod?: string;
  isPrime?: boolean;
  isAmazonChoice?: boolean;
  lastUpdated: Date;
}

export class AmazonProductDataService {
  
  /**
   * Initialize the Amazon product data table
   */
  async initializeTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS amazon_product_data (
          id SERIAL PRIMARY KEY,
          asin VARCHAR(20) UNIQUE NOT NULL,
          title TEXT,
          brand VARCHAR(255),
          manufacturer VARCHAR(255),
          model VARCHAR(255),
          upc VARCHAR(20),
          ean VARCHAR(20),
          part_number VARCHAR(255),
          primary_image_url TEXT,
          additional_images JSONB,
          features JSONB,
          description TEXT,
          category_path TEXT,
          dimensions JSONB,
          pricing JSONB,
          sales_rank INTEGER,
          category_rank INTEGER,
          availability VARCHAR(100),
          fulfillment_method VARCHAR(50),
          is_prime BOOLEAN DEFAULT false,
          is_amazon_choice BOOLEAN DEFAULT false,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for better performance
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_amazon_product_asin ON amazon_product_data(asin)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_amazon_product_upc ON amazon_product_data(upc)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_amazon_product_updated ON amazon_product_data(last_updated)`);
      
      console.log('✓ Amazon product data table initialized');
    } catch (error) {
      console.error('Error initializing Amazon product data table:', error);
      throw error;
    }
  }

  /**
   * Store Amazon product data
   */
  async storeProductData(productData: AmazonProductData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO amazon_product_data (
          asin, title, brand, manufacturer, model, upc, ean, part_number,
          primary_image_url, additional_images, features, description,
          category_path, dimensions, pricing, sales_rank, category_rank,
          availability, fulfillment_method, is_prime, is_amazon_choice, last_updated
        ) VALUES (
          ${productData.asin},
          ${productData.title || null},
          ${productData.brand || null},
          ${productData.manufacturer || null},
          ${productData.model || null},
          ${productData.upc || null},
          ${productData.ean || null},
          ${productData.partNumber || null},
          ${productData.primaryImageUrl || null},
          ${JSON.stringify(productData.additionalImages || [])},
          ${JSON.stringify(productData.features || [])},
          ${productData.description || null},
          ${productData.categoryPath || null},
          ${JSON.stringify(productData.dimensions || {})},
          ${JSON.stringify(productData.pricing || {})},
          ${productData.salesRank || null},
          ${productData.categoryRank || null},
          ${productData.availability || null},
          ${productData.fulfillment_method || null},
          ${productData.isPrime || false},
          ${productData.isAmazonChoice || false},
          ${productData.lastUpdated}
        )
        ON CONFLICT (asin) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          manufacturer = EXCLUDED.manufacturer,
          model = EXCLUDED.model,
          upc = EXCLUDED.upc,
          ean = EXCLUDED.ean,
          part_number = EXCLUDED.part_number,
          primary_image_url = EXCLUDED.primary_image_url,
          additional_images = EXCLUDED.additional_images,
          features = EXCLUDED.features,
          description = EXCLUDED.description,
          category_path = EXCLUDED.category_path,
          dimensions = EXCLUDED.dimensions,
          pricing = EXCLUDED.pricing,
          sales_rank = EXCLUDED.sales_rank,
          category_rank = EXCLUDED.category_rank,
          availability = EXCLUDED.availability,
          fulfillment_method = EXCLUDED.fulfillment_method,
          is_prime = EXCLUDED.is_prime,
          is_amazon_choice = EXCLUDED.is_amazon_choice,
          last_updated = EXCLUDED.last_updated
      `);
    } catch (error) {
      console.error('Error storing Amazon product data:', error);
      throw error;
    }
  }

  /**
   * Get product data by ASIN
   */
  async getProductByAsin(asin: string): Promise<AmazonProductData | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM amazon_product_data WHERE asin = ${asin}
      `);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      return {
        asin: row.asin,
        title: row.title,
        brand: row.brand,
        manufacturer: row.manufacturer,
        model: row.model,
        upc: row.upc,
        ean: row.ean,
        partNumber: row.part_number,
        primaryImageUrl: row.primary_image_url,
        additionalImages: row.additional_images ? JSON.parse(row.additional_images) : [],
        features: row.features ? JSON.parse(row.features) : [],
        description: row.description,
        categoryPath: row.category_path,
        dimensions: row.dimensions ? JSON.parse(row.dimensions) : {},
        pricing: row.pricing ? JSON.parse(row.pricing) : {},
        salesRank: row.sales_rank,
        categoryRank: row.category_rank,
        availability: row.availability,
        fulfillmentMethod: row.fulfillment_method,
        isPrime: row.is_prime,
        isAmazonChoice: row.is_amazon_choice,
        lastUpdated: new Date(row.last_updated)
      };
    } catch (error) {
      console.error('Error getting Amazon product data:', error);
      return null;
    }
  }

  /**
   * Get products with images for opportunities display
   */
  async getProductsForOpportunities(limit: number = 50): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          apd.asin,
          apd.title as amazon_title,
          apd.brand as amazon_brand,
          apd.primary_image_url as amazon_image_url,
          apd.pricing,
          apd.sales_rank,
          apd.category_rank,
          apd.fulfillment_method,
          apd.is_prime,
          p.id as product_id,
          p.sku,
          p.name as product_name,
          p.upc,
          p.image_url as supplier_image_url,
          p.price as current_price,
          p.cost,
          c.name as category_name,
          pam.is_active
        FROM amazon_product_data apd
        INNER JOIN product_asin_mapping pam ON apd.asin = pam.asin
        INNER JOIN products p ON pam.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE pam.is_active = true
          AND apd.primary_image_url IS NOT NULL
        ORDER BY apd.sales_rank ASC NULLS LAST
        LIMIT ${limit}
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting products for opportunities:', error);
      return [];
    }
  }

  /**
   * Bulk store product data from Amazon API responses
   */
  async bulkStoreProducts(products: AmazonProductData[]): Promise<void> {
    console.log(`Storing ${products.length} Amazon products...`);
    
    for (const product of products) {
      await this.storeProductData(product);
    }
    
    console.log(`✓ Stored ${products.length} Amazon products`);
  }
}

export const amazonProductDataService = new AmazonProductDataService();