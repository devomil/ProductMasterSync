/**
 * Standalone Amazon SP-API authentication test
 * Tests OAuth and AWS signature separately to isolate the issue
 */

import axios from 'axios';
import crypto from 'crypto';

async function testOAuthToken() {
  console.log('Testing Amazon SP-API OAuth token generation...');
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_SP_API_REFRESH_TOKEN,
    client_id: process.env.AMAZON_SP_API_CLIENT_ID,
    client_secret: process.env.AMAZON_SP_API_CLIENT_SECRET
  });

  try {
    const response = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✓ OAuth token generated successfully');
    console.log('Token type:', response.data.token_type);
    console.log('Expires in:', response.data.expires_in, 'seconds');
    console.log('Access token length:', response.data.access_token?.length || 0);
    
    return response.data.access_token;
  } catch (error) {
    console.error('✗ OAuth token generation failed:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    return null;
  }
}

function createAWSSignature(method, path, queryString, headers, body, accessKeyId, secretAccessKey) {
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 'execute-api';
  const region = 'us-east-1';
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = headers['x-amz-date'];
  
  // Sort and format headers
  const sortedHeaders = Object.keys(headers)
    .map(key => key.toLowerCase())
    .sort();
  
  const canonicalHeaders = sortedHeaders
    .map(key => `${key}:${headers[Object.keys(headers).find(h => h.toLowerCase() === key)].trim()}`)
    .join('\n') + '\n';
  
  const signedHeaders = sortedHeaders.join(';');
  
  // Hash the payload
  const payloadHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  
  // Create canonical request
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    datetime,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
  ].join('\n');
  
  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  
  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function testAmazonAPICall(accessToken) {
  console.log('\nTesting Amazon SP-API call with OAuth-only authentication...');
  
  const url = 'https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items';
  const queryString = 'marketplaceIds=ATVPDKIKX0DER&keywords=test&pageSize=1';
  
  // Simple OAuth-only headers (no AWS signature required)
  const headers = {
    'x-amz-access-token': accessToken,
    'Content-Type': 'application/json',
    'User-Agent': 'MDM-PIM-System/1.0 (Language=JavaScript)'
  };
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${url}?${queryString}`,
      headers,
      timeout: 30000,
      validateStatus: () => true
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.keys(response.headers));
    
    if (response.status === 200) {
      console.log('✓ Amazon SP-API call successful');
      console.log('Response data type:', typeof response.data);
      console.log('Has items:', !!response.data?.items);
      if (response.data?.items) {
        console.log('Number of items:', response.data.items.length);
      }
    } else {
      console.log('✗ Amazon SP-API call failed');
      console.log('Response data:', response.data);
    }
    
    return response.status === 200;
  } catch (error) {
    console.error('✗ Request failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('Amazon SP-API Authentication Diagnostic Test');
  console.log('===========================================\n');
  
  // Check credentials
  const requiredEnvVars = [
    'AMAZON_SP_API_CLIENT_ID',
    'AMAZON_SP_API_CLIENT_SECRET', 
    'AMAZON_SP_API_REFRESH_TOKEN',
    'AMAZON_SP_API_ACCESS_KEY_ID',
    'AMAZON_SP_API_SECRET_KEY'
  ];
  
  console.log('Checking credentials...');
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    console.log(`${envVar}: ${value ? '✓ Set (' + value.length + ' chars)' : '✗ Missing'}`);
  }
  console.log();
  
  // Test OAuth
  const accessToken = await testOAuthToken();
  if (!accessToken) {
    console.log('Cannot proceed without valid access token');
    return;
  }
  
  // Test SP-API call
  const apiSuccess = await testAmazonAPICall(accessToken);
  
  console.log('\n===========================================');
  console.log('Summary:');
  console.log('OAuth:', accessToken ? '✓ Working' : '✗ Failed');
  console.log('SP-API:', apiSuccess ? '✓ Working' : '✗ Failed');
}

main().catch(console.error);