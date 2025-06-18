import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Test endpoint to verify image URLs are retrieved correctly
router.get('/test-images', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id as product_id,
        p.sku,
        p.name,
        p.image_url as supplier_image_url,
        pam.asin,
        aa.title as amazon_title,
        COALESCE(aa.image_url, aa.primary_image_url) as amazon_image_url
      FROM products p
      INNER JOIN product_asin_mapping pam ON p.id = pam.product_id
      INNER JOIN amazon_asins aa ON pam.asin = aa.asin
      WHERE p.image_url IS NOT NULL 
      AND (aa.image_url IS NOT NULL OR aa.primary_image_url IS NOT NULL)
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    
    // Transform to opportunities format
    const opportunities = result.rows.map(row => ({
      sku: row.sku,
      productName: row.name,
      supplierImageUrl: row.supplier_image_url,
      image: row.supplier_image_url,
      asinMatches: [{
        asin: row.asin,
        amazonTitle: row.amazon_title,
        imageUrl: row.amazon_image_url,
        supplierImageUrl: row.supplier_image_url,
        score: 50,
        price: 0,
        listPrice: 0,
        sellers: 1,
        buyboxHolder: 'Unknown',
        priceHistory: [],
        isBuyboxEligible: true,
        condition: 'New',
        canList: true,
        hasListingRestrictions: false,
        restrictionMessages: []
      }],
      strategicTags: []
    }));

    res.json({
      success: true,
      opportunities,
      totalCount: opportunities.length
    });

  } catch (error) {
    console.error('Error in image test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;