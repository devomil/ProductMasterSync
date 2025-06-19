/**
 * Low Confidence Fallback API Routes
 * 
 * Provides alternative ASIN suggestions and detailed explanations for low confidence matches
 */

import { Router } from 'express';
import { pool } from '../db';
import { rankAsinCandidates, getConfidenceLevel, validateAsinCandidate } from '../utils/asin-confidence-matcher';
import { validateCategoryConsistency, generateCategoryValidationFlags } from '../utils/category-validation';
import { validateImageUrl, generateImageQualityFlags } from '../utils/image-validation';

const router = Router();

/**
 * GET /low-confidence-fallback/alternative-matches/:productId
 * Get alternative ASIN matches for products with low confidence scores
 */
router.get('/alternative-matches/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { includeDescriptionSearch = true, includeManufacturerSearch = true } = req.query;

    // Get product details
    const productResult = await pool.query(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productResult.rows[0];
    
    // Get current ASIN mappings with confidence scores
    const currentMappings = await pool.query(`
      SELECT pam.*, acd.*
      FROM product_asin_mapping pam
      LEFT JOIN amazon_catalog_data acd ON pam.asin = acd.asin
      WHERE pam.product_id = $1
      ORDER BY pam.match_confidence DESC NULLS LAST
    `, [productId]);

    const alternatives = {
      currentMappings: [],
      upcAlternatives: [],
      descriptionAlternatives: [],
      manufacturerAlternatives: [],
      categoryAlternatives: []
    };

    // Process current mappings with detailed analysis
    for (const mapping of currentMappings.rows) {
      const analysisResult = await analyzeAsinMatch(product, mapping);
      alternatives.currentMappings.push(analysisResult);
    }

    // Search for UPC-based alternatives
    if (product.upc) {
      const upcAlternatives = await pool.query(`
        SELECT DISTINCT acd.*, 'upc_match' as match_method
        FROM amazon_catalog_data acd
        WHERE acd.upc = $1
          AND acd.asin NOT IN (
            SELECT asin FROM product_asin_mapping WHERE product_id = $2
          )
        ORDER BY acd.sales_rank ASC NULLS LAST
        LIMIT 5
      `, [product.upc, productId]);

      for (const alt of upcAlternatives.rows) {
        const analysisResult = await analyzeAsinMatch(product, alt);
        alternatives.upcAlternatives.push(analysisResult);
      }
    }

    // Search for description-based alternatives
    if (includeDescriptionSearch === 'true' && product.description) {
      const keywords = extractSearchKeywords(product.description);
      if (keywords.length > 0) {
        const descAlternatives = await pool.query(`
          SELECT DISTINCT acd.*, 'description_match' as match_method,
            ts_rank(to_tsvector('english', acd.title || ' ' || COALESCE(acd.description, '')), 
                    plainto_tsquery('english', $1)) as relevance_score
          FROM amazon_catalog_data acd
          WHERE to_tsvector('english', acd.title || ' ' || COALESCE(acd.description, '')) 
                @@ plainto_tsquery('english', $1)
            AND acd.asin NOT IN (
              SELECT asin FROM product_asin_mapping WHERE product_id = $2
            )
          ORDER BY relevance_score DESC, acd.sales_rank ASC NULLS LAST
          LIMIT 5
        `, [keywords.slice(0, 5).join(' '), productId]);

        for (const alt of descAlternatives.rows) {
          const analysisResult = await analyzeAsinMatch(product, alt);
          alternatives.descriptionAlternatives.push(analysisResult);
        }
      }
    }

    // Search for manufacturer-based alternatives
    if (includeManufacturerSearch === 'true' && product.manufacturer_part_number) {
      const mfgAlternatives = await pool.query(`
        SELECT DISTINCT acd.*, 'manufacturer_match' as match_method
        FROM amazon_catalog_data acd
        WHERE acd.part_number = $1
          AND acd.asin NOT IN (
            SELECT asin FROM product_asin_mapping WHERE product_id = $2
          )
        ORDER BY acd.sales_rank ASC NULLS LAST
        LIMIT 5
      `, [product.manufacturer_part_number, productId]);

      for (const alt of mfgAlternatives.rows) {
        const analysisResult = await analyzeAsinMatch(product, alt);
        alternatives.manufacturerAlternatives.push(analysisResult);
      }
    }

    // Search for category-based alternatives
    if (product.category) {
      const categoryAlternatives = await pool.query(`
        SELECT DISTINCT acd.*, 'category_match' as match_method
        FROM amazon_catalog_data acd
        WHERE acd.main_category ILIKE $1
          AND acd.brand ILIKE $2
          AND acd.asin NOT IN (
            SELECT asin FROM product_asin_mapping WHERE product_id = $3
          )
        ORDER BY acd.sales_rank ASC NULLS LAST
        LIMIT 3
      `, [`%${product.category}%`, `%${product.brand || ''}%`, productId]);

      for (const alt of categoryAlternatives.rows) {
        const analysisResult = await analyzeAsinMatch(product, alt);
        alternatives.categoryAlternatives.push(analysisResult);
      }
    }

    res.json({
      success: true,
      productId,
      productName: product.name,
      alternatives,
      suggestions: generateFallbackSuggestions(alternatives)
    });

  } catch (error) {
    console.error('Error finding alternative matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find alternative matches'
    });
  }
});

