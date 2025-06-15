/**
 * Amazon Product Pricing Service
 * 
 * Handles competitive pricing data retrieval using Amazon SP-API Product Pricing API
 * and enhanced product search by UPC and manufacturer number.
 */

import { getCompetitivePricing, getItemOffers, searchProductMultipleWays } from '../utils/amazon-spapi.js';
import { pool } from '../db.js';

interface PricingData {
  asin: string;
  competitorPrice: number;
  listingPrice: number;
  lowestPrice: number;
  offerCount: number;
  lastUpdated: Date;
}

interface ProductSearchResult {
  asin: string;
  title: string;
  brand: string;
  upc?: string;
  manufacturerNumber?: string;
  category: string;
  salesRank?: number;
  imageUrl?: string;
}

/**
 * Get accurate competitive pricing for ASINs using SP-API
 */
export async function getAccuratePricing(asins: string[]): Promise<Map<string, PricingData>> {
  const pricingMap = new Map<string, PricingData>();
  
  try {
    // Get competitive pricing data
    const competitivePricing = await getCompetitivePricing(asins);
    
    // Get item offers (lowest prices)
    const itemOffers = await getItemOffers(asins);
    
    // Process competitive pricing data
    for (const pricingData of competitivePricing) {
      if (pricingData.ASIN && pricingData.Product) {
        const asin = pricingData.ASIN;
        const product = pricingData.Product;
        
        let competitorPrice = 0;
        let listingPrice = 0;
        
        // Extract competitive pricing
        if (product.CompetitivePricing && product.CompetitivePricing.CompetitivePrices) {
          const prices = product.CompetitivePricing.CompetitivePrices;
          
          for (const priceData of prices) {
            if (priceData.condition === 'New' && priceData.Price) {
              const price = parseFloat(priceData.Price.ListingPrice?.Amount || '0');
              if (price > competitorPrice) {
                competitorPrice = price;
              }
            }
          }
        }
        
        // Extract listing price from offer data
        const offerData = itemOffers.find(offer => offer.asin === asin);
        if (offerData && offerData.offers) {
          const summary = offerData.offers.Summary;
          if (summary && summary.LowestPrices) {
            const lowestNewPrice = summary.LowestPrices.find((p: any) => p.condition === 'New');
            if (lowestNewPrice && lowestNewPrice.LandedPrice) {
              listingPrice = parseFloat(lowestNewPrice.LandedPrice.Amount || '0');
            }
          }
        }
        
        pricingMap.set(asin, {
          asin,
          competitorPrice: competitorPrice || listingPrice,
          listingPrice,
          lowestPrice: Math.min(competitorPrice, listingPrice) || competitorPrice || listingPrice,
          offerCount: offerData?.offers?.Summary?.TotalOfferCount || 0,
          lastUpdated: new Date()
        });
      }
    }
    
  } catch (error) {
    console.error('Error fetching accurate pricing:', error);
  }
  
  return pricingMap;
}

/**
 * Enhanced product search that finds multiple ASINs for the same product
 */
export async function findMultipleASINsForProduct(upc: string, manufacturerNumber?: string): Promise<ProductSearchResult[]> {
  try {
    const searchResults = await searchProductMultipleWays(upc, manufacturerNumber);
    const products: ProductSearchResult[] = [];
    
    for (const item of searchResults) {
      const product: ProductSearchResult = {
        asin: item.asin,
        title: '',
        brand: '',
        category: '',
      };
      
      // Extract title
      if (item.summaries && item.summaries.length > 0) {
        product.title = item.summaries[0].itemName || '';
      }
      
      // Extract brand
      if (item.attributes && item.attributes.brand) {
        const brand = Array.isArray(item.attributes.brand) 
          ? item.attributes.brand[0] 
          : item.attributes.brand;
        product.brand = brand.value || brand;
      }
      
      // Extract UPC from identifiers
      if (item.identifiers && item.identifiers.length > 0) {
        for (const identifier of item.identifiers) {
          if (identifier.identifierType === 'UPC' && identifier.identifier) {
            product.upc = identifier.identifier;
            break;
          }
        }
      }
      
      // Extract manufacturer number from attributes
      if (item.attributes) {
        const mfgAttrs = ['part_number', 'model_number', 'manufacturer_part_number', 'item_model_number'];
        for (const attr of mfgAttrs) {
          if (item.attributes[attr]) {
            const value = Array.isArray(item.attributes[attr]) 
              ? item.attributes[attr][0] 
              : item.attributes[attr];
            product.manufacturerNumber = value.value || value;
            break;
          }
        }
      }
      
      // Extract category
      if (item.productTypes && item.productTypes.length > 0) {
        product.category = item.productTypes[0].productType;
      }
      
      // Extract sales rank
      if (item.salesRanks && item.salesRanks.length > 0 && item.salesRanks[0].ranks) {
        const firstRank = item.salesRanks[0].ranks[0];
        if (firstRank && firstRank.rank) {
          product.salesRank = firstRank.rank;
        }
      }
      
      // Extract image URL
      if (item.images && item.images.length > 0 && item.images[0].images) {
        const mainImage = item.images[0].images.find((img: any) => img.variant === 'MAIN');
        if (mainImage && mainImage.link) {
          product.imageUrl = mainImage.link;
        } else if (item.images[0].images[0] && item.images[0].images[0].link) {
          product.imageUrl = item.images[0].images[0].link;
        }
      }
      
      products.push(product);
    }
    
    return products;
    
  } catch (error) {
    console.error('Error searching for multiple ASINs:', error);
    return [];
  }
}

/**
 * Update pricing data for existing ASINs in the database
 */
export async function updatePricingForASINs(): Promise<void> {
  try {
    // Get all ASINs from the database
    const result = await db.query('SELECT DISTINCT asin FROM amazon_asins WHERE asin IS NOT NULL');
    const asins = result.rows.map(row => row.asin);
    
    if (asins.length === 0) {
      console.log('No ASINs found to update pricing');
      return;
    }
    
    console.log(`Updating pricing for ${asins.length} ASINs`);
    
    // Get accurate pricing data
    const pricingMap = await getAccuratePricing(asins);
    
    // Update database with new pricing
    for (const [asin, pricing] of pricingMap) {
      await db.query(`
        UPDATE amazon_asins 
        SET 
          current_price = $1,
          competitor_price = $2,
          lowest_price = $3,
          offer_count = $4,
          pricing_last_updated = $5
        WHERE asin = $6
      `, [
        pricing.listingPrice,
        pricing.competitorPrice,
        pricing.lowestPrice,
        pricing.offerCount,
        pricing.lastUpdated,
        asin
      ]);
    }
    
    console.log(`Updated pricing for ${pricingMap.size} ASINs`);
    
  } catch (error) {
    console.error('Error updating pricing for ASINs:', error);
  }
}

/**
 * Search and store multiple ASINs for products based on UPC and manufacturer number
 */
export async function enhanceProductWithMultipleASINs(): Promise<void> {
  try {
    // Get products with UPC and manufacturer number
    const result = await db.query(`
      SELECT id, upc, manufacturer_part_number, brand, name 
      FROM products 
      WHERE upc IS NOT NULL 
      AND (manufacturer_part_number IS NOT NULL OR brand IS NOT NULL)
      LIMIT 50
    `);
    
    for (const product of result.rows) {
      const { id, upc, manufacturer_part_number, brand, name } = product;
      
      console.log(`Searching for multiple ASINs for product: ${name} (UPC: ${upc})`);
      
      // Search for multiple ASINs
      const foundProducts = await findMultipleASINsForProduct(upc, manufacturer_part_number);
      
      // Store found ASINs
      for (const foundProduct of foundProducts) {
        // Check if this ASIN is already mapped to this product
        const existingMapping = await db.query(`
          SELECT id FROM product_asin_mapping 
          WHERE product_id = $1 AND asin = $2
        `, [id, foundProduct.asin]);
        
        if (existingMapping.rows.length === 0) {
          // Store the ASIN
          await db.query(`
            INSERT INTO amazon_asins (asin, title, brand, category, sales_rank, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (asin) DO UPDATE SET
              title = EXCLUDED.title,
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              sales_rank = EXCLUDED.sales_rank,
              image_url = EXCLUDED.image_url
          `, [
            foundProduct.asin,
            foundProduct.title,
            foundProduct.brand,
            foundProduct.category,
            foundProduct.salesRank,
            foundProduct.imageUrl
          ]);
          
          // Create product-ASIN mapping
          await db.query(`
            INSERT INTO product_asin_mapping (product_id, asin, upc_match, mfg_number_match, confidence_score, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            foundProduct.asin,
            foundProduct.upc === upc,
            foundProduct.manufacturerNumber === manufacturer_part_number,
            foundProduct.upc === upc ? 0.9 : 0.7, // Higher confidence for UPC matches
            true
          ]);
          
          console.log(`  - Found and stored ASIN: ${foundProduct.asin} (${foundProduct.title})`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error enhancing products with multiple ASINs:', error);
  }
}