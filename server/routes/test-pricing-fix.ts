/**
 * Test Pricing Fix Routes
 * Verify and fix pricing calculations to match real Amazon prices
 */

import { Router } from 'express';
import { db } from '../db';
import { products, amazonAsins, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Test and compare pricing calculations
 */
router.get('/compare-calculations', async (req, res) => {
  try {
    console.log('Testing pricing calculations...');

    // Get a product with known cost and ASIN (like B000K2IHAI)
    const testProducts = await db
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

    if (testProducts.length === 0) {
      return res.json({
        success: false,
        message: 'No test product found'
      });
    }

    const product = testProducts[0];
    const cost = parseFloat(product.cost || '0');

    // Old inflated calculation (2.5x markup)
    const oldMarkup = 2.5;
    const oldMarketPrice = cost * oldMarkup;
    const oldCompetitivePrice = oldMarketPrice * 0.95;
    const oldListPrice = oldMarketPrice * 1.2;

    // New realistic calculation (1.6x markup)
    const newMarkup = 1.6;
    const newMarketPrice = cost * newMarkup;
    const newCompetitivePrice = newMarketPrice * 0.92;
    const newListPrice = newCompetitivePrice * 1.15;

    // Real Amazon price range for comparison
    const realAmazonLow = 15000; // $150 in cents
    const realAmazonHigh = 20000; // $200 in cents

    const results = {
      success: true,
      product: {
        name: product.name,
        asin: product.asin,
        cost: `$${cost.toFixed(2)}`,
        costInCents: Math.round(cost * 100)
      },
      oldCalculation: {
        method: 'Inflated 2.5x markup',
        competitivePrice: `$${(oldCompetitivePrice).toFixed(2)}`,
        listPrice: `$${(oldListPrice).toFixed(2)}`,
        competitivePriceInCents: Math.round(oldCompetitivePrice * 100),
        problem: 'Produces $379 which is way above real Amazon price of ~$150-200'
      },
      newCalculation: {
        method: 'Realistic 1.6x markup',
        competitivePrice: `$${(newCompetitivePrice).toFixed(2)}`,
        listPrice: `$${(newListPrice).toFixed(2)}`,
        competitivePriceInCents: Math.round(newCompetitivePrice * 100),
        improvement: 'Much closer to real Amazon market prices'
      },
      realAmazonPricing: {
        range: '$150 - $200',
        lowInCents: realAmazonLow,
        highInCents: realAmazonHigh,
        source: 'Actual Amazon listing observation'
      },
      recommendation: 'Use the new realistic pricing calculation to match market reality'
    };

    console.log(`Pricing comparison for ${product.asin}:`);
    console.log(`- Cost: $${cost.toFixed(2)}`);
    console.log(`- Old calculation: $${oldCompetitivePrice.toFixed(2)} (inflated)`);
    console.log(`- New calculation: $${newCompetitivePrice.toFixed(2)} (realistic)`);
    console.log(`- Real Amazon: $150-200`);

    res.json(results);

  } catch (error) {
    console.error('Pricing comparison error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

/**
 * Update all opportunities with fixed pricing
 */
router.post('/fix-all-opportunities', async (req, res) => {
  try {
    console.log('Fixing all pricing calculations to use realistic values...');

    // Get all products with ASINs and costs
    const productsWithAsins = await db
      .select({
        productId: products.id,
        name: products.name,
        cost: products.cost,
        asin: amazonAsins.asin
      })
      .from(products)
      .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
      .innerJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
      .limit(10); // Process first 10 for testing

    const results = [];

    for (const product of productsWithAsins) {
      const cost = parseFloat(product.cost || '0');
      
      if (cost > 0) {
        // Use realistic pricing calculation
        const newMarkup = 1.6; // 60% markup instead of 150%
        const marketPrice = cost * newMarkup;
        const competitivePrice = marketPrice * 0.92; // 8% below market
        const listPrice = competitivePrice * 1.15; // 15% above competitive

        // Update the product price in database
        await db
          .update(products)
          .set({
            price: competitivePrice.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(products.id, product.productId));

        results.push({
          asin: product.asin,
          name: product.name,
          cost: `$${cost.toFixed(2)}`,
          newPrice: `$${competitivePrice.toFixed(2)}`,
          listPrice: `$${listPrice.toFixed(2)}`,
          success: true
        });

        console.log(`Updated ${product.asin}: $${cost.toFixed(2)} cost → $${competitivePrice.toFixed(2)} price`);
      } else {
        results.push({
          asin: product.asin,
          name: product.name,
          error: 'No cost data available',
          success: false
        });
      }
    }

    const successful = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Fixed pricing for ${successful} products using realistic calculations`,
      totalProcessed: results.length,
      successful,
      results: results.slice(0, 5), // Show first 5 results
      note: 'Pricing now uses 60% markup instead of 150% to match real Amazon market prices'
    });

  } catch (error) {
    console.error('Fix pricing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

export default router;