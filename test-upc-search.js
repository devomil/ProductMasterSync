import axios from 'axios';

async function testUPCSearch() {
  try {
    console.log('Testing UPC search for 791659060018...');
    
    // Test the comprehensive Amazon search
    const response = await axios.post('http://localhost:5000/api/amazon/comprehensive-search', {
      upc: '791659060018',
      description: 'ACR 55W/12V LAMP FOR RCL-100 SERIES SEARCHLIGHT'
    });
    
    console.log('Search results:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.results) {
      console.log('\nFound ASINs:');
      response.data.results.forEach((result, index) => {
        console.log(`${index + 1}. ASIN: ${result.asin}, Title: ${result.title}, Method: ${result.matchMethod}, Confidence: ${result.confidence}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing UPC search:', error.response?.data || error.message);
  }
}

testUPCSearch();