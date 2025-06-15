/**
 * Batch Processing API Routes
 * Handles automated ASIN discovery for the entire catalog
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getGlobalProcessor } from '../services/batch-asin-processor';
import { rateLimiter } from '../services/rate-limiter';
import { db } from '../db';

const router = Router();

/**
 * Start batch processing for the entire catalog
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const processor = getGlobalProcessor(db);

    if (processor.isRunning()) {
      return res.status(409).json({
        success: false,
        message: 'Batch processing is already running'
      });
    }

    const options = {
      batchSize: req.body.batchSize || 50,
      maxConcurrency: req.body.maxConcurrency || 3,
      skipRecentlyProcessed: req.body.skipRecentlyProcessed !== false,
      onlyWithUPCOrMPN: req.body.onlyWithUPCOrMPN !== false
    };

    // Start processing in background
    processor.startBatchProcessing(options)
      .then((stats) => {
        console.log('[BatchAPI] Batch processing completed:', stats);
      })
      .catch((error) => {
        console.error('[BatchAPI] Batch processing failed:', error);
      });

    res.json({
      success: true,
      message: 'Batch processing started',
      options
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to start batch processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start batch processing',
      error: error.message
    });
  }
});

/**
 * Get current batch processing status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const processor = getGlobalProcessor(db);

    const stats = processor.getStats();
    const isRunning = processor.isRunning();

    // Get rate limiter status for key operations
    const rateLimiterStatus = {
      searchCatalogItems: rateLimiter.getBucketStatus('searchCatalogItems'),
      getListingsRestrictions: rateLimiter.getBucketStatus('getListingsRestrictions')
    };

    res.json({
      success: true,
      isRunning,
      stats,
      rateLimiterStatus
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to get batch status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batch status',
      error: error.message
    });
  }
});

/**
 * Stop batch processing
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const processor = getGlobalProcessor(db);

    await processor.stop();

    res.json({
      success: true,
      message: 'Batch processing stopped'
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to stop batch processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop batch processing',
      error: error.message
    });
  }
});

/**
 * Get stored ASIN mappings for a product
 */
router.get('/mappings/:productId', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Get product details
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = productResult.rows[0];

    // Get ASIN mappings
    const mappingsQuery = `
      SELECT 
        m.*,
        COUNT(*) OVER() as total_asins
      FROM upc_asin_mappings m
      WHERE (m.upc = $1 OR m.manufacturer_part_number = $2)
      AND m.is_active = true
      ORDER BY m.can_list DESC, m.confidence DESC, m.discovered_at DESC
    `;

    const mappingsResult = await db.query(mappingsQuery, [
      product.upc,
      product.manufacturerPartNumber
    ]);

    // Get lookup status
    const lookupResult = await db.query(
      'SELECT * FROM product_amazon_lookup WHERE product_id = $1',
      [productId]
    );

    const lookupStatus = lookupResult.rows[0] || null;

    res.json({
      success: true,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        upc: product.upc,
        manufacturerPartNumber: product.manufacturerPartNumber
      },
      mappings: mappingsResult.rows,
      totalASINs: mappingsResult.rows[0]?.total_asins || 0,
      lookupStatus
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to get ASIN mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ASIN mappings',
      error: error.message
    });
  }
});

