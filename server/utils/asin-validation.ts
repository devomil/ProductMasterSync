/**
 * ASIN Validation and Product Detail Verification Utility
 * Implements safeguards for mapping Amazon SP-API results to master catalog
 */

import { db } from '../db';
import { products, productAsinMapping } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ProductMatchData {
  asin: string;
  upc?: string;
  mpn?: string;
  title: string;
  brand?: string;
  category?: string;
  price?: number;
  salesRank?: number;
  imageUrl?: string;
  source: 'amazon_api' | 'master_catalog' | 'supplier';
}

export class ASINValidator {
  private static instance: ASINValidator;
  private validationLogs: ValidationLog[] = [];

  public static getInstance(): ASINValidator {
    if (!ASINValidator.instance) {
      ASINValidator.instance = new ASINValidator();
    }
    return ASINValidator.instance;
  }

  /**
   * Validate ASIN mapping between Amazon API and master catalog
   */
  async validateASINMapping(
    amazonData: ProductMatchData,
    catalogData: ProductMatchData
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let confidence = 1.0;

    // Critical ASIN validation
    if (amazonData.asin !== catalogData.asin) {
      errors.push({
        field: 'asin',
        message: `ASIN mismatch: Amazon API returned ${amazonData.asin} but catalog expects ${catalogData.asin}`,
        severity: 'critical',
        code: 'ASIN_MISMATCH'
      });
      confidence -= 0.8;
    }

    // UPC cross-validation
    if (amazonData.upc && catalogData.upc && amazonData.upc !== catalogData.upc) {
      errors.push({
        field: 'upc',
        message: `UPC mismatch: Amazon ${amazonData.upc} vs Catalog ${catalogData.upc}`,
        severity: 'high',
        code: 'UPC_MISMATCH'
      });
      confidence -= 0.3;
    }

    // MPN cross-validation
    if (amazonData.mpn && catalogData.mpn && amazonData.mpn !== catalogData.mpn) {
      warnings.push({
        field: 'mpn',
        message: `MPN mismatch: Amazon ${amazonData.mpn} vs Catalog ${catalogData.mpn}`,
        suggestion: 'Verify manufacturer part number with supplier'
      });
      confidence -= 0.1;
    }

    // Required field validation
    const requiredFields = ['asin', 'title'];
    for (const field of requiredFields) {
      if (!amazonData[field as keyof ProductMatchData]) {
        errors.push({
          field,
          message: `Missing required field: ${field}`,
          severity: 'critical',
          code: 'MISSING_REQUIRED_FIELD'
        });
        confidence -= 0.4;
      }
    }

    // Category validation
    if (!amazonData.category) {
      warnings.push({
        field: 'category',
        message: 'Missing Amazon category information',
        suggestion: 'Use master catalog category as fallback'
      });
      confidence -= 0.05;
    }

    // Price validation
    if (amazonData.price && amazonData.price <= 0) {
      errors.push({
        field: 'price',
        message: 'Invalid price value from Amazon API',
        severity: 'medium',
        code: 'INVALID_PRICE'
      });
      confidence -= 0.2;
    }

    // Image URL validation
    if (!amazonData.imageUrl) {
      warnings.push({
        field: 'imageUrl',
        message: 'Missing Amazon product image',
        suggestion: 'Use supplier image as fallback'
      });
      confidence -= 0.1;
    }

    // Log validation attempt
    this.logValidation({
      asin: amazonData.asin,
      success: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      confidence,
      timestamp: new Date()
    });

    return {
      success: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      confidence: Math.max(0, confidence)
    };
  }

  /**
   * Cross-reference ASIN with multiple data sources
   */
  async crossReferenceASIN(asin: string): Promise<{
    amazonExists: boolean;
    catalogExists: boolean;
    supplierExists: boolean;
    conflictingData: any[];
  }> {
    try {
      // Check Amazon product data table
      const amazonResult = await db.query(`
        SELECT COUNT(*) as count FROM amazon_product_data WHERE asin = $1
      `, [asin]);
      const amazonExists = parseInt(amazonResult.rows[0].count) > 0;

      // Check product ASIN mappings
      const catalogResult = await db.query(`
        SELECT COUNT(*) as count FROM product_asin_mapping WHERE asin = $1
      `, [asin]);
      const catalogExists = parseInt(catalogResult.rows[0].count) > 0;

      // Check supplier data (if ASIN appears in supplier files)
      const supplierResult = await db.query(`
        SELECT COUNT(*) as count FROM import_data 
        WHERE data_json::text ILIKE '%${asin}%'
      `);
      const supplierExists = parseInt(supplierResult.rows[0].count) > 0;

      // Identify conflicting data
      const conflictingData = await this.findConflictingData(asin);

      return {
        amazonExists,
        catalogExists,
        supplierExists,
        conflictingData
      };
    } catch (error) {
      console.error('Error cross-referencing ASIN:', error);
      return {
        amazonExists: false,
        catalogExists: false,
        supplierExists: false,
        conflictingData: []
      };
    }
  }

