import axios from 'axios';

async function testAmazonAPI() {
  try {
    console.log('Testing Amazon SP-API with product UPC: 791659192832');
    
    // Test the access token generation first
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_SP_API_REFRESH_TOKEN,
      client_id: process.env.AMAZON_SP_API_CLIENT_ID,
      client_secret: process.env.AMAZON_SP_API_CLIENT_SECRET
    });
    
    console.log('✓ Successfully obtained Amazon access token');
    const accessToken = tokenResponse.data.access_token;
    
    // Test catalog search
    const catalogResponse = await axios({
      method: 'GET',
      url: 'https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items',
      params: {
        marketplaceIds: 'ATVPDKIKX0DER',
        identifiers: '791659192832',
        identifiersType: 'UPC',
        includedData: 'attributes,summaries'
      },
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ Amazon catalog search successful');
    console.log('Items found:', catalogResponse.data.items?.length || 0);
    
    if (catalogResponse.data.items && catalogResponse.data.items.length > 0) {
      catalogResponse.data.items.forEach((item, index) => {
        console.log(`ASIN ${index + 1}: ${item.asin}`);
        console.log(`Title: ${item.summaries?.[0]?.itemName || 'Unknown'}`);
        console.log(`Brand: ${item.summaries?.[0]?.brand || 'Unknown'}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Amazon API test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('Authentication failed - check Amazon SP-API credentials');
    } else if (error.response?.status === 403) {
      console.error('Access denied - check marketplace permissions');
    } else if (error.response?.status === 429) {
      console.error('Rate limit exceeded - will retry with proper throttling');
    }
  }
}

testAmazonAPI();