/**
 * GET /low-confidence-fallback/rejection-analysis/:productId/:asin
 * Detailed analysis of why an ASIN was rejected or flagged
 */
router.get('/rejection-analysis/:productId/:asin', async (req, res) => {
  try {
    const { productId, asin } = req.params;

    // Get product and ASIN data
    const productResult = await pool.query(`
      SELECT * FROM products WHERE id = $1
    `, [productId]);

    const asinResult = await pool.query(`
      SELECT acd.*, pam.match_confidence, pam.override_reason, pam.mapping_source
      FROM amazon_catalog_data acd
      LEFT JOIN product_asin_mapping pam ON acd.asin = pam.asin AND pam.product_id = $1
      WHERE acd.asin = $2
    `, [productId, asin]);

    if (productResult.rows.length === 0 || asinResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product or ASIN not found'
      });
    }

    const product = productResult.rows[0];
    const asinData = asinResult.rows[0];

    const analysis = await analyzeAsinMatch(product, asinData);

    res.json({
      success: true,
      analysis,
      recommendations: generateDetailedRecommendations(analysis)
    });

  } catch (error) {
    console.error('Error analyzing rejection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze rejection'
    });
  }
});

/**
 * Analyze ASIN match quality with detailed breakdown
 */
async function analyzeAsinMatch(product: any, asinData: any) {
  const catalogProduct = {
    upc: product.upc,
    manufacturerPartNumber: product.manufacturer_part_number,
    description: product.description,
    name: product.name,
    category: product.category,
    productType: product.product_type
  };

  const amazonData = {
    asin: asinData.asin,
    upc: asinData.upc,
    manufacturerPartNumber: asinData.part_number,
    title: asinData.title,
    description: asinData.description,
    brand: asinData.brand,
    imageUrl: asinData.image_url,
    mainCategory: asinData.main_category,
    productType: asinData.product_type
  };

  // Confidence matching
  const confidenceResult = rankAsinCandidates(catalogProduct, [amazonData])[0];
  const confidenceInfo = getConfidenceLevel(confidenceResult.confidenceScore);
  const validationIssues = validateAsinCandidate(confidenceResult);

  // Category validation
  const categoryResult = validateCategoryConsistency(catalogProduct, amazonData);
  const categoryFlags = generateCategoryValidationFlags(categoryResult);

  // Image validation
  let imageResult = null;
  let imageFlags: string[] = [];
  if (asinData.image_url) {
    imageResult = await validateImageUrl(asinData.image_url);
    imageFlags = generateImageQualityFlags(imageResult);
  }

  return {
    asin: asinData.asin,
    amazonTitle: asinData.title,
    amazonBrand: asinData.brand,
    currentPrice: asinData.current_price,
    salesRank: asinData.sales_rank,
    imageUrl: asinData.image_url,
    matchMethod: asinData.match_method || 'unknown',
    
    confidence: {
      score: confidenceResult.confidenceScore,
      level: confidenceInfo.level,
      color: confidenceInfo.color,
      description: confidenceInfo.description,
      matchReason: confidenceResult.matchReason,
      matchDetails: confidenceResult.matchDetails,
      validationIssues
    },
    
    categoryValidation: {
      isConsistent: categoryResult.isConsistent,
      confidence: categoryResult.confidence,
      issues: categoryResult.issues,
      suggestions: categoryResult.suggestions,
      flags: categoryFlags
    },
    
    imageValidation: imageResult ? {
      isValid: imageResult.isValid,
      warnings: imageResult.warnings,
      metadata: imageResult.metadata,
      flags: imageFlags
    } : null,
    
    rejectionReasons: generateRejectionReasons(confidenceResult, categoryResult, imageResult),
    overallScore: calculateOverallScore(confidenceResult, categoryResult, imageResult)
  };
}