  /**
   * Apply fallback logic for missing or invalid data
   */
  applyFallbackLogic(amazonData: ProductMatchData, catalogData?: ProductMatchData): ProductMatchData {
    const result = { ...amazonData };

    // Use catalog data as fallback
    if (catalogData) {
      if (!result.category && catalogData.category) {
        result.category = catalogData.category;
      }
      
      if (!result.brand && catalogData.brand) {
        result.brand = catalogData.brand;
      }

      if (!result.imageUrl && catalogData.imageUrl) {
        result.imageUrl = catalogData.imageUrl;
      }
    }

    // Apply default values for missing critical fields
    if (!result.salesRank) {
      result.salesRank = 999999; // Default to low rank
    }

    if (!result.price) {
      result.price = 0; // Will be flagged for manual review
    }

    return result;
  }

  /**
   * Generate automated alerts for discrepancies
   */
  async generateAlert(validation: ValidationResult, asin: string): Promise<void> {
    const criticalErrors = validation.errors.filter(e => e.severity === 'critical');
    
    if (criticalErrors.length > 0) {
      // Store alert in database
      await db.query(`
        INSERT INTO validation_alerts (asin, severity, error_count, message, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        asin,
        'critical',
        criticalErrors.length,
        criticalErrors.map(e => e.message).join('; '),
        new Date()
      ]);

      // Log for immediate attention
      console.error(`CRITICAL VALIDATION ALERT for ASIN ${asin}:`, criticalErrors);
    }

    if (validation.confidence < 0.7) {
      await db.query(`
        INSERT INTO validation_alerts (asin, severity, error_count, message, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        asin,
        'low_confidence',
        validation.errors.length,
        `Low confidence mapping: ${validation.confidence.toFixed(2)}`,
        new Date()
      ]);
    }
  }

  /**
   * Batch validate multiple ASINs with progress tracking
   */
  async batchValidate(
    asinBatch: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    let processed = 0;

    for (const asin of asinBatch) {
      try {
        // Get Amazon data (mock for now, replace with actual API call)
        const amazonData = await this.getAmazonData(asin);
        const catalogData = await this.getCatalogData(asin);

        if (amazonData && catalogData) {
          const validation = await this.validateASINMapping(amazonData, catalogData);
          results.set(asin, validation);

          // Generate alerts if needed
          await this.generateAlert(validation, asin);
        }

        processed++;
        if (onProgress) {
          onProgress(processed, asinBatch.length);
        }

        // Rate limiting for millions of products
        if (processed % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Error validating ASIN ${asin}:`, error);
        results.set(asin, {
          success: false,
          errors: [{
            field: 'general',
            message: `Validation failed: ${error.message}`,
            severity: 'critical',
            code: 'VALIDATION_ERROR'
          }],
          warnings: [],
          confidence: 0
        });
      }
    }

    return results;
  }

  private async findConflictingData(asin: string): Promise<any[]> {
    // Implementation to find conflicting data across sources
    return [];
  }

  private async getAmazonData(asin: string): Promise<ProductMatchData | null> {
    // Implementation to get Amazon data
    return null;
  }

  private async getCatalogData(asin: string): Promise<ProductMatchData | null> {
    // Implementation to get catalog data
    return null;
  }

  private logValidation(log: ValidationLog): void {
    this.validationLogs.push(log);
    
    // Keep only last 10000 logs in memory
    if (this.validationLogs.length > 10000) {
      this.validationLogs = this.validationLogs.slice(-5000);
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    successRate: number;
    averageConfidence: number;
    commonErrors: string[];
  } {
    const total = this.validationLogs.length;
    const successful = this.validationLogs.filter(l => l.success).length;
    const avgConfidence = this.validationLogs.reduce((sum, l) => sum + l.confidence, 0) / total;

    return {
      totalValidations: total,
      successRate: total > 0 ? successful / total : 0,
      averageConfidence: avgConfidence || 0,
      commonErrors: [] // Implementation to track common errors
    };
  }
}

interface ValidationLog {
  asin: string;
  success: boolean;
  errorCount: number;
  warningCount: number;
  confidence: number;
  timestamp: Date;
}

// Export singleton instance
export const asinValidator = ASINValidator.getInstance();