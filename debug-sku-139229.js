import { searchCatalogItemsByUPC } from './server/utils/amazon-spapi.js';

async function debugSKU139229() {
  console.log('=== Debugging SKU 139229 UPC Search ===');
  console.log('Expected ASINs: B000K2IKGY, B011KJROI0');
  console.log('Current mapped ASIN: B00DMWKX8E');
  console.log('UPC: 791659060018');
  console.log('');

  try {
    console.log('Making direct Amazon SP-API UPC search...');
    const result = await searchCatalogItemsByUPC('791659060018');
    
    console.log('SP-API Raw Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.items && result.items.length > 0) {
      console.log('\nFound ASINs:');
      result.items.forEach((item, index) => {
        console.log(`${index + 1}. ASIN: ${item.asin}`);
        console.log(`   Title: ${item.summaries?.[0]?.itemName || 'N/A'}`);
        console.log(`   Brand: ${item.attributes?.brand?.[0]?.value || 'N/A'}`);
        
        // Check if this is one of the expected ASINs
        if (['B000K2IKGY', 'B011KJROI0'].includes(item.asin)) {
          console.log(`   ✓ THIS IS AN EXPECTED ASIN`);
        } else if (item.asin === 'B00DMWKX8E') {
          console.log(`   ⚠ This is the currently mapped ASIN`);
        }
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error in UPC search:', error.message);
    
    // Try alternative search methods
    console.log('\nTrying alternative search methods...');
    try {
      const axios = (await import('axios')).default;
      
      console.log('Testing comprehensive search endpoint...');
      const response = await axios.post('http://localhost:5000/api/amazon/comprehensive-search', {
        upc: '791659060018',
        mpn: '6003',
        description: 'ACR 55W/12V LAMP FOR RCL-100 SERIES SEARCHLIGHT'
      });
      
      console.log('Comprehensive search results:');
      console.log(JSON.stringify(response.data, null, 2));
      
    } catch (compError) {
      console.error('Comprehensive search failed:', compError.message);
    }
  }
}

debugSKU139229();