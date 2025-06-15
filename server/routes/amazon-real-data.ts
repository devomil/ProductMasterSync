/**
 * Amazon Real Data Routes
 * Fetch authentic pricing and verify ASIN mappings using Amazon SP-API
 */

import { Router } from 'express';
import { amazonAPIClient } from '../services/amazon-api-client';
import { pool } from '../db';

const router = Router();

/**
 * Verify UPC to ASIN mapping and get correct ASIN
 */
router.post('/verify-upc/:upc', async (req, res) => {
  try {
    const { upc } = req.params;
    
    console.log(`Verifying UPC to ASIN mapping for: ${upc}`);
    
    // Search Amazon catalog for this UPC
    const catalogResults = await amazonAPIClient.searchByUPC(upc);
    
    if (catalogResults.length === 0) {
      return res.json({
        success: false,
        message: `No Amazon catalog items found for UPC: ${upc}`,
        upc,
        suggestedAsins: []
      });
    }

    // Extract ASINs and product info
    const suggestedAsins = catalogResults.map(item => ({
      asin: item.asin,
      title: item.summaries?.[0]?.itemName || 'Unknown',
      brand: item.summaries?.[0]?.brand || 'Unknown',
      upcMatches: item.identifiers?.some(id => id.identifierType === 'UPC' && id.identifier === upc) || false
    }));

    // Get current mapping from database
    const currentMappingQuery = `
      SELECT p.id, p.name, p.upc, pam.asin as current_asin
      FROM products p
      LEFT JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc = $1
    `;
    
    const currentMapping = await pool.query(currentMappingQuery, [upc]);
    
    res.json({
      success: true,
      upc,
      currentMapping: currentMapping.rows[0] || null,
      suggestedAsins,
      catalogResultsCount: catalogResults.length,
      message: `Found ${catalogResults.length} Amazon catalog items for UPC ${upc}`
    });

  } catch (error) {
    console.error('UPC verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify UPC mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get real Amazon pricing for specific ASINs
 */
router.post('/pricing', async (req, res) => {
  try {
    const { asins } = req.body;
    
    if (!Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }

    console.log(`Fetching real Amazon pricing for ASINs: ${asins.join(', ')}`);
    
    const pricingResults = new Map();
    
    // Fetch pricing for each ASIN
    for (const asin of asins) {
      try {
        const pricingData = await amazonAPIClient.getPricingData(asin);
        if (pricingData) {
          pricingResults.set(asin, pricingData);
        } else {
          pricingResults.set(asin, {
            asin,
            error: 'No pricing data available',
            timestamp: new Date().toISOString()
          });
        }
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error fetching pricing for ${asin}:`, error);
        pricingResults.set(asin, {
          asin,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Convert Map to array for response
    const results = Array.from(pricingResults.entries()).map(([asin, data]) => ({
      asin,
      ...data
    }));

    res.json({
      success: true,
      results,
      processedCount: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Real pricing fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real Amazon pricing',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fix incorrect UPC mapping for specific product
 */
router.post('/fix-mapping', async (req, res) => {
  try {
    const { productId, newAsin, realPrice } = req.body;
    
    if (!productId || !newAsin) {
      return res.status(400).json({
        success: false,
        error: 'productId and newAsin are required'
      });
    }

    console.log(`Fixing ASIN mapping for product ${productId} to ${newAsin}`);
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if new ASIN exists in amazon_asins table
      const asinCheck = await client.query(
        'SELECT asin FROM amazon_asins WHERE asin = $1',
        [newAsin]
      );
      
      // Add ASIN to amazon_asins if it doesn't exist
      if (asinCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO amazon_asins (asin, is_active, created_at, updated_at)
          VALUES ($1, true, NOW(), NOW())
        `, [newAsin]);
      }
      
      // Update the ASIN mapping
      await client.query(`
        UPDATE product_asin_mapping 
        SET asin = $1, updated_at = NOW()
        WHERE product_id = $2
      `, [newAsin, productId]);
      
      // Update product price if provided
      if (realPrice && realPrice > 0) {
        await client.query(`
          UPDATE products 
          SET price = $1, updated_at = NOW()
          WHERE id = $2
        `, [realPrice, productId]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully updated product ${productId} to ASIN ${newAsin}`,
        productId,
        newAsin,
        priceUpdated: !!realPrice
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Mapping fix error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix ASIN mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update product prices with real Amazon data
 */
router.post('/update-prices', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    
    console.log(`Updating product prices with real Amazon data (limit: ${limit})`);
    
    // Get products with ASIN mappings
    const productsQuery = `
      SELECT p.id, p.name, p.upc, p.price as current_price, pam.asin
      FROM products p
      INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
      INNER JOIN amazon_asins aa ON pam.asin = aa.asin
      WHERE aa.is_active = true
      LIMIT $1
    `;
    
    const products = await pool.query(productsQuery, [limit]);
    
    if (products.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No products with ASIN mappings found'
      });
    }
    
    const updateResults = [];
    
    for (const product of products.rows) {
      try {
        console.log(`Fetching real pricing for product ${product.id} (ASIN: ${product.asin})`);
        
        const pricingData = await amazonAPIClient.getPricingData(product.asin);
        
        if (pricingData && pricingData.listPrice) {
          // Update product with real Amazon price
          await pool.query(`
            UPDATE products 
            SET price = $1, updated_at = NOW()
            WHERE id = $2
          `, [pricingData.listPrice, product.id]);
          
          updateResults.push({
            productId: product.id,
            productName: product.name,
            asin: product.asin,
            oldPrice: product.current_price,
            newPrice: pricingData.listPrice,
            updated: true
          });
          
        } else {
          updateResults.push({
            productId: product.id,
            productName: product.name,
            asin: product.asin,
            oldPrice: product.current_price,
            error: 'No pricing data available',
            updated: false
          });
        }
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error updating price for product ${product.id}:`, error);
        updateResults.push({
          productId: product.id,
          productName: product.name,
          asin: product.asin,
          error: error instanceof Error ? error.message : 'Unknown error',
          updated: false
        });
      }
    }
    
    const successCount = updateResults.filter(r => r.updated).length;
    
    res.json({
      success: true,
      message: `Updated ${successCount} of ${updateResults.length} products with real Amazon pricing`,
      results: updateResults,
      successCount,
      totalProcessed: updateResults.length
    });

  } catch (error) {
    console.error('Price update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prices with real Amazon data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;