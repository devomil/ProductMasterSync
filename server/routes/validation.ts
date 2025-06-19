/**
 * ASIN Validation and Monitoring Routes
 */

import { Router } from 'express';
import { asinValidator, ValidationResult } from '../utils/asin-validation';
import { db } from '../db';

const router = Router();

/**
 * Validate a single ASIN mapping
 */
router.post('/validate-asin/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const { amazonData, catalogData } = req.body;

    if (!amazonData || !catalogData) {
      return res.status(400).json({
        success: false,
        error: 'Both amazonData and catalogData are required'
      });
    }

    const validation = await asinValidator.validateASINMapping(amazonData, catalogData);
    
    res.json({
      success: true,
      asin,
      validation
    });

  } catch (error) {
    console.error('Error validating ASIN:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during validation'
    });
  }
});

/**
 * Cross-reference ASIN with multiple data sources
 */
router.get('/cross-reference/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    
    const crossReference = await asinValidator.crossReferenceASIN(asin);
    
    res.json({
      success: true,
      asin,
      crossReference
    });

  } catch (error) {
    console.error('Error cross-referencing ASIN:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during cross-reference'
    });
  }
});

/**
 * Batch validate multiple ASINs
 */
router.post('/batch-validate', async (req, res) => {
  try {
    const { asins, batchSize = 50 } = req.body;

    if (!Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }

    // Limit batch size for performance
    const limitedAsins = asins.slice(0, Math.min(batchSize, 100));
    
    const results = await asinValidator.batchValidate(limitedAsins, (processed, total) => {
      console.log(`Validation progress: ${processed}/${total}`);
    });

    // Convert Map to object for JSON response
    const resultObject = Object.fromEntries(results);

    res.json({
      success: true,
      totalProcessed: limitedAsins.length,
      results: resultObject,
      stats: asinValidator.getValidationStats()
    });

  } catch (error) {
    console.error('Error in batch validation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during batch validation'
    });
  }
});

/**
 * Get validation alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { severity, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT * FROM validation_alerts 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (severity) {
      query += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    res.json({
      success: true,
      alerts: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching validation alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error fetching alerts'
    });
  }
});

/**
 * Mark alert as resolved
 */
router.patch('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy, notes } = req.body;

    await db.query(`
      UPDATE validation_alerts 
      SET resolved = true, resolved_at = $1, resolved_by = $2, resolution_notes = $3
      WHERE id = $4
    `, [new Date(), resolvedBy, notes, alertId]);

    res.json({
      success: true,
      message: 'Alert marked as resolved'
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error resolving alert'
    });
  }
});

/**
 * Get validation statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = asinValidator.getValidationStats();
    
    // Get database stats
    const dbStats = await db.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_alerts
      FROM validation_alerts
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        alerts: dbStats.rows[0]
      }
    });

  } catch (error) {
    console.error('Error fetching validation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error fetching stats'
    });
  }
});

/**
 * Test validation with sample data
 */
router.post('/test-validation', async (req, res) => {
  try {
    const sampleAmazonData = {
      asin: 'B000U0JLO6',
      upc: '010342050458',
      mpn: 'SP-5-B',
      title: 'RITCHIE SP-5-B GLOBEMASTER COMPASS PEDESTAL MOUNT - BLACK',
      brand: 'Ritchie',
      category: 'Sports & Outdoors',
      price: 75.99,
      salesRank: 12345,
      imageUrl: 'https://images-na.ssl-images-amazon.com/images/P/B000U0JLO6.01.L.jpg',
      source: 'amazon_api' as const
    };

    const sampleCatalogData = {
      asin: 'B000U0JLO6',
      upc: '010342050458',
      mpn: 'SP-5-B',
      title: 'RITCHIE SP-5-B GLOBEMASTER COMPASS PEDESTAL MOUNT - BLACK',
      brand: 'Ritchie',
      category: 'Marine Navigation',
      price: 76.50,
      imageUrl: 'https://productimageserver.com/product/xl/10350XL.jpg',
      source: 'master_catalog' as const
    };

    const validation = await asinValidator.validateASINMapping(sampleAmazonData, sampleCatalogData);

    res.json({
      success: true,
      testData: {
        amazonData: sampleAmazonData,
        catalogData: sampleCatalogData
      },
      validation
    });

  } catch (error) {
    console.error('Error in test validation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during test validation'
    });
  }
});

export default router;