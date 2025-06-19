/**
 * ASIN Selection API Routes
 * 
 * Handles selection of the best ASIN when multiple ASINs exist for a single product
 */

import { Express, Request, Response } from 'express';
import { pool } from '../db';
import { bestASINSelector } from '../utils/best-asin-selector';

export function registerASINSelectionRoutes(app: Express) {
  
  /**
   * Get all products with multiple ASIN mappings
   */
  app.get('/api/asin-selection/multi-asin-products', async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT 
          p.sku,
          p.name,
          p.upc,
          COUNT(pam.asin) as asin_count,
          ARRAY_AGG(pam.asin) as asins
        FROM products p
        INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
        GROUP BY p.id, p.sku, p.name, p.upc
        HAVING COUNT(pam.asin) > 1
        ORDER BY COUNT(pam.asin) DESC, p.sku
      `;
      
      const result = await pool.query(query);
      
      res.json({
        success: true,
        products: result.rows,
        totalProducts: result.rows.length
      });
      
    } catch (error) {
      console.error('Error fetching multi-ASIN products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch multi-ASIN products',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze and select best ASIN for a specific product
   */
  app.post('/api/asin-selection/select-best-asin', async (req: Request, res: Response) => {
    try {
      const { sku } = req.body;
      
      if (!sku) {
        return res.status(400).json({
          success: false,
          error: 'SKU is required'
        });
      }

      // Get product and all its ASINs
      const productQuery = `
        SELECT 
          p.id as product_id,
          p.sku,
          p.name,
          p.upc,
          pam.asin
        FROM products p
        INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
        WHERE p.sku = $1
      `;
      
      const productResult = await pool.query(productQuery, [sku]);
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Product not found or has no ASIN mappings'
        });
      }

      const asins = productResult.rows.map(row => row.asin);
      const productId = productResult.rows[0].product_id;
      
      // Get Amazon data for each ASIN
      const amazonDataQuery = `
        SELECT 
          asin,
          title,
          brand,
          current_price as price,
          sales_rank,
          category_rank,
          buybox_holder,
          is_buybox_eligible,
          condition,
          sellers_count,
          main_image_url as imageUrl
        FROM amazon_product_data
        WHERE asin = ANY($1)
      `;
      
      const amazonResult = await pool.query(amazonDataQuery, [asins]);
      
      // Use ASIN selector to find the best one
      const bestASIN = await bestASINSelector.selectBestASIN(amazonResult.rows);
      
      if (!bestASIN) {
        return res.status(404).json({
          success: false,
          error: 'No suitable ASIN found'
        });
      }

      // Get detailed scoring for all candidates
      const scoringDetails = amazonResult.rows.map(candidate => ({
        ...candidate,
        ...bestASINSelector.getScoreBreakdown(candidate, amazonResult.rows)
      }));

      res.json({
        success: true,
        sku,
        selectedASIN: bestASIN.asin,
        selectionReason: 'Highest scoring ASIN based on sales rank, price, buybox eligibility, and data completeness',
        totalCandidates: asins.length,
        scoringDetails: scoringDetails.sort((a, b) => b.totalScore - a.totalScore)
      });
      
    } catch (error) {
      console.error('Error selecting best ASIN:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to select best ASIN',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Apply selected ASIN as the primary mapping for a product
   */
  app.post('/api/asin-selection/apply-best-asin', async (req: Request, res: Response) => {
    try {
      const { sku, selectedASIN, reason } = req.body;
      
      if (!sku || !selectedASIN) {
        return res.status(400).json({
          success: false,
          error: 'SKU and selectedASIN are required'
        });
      }

      // Get product ID
      const productQuery = 'SELECT id FROM products WHERE sku = $1';
      const productResult = await pool.query(productQuery, [sku]);
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      const productId = productResult.rows[0].id;

      // Clear existing primary mappings
      await pool.query(
        'UPDATE product_asin_mapping SET is_primary = false WHERE product_id = $1',
        [productId]
      );

      // Set the selected ASIN as primary
      const updateResult = await pool.query(
        'UPDATE product_asin_mapping SET is_primary = true, updated_at = NOW() WHERE product_id = $1 AND asin = $2',
        [productId, selectedASIN]
      );

      if (updateResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Selected ASIN not found in mappings'
        });
      }

      // Log the selection
      await pool.query(`
        INSERT INTO asin_correction_log (
          product_id, 
          original_asin, 
          corrected_asin, 
          correction_reason, 
          correction_type,
          created_at
        ) VALUES ($1, NULL, $2, $3, 'BEST_SELECTION', NOW())
      `, [productId, selectedASIN, reason || 'Selected as best ASIN from multiple candidates']);

      res.json({
        success: true,
        message: `SKU ${sku} primary ASIN set to ${selectedASIN}`,
        appliedASIN: selectedASIN
      });
      
    } catch (error) {
      console.error('Error applying best ASIN:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply best ASIN',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Batch process multiple products to select and apply best ASINs
   */
  app.post('/api/asin-selection/batch-select-best-asins', async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.body;
      
      // Get products with multiple ASINs
      const multiASINQuery = `
        SELECT 
          p.sku,
          COUNT(pam.asin) as asin_count
        FROM products p
        INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
        GROUP BY p.id, p.sku
        HAVING COUNT(pam.asin) > 1
        ORDER BY COUNT(pam.asin) DESC, p.sku
        LIMIT $1
      `;
      
      const multiASINResult = await pool.query(multiASINQuery, [limit]);
      
      const results = [];
      
      for (const product of multiASINResult.rows) {
        try {
          // Select best ASIN for this product
          const selectionResponse = await fetch(`http://localhost:5000/api/asin-selection/select-best-asin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: product.sku })
          });
          
          const selectionData = await selectionResponse.json();
          
          if (selectionData.success && selectionData.selectedASIN) {
            // Apply the best ASIN
            const applyResponse = await fetch(`http://localhost:5000/api/asin-selection/apply-best-asin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku: product.sku,
                selectedASIN: selectionData.selectedASIN,
                reason: `Batch selection: ${selectionData.selectionReason}`
              })
            });
            
            const applyData = await applyResponse.json();
            
            results.push({
              sku: product.sku,
              success: applyData.success,
              selectedASIN: selectionData.selectedASIN,
              originalASINCount: product.asin_count,
              message: applyData.message || selectionData.selectionReason
            });
          } else {
            results.push({
              sku: product.sku,
              success: false,
              error: selectionData.error || 'Failed to select ASIN'
            });
          }
        } catch (error) {
          results.push({
            sku: product.sku,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        processedProducts: results.length,
        successfulSelections: successCount,
        results
      });
      
    } catch (error) {
      console.error('Error in batch ASIN selection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch select ASINs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}