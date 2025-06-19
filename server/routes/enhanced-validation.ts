/**
 * Enhanced Validation Routes - Real Product Testing
 */

import { Router } from 'express';
import { enhancedAmazonValidator } from '../utils/enhanced-amazon-validation';
import { db } from '../db';

const router = Router();

/**
 * Comprehensive validation for a specific product
 */
router.post('/validate-product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }

    console.log(`Starting comprehensive validation for product ${productId}...`);
    
    const report = await enhancedAmazonValidator.validateProductComprehensively(productId);
    
    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Error in product validation:', error);
    res.status(500).json({
      success: false,
      error: `Validation failed: ${error.message}`
    });
  }
});

/**
 * Batch validate multiple products with progress tracking
 */
router.post('/batch-validate-products', async (req, res) => {
  try {
    const { productIds, batchSize = 5 } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs array is required'
      });
    }

    console.log(`Starting batch validation for ${productIds.length} products...`);
    
    const reports = await enhancedAmazonValidator.batchValidateProducts(
      productIds.slice(0, 10), // Limit to 10 for testing
      {
        batchSize,
        delayBetweenBatches: 1000,
        onProgress: (completed, total, current) => {
          console.log(`Validation progress: ${completed}/${total}`);
          if (current) {
            console.log(`Latest: ${current.sku} - ${current.status}`);
          }
        }
      }
    );

    // Calculate summary statistics
    const summary = {
      totalProcessed: reports.length,
      validated: reports.filter(r => r.status === 'validated').length,
      needsReview: reports.filter(r => r.status === 'needs_review').length,
      failed: reports.filter(r => r.status === 'failed').length,
      averageConfidence: reports.reduce((sum, r) => sum + r.confidence, 0) / reports.length || 0
    };

    res.json({
      success: true,
      summary,
      reports
    });

  } catch (error) {
    console.error('Error in batch validation:', error);
    res.status(500).json({
      success: false,
      error: `Batch validation failed: ${error.message}`
    });
  }
});

/**
 * Validate products with known issues (SKUs 165731, 370129)
 */
router.post('/validate-fixed-products', async (req, res) => {
  try {
    // Get product IDs for our test SKUs
    const testProducts = await db.query(`
      SELECT id, sku, name 
      FROM products 
      WHERE sku IN ('165731', '370129')
      ORDER BY sku
    `);

    if (testProducts.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Test products not found'
      });
    }

    const productIds = testProducts.rows.map(p => p.id);
    console.log(`Validating fixed products: ${testProducts.rows.map(p => p.sku).join(', ')}`);

    const reports = await enhancedAmazonValidator.batchValidateProducts(productIds, {
      batchSize: 2,
      delayBetweenBatches: 500
    });

    res.json({
      success: true,
      testProducts: testProducts.rows,
      reports,
      summary: {
        totalValidated: reports.length,
        successfullyFixed: reports.filter(r => r.status === 'validated').length
      }
    });

  } catch (error) {
    console.error('Error validating fixed products:', error);
    res.status(500).json({
      success: false,
      error: `Fixed product validation failed: ${error.message}`
    });
  }
});

/**
 * Get validation alerts summary
 */
router.get('/alerts-summary', async (req, res) => {
  try {
    const alertsResult = await db.query(`
      SELECT 
        severity,
        COUNT(*) as count,
        COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_count
      FROM validation_alerts
      GROUP BY severity
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END
    `);

    const recentAlertsResult = await db.query(`
      SELECT asin, severity, message, created_at
      FROM validation_alerts
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      alertsBySeverity: alertsResult.rows,
      recentAlerts: recentAlertsResult.rows
    });

  } catch (error) {
    console.error('Error fetching alerts summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts summary'
    });
  }
});

/**
 * Test validation system performance with sample data
 */
router.post('/performance-test', async (req, res) => {
  try {
    const { sampleSize = 10 } = req.body;
    
    // Get random sample of products
    const sampleProducts = await db.query(`
      SELECT id FROM products 
      WHERE upc IS NOT NULL 
      ORDER BY RANDOM() 
      LIMIT $1
    `, [Math.min(sampleSize, 20)]);

    if (sampleProducts.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No products with UPC found for testing'
      });
    }

    const startTime = Date.now();
    const productIds = sampleProducts.rows.map(p => p.id);
    
    console.log(`Performance test: validating ${productIds.length} products...`);

    const reports = await enhancedAmazonValidator.batchValidateProducts(productIds, {
      batchSize: 3,
      delayBetweenBatches: 500,
      onProgress: (completed, total) => {
        console.log(`Performance test progress: ${completed}/${total}`);
      }
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const performance = {
      totalProducts: reports.length,
      totalTimeMs: totalTime,
      averageTimePerProduct: totalTime / reports.length,
      successRate: reports.filter(r => r.status === 'validated').length / reports.length,
      estimatedTimeFor1000Products: (totalTime / reports.length) * 1000,
      estimatedTimeFor1Million: ((totalTime / reports.length) * 1000000) / (1000 * 60 * 60) // hours
    };

    res.json({
      success: true,
      performance,
      sampleReports: reports.slice(0, 3) // Show first 3 for inspection
    });

  } catch (error) {
    console.error('Error in performance test:', error);
    res.status(500).json({
      success: false,
      error: `Performance test failed: ${error.message}`
    });
  }
});

export default router;