/**
 * Get batch processing history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const historyQuery = `
      SELECT 
        batch_id,
        result,
        error_message,
        sync_started_at,
        sync_completed_at,
        COUNT(*) FILTER (WHERE product_id IS NOT NULL) as products_processed,
        COUNT(*) FILTER (WHERE result = 'success' AND product_id IS NOT NULL) as successful_products
      FROM amazon_sync_logs
      WHERE batch_id IS NOT NULL
      GROUP BY batch_id, result, error_message, sync_started_at, sync_completed_at
      ORDER BY sync_started_at DESC
      LIMIT $1 OFFSET $2
    `;

    const historyResult = await db.query(historyQuery, [limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(DISTINCT batch_id) as total
      FROM amazon_sync_logs
      WHERE batch_id IS NOT NULL
    `);

    res.json({
      success: true,
      history: historyResult.rows,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.rows[0]?.total || '0')
      }
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to get batch history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batch history',
      error: error.message
    });
  }
});

/**
 * Get catalog processing overview
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT p.id) FILTER (WHERE p.upc IS NOT NULL OR p."manufacturerPartNumber" IS NOT NULL) as searchable_products,
        COUNT(DISTINCT pal.product_id) FILTER (WHERE pal.search_status = 'found') as products_with_asins,
        COUNT(DISTINCT m.asin) as total_asins_found,
        COUNT(DISTINCT m.asin) FILTER (WHERE m.can_list = true) as listable_asins,
        COUNT(DISTINCT m.asin) FILTER (WHERE m.has_listing_restrictions = true) as restricted_asins,
        AVG(CASE WHEN pal.search_status = 'found' THEN pal.asins_found ELSE 0 END) as avg_asins_per_product
      FROM products p
      LEFT JOIN product_amazon_lookup pal ON p.id = pal.product_id
      LEFT JOIN upc_asin_mappings m ON (p.upc = m.upc OR p."manufacturerPartNumber" = m.manufacturer_part_number)
      WHERE p.status = 'active'
    `;

    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get recent processing activity
    const recentActivityQuery = `
      SELECT 
        DATE(sync_started_at) as date,
        COUNT(*) as searches_performed,
        COUNT(*) FILTER (WHERE result = 'success') as successful_searches,
        COUNT(DISTINCT asin) as asins_discovered
      FROM amazon_sync_logs
      WHERE sync_started_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(sync_started_at)
      ORDER BY date DESC
    `;

    const activityResult = await db.query(recentActivityQuery);

    // Get top categories by ASIN count
    const categoriesQuery = `
      SELECT 
        c.name as category_name,
        COUNT(DISTINCT m.asin) as asin_count,
        COUNT(DISTINCT p.id) as product_count
      FROM categories c
      JOIN products p ON c.id = p."categoryId"
      LEFT JOIN upc_asin_mappings m ON (p.upc = m.upc OR p."manufacturerPartNumber" = m.manufacturer_part_number)
      WHERE p.status = 'active'
      GROUP BY c.id, c.name
      HAVING COUNT(DISTINCT m.asin) > 0
      ORDER BY asin_count DESC
      LIMIT 10
    `;

    const categoriesResult = await db.query(categoriesQuery);

    res.json({
      success: true,
      overview: {
        totalProducts: parseInt(stats.total_products || '0'),
        searchableProducts: parseInt(stats.searchable_products || '0'),
        productsWithASINs: parseInt(stats.products_with_asins || '0'),
        totalASINsFound: parseInt(stats.total_asins_found || '0'),
        listableASINs: parseInt(stats.listable_asins || '0'),
        restrictedASINs: parseInt(stats.restricted_asins || '0'),
        averageASINsPerProduct: parseFloat(stats.avg_asins_per_product || '0')
      },
      recentActivity: activityResult.rows,
      topCategories: categoriesResult.rows
    });

  } catch (error: any) {
    console.error('[BatchAPI] Failed to get processing overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get processing overview',
      error: error.message
    });
  }
});

/**
 * Process a single product manually
 */
router.post('/process-product/:productId', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Pool;
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Get product details
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1 AND status = $2',
      [productId, 'active']
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    const product = productResult.rows[0];

    if (!product.upc && !product.manufacturerPartNumber) {
      return res.status(400).json({
        success: false,
        message: 'Product must have UPC or manufacturer part number for ASIN discovery'
      });
    }

    // Create a single-product processor
    const processor = getGlobalProcessor(db);
    
    // Process the single product
    const startTime = Date.now();
    
    try {
      await processor.processProduct(product);
      
      const processingTime = Date.now() - startTime;
      
      // Get updated mappings
      const mappingsResult = await db.query(`
        SELECT * FROM upc_asin_mappings
        WHERE (upc = $1 OR manufacturer_part_number = $2)
        AND is_active = true
        ORDER BY discovered_at DESC
      `, [product.upc, product.manufacturerPartNumber]);

      res.json({
        success: true,
        message: `Found ${mappingsResult.rows.length} ASINs`,
        processingTimeMs: processingTime,
        asinsFound: mappingsResult.rows.length,
        mappings: mappingsResult.rows
      });

    } catch (processingError: any) {
      res.status(500).json({
        success: false,
        message: 'ASIN discovery failed',
        error: processingError.message
      });
    }

  } catch (error: any) {
    console.error('[BatchAPI] Failed to process single product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process product',
      error: error.message
    });
  }
});

export default router;