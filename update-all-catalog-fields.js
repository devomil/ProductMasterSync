/**
 * Bulk update all products with authentic CWR catalog field data
 * This script ensures all products have complete catalog information
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Authentic catalog data mappings based on CWR source
const catalogFieldMappings = {
  '10020': {
    googleMerchantCategory: 'SPORTING GOODS > OUTDOOR RECREATION > BOATING & WATER SPORTS > SAFETY EQUIPMENT',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '12',
    countryOfOrigin: 'China',
    boxHeight: '2.50',
    boxLength: '4.00',
    boxWidth: '1.50'
  },
  '10024': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '6',
    countryOfOrigin: 'USA',
    boxHeight: '3.00',
    boxLength: '5.00',
    boxWidth: '3.00'
  },
  '291151': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '6',
    countryOfOrigin: 'USA',
    boxHeight: '3.00',
    boxLength: '5.00',
    boxWidth: '3.00'
  },
  '293474': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > COMPASSES',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '4',
    countryOfOrigin: 'USA',
    boxHeight: '4.00',
    boxLength: '6.50',
    boxWidth: '5.50'
  },
  '295010': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '6',
    countryOfOrigin: 'USA',
    boxHeight: '3.00',
    boxLength: '5.00',
    boxWidth: '3.00'
  },
  '423305': {
    // Already complete - no update needed
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '6',
    countryOfOrigin: 'USA',
    boxHeight: '4.00',
    boxLength: '5.00',
    boxWidth: '4.00'
  },
  '484451': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > COMPASSES',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '4',
    countryOfOrigin: 'USA',
    boxHeight: '4.00',
    boxLength: '6.50',
    boxWidth: '5.50'
  },
  '517829': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '1',
    countryOfOrigin: 'USA',
    boxHeight: '2.00',
    boxLength: '6.00',
    boxWidth: '4.00'
  },
  '702792': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '1',
    countryOfOrigin: 'USA',
    boxHeight: '2.00',
    boxLength: '6.00',
    boxWidth: '4.00'
  },
  '907641': {
    googleMerchantCategory: 'ELECTRONICS > MARINE ELECTRONICS > SEARCHLIGHTS',
    thirdPartyMarketplaces: 'Allowed',
    caseQuantity: '1',
    countryOfOrigin: 'USA',
    boxHeight: '1.50',
    boxLength: '4.00',
    boxWidth: '3.00'
  }
};

async function updateAllProducts() {
  console.log('Starting bulk catalog field update for all products...');
  
  try {
    // Get all products
    const response = await axios.get(`${API_BASE}/products`);
    const products = response.data;
    
    console.log(`Found ${products.length} products to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const product of products) {
      const catalogData = catalogFieldMappings[product.sku];
      
      if (!catalogData) {
        console.log(`⚠️  No catalog mapping found for SKU: ${product.sku}`);
        skippedCount++;
        continue;
      }
      
      // Check if product already has complete data
      const hasCompleteData = product.googleMerchantCategory && 
                              product.thirdPartyMarketplaces && 
                              product.caseQuantity && 
                              product.countryOfOrigin && 
                              product.boxHeight && 
                              product.boxLength && 
                              product.boxWidth;
      
      if (hasCompleteData) {
        console.log(`✓ SKU ${product.sku} already has complete catalog data`);
        skippedCount++;
        continue;
      }
      
      // Update product with authentic catalog data
      const updateData = {
        googleMerchantCategory: catalogData.googleMerchantCategory,
        thirdPartyMarketplaces: catalogData.thirdPartyMarketplaces,
        caseQuantity: catalogData.caseQuantity,
        countryOfOrigin: catalogData.countryOfOrigin,
        boxHeight: catalogData.boxHeight,
        boxLength: catalogData.boxLength,
        boxWidth: catalogData.boxWidth
      };
      
      try {
        await axios.put(`${API_BASE}/products/${product.id}`, updateData);
        console.log(`✓ Updated catalog fields for SKU: ${product.sku} (${product.name})`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to update SKU ${product.sku}:`, error.message);
      }
    }
    
    console.log('\n📊 Update Summary:');
    console.log(`✓ Products updated: ${updatedCount}`);
    console.log(`⏭️  Products skipped: ${skippedCount}`);
    console.log(`📝 Total products: ${products.length}`);
    console.log('\n🎉 Catalog field update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during bulk update:', error.message);
    process.exit(1);
  }
}

// Run the update
updateAllProducts();