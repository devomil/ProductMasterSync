import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Calculate and update supplier trust score
async function calculateTrustScore(supplierId: number) {
  try {
    // Get supplier data quality metrics
    const dataQualityQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN p.upc IS NOT NULL THEN 1 END) as has_upc,
        COUNT(CASE WHEN p.manufacturer_part_number IS NOT NULL THEN 1 END) as has_mpn,
        COUNT(CASE WHEN p.description IS NOT NULL AND LENGTH(p.description) > 10 THEN 1 END) as has_description,
        COUNT(CASE WHEN p.category_id IS NOT NULL THEN 1 END) as has_category
      FROM products p 
      WHERE p.supplier_id = $1
    `;

    const dataResult = await pool.query(dataQualityQuery, [supplierId]);
    const data = dataResult.rows[0];

    // Calculate data quality score (0-100)
    const dataQualityScore = data.total_products > 0 ? 
      Math.round(((parseInt(data.has_upc) + parseInt(data.has_mpn) + parseInt(data.has_description) + parseInt(data.has_category)) / (parseInt(data.total_products) * 4)) * 100) : 50;

    // Get ASIN mapping reliability metrics
    const reliabilityQuery = `
      SELECT 
        COUNT(*) as total_mappings,
        COUNT(CASE WHEN pam.match_confidence > 90 THEN 1 END) as high_confidence,
        COUNT(CASE WHEN pam.match_confidence > 75 THEN 1 END) as medium_confidence,
        COUNT(CASE WHEN aco.id IS NOT NULL THEN 1 END) as manual_overrides
      FROM products p
      JOIN product_asin_mapping pam ON p.id = pam.product_id
      LEFT JOIN asin_confidence_overrides aco ON p.id = aco.product_id AND pam.asin = aco.asin
      WHERE p.supplier_id = $1
    `;

    const reliabilityResult = await pool.query(reliabilityQuery, [supplierId]);
    const reliability = reliabilityResult.rows[0];

    // Calculate reliability score (0-100)
    const reliabilityScore = reliability.total_mappings > 0 ?
      Math.round(((parseInt(reliability.high_confidence) * 1.0 + parseInt(reliability.medium_confidence) * 0.7) / parseInt(reliability.total_mappings)) * 100) : 50;

    // Get accuracy metrics from successful matches
    const accuracyQuery = `
      SELECT 
        COUNT(*) as validated_mappings,
        AVG(pam.match_confidence) as avg_confidence
      FROM products p
      JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.supplier_id = $1 AND pam.is_primary = true
    `;

    const accuracyResult = await pool.query(accuracyQuery, [supplierId]);
    const accuracy = accuracyResult.rows[0];

    // Calculate accuracy score (0-100)
    const accuracyScore = accuracy.validated_mappings > 0 ?
      Math.round(parseFloat(accuracy.avg_confidence)) : 50;

    // Calculate overall trust score (weighted average)
    const trustScore = Math.round((dataQualityScore * 0.3 + reliabilityScore * 0.4 + accuracyScore * 0.3));

    // Update or insert trust score
    const upsertQuery = `
      INSERT INTO supplier_trust_scores 
      (supplier_id, trust_score, data_quality_score, reliability_score, accuracy_score, 
       total_overrides, successful_matches, failed_matches, last_calculated, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (supplier_id) DO UPDATE SET
        trust_score = EXCLUDED.trust_score,
        data_quality_score = EXCLUDED.data_quality_score,
        reliability_score = EXCLUDED.reliability_score,
        accuracy_score = EXCLUDED.accuracy_score,
        total_overrides = EXCLUDED.total_overrides,
        successful_matches = EXCLUDED.successful_matches,
        failed_matches = EXCLUDED.failed_matches,
        last_calculated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [
      supplierId,
      trustScore,
      dataQualityScore,
      reliabilityScore,
      accuracyScore,
      parseInt(reliability.manual_overrides) || 0,
      parseInt(accuracy.validated_mappings) || 0,
      0 // failed matches calculation can be added later
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error calculating trust score:', error);
    throw error;
  }
}

// Get supplier trust score
router.get('/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;

    const query = `
      SELECT sts.*, s.name as supplier_name
      FROM supplier_trust_scores sts
      JOIN suppliers s ON sts.supplier_id = s.id
      WHERE sts.supplier_id = $1
    `;

    const result = await pool.query(query, [supplierId]);

    if (result.rows.length === 0) {
      // Calculate trust score if not exists
      const trustScore = await calculateTrustScore(parseInt(supplierId));
      return res.json({
        success: true,
        trustScore
      });
    }

    res.json({
      success: true,
      trustScore: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching trust score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trust score'
    });
  }
});

// Update trust score manually or recalculate
router.post('/:supplierId/calculate', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const trustScore = await calculateTrustScore(parseInt(supplierId));

    res.json({
      success: true,
      trustScore,
      message: 'Trust score recalculated successfully'
    });
  } catch (error) {
    console.error('Error calculating trust score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate trust score'
    });
  }
});

// Get all supplier trust scores
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT sts.*, s.name as supplier_name, s.code as supplier_code
      FROM supplier_trust_scores sts
      JOIN suppliers s ON sts.supplier_id = s.id
      ORDER BY sts.trust_score DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      trustScores: result.rows
    });
  } catch (error) {
    console.error('Error fetching trust scores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trust scores'
    });
  }
});

export default router;