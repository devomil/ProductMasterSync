import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Correct ASIN mapping for a specific product
 * This endpoint allows manual correction when UPC search returns wrong ASIN
 */
router.post('/correct-mapping', async (req, res) => {
  try {
    const { sku, correctAsin, reason } = req.body;
    
    if (!sku || !correctAsin) {
      return res.status(400).json({
        success: false,
        error: 'SKU and correct ASIN are required'
      });
    }

    const { pool } = await import('../db');
    
    // First ensure the ASIN exists in amazon_asins table
    await pool.query(`
      INSERT INTO amazon_asins (asin) 
      VALUES ($1) 
      ON CONFLICT (asin) DO NOTHING
    `, [correctAsin]);
    
    // Update the product ASIN mapping
    const updateResult = await pool.query(`
      UPDATE product_asin_mapping 
      SET asin = $1, updated_at = NOW()
      WHERE product_id = (SELECT id FROM products WHERE sku = $2)
      RETURNING *
    `, [correctAsin, sku]);
    
    if (updateResult.rows.length === 0) {
      // If no mapping exists, create one
      const productResult = await pool.query('SELECT id FROM products WHERE sku = $1', [sku]);
      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      await pool.query(`
        INSERT INTO product_asin_mapping (product_id, asin, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `, [productResult.rows[0].id, correctAsin]);
    }
    
    // Log the correction
    await pool.query(`
      INSERT INTO validation_log (
        asin, sku, action_type, details, timestamp
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [correctAsin, sku, 'asin_correction', reason || 'Manual ASIN correction']);
    
    res.json({
      success: true,
      message: `SKU ${sku} ASIN corrected to ${correctAsin}`,
      mapping: updateResult.rows[0] || { sku, asin: correctAsin }
    });
    
  } catch (error) {
    console.error('Error correcting ASIN mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to correct ASIN mapping'
    });
  }
});

/**
 * Batch correct multiple ASIN mappings
 */
router.post('/batch-correct', async (req, res) => {
  try {
    const { corrections } = req.body; // Array of {sku, correctAsin, reason}
    
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Corrections array is required'
      });
    }

    const { pool } = await import('../db');
    const results = [];
    
    for (const correction of corrections) {
      const { sku, correctAsin, reason } = correction;
      
      try {
        // Ensure ASIN exists
        await pool.query(`
          INSERT INTO amazon_asins (asin) 
          VALUES ($1) 
          ON CONFLICT (asin) DO NOTHING
        `, [correctAsin]);
        
        // Update mapping
        const updateResult = await pool.query(`
          UPDATE product_asin_mapping 
          SET asin = $1, updated_at = NOW()
          WHERE product_id = (SELECT id FROM products WHERE sku = $2)
          RETURNING *
        `, [correctAsin, sku]);
        
        if (updateResult.rows.length === 0) {
          // Create new mapping if none exists
          const productResult = await pool.query('SELECT id FROM products WHERE sku = $1', [sku]);
          if (productResult.rows.length > 0) {
            await pool.query(`
              INSERT INTO product_asin_mapping (product_id, asin, created_at, updated_at)
              VALUES ($1, $2, NOW(), NOW())
            `, [productResult.rows[0].id, correctAsin]);
          }
        }
        
        // Log correction
        await pool.query(`
          INSERT INTO validation_log (
            asin, sku, action_type, details, timestamp
          ) VALUES ($1, $2, $3, $4, NOW())
        `, [correctAsin, sku, 'batch_asin_correction', reason || 'Batch ASIN correction']);
        
        results.push({
          sku,
          correctAsin,
          status: 'success'
        });
        
      } catch (error) {
        results.push({
          sku,
          correctAsin,
          status: 'error',
          error: (error as Error).message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${corrections.length} corrections`,
      results
    });
    
  } catch (error) {
    console.error('Error in batch correction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch corrections'
    });
  }
});

/**
 * Get validation log for ASIN corrections
 */
router.get('/validation-log', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const { pool } = await import('../db');
    const result = await pool.query(`
      SELECT * FROM validation_log 
      WHERE action_type LIKE '%correction%'
      ORDER BY timestamp DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json({
      success: true,
      logs: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching validation log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation log'
    });
  }
});

export default router;