/**
 * Generate rejection reasons based on analysis
 */
function generateRejectionReasons(confidenceResult: any, categoryResult: any, imageResult: any): string[] {
  const reasons: string[] = [];

  if (confidenceResult.confidenceScore < 60) {
    reasons.push(`Low confidence match (${confidenceResult.confidenceScore}%)`);
  }

  if (!confidenceResult.matchDetails.upcMatch && !confidenceResult.matchDetails.mpnMatch) {
    reasons.push('No UPC or manufacturer part number match');
  }

  if (categoryResult && !categoryResult.isConsistent) {
    reasons.push('Category mismatch detected');
  }

  if (imageResult && !imageResult.isValid) {
    reasons.push('Image validation failed');
  }

  if (confidenceResult.matchDetails.descriptionMatch === false) {
    reasons.push('Product description does not match Amazon title');
  }

  return reasons;
}

/**
 * Calculate overall match score
 */
function calculateOverallScore(confidenceResult: any, categoryResult: any, imageResult: any): number {
  let score = confidenceResult.confidenceScore * 0.6; // 60% weight on confidence

  if (categoryResult) {
    score += categoryResult.confidence * 0.25; // 25% weight on category
  }

  if (imageResult && imageResult.isValid) {
    score += 15; // 15% bonus for valid image
  }

  return Math.min(100, Math.round(score));
}

/**
 * Extract search keywords from description
 */
function extractSearchKeywords(description: string): string[] {
  const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10);
}

/**
 * Generate fallback suggestions
 */
function generateFallbackSuggestions(alternatives: any): string[] {
  const suggestions: string[] = [];

  if (alternatives.upcAlternatives.length > 0) {
    suggestions.push(`Found ${alternatives.upcAlternatives.length} UPC-based alternatives`);
  }

  if (alternatives.descriptionAlternatives.length > 0) {
    suggestions.push(`Found ${alternatives.descriptionAlternatives.length} description-based alternatives`);
  }

  if (alternatives.currentMappings.length === 0) {
    suggestions.push('No current ASIN mappings found - consider manual search');
  }

  const lowConfidenceMappings = alternatives.currentMappings.filter((m: any) => m.confidence.score < 60);
  if (lowConfidenceMappings.length > 0) {
    suggestions.push(`${lowConfidenceMappings.length} current mappings have low confidence`);
  }

  return suggestions;
}

/**
 * Generate detailed recommendations
 */
function generateDetailedRecommendations(analysis: any): string[] {
  const recommendations: string[] = [];

  if (analysis.confidence.score < 60) {
    recommendations.push('Consider manual verification of this ASIN match');
  }

  if (analysis.categoryValidation && !analysis.categoryValidation.isConsistent) {
    recommendations.push('Review product category classification');
  }

  if (analysis.imageValidation && !analysis.imageValidation.isValid) {
    recommendations.push('Verify product image URL and accessibility');
  }

  if (analysis.rejectionReasons.length > 2) {
    recommendations.push('Multiple issues detected - consider alternative ASINs');
  }

  return recommendations;
}

export default router;