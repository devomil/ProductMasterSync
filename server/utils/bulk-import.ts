import { db } from "../db";
import { products, productSuppliers, mappingTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { processDescription, formatDescriptionForContext } from "./description-processor";

interface BulkImportConfig {
  batchSize: number;
  maxConcurrent: number;
  delayBetweenBatches: number;
}

interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: Date;
  errors: string[];
}

export class BulkImportProcessor {
  private config: BulkImportConfig;
  private progress: ImportProgress;

  constructor(config: Partial<BulkImportConfig> = {}) {
    this.config = {
      batchSize: config.batchSize || 100,
      maxConcurrent: config.maxConcurrent || 3,
      delayBetweenBatches: config.delayBetweenBatches || 100
    };
    
    this.progress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: new Date(),
      errors: []
    };
  }

  async importProducts(rawData: any[], mappingTemplateId: string, supplierId: number): Promise<ImportProgress> {
    console.log(`Starting bulk import of ${rawData.length} products`);
    
    this.progress.total = rawData.length;
    this.progress.startTime = new Date();

    // Get mapping template
    const [template] = await db
      .select()
      .from(mappingTemplates)
      .where(eq(mappingTemplates.id, mappingTemplateId));

    if (!template) {
      throw new Error(`Mapping template ${mappingTemplateId} not found`);
    }

    const mappings = template.mappings as Record<string, string>;

    // Process data in batches
    const batches = this.createBatches(rawData, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
      
      try {
        await this.processBatch(batch, mappings, supplierId);
        this.progress.processed += batch.length;
        this.progress.successful += batch.length;
        
        // Add delay between batches to prevent overwhelming the database
        if (i < batches.length - 1) {
          await this.delay(this.config.delayBetweenBatches);
        }
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error);
        this.progress.processed += batch.length;
        this.progress.failed += batch.length;
        this.progress.errors.push(`Batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const duration = Date.now() - this.progress.startTime.getTime();
    console.log(`Import completed in ${duration}ms. Success: ${this.progress.successful}, Failed: ${this.progress.failed}`);
    
    return this.progress;
  }

  private async processBatch(batch: any[], mappings: Record<string, string>, supplierId: number): Promise<void> {
    const transformedProducts = batch.map(rawProduct => this.transformProduct(rawProduct, mappings, supplierId));
    
    // Insert products in batch using transaction
    await db.transaction(async (tx) => {
      // Insert products
      for (const product of transformedProducts) {
        try {
          const [insertedProduct] = await tx
            .insert(products)
            .values({
              name: product.name,
              sku: product.sku,
              upc: product.upc,
              price: product.price,
              cost: product.cost,
              description: product.description,
              category: product.category,
              brand: product.brand,
              weight: product.weight,
              imageUrl: product.imageUrl,
              status: product.status || 'active'
            })
            .onConflictDoUpdate({
              target: products.sku,
              set: {
                name: product.name,
                price: product.price,
                cost: product.cost,
                description: product.description,
                category: product.category,
                brand: product.brand,
                weight: product.weight,
                imageUrl: product.imageUrl,
                updatedAt: new Date()
              }
            })
            .returning();

          // Insert supplier relationship
          if (product.supplierData) {
            await tx
              .insert(productSuppliers)
              .values({
                productId: insertedProduct.id,
                supplierId: supplierId,
                supplierSku: product.supplierData.sku,
                cost: product.supplierData.cost,
                stock: product.supplierData.stock || 0,
                leadTimeDays: product.supplierData.leadTime || 1
              })
              .onConflictDoUpdate({
                target: [productSuppliers.productId, productSuppliers.supplierId],
                set: {
                  cost: product.supplierData.cost,
                  stock: product.supplierData.stock || 0,
                  leadTimeDays: product.supplierData.leadTime || 1,
                  updatedAt: new Date()
                }
              });
          }
        } catch (error) {
          console.error(`Failed to insert product ${product.sku}:`, error);
          throw error;
        }
      }
    });
  }

  private transformProduct(rawProduct: any, mappings: Record<string, string>, supplierId: number): any {
    const transformed: any = {
      supplierData: {}
    };

    // Apply field mappings
    for (const [sourceField, targetField] of Object.entries(mappings)) {
      const value = rawProduct[sourceField];
      if (value !== undefined && value !== null && value !== '') {
        if (targetField.startsWith('supplier_')) {
          // This is supplier-specific data
          const supplierField = targetField.replace('supplier_', '');
          transformed.supplierData[supplierField] = this.cleanValue(value);
        } else {
          // This is product data
          if (targetField === 'description' && typeof value === 'string' && value.includes('<')) {
            // Automatically process HTML descriptions
            transformed[targetField] = formatDescriptionForContext(value, 'detail');
          } else {
            transformed[targetField] = this.cleanValue(value);
          }
        }
      }
    }

    // Ensure required fields have values
    if (!transformed.sku) {
      transformed.sku = rawProduct['CWR Part Number'] || rawProduct['sku'] || `UNKNOWN-${Date.now()}`;
    }
    if (!transformed.name) {
      transformed.name = rawProduct['Title'] || rawProduct['name'] || 'Unnamed Product';
    }

    // Convert price and cost to numbers
    if (transformed.price && typeof transformed.price === 'string') {
      transformed.price = parseFloat(transformed.price.replace(/[^0-9.-]/g, '')) || null;
    }
    if (transformed.cost && typeof transformed.cost === 'string') {
      transformed.cost = parseFloat(transformed.cost.replace(/[^0-9.-]/g, '')) || null;
    }

    // Handle supplier-specific data
    if (transformed.supplierData.cost && typeof transformed.supplierData.cost === 'string') {
      transformed.supplierData.cost = parseFloat(transformed.supplierData.cost.replace(/[^0-9.-]/g, '')) || null;
    }
    if (transformed.supplierData.stock && typeof transformed.supplierData.stock === 'string') {
      transformed.supplierData.stock = parseInt(transformed.supplierData.stock) || 0;
    }

    transformed.supplierData.sku = transformed.sku;

    return transformed;
  }

  private cleanValue(value: any): any {
    if (typeof value === 'string') {
      value = value.trim();
      if (value === '' || value === 'N/A' || value === 'NULL') {
        return null;
      }
      // Clean HTML tags from descriptions
      if (value.includes('<') && value.includes('>')) {
        value = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    return value;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProgress(): ImportProgress {
    return { ...this.progress };
  }
}

// Utility function for progress tracking
export function calculateProgress(current: number, total: number): {
  percentage: number;
  eta: number | null;
  rate: number;
} {
  const percentage = Math.round((current / total) * 100);
  
  // Simple rate calculation (items per second)
  const rate = current / (Date.now() / 1000);
  
  // Estimated time to completion
  const remaining = total - current;
  const eta = rate > 0 ? remaining / rate : null;
  
  return { percentage, eta, rate };
}