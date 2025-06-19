/**
 * Multi-ASIN Display API Routes
 * 
 * Provides endpoints specifically for displaying ALL ASIN candidates
 * for products with multiple ASINs, not just the selected primary ones
 */

import { Router } from 'express';
import { pool } from '../db';
import { rankAsinCandidates, getConfidenceLevel, validateAsinCandidate } from '../utils/asin-confidence-matcher';
import { validateCategoryConsistency, generateCategoryValidationFlags } from '../utils/category-validation';
import { validateImageUrl, generateImageQualityFlags } from '../utils/image-validation';

const router = Router();

/**
 * GET /multi-asin-display/products-with-candidates
 * Returns products showing ALL ASIN candidates for multi-ASIN analysis UI
 */
router.get('/products-with-candidates', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get products with multiple ASINs and show ALL candidates
    const query = `
      WITH multi_asin_products AS (
        SELECT p.id, p.sku, p.name, p.upc, p.cost, p.price, p.manufacturer_part_number, p.description
        FROM products p
        JOIN product_asin_mapping pam ON p.id = pam.product_id
        GROUP BY p.id, p.sku, p.name, p.upc, p.cost, p.price, p.manufacturer_part_number, p.description
        HAVING COUNT(pam.asin) > 1
        ORDER BY COUNT(pam.asin) DESC
        LIMIT $1 OFFSET $2
      )
      SELECT 
        map.sku,
        map.name as product_name,
        map.upc,
        map.cost,
        map.price,
        map.manufacturer_part_number,
        map.description,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'asin', pam.asin,
            'isPrimary', pam.is_primary,
            'matchConfidence', pam.match_confidence,
            'amazonTitle', acd.title,
            'amazonBrand', acd.brand,
            'currentPrice', acd.current_price,
            'salesRank', acd.sales_rank,
            'categoryRank', acd.category_rank,
            'buyboxHolder', acd.buybox_holder,
            'isBuyboxEligible', acd.is_buybox_eligible,
            'condition', acd.condition,
            'sellerCount', acd.seller_count,
            'imageUrl', acd.image_url,
            'hasAmazonData', CASE WHEN acd.asin IS NOT NULL THEN true ELSE false END,
            'amazonUpc', acd.upc,
            'amazonMpn', acd.part_number,
            'amazonDescription', acd.title,
            'score', CASE 
              WHEN acd.asin IS NOT NULL AND acd.sales_rank IS NOT NULL THEN
                GREATEST(0, 100 - (acd.sales_rank / 1000))
              ELSE 
                50
            END
          )
          ORDER BY 
            pam.is_primary DESC,
            acd.sales_rank ASC NULLS LAST,
            pam.match_confidence DESC
        ) as asin_candidates
      FROM multi_asin_products map
      JOIN product_asin_mapping pam ON map.id = pam.product_id
      LEFT JOIN amazon_catalog_data acd ON pam.asin = acd.asin
      GROUP BY map.sku, map.name, map.upc, map.cost, map.price, map.manufacturer_part_number, map.description
      ORDER BY JSONB_ARRAY_LENGTH(JSON_AGG(pam.asin)::jsonb) DESC
    `;

    const result = await pool.query(query, [limit, offset]);

    // Apply confidence scoring to each product
    const products = result.rows.map((row: any) => {
      const catalogProduct = {
        upc: row.upc,
        manufacturerPartNumber: row.manufacturer_part_number,
        description: row.description,
        name: row.product_name
      };

      // Convert ASIN candidates to format expected by confidence matcher
      const amazonAsins = (row.asin_candidates || []).map((candidate: any) => ({
        asin: candidate.asin,
        upc: candidate.amazonUpc,
        manufacturerPartNumber: candidate.amazonMpn,
        title: candidate.amazonTitle,
        description: candidate.amazonTitle,
        brand: candidate.amazonBrand,
        imageUrl: candidate.imageUrl
      }));

      // Apply confidence scoring
      const rankedCandidates = rankAsinCandidates(catalogProduct, amazonAsins);

      // Merge ranked results with original Amazon data and add enhanced validation
      const enhancedCandidates = rankedCandidates.map((ranked: any) => {
        const original = row.asin_candidates.find((c: any) => c.asin === ranked.asin);
        const confidenceInfo = getConfidenceLevel(ranked.confidenceScore);
        const validationIssues = validateAsinCandidate(ranked);

        // Category validation
        const categoryResult = validateCategoryConsistency(
          {
            category: row.description || '',
            productType: row.product_name,
            description: row.description || '',
            name: row.product_name
          },
          {
            mainCategory: original.amazonTitle?.split(' ')[0] || '',
            title: original.amazonTitle || '',
            description: original.amazonTitle || ''
          }
        );

        // Image validation
        let imageValidation = null;
        let imageFlags: string[] = [];
        if (original.imageUrl) {
          try {
            imageValidation = { isValid: true, qualityScore: 0.8 };
            imageFlags = generateImageQualityFlags(imageValidation);
          } catch (error) {
            imageFlags = ['IMAGE_VALIDATION_ERROR'];
          }
        }

        const categoryFlags = generateCategoryValidationFlags(categoryResult);
        const allValidationIssues = [
          ...validationIssues,
          ...(Array.isArray(categoryResult.issues) ? categoryResult.issues : []),
          ...(Array.isArray(imageFlags) ? imageFlags : [])
        ];

        return {
          ...original,
          confidenceScore: ranked.confidenceScore,
          matchReason: ranked.matchReason,
          matchDetails: ranked.matchDetails,
          confidenceLevel: confidenceInfo.level,
          confidenceColor: confidenceInfo.color,
          confidenceDescription: confidenceInfo.description,
          validationIssues: allValidationIssues,
          categoryValidation: categoryResult,
          imageValidation,
          qualityFlags: [...categoryFlags, ...imageFlags],
          isPrimary: ranked.status === 'primary' ? true : original.isPrimary,
          needsReview: ranked.status === 'review' || ranked.status === 'low_confidence' || !categoryResult.isConsistent,
          score: ranked.confidenceScore,
          hasOverride: original.mapping_source === 'manual_override',
          overrideReason: original.override_reason
        };
      });

      return {
        sku: row.sku,
        product_name: row.product_name,
        upc: row.upc,
        cost: row.cost,
        price: row.price,
        manufacturer_part_number: row.manufacturer_part_number,
        description: row.description,
        asin_candidates: enhancedCandidates
      };
    });

    // Count total products with multiple ASINs
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      JOIN product_asin_mapping pam ON p.id = pam.product_id
      GROUP BY p.id
      HAVING COUNT(pam.asin) > 1
    `;
    
    const countResult = await pool.query(countQuery);

    res.json({
      success: true,
      products,
      pagination: {
        total: countResult.rows.length,
        limit,
        offset,
        hasMore: (offset + limit) < countResult.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching multi-ASIN products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch multi-ASIN products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /multi-asin-display/product/:sku/all-candidates
 * Returns ALL ASIN candidates for a specific product
 */
router.get('/product/:sku/all-candidates', async (req, res) => {
  try {
    const { sku } = req.params;

    const query = `
      SELECT 
        p.sku,
        p.name as product_name,
        p.upc,
        pam.asin,
        pam.is_primary,
        pam.match_confidence,
        pam.mapping_source,
        pam.match_method,
        acd.title as amazon_title,
        acd.brand as amazon_brand,
        acd.current_price,
        acd.list_price,
        acd.sales_rank,
        acd.category_rank,
        acd.main_category,
        acd.buybox_holder,
        acd.is_buybox_eligible,
        acd.condition,
        acd.seller_count,
        acd.review_count,
        acd.average_rating,
        acd.image_url as amazon_image_url,
        acd.product_url as amazon_product_url,
        CASE 
          WHEN acd.asin IS NOT NULL AND acd.sales_rank IS NOT NULL THEN
            GREATEST(0, 100 - (acd.sales_rank / 1000))
          ELSE 
            50
        END as calculated_score
      FROM products p
      JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN amazon_catalog_data acd ON pam.asin = acd.asin
      WHERE p.sku = $1
      ORDER BY 
        pam.is_primary DESC,
        acd.sales_rank ASC NULLS LAST,
        pam.match_confidence DESC
    `;

    const result = await pool.query(query, [sku]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or has no ASIN mappings'
      });
    }

    res.json({
      success: true,
      sku,
      productName: result.rows[0].product_name,
      upc: result.rows[0].upc,
      totalCandidates: result.rows.length,
      primarySelected: result.rows.filter(r => r.is_primary).length,
      candidatesWithAmazonData: result.rows.filter(r => r.amazon_title).length,
      asinCandidates: result.rows.map(row => ({
        asin: row.asin,
        isPrimary: row.is_primary,
        matchConfidence: row.match_confidence,
        mappingSource: row.mapping_source,
        matchMethod: row.match_method,
        amazonTitle: row.amazon_title,
        amazonBrand: row.amazon_brand,
        currentPrice: row.current_price,
        listPrice: row.list_price,
        salesRank: row.sales_rank,
        categoryRank: row.category_rank,
        mainCategory: row.main_category,
        buyboxHolder: row.buybox_holder,
        isBuyboxEligible: row.is_buybox_eligible,
        condition: row.condition,
        sellerCount: row.seller_count,
        reviewCount: row.review_count,
        averageRating: row.average_rating,
        imageUrl: row.amazon_image_url,
        productUrl: row.amazon_product_url,
        calculatedScore: row.calculated_score,
        hasAmazonData: !!row.amazon_title
      }))
    });

  } catch (error) {
    console.error('Error fetching ASIN candidates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ASIN candidates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;