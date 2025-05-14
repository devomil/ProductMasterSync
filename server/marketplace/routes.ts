/**
 * Amazon Marketplace API Routes
 * 
 * Provides API endpoints for Amazon marketplace data
 */

import { Router } from 'express';
import { z } from 'zod';
import { fetchAmazonDataByUpc, getAmazonDataForProduct, batchSyncAmazonData } from './amazon-service';
import { getAmazonConfig, validateAmazonConfig } from '../utils/amazon-spapi';
import { scheduler } from '../utils/scheduler';
import { getSyncStats, getSyncLogsByBatch, getSyncLogsForProduct } from './repository';

const router = Router();

/**
 * GET /marketplace/amazon/:productId
 * Get Amazon marketplace data for a product
 */
router.get('/amazon/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const data = await getAmazonDataForProduct(productId);
    return res.json(data);
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/:productId:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /marketplace/amazon/fetch/:productId
 * Fetch Amazon marketplace data for a product by UPC
 */
router.post('/amazon/fetch/:productId', async (req, res) => {
  try {
    // Validate config first
    const config = getAmazonConfig();
    if (!validateAmazonConfig(config)) {
      return res.status(400).json({ 
        error: 'Amazon SP-API configuration is missing. Please set the required environment variables.', 
        requiredEnvVars: [
          'AMAZON_SP_API_CLIENT_ID',
          'AMAZON_SP_API_CLIENT_SECRET',
          'AMAZON_SP_API_REFRESH_TOKEN',
          'AMAZON_SP_API_ACCESS_KEY_ID',
          'AMAZON_SP_API_SECRET_KEY'
        ]
      });
    }

    // Validate product ID
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Validate UPC code
    const upcSchema = z.object({
      upc: z.string().min(1).max(14)
    });
    
    const validationResult = upcSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validationResult.error.format()
      });
    }

    // Fetch Amazon data
    const { upc } = validationResult.data;
    const data = await fetchAmazonDataByUpc(productId, upc);
    
    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error in POST /marketplace/amazon/fetch/:productId:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /marketplace/amazon/batch-sync
 * Run a batch sync job to fetch Amazon data for products with UPC codes
 */
router.post('/amazon/batch-sync', async (req, res) => {
  try {
    // Validate config first
    const config = getAmazonConfig();
    if (!validateAmazonConfig(config)) {
      return res.status(400).json({ 
        error: 'Amazon SP-API configuration is missing. Please set the required environment variables.', 
        requiredEnvVars: [
          'AMAZON_SP_API_CLIENT_ID',
          'AMAZON_SP_API_CLIENT_SECRET',
          'AMAZON_SP_API_REFRESH_TOKEN',
          'AMAZON_SP_API_ACCESS_KEY_ID',
          'AMAZON_SP_API_SECRET_KEY'
        ]
      });
    }

    // Validate limit
    const limitSchema = z.object({
      limit: z.number().int().positive().max(50).optional().default(10)
    });
    
    const validationResult = limitSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validationResult.error.format()
      });
    }

    // Run batch sync
    const { limit } = validationResult.data;
    const result = await batchSyncAmazonData(limit);
    
    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in POST /marketplace/amazon/batch-sync:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /marketplace/amazon/config-status
 * Check Amazon SP-API configuration status
 */
router.get('/amazon/config-status', (req, res) => {
  try {
    const config = getAmazonConfig();
    const isValid = validateAmazonConfig(config);
    
    return res.json({
      configValid: isValid,
      missingEnvVars: !isValid ? [
        !config.clientId && 'AMAZON_SP_API_CLIENT_ID',
        !config.clientSecret && 'AMAZON_SP_API_CLIENT_SECRET',
        !config.refreshToken && 'AMAZON_SP_API_REFRESH_TOKEN',
        !config.accessKeyId && 'AMAZON_SP_API_ACCESS_KEY_ID',
        !config.secretKey && 'AMAZON_SP_API_SECRET_KEY'
      ].filter(Boolean) : []
    });
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/config-status:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /marketplace/amazon/sync-stats
 * Get statistics about Amazon data sync operations
 */
router.get('/amazon/sync-stats', async (req, res) => {
  try {
    const stats = await getSyncStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/sync-stats:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /marketplace/amazon/sync-logs/:productId
 * Get sync logs for a specific product
 */
router.get('/amazon/sync-logs/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const logs = await getSyncLogsForProduct(productId);
    return res.json(logs);
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/sync-logs/:productId:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /marketplace/amazon/batch-logs/:batchId
 * Get sync logs for a specific batch
 */
router.get('/amazon/batch-logs/:batchId', async (req, res) => {
  try {
    const batchId = req.params.batchId;
    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID is required' });
    }
    
    const logs = await getSyncLogsByBatch(batchId);
    return res.json(logs);
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/batch-logs/:batchId:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /marketplace/amazon/scheduler/status
 * Get the status of the Amazon sync scheduler
 */
router.get('/amazon/scheduler/status', (req, res) => {
  try {
    const jobs = scheduler.getJobs();
    const amazonSyncJob = jobs.find(job => job.id === 'amazon-sync');
    
    return res.json({
      active: !!amazonSyncJob,
      details: amazonSyncJob || null,
      allJobs: jobs
    });
  } catch (error) {
    console.error('Error in GET /marketplace/amazon/scheduler/status:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /marketplace/amazon/scheduler/trigger
 * Manually trigger the Amazon sync job
 */
router.post('/amazon/scheduler/trigger', async (req, res) => {
  try {
    // Validate config first
    const config = getAmazonConfig();
    if (!validateAmazonConfig(config)) {
      return res.status(400).json({ 
        error: 'Amazon SP-API configuration is missing. Please set the required environment variables.',
        requiredEnvVars: [
          'AMAZON_SP_API_CLIENT_ID',
          'AMAZON_SP_API_CLIENT_SECRET', 
          'AMAZON_SP_API_REFRESH_TOKEN',
          'AMAZON_SP_API_ACCESS_KEY_ID',
          'AMAZON_SP_API_SECRET_KEY'
        ]
      });
    }
    
    try {
      const result = await scheduler.triggerJob('amazon-sync');
      return res.json({
        success: true,
        message: 'Amazon sync job triggered successfully',
        result
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ 
          error: 'Amazon sync job is not currently scheduled. Please enable the scheduler first.' 
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in POST /marketplace/amazon/scheduler/trigger:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;