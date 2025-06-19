/**
 * Enhanced Amazon SP-API Validation with Real-time Data Verification
 * Integrates with existing comprehensive search and validation systems
 */

import { comprehensiveAmazonSearch } from './comprehensive-amazon-search';
import { asinValidator, ProductMatchData } from './asin-validation';
import { getCatalogItem, searchCatalogItemsByUPC } from './amazon-spapi';
import { db } from '../db';
import { eq } from 'drizzle-orm';

export interface ProductValidationReport {
  sku: string;
  productId: number;
  validationResults: Map<string, any>;
  recommendedActions: RecommendedAction[];
  confidence: number;
  status: 'validated' | 'needs_review' | 'failed';
}

export interface RecommendedAction {
  type: 'fix_mapping' | 'update_catalog' | 'manual_review' | 'ignore';
  description: string;
  priority: 'high' | 'medium' | 'low';
  data?: any;
}

export class EnhancedAmazonValidator {
  
  /**
   * Comprehensive product validation using all available data sources
   */
  async validateProductComprehensively(productId: number): Promise<ProductValidationReport> {
    try {
      // Get product data from catalog
      const { pool } = await import('../db');
      const productResult = await pool.query(`
        SELECT p.*, STRING_AGG(pam.asin, ',') as current_asins
        FROM products p
        LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
        WHERE p.id = $1
        GROUP BY p.id
      `, [productId]);

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${productId} not found`);
      }

      const product = productResult.rows[0];
      const currentAsins = product.current_asins ? product.current_asins.split(',') : [];

      // Perform comprehensive Amazon search
      const searchResults = await comprehensiveAmazonSearch({
        upc: product.upc,
        mpn: product.manufacturer_part_number,
        description: product.description,
        brand: product.brand,
        name: product.name
      });

      const validationResults = new Map();
      const recommendedActions: RecommendedAction[] = [];
      let overallConfidence = 1.0;

      // Validate each current ASIN mapping
      for (const asin of currentAsins) {
        if (asin) {
          const validation = await this.validateSingleASIN(asin, product);
          validationResults.set(asin, validation);
          
          if (!validation.success) {
            overallConfidence -= 0.3;
            recommendedActions.push({
              type: 'fix_mapping',
              description: `ASIN ${asin} failed validation: ${validation.errors.map(e => e.message).join(', ')}`,
              priority: 'high',
              data: { asin, errors: validation.errors }
            });
          }
        }
      }

      // Check if comprehensive search found better ASINs
      const bestMatches = searchResults.slice(0, 3);
      for (const match of bestMatches) {
        if (!currentAsins.includes(match.asin)) {
          recommendedActions.push({
            type: 'update_catalog',
            description: `Found potential better ASIN: ${match.asin} (${match.matchMethod}, confidence: ${match.confidence})`,
            priority: match.confidence > 0.8 ? 'high' : 'medium',
            data: { asin: match.asin, match }
          });
        }
      }

      // Validate product data completeness
      const completenessCheck = this.validateProductCompleteness(product);
      if (completenessCheck.warnings.length > 0) {
        overallConfidence -= 0.1;
        recommendedActions.push({
          type: 'manual_review',
          description: `Product data incomplete: ${completenessCheck.warnings.map(w => w.message).join(', ')}`,
          priority: 'medium',
          data: { warnings: completenessCheck.warnings }
        });
      }

      // Determine overall status
      let status: 'validated' | 'needs_review' | 'failed' = 'validated';
      const criticalIssues = recommendedActions.filter(a => a.priority === 'high').length;
      
      if (criticalIssues > 0) {
        status = overallConfidence < 0.5 ? 'failed' : 'needs_review';
      } else if (recommendedActions.length > 0) {
        status = 'needs_review';
      }

      return {
        sku: product.sku,
        productId,
        validationResults,
        recommendedActions,
        confidence: overallConfidence,
        status
      };

    } catch (error) {
      console.error(`Error validating product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Validate single ASIN against Amazon SP-API
   */
  private async validateSingleASIN(asin: string, catalogProduct: any): Promise<any> {
    try {
      // Get fresh Amazon data
      const amazonData = await getCatalogItem(asin, {
        clientId: process.env.AMAZON_SP_API_CLIENT_ID!,
        clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET!,
        refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN!,
        marketplaceId: 'ATVPDKIKX0DER',
        endpoint: 'https://sellingpartnerapi-na.amazon.com'
      });

      if (!amazonData || amazonData.errors) {
        return {
          success: false,
          errors: [{
            field: 'asin',
            message: `ASIN ${asin} not found in Amazon catalog or API error`,
            severity: 'critical',
            code: 'ASIN_NOT_FOUND'
          }]
        };
      }

      // Create ProductMatchData objects
      const amazonProductData: ProductMatchData = {
        asin,
        upc: this.extractIdentifier(amazonData, 'UPC'),
        mpn: this.extractIdentifier(amazonData, 'MPN'),
        title: amazonData.summaries?.[0]?.itemName || '',
        brand: amazonData.attributes?.brand?.[0]?.value || '',
        category: amazonData.summaries?.[0]?.browseClassification?.displayName || '',
        imageUrl: amazonData.summaries?.[0]?.mainImage?.link || '',
        source: 'amazon_api'
      };

      const catalogProductData: ProductMatchData = {
        asin,
        upc: catalogProduct.upc,
        mpn: catalogProduct.manufacturer_part_number,
        title: catalogProduct.name,
        brand: catalogProduct.brand,
        category: catalogProduct.category,
        imageUrl: catalogProduct.image_url,
        source: 'master_catalog'
      };

      // Use existing validation logic
      return await asinValidator.validateASINMapping(amazonProductData, catalogProductData);

    } catch (error) {
      console.error(`Error validating ASIN ${asin}:`, error);
      return {
        success: false,
        errors: [{
          field: 'general',
          message: `Validation error: ${error.message}`,
          severity: 'critical',
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * Validate product data completeness
   */
  private validateProductCompleteness(product: any): { warnings: any[] } {
    const warnings: any[] = [];

    const requiredFields = ['sku', 'name', 'upc'];
    const recommendedFields = ['brand', 'manufacturer_part_number', 'description', 'category'];

    for (const field of requiredFields) {
      if (!product[field]) {
        warnings.push({
          field,
          message: `Missing required field: ${field}`,
          severity: 'high'
        });
      }
    }

    for (const field of recommendedFields) {
      if (!product[field]) {
        warnings.push({
          field,
          message: `Missing recommended field: ${field}`,
          severity: 'medium'
        });
      }
    }

    return { warnings };
  }

  /**
   * Extract identifier from Amazon catalog response
   */
  private extractIdentifier(amazonData: any, type: 'UPC' | 'MPN'): string | undefined {
    const identifiers = amazonData.identifiers;
    if (!identifiers) return undefined;

    for (const identifier of identifiers) {
      if (identifier.identifierType === type) {
        return identifier.identifier;
      }
    }
    return undefined;
  }

  /**
   * Batch validate products with progress tracking and rate limiting
   */
  async batchValidateProducts(
    productIds: number[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      onProgress?: (completed: number, total: number, current?: ProductValidationReport) => void;
    } = {}
  ): Promise<ProductValidationReport[]> {
    const {
      batchSize = 10,
      delayBetweenBatches = 2000,
      onProgress
    } = options;

    const results: ProductValidationReport[] = [];
    let completed = 0;

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (productId) => {
        try {
          const report = await this.validateProductComprehensively(productId);
          completed++;
          
          if (onProgress) {
            onProgress(completed, productIds.length, report);
          }
          
          return report;
        } catch (error) {
          console.error(`Failed to validate product ${productId}:`, error);
          completed++;
          
          if (onProgress) {
            onProgress(completed, productIds.length);
          }
          
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as ProductValidationReport[]);

      // Rate limiting delay between batches
      if (i + batchSize < productIds.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }
}

// Export singleton instance
export const enhancedAmazonValidator = new EnhancedAmazonValidator();