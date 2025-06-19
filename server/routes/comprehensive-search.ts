/**
 * Comprehensive Amazon Search Routes
 * Routes for testing and implementing multi-method Amazon SP-API search
 */

import { Router } from 'express';
import { comprehensiveAmazonSearch, updateProductASINMappings } from '../utils/comprehensive-amazon-search';
import { db } from '../db';
import { products, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Test comprehensive Amazon search for a specific product
 */
router.post('/test-comprehensive-search/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // Get product details
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Perform comprehensive search
    const searchParams = {
      upc: product.upc,
      mpn: product.manufacturerPartNumber,
      description: product.description,
      brand: product.brand,
      name: product.name
    };

    const matches = await comprehensiveAmazonSearch(searchParams);

    res.json({
      success: true,
      product: {
        sku: product.sku,
        name: product.name,
        upc: product.upc,
        mpn: product.manufacturerPartNumber
      },
      searchParams,
      matches,
      totalMatches: matches.length
    });
  } catch (error) {
    console.error('Comprehensive search test failed:', error);
    res.status(500).json({ 
      error: 'Failed to perform comprehensive search',
      details: error.message
    });
  }
});

/**
 * Fix invalid ASIN mappings using comprehensive search
 */
router.post('/fix-invalid-mappings', async (req, res) => {
  try {
    const { productIds, autoApprove = false } = req.body;
    
    const results = [];
    
    for (const productId of productIds) {
      // Get product details
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));

      if (!product) {
        results.push({
          productId,
          error: 'Product not found'
        });
        continue;
      }

      // Get current ASIN mapping
      const [currentMapping] = await db
        .select()
        .from(productAsinMapping)
        .where(eq(productAsinMapping.productId, productId));

      // Perform comprehensive search
      const searchParams = {
        upc: product.upc,
        mpn: product.manufacturerPartNumber,
        description: product.description,
        brand: product.brand,
        name: product.name
      };

      const matches = await comprehensiveAmazonSearch(searchParams);

      if (matches.length > 0 && autoApprove) {
        const bestMatch = matches[0];
        
        // Update ASIN mapping
        if (currentMapping) {
          await db
            .update(productAsinMapping)
            .set({
              asin: bestMatch.asin,
              mappingSource: 'comprehensive_search',
              matchConfidence: bestMatch.confidence,
              updatedAt: new Date()
            })
            .where(eq(productAsinMapping.id, currentMapping.id));
        } else {
          await db
            .insert(productAsinMapping)
            .values({
              productId,
              asin: bestMatch.asin,
              mappingSource: 'comprehensive_search',
              matchConfidence: bestMatch.confidence
            });
        }

        // Store Amazon product data via SQL to handle the missing schema export
        try {
          const { pool } = await import('../db');
          await pool.query(`
            INSERT INTO amazon_product_data (asin, title, brand, primary_image_url)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (asin) DO UPDATE SET
              title = EXCLUDED.title,
              brand = EXCLUDED.brand,
              primary_image_url = EXCLUDED.primary_image_url
          `, [bestMatch.asin, bestMatch.title, bestMatch.brand, bestMatch.imageUrl]);
        } catch (error) {
          console.log('Error storing Amazon product data:', error.message);
        }
      }

      results.push({
        productId,
        sku: product.sku,
        name: product.name,
        currentAsin: currentMapping?.asin,
        matches,
        updated: autoApprove && matches.length > 0
      });
    }

    res.json({
      success: true,
      results,
      totalProcessed: productIds.length
    });
  } catch (error) {
    console.error('Fix invalid mappings failed:', error);
    res.status(500).json({ 
      error: 'Failed to fix invalid mappings',
      details: error.message
    });
  }
});

export { router as comprehensiveSearchRouter };