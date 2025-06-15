/**
 * Amazon SP-API Connection Testing Routes
 * Focused testing for 1-10 products with comprehensive error handling
 */

import { Router } from 'express';
import { amazonSPAPI } from '../services/amazon-sp-api';
import { pool } from '../db';

const router = Router();

/**
 * Test Amazon SP-API connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    console.log('Testing Amazon SP-API connection...');
    
    const result = await amazonSPAPI.testConnection();
    
    res.json({
      success: result.success,
      message: result.message,
      details: result.details,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test specific products (limit 1-10)
 */
router.post('/test-products', async (req, res) => {
  try {
    const { limit = 5 } = req.body;
    const maxLimit = Math.min(limit, 10); // Enforce max 10 products
    
    console.log(`Testing Amazon API with ${maxLimit} products...`);
    
    // Get products with UPC and ASIN mappings
    const productsQuery = `
      SELECT p.id, p.name, p.upc, p.price, pam.asin
      FROM products p
      INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
      WHERE p.upc IS NOT NULL AND p.upc != ''
      ORDER BY p.id
      LIMIT $1
    `;
    
    const products = await pool.query(productsQuery, [maxLimit]);
    
    if (products.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No products with UPC and ASIN mappings found'
      });
    }
    
    const testResults = [];
    
    for (const product of products.rows) {
      console.log(`Testing product ${product.id}: ${product.name}`);
      
      const productResult = {
        productId: product.id,
        productName: product.name,
        upc: product.upc,
        currentAsin: product.asin,
        currentPrice: product.price,
        tests: {
          upcSearch: { success: false, message: '', data: null },
          pricing: { success: false, message: '', data: null },
          restrictions: { success: false, message: '', data: null }
        }
      };
      
      // Test 1: UPC Search
      try {
        const upcResults = await amazonSPAPI.searchByUPC(product.upc);
        productResult.tests.upcSearch = {
          success: true,
          message: `Found ${upcResults.length} catalog items`,
          data: upcResults
        };
      } catch (error) {
        productResult.tests.upcSearch = {
          success: false,
          message: error instanceof Error ? error.message : 'UPC search failed',
          data: null
        };
      }
      
      // Test 2: Pricing
      try {
        const pricingResult = await amazonSPAPI.getPricing(product.asin);
        productResult.tests.pricing = {
          success: pricingResult.success,
          message: pricingResult.success ? `Price: $${pricingResult.price}` : pricingResult.error || 'Pricing failed',
          data: pricingResult
        };
      } catch (error) {
        productResult.tests.pricing = {
          success: false,
          message: error instanceof Error ? error.message : 'Pricing test failed',
          data: null
        };
      }
      
      // Test 3: Listing Restrictions
      try {
        const restrictionsResult = await amazonSPAPI.getListingRestrictions(product.asin);
        productResult.tests.restrictions = {
          success: restrictionsResult.success,
          message: restrictionsResult.success ? 
            (restrictionsResult.canList ? 'Can list' : 'Has restrictions') : 
            restrictionsResult.error || 'Restrictions check failed',
          data: restrictionsResult
        };
      } catch (error) {
        productResult.tests.restrictions = {
          success: false,
          message: error instanceof Error ? error.message : 'Restrictions test failed',
          data: null
        };
      }
      
      testResults.push(productResult);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successfulTests = testResults.filter(result => 
      result.tests.upcSearch.success || result.tests.pricing.success
    );
    
    res.json({
      success: true,
      message: `Tested ${testResults.length} products, ${successfulTests.length} had successful API calls`,
      summary: {
        totalProducts: testResults.length,
        successfulProducts: successfulTests.length,
        upcSearchSuccesses: testResults.filter(r => r.tests.upcSearch.success).length,
        pricingSuccesses: testResults.filter(r => r.tests.pricing.success).length,
        restrictionSuccesses: testResults.filter(r => r.tests.restrictions.success).length
      },
      results: testResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Product testing error:', error);
    res.status(500).json({
      success: false,
      error: 'Product testing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fix ASIN mapping based on UPC search results
 */
router.post('/fix-asin-mapping', async (req, res) => {
  try {
    const { productId, newAsin, reason } = req.body;
    
    if (!productId || !newAsin) {
      return res.status(400).json({
        success: false,
        error: 'productId and newAsin are required'
      });
    }
    
    console.log(`Fixing ASIN mapping for product ${productId} to ${newAsin}. Reason: ${reason}`);
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get product details
      const productQuery = await client.query(
        'SELECT id, name, upc FROM products WHERE id = $1',
        [productId]
      );
      
      if (productQuery.rows.length === 0) {
        throw new Error('Product not found');
      }
      
      const product = productQuery.rows[0];
      
      // Check if new ASIN exists in amazon_asins table
      const asinCheck = await client.query(
        'SELECT asin FROM amazon_asins WHERE asin = $1',
        [newAsin]
      );
      
      // Add ASIN to amazon_asins if it doesn't exist
      if (asinCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO amazon_asins (asin, title, upc, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, true, NOW(), NOW())
        `, [newAsin, product.name, product.upc]);
      }
      
      // Update the ASIN mapping
      await client.query(`
        UPDATE product_asin_mapping 
        SET asin = $1, updated_at = NOW()
        WHERE product_id = $2
      `, [newAsin, productId]);
      
      // Get fresh pricing data
      const pricingResult = await amazonSPAPI.getPricing(newAsin);
      
      if (pricingResult.success && pricingResult.price) {
        await client.query(`
          UPDATE products 
          SET price = $1, updated_at = NOW()
          WHERE id = $2
        `, [pricingResult.price, productId]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully updated product ${productId} to ASIN ${newAsin}`,
        details: {
          productId,
          productName: product.name,
          newAsin,
          reason,
          priceUpdated: pricingResult.success ? pricingResult.price : null
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('ASIN mapping fix error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix ASIN mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update prices with real Amazon data
 */
router.post('/update-prices', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'productIds array is required'
      });
    }
    
    if (productIds.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 products allowed per request'
      });
    }
    
    console.log(`Updating prices for ${productIds.length} products...`);
    
    const updateResults = [];
    
    for (const productId of productIds) {
      try {
        // Get product and ASIN
        const productQuery = await pool.query(`
          SELECT p.id, p.name, p.price, pam.asin
          FROM products p
          INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
          WHERE p.id = $1
        `, [productId]);
        
        if (productQuery.rows.length === 0) {
          updateResults.push({
            productId,
            success: false,
            error: 'Product not found or no ASIN mapping'
          });
          continue;
        }
        
        const product = productQuery.rows[0];
        
        // Get real Amazon pricing
        const pricingResult = await amazonSPAPI.getPricing(product.asin);
        
        if (pricingResult.success && pricingResult.price) {
          // Update product price
          await pool.query(`
            UPDATE products 
            SET price = $1, updated_at = NOW()
            WHERE id = $2
          `, [pricingResult.price, productId]);
          
          updateResults.push({
            productId,
            productName: product.name,
            asin: product.asin,
            oldPrice: product.price,
            newPrice: pricingResult.price,
            success: true
          });
        } else {
          updateResults.push({
            productId,
            productName: product.name,
            asin: product.asin,
            success: false,
            error: pricingResult.error || 'No pricing data available'
          });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        updateResults.push({
          productId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const successCount = updateResults.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Updated ${successCount} of ${updateResults.length} products`,
      results: updateResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Price update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;