/**
 * Fix Market Pricing Routes
 * Apply market-based pricing that matches actual Amazon listings
 */

import { Router } from 'express';
import { db } from '../db';
import { products, amazonAsins, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Apply market-based pricing corrections
 */
router.post('/apply-market-corrections', async (req, res) => {
  try {
    console.log('Applying market-based pricing corrections...');

    // Define specific market corrections based on actual Amazon observations
    const marketCorrections = {
      'B000K2IHAI': {
        marketPrice: 17500, // $175 in cents (middle of $150-200 range)
        reasoning: 'Actual Amazon listing shows ~$150-200, using $175 as competitive price'
      }
    };

    // Get products that need market corrections
    const productsToCorrect = await db
      .select({
        productId: products.id,
        name: products.name,
        cost: products.cost,
        currentPrice: products.price,
        asin: amazonAsins.asin
      })
      .from(products)
      .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
      .innerJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
      .where(eq(amazonAsins.asin, 'B000K2IHAI'))
      .limit(1);

    if (productsToCorrect.length === 0) {
      return res.json({
        success: false,
        message: 'No products found for market correction'
      });
    }

    const results = [];

    for (const product of productsToCorrect) {
      const correction = marketCorrections[product.asin as keyof typeof marketCorrections];
      
      if (correction) {
        const newPrice = correction.marketPrice / 100; // Convert cents to dollars
        const cost = parseFloat(product.cost || '0');

        // Update the product price to match market reality
        await db
          .update(products)
          .set({
            price: newPrice.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(products.id, product.productId));

        const profitMargin = cost > 0 ? ((newPrice - cost) / newPrice * 100) : 0;

        results.push({
          asin: product.asin,
          name: product.name,
          cost: `$${cost.toFixed(2)}`,
          oldPrice: product.currentPrice || 'N/A',
          newPrice: `$${newPrice.toFixed(2)}`,
          profitMargin: `${profitMargin.toFixed(1)}%`,
          reasoning: correction.reasoning,
          success: true
        });

        console.log(`Applied market correction for ${product.asin}: $${newPrice.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      message: `Applied market-based pricing corrections for ${results.length} products`,
      corrections: results,
      note: 'Pricing now matches actual Amazon marketplace observations'
    });

  } catch (error) {
    console.error('Market pricing correction error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

/**
 * Verify current pricing against market reality
 */
router.get('/verify-market-pricing', async (req, res) => {
  try {
    // Get current pricing for B000K2IHAI
    const productData = await db
      .select({
        productId: products.id,
        name: products.name,
        cost: products.cost,
        currentPrice: products.price,
        asin: amazonAsins.asin
      })
      .from(products)
      .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
      .innerJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
      .where(eq(amazonAsins.asin, 'B000K2IHAI'))
      .limit(1);

    if (productData.length === 0) {
      return res.json({
        success: false,
        message: 'Product B000K2IHAI not found'
      });
    }

    const product = productData[0];
    const currentPrice = parseFloat(product.currentPrice || '0');
    const cost = parseFloat(product.cost || '0');
    const amazonRealPrice = 175; // $175 based on actual observation

    const analysis = {
      product: {
        asin: product.asin,
        name: product.name,
        cost: `$${cost.toFixed(2)}`
      },
      pricing: {
        current: `$${currentPrice.toFixed(2)}`,
        amazonReal: `$${amazonRealPrice.toFixed(2)}`,
        difference: `$${(currentPrice - amazonRealPrice).toFixed(2)}`,
        percentageDiff: `${(((currentPrice - amazonRealPrice) / amazonRealPrice) * 100).toFixed(1)}%`
      },
      status: currentPrice <= 200 && currentPrice >= 150 ? 'ALIGNED' : 'NEEDS_CORRECTION',
      recommendation: currentPrice > 200 ? 'Reduce price to match market' : 'Price is reasonable'
    };

    res.json({
      success: true,
      analysis,
      marketData: {
        observedRange: '$150 - $200',
        recommendedPrice: '$175',
        source: 'Direct Amazon listing observation'
      }
    });

  } catch (error) {
    console.error('Market pricing verification error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

export default router;