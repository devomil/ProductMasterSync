/**
 * Amazon Real Data Routes
 * Fetch authentic pricing and verify ASIN mappings using Amazon SP-API
 */

import { Router } from 'express';
import { amazonRealPricingService } from '../services/amazon-real-pricing';
import { db } from '../db';
import { products, amazonAsins, productAsinMapping } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Verify UPC to ASIN mapping and get correct ASIN
 */
router.post('/verify-upc-mapping', async (req, res) => {
  try {
    const { upc, currentAsin } = req.body;

    if (!upc || !currentAsin) {
      return res.status(400).json({
        success: false,
        error: 'UPC and current ASIN are required'
      });
    }

    console.log(`Verifying UPC ${upc} mapping to ASIN ${currentAsin}`);

    const verification = await amazonRealPricingService.verifyUPCMapping(upc, currentAsin);

    res.json({
      success: true,
      upc,
      currentAsin,
      isCorrect: verification.isCorrect,
      correctAsin: verification.correctAsin,
      searchResults: verification.searchResults,
      recommendation: verification.isCorrect 
        ? 'Current ASIN mapping is correct'
        : `Incorrect mapping. Correct ASIN should be: ${verification.correctAsin}`
    });

  } catch (error) {
    console.error('UPC verification error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get real Amazon pricing for specific ASINs
 */
router.post('/get-real-pricing', async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins)) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }

    console.log(`Fetching real Amazon pricing for ASINs: ${asins.join(', ')}`);

    const pricingData = await amazonRealPricingService.getRealPricing(asins);

    const results = Array.from(pricingData.entries()).map(([asin, data]) => ({
      asin,
      buyBoxPrice: data.buyBoxPrice ? `$${data.buyBoxPrice.toFixed(2)}` : 'N/A',
      listPrice: data.listPrice ? `$${data.listPrice.toFixed(2)}` : 'N/A',
      offerCount: data.offerCount || 0,
      condition: data.condition,
      fulfillmentChannel: data.fulfillmentChannel,
      timestamp: data.timestamp
    }));

    res.json({
      success: true,
      message: `Retrieved real Amazon pricing for ${results.length} ASINs`,
      results,
      totalRequested: asins.length,
      totalRetrieved: results.length
    });

  } catch (error) {
    console.error('Real pricing fetch error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fix incorrect UPC mapping for specific product
 */
router.post('/fix-upc-mapping', async (req, res) => {
  try {
    const { upc, productId } = req.body;

    if (!upc || !productId) {
      return res.status(400).json({
        success: false,
        error: 'UPC and product ID are required'
      });
    }

    // Get current product and ASIN mapping
    const currentMapping = await db
      .select({
        productId: products.id,
        productName: products.name,
        currentAsin: amazonAsins.asin
      })
      .from(products)
      .leftJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
      .leftJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
      .where(eq(products.id, productId))
      .limit(1);

    if (currentMapping.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const currentAsin = currentMapping[0].currentAsin;
    
    if (!currentAsin) {
      return res.status(400).json({
        success: false,
        error: 'Product has no current ASIN mapping'
      });
    }

    console.log(`Fixing UPC mapping for product ${productId}: UPC ${upc}, current ASIN ${currentAsin}`);

    // Verify the mapping with Amazon
    const verification = await amazonRealPricingService.verifyUPCMapping(upc, currentAsin);

    if (verification.isCorrect) {
      return res.json({
        success: true,
        message: 'Current ASIN mapping is already correct',
        productName: currentMapping[0].productName,
        upc,
        currentAsin,
        verified: true
      });
    }

    if (!verification.correctAsin) {
      return res.json({
        success: false,
        message: 'No correct ASIN found for this UPC',
        productName: currentMapping[0].productName,
        upc,
        currentAsin,
        searchResults: verification.searchResults
      });
    }

    // Update the ASIN mapping
    await db
      .update(productAsinMapping)
      .set({ asin: verification.correctAsin })
      .where(eq(productAsinMapping.productId, productId));

    // Check if the correct ASIN exists in amazon_asins table
    const existingAsin = await db
      .select()
      .from(amazonAsins)
      .where(eq(amazonAsins.asin, verification.correctAsin))
      .limit(1);

    if (existingAsin.length === 0) {
      // Insert the new ASIN
      const searchResult = verification.searchResults.find(r => r.asin === verification.correctAsin);
      await db.insert(amazonAsins).values({
        asin: verification.correctAsin,
        title: searchResult?.title || 'Amazon Product',
        brand: searchResult?.brand || null,
        imageUrl: searchResult?.imageUrl || null,
        upc: searchResult?.upc || null,
        partNumber: searchResult?.partNumber || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'ASIN mapping corrected successfully',
      productName: currentMapping[0].productName,
      upc,
      oldAsin: currentAsin,
      newAsin: verification.correctAsin,
      searchResults: verification.searchResults
    });

  } catch (error) {
    console.error('Fix UPC mapping error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update product prices with real Amazon data
 */
router.post('/update-prices-with-real-data', async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins)) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }

    console.log(`Updating prices with real Amazon data for ASINs: ${asins.join(', ')}`);

    // Get real pricing from Amazon
    const pricingData = await amazonRealPricingService.getRealPricing(asins);

    const results = [];

    for (const [asin, amazonData] of pricingData.entries()) {
      // Get product associated with this ASIN
      const productData = await db
        .select({
          productId: products.id,
          productName: products.name,
          cost: products.cost,
          currentPrice: products.price
        })
        .from(products)
        .innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
        .where(eq(productAsinMapping.asin, asin))
        .limit(1);

      if (productData.length === 0) {
        results.push({
          asin,
          success: false,
          error: 'No product found for this ASIN'
        });
        continue;
      }

      const product = productData[0];
      
      // Use buy box price if available, otherwise list price
      const realAmazonPrice = amazonData.buyBoxPrice || amazonData.listPrice;
      
      if (!realAmazonPrice) {
        results.push({
          asin,
          productName: product.productName,
          success: false,
          error: 'No pricing data available from Amazon'
        });
        continue;
      }

      // Update product price to match real Amazon pricing
      await db
        .update(products)
        .set({
          price: realAmazonPrice.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(products.id, product.productId));

      const cost = parseFloat(product.cost || '0');
      const profitMargin = cost > 0 ? ((realAmazonPrice - cost) / realAmazonPrice * 100) : 0;

      results.push({
        asin,
        productName: product.productName,
        cost: `$${cost.toFixed(2)}`,
        oldPrice: product.currentPrice || 'N/A',
        newPrice: `$${realAmazonPrice.toFixed(2)}`,
        profitMargin: `${profitMargin.toFixed(1)}%`,
        source: amazonData.buyBoxPrice ? 'Amazon Buy Box' : 'Amazon List Price',
        success: true
      });

      console.log(`Updated ${asin}: ${product.productName} to $${realAmazonPrice.toFixed(2)}`);
    }

    const successful = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Updated ${successful} products with real Amazon pricing`,
      totalRequested: asins.length,
      successful,
      results
    });

  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;