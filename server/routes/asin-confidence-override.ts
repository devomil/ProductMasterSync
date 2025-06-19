/**
 * ASIN Confidence Override API Routes
 * 
 * Allows users to manually override confidence scores and set primary ASINs
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * POST /asin-confidence-override/manual-override
 * Manually override confidence score and set ASIN as primary
 */
router.post('/manual-override', async (req, res) => {
  try {
    const { 
      productId, 
      asin, 
      overrideReason, 
      setPrimary = true, 
      userConfidenceScore,
      overrideFlags = []
    } = req.body;

    if (!productId || !asin || !overrideReason) {
      return res.status(400).json({
        success: false,
        error: 'Product ID, ASIN, and override reason are required'
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // If setting as primary, remove primary flag from other ASINs for this product
      if (setPrimary) {
        await client.query(`
          UPDATE product_asin_mapping 
          SET is_primary = false 
          WHERE product_id = $1 AND asin != $2
        `, [productId, asin]);
      }

      // Update the ASIN mapping with override information
      const updateResult = await client.query(`
        UPDATE product_asin_mapping 
        SET 
          is_primary = $3,
          match_confidence = $4,
          mapping_source = 'manual_override',
          override_reason = $5,
          override_flags = $6,
          override_timestamp = NOW(),
          match_method = 'user_override'
        WHERE product_id = $1 AND asin = $2
        RETURNING *
      `, [
        productId, 
        asin, 
        setPrimary, 
        userConfidenceScore || 100,
        overrideReason,
        JSON.stringify(overrideFlags)
      ]);

      if (updateResult.rows.length === 0) {
        throw new Error('ASIN mapping not found for this product');
      }

      // Log the override action
      await client.query(`
        INSERT INTO asin_override_log (
          product_id, 
          asin, 
          override_reason, 
          previous_confidence, 
          new_confidence,
          override_flags,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        productId,
        asin,
        overrideReason,
        updateResult.rows[0].match_confidence,
        userConfidenceScore || 100,
        JSON.stringify(overrideFlags)
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'ASIN confidence override applied successfully',
        updatedMapping: updateResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error applying ASIN confidence override:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply confidence override',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /asin-confidence-override/override-history/:productId
 * Get override history for a product
 */
router.get('/override-history/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await pool.query(`
      SELECT 
        aol.*,
        acd.title as amazon_title,
        acd.brand as amazon_brand,
        acd.image_url
      FROM asin_override_log aol
      LEFT JOIN amazon_catalog_data acd ON aol.asin = acd.asin
      WHERE aol.product_id = $1
      ORDER BY aol.created_at DESC
    `, [productId]);

    res.json({
      success: true,
      overrideHistory: result.rows
    });

  } catch (error) {
    console.error('Error fetching override history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch override history'
    });
  }
});

/**
 * DELETE /asin-confidence-override/remove-override
 * Remove manual override and restore automatic confidence scoring
 */
router.delete('/remove-override', async (req, res) => {
  try {
    const { productId, asin } = req.body;

    if (!productId || !asin) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and ASIN are required'
      });
    }

    await pool.query(`
      UPDATE product_asin_mapping 
      SET 
        mapping_source = 'automatic',
        override_reason = NULL,
        override_flags = NULL,
        override_timestamp = NULL,
        match_method = 'confidence_based'
      WHERE product_id = $1 AND asin = $2
    `, [productId, asin]);

    res.json({
      success: true,
      message: 'Manual override removed successfully'
    });

  } catch (error) {
    console.error('Error removing override:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove override'
    });
  }
});

export default router;