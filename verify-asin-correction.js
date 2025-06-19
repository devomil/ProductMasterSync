import axios from 'axios';

async function verifyASINCorrection() {
  try {
    // Check current mapping for SKU 139229
    const response = await axios.get('http://localhost:5000/api/products');
    const product = response.data.find(p => p.sku === '139229');
    
    console.log('SKU 139229 Current Mapping:');
    console.log(`- SKU: ${product.sku}`);
    console.log(`- Name: ${product.name}`);
    console.log(`- UPC: ${product.upc}`);
    console.log(`- Current ASIN: ${product.asin || 'None'}`);
    
    // Test comprehensive search for this UPC
    console.log('\nTesting UPC search for 791659060018...');
    const searchResponse = await axios.post('http://localhost:5000/api/amazon/comprehensive-search', {
      upc: '791659060018'
    });
    
    if (searchResponse.data.success && searchResponse.data.results?.length > 0) {
      console.log('\nUPC Search Results:');
      searchResponse.data.results.forEach((result, index) => {
        const isExpected = ['B000K2IKGY', 'B011KJROI0'].includes(result.asin);
        const marker = isExpected ? '✓ EXPECTED' : result.asin === 'B00DMWKX8E' ? '⚠ OLD MAPPING' : '';
        console.log(`${index + 1}. ASIN: ${result.asin} ${marker}`);
        console.log(`   Title: ${result.title}`);
        console.log(`   Method: ${result.matchMethod}, Confidence: ${result.confidence}`);
      });
    } else {
      console.log('No results found from UPC search');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

verifyASINCorrection();