/**
 * Enhanced ASIN Search Endpoints
 * 
 * Implements comprehensive product search functionality to find multiple ASINs
 * for the same product using UPC and manufacturer number searches.
 */

import { Request, Response } from 'express';
import { searchProductMultipleWays, searchByManufacturerNumber, searchCatalogItemsByUPC, getAmazonConfig } from '../utils/amazon-spapi';

/**
 * Search for multiple ASINs using UPC and manufacturer number
 */
export async function searchMultipleASINs(req: Request, res: Response) {
  try {
    const { upc, manufacturerNumber } = req.query;
    
    if (!upc && !manufacturerNumber) {
      return res.status(400).json({
        success: false,
        error: 'Either UPC or manufacturer number is required'
      });
    }

    const results = await searchProductMultipleWays(
      upc as string, 
      manufacturerNumber as string
    );

    // Extract ASINs and basic product info
    const asins = results.map(item => ({
      asin: item.asin,
      title: item.attributes?.item_name?.[0]?.value || 'Unknown',
      brand: item.attributes?.brand?.[0]?.value || 'Unknown',
      imageUrl: item.images?.[0]?.images?.[0]?.link,
      category: item.productTypes?.[0]?.displayName || 'Unknown',
      salesRank: item.salesRanks?.[0]?.rank
    }));

    res.json({
      success: true,
      data: {
        searchCriteria: { upc, manufacturerNumber },
        foundASINs: asins,
        totalFound: asins.length
      }
    });

  } catch (error: any) {
    console.error('Error in searchMultipleASINs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for ASINs',
      details: error.message
    });
  }
}

/**
 * Search by manufacturer number only
 */
export async function searchByMfgNumber(req: Request, res: Response) {
  try {
    const { manufacturerNumber } = req.params;
    
    if (!manufacturerNumber) {
      return res.status(400).json({
        success: false,
        error: 'Manufacturer number is required'
      });
    }

    const results = await searchByManufacturerNumber(manufacturerNumber);

    const asins = results.map(item => ({
      asin: item.asin,
      title: item.attributes?.item_name?.[0]?.value || 'Unknown',
      brand: item.attributes?.brand?.[0]?.value || 'Unknown',
      manufacturerNumber: item.attributes?.part_number?.[0]?.value,
      imageUrl: item.images?.[0]?.images?.[0]?.link,
      category: item.productTypes?.[0]?.displayName || 'Unknown'
    }));

    res.json({
      success: true,
      data: {
        manufacturerNumber,
        foundASINs: asins,
        totalFound: asins.length
      }
    });

  } catch (error: any) {
    console.error('Error in searchByMfgNumber:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search by manufacturer number',
      details: error.message
    });
  }
}

/**
 * Search by UPC only
 */
export async function searchByUPC(req: Request, res: Response) {
  try {
    const { upc } = req.params;
    
    if (!upc) {
      return res.status(400).json({
        success: false,
        error: 'UPC is required'
      });
    }

    const config = getAmazonConfig();
    const results = await searchCatalogItemsByUPC(upc, config);

    const asins = results.map(item => ({
      asin: item.asin,
      title: item.attributes?.item_name?.[0]?.value || 'Unknown',
      brand: item.attributes?.brand?.[0]?.value || 'Unknown',
      upc: item.identifiers?.find((id: any) => id.identifierType === 'UPC')?.identifier,
      imageUrl: item.images?.[0]?.images?.[0]?.link,
      category: item.productTypes?.[0]?.displayName || 'Unknown'
    }));

    res.json({
      success: true,
      data: {
        upc,
        foundASINs: asins,
        totalFound: asins.length
      }
    });

  } catch (error: any) {
    console.error('Error in searchByUPC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search by UPC',
      details: error.message
    });
  }
}

/**
 * Batch process products to find multiple ASINs
 */
export async function batchFindASINs(req: Request, res: Response) {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required'
      });
    }

    const results = [];
    
    for (const product of products) {
      try {
        const { upc, manufacturerNumber, productId } = product;
        
        const asins = await searchProductMultipleWays(upc, manufacturerNumber);
        
        results.push({
          productId,
          upc,
          manufacturerNumber,
          foundASINs: asins.map(item => ({
            asin: item.asin,
            title: item.attributes?.item_name?.[0]?.value || 'Unknown',
            brand: item.attributes?.brand?.[0]?.value || 'Unknown'
          })),
          totalFound: asins.length
        });
        
        // Rate limiting between products
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing product ${product.productId}:`, error);
        results.push({
          productId: product.productId,
          error: 'Failed to search for ASINs'
        });
      }
    }

    res.json({
      success: true,
      data: {
        processedCount: products.length,
        results
      }
    });

  } catch (error: any) {
    console.error('Error in batchFindASINs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch process products',
      details: error.message
    });
  }
}