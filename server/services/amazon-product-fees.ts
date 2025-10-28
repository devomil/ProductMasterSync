/**
 * Amazon Product Fees API Service
 * 
 * Fetches real-time fee estimates from Amazon SP-API
 * for accurate profit calculations
 */

import axios from 'axios';
import { getAmazonConfig } from '../utils/amazon-spapi';
import { createAWSSignature } from '../utils/aws-signature';

interface FeeEstimateRequest {
  asin: string;
  price: number;
  isAmazonFulfilled?: boolean;
  shippingPrice?: number;
}

interface FeeDetail {
  feeType: string;
  feeAmount: {
    currencyCode: string;
    amount: number;
  };
}

interface AmazonFeesResponse {
  referralFee: number;
  fbaFee: number;
  variableClosingFee: number;
  totalFees: number;
  feePercentage: number;
  netProceeds: number;
  feeBreakdown: FeeDetail[];
}

// Token cache
let tokenCache: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  const config = getAmazonConfig();
  
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    const expiresIn = response.data.expires_in || 3600;
    tokenCache = {
      access_token: response.data.access_token,
      expires_at: Date.now() + (expiresIn * 1000) - 60000
    };

    return tokenCache.access_token;
  } catch (error) {
    console.error('[Amazon Fees] Error getting access token:', error);
    throw new Error('Failed to authenticate with Amazon SP-API');
  }
}

/**
 * Get fee estimate for a product by ASIN
 */
export async function getProductFees(request: FeeEstimateRequest): Promise<AmazonFeesResponse> {
  const config = getAmazonConfig();
  const accessToken = await getAccessToken();

  try {
    const endpoint = config.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const path = `/products/fees/v0/items/${request.asin}/feesEstimate`;

    const requestBody = {
      FeesEstimateRequest: {
        MarketplaceId: config.marketplaceId,
        IsAmazonFulfilled: request.isAmazonFulfilled !== false, // Default to FBA
        PriceToEstimateFees: {
          ListingPrice: {
            CurrencyCode: 'USD',
            Amount: request.price
          },
          Shipping: {
            CurrencyCode: 'USD',
            Amount: request.shippingPrice || 0
          }
        },
        Identifier: `fee-estimate-${request.asin}-${Date.now()}`
      }
    };

    // Prepare headers for AWS SigV4 signing
    const url = `${endpoint}${path}`;
    const bodyString = JSON.stringify(requestBody);
    const baseHeaders = {
      'host': new URL(endpoint).hostname,
      'content-type': 'application/json',
      'x-amz-access-token': accessToken
    };

    // Add AWS Signature V4 if credentials are available
    let awsHeaders = {};
    if (process.env.AMAZON_SP_API_AWS_ACCESS_KEY && process.env.AMAZON_SP_API_AWS_SECRET_KEY) {
      try {
        awsHeaders = await createAWSSignature({
          method: 'POST',
          url,
          headers: baseHeaders,
          body: bodyString,
          service: 'execute-api',
          region: 'us-east-1'
        });
        console.log('[Amazon Fees] Using AWS SigV4 authentication');
      } catch (error) {
        console.warn('[Amazon Fees] AWS SigV4 signing failed, proceeding with OAuth-only:', error);
      }
    }

    const response = await axios({
      method: 'POST',
      url,
      headers: {
        ...baseHeaders,
        ...awsHeaders
      },
      data: bodyString
    });

    // Parse the fee response
    const feesResult = response.data?.payload?.FeesEstimateResult;
    
    if (!feesResult || feesResult.Status !== 'Success') {
      const errorMessage = feesResult?.Error?.Message || 'Unknown error';
      throw new Error(`Fee estimate failed: ${errorMessage}`);
    }

    const feesEstimate = feesResult.FeesEstimate;
    const feeDetails = feesEstimate?.FeeDetailList || [];

    // Calculate totals
    let referralFee = 0;
    let fbaFee = 0;
    let variableClosingFee = 0;

    feeDetails.forEach((fee: FeeDetail) => {
      const amount = fee.feeAmount?.amount || 0;
      
      if (fee.feeType === 'ReferralFee') {
        referralFee = amount;
      } else if (fee.feeType === 'FBAFees' || fee.feeType === 'FulfillmentFee') {
        fbaFee = amount;
      } else if (fee.feeType === 'VariableClosingFee') {
        variableClosingFee = amount;
      }
    });

    const totalFees = referralFee + fbaFee + variableClosingFee;
    const feePercentage = request.price > 0 ? (totalFees / request.price) * 100 : 0;
    const netProceeds = request.price - totalFees;

    return {
      referralFee,
      fbaFee,
      variableClosingFee,
      totalFees,
      feePercentage,
      netProceeds,
      feeBreakdown: feeDetails
    };

  } catch (error: any) {
    console.error(`[Amazon Fees] Error getting fees for ASIN ${request.asin}:`, error.message);
    
    // Return estimated fees as fallback
    console.warn(`[Amazon Fees] Using estimated fees for ASIN ${request.asin}`);
    return estimateFees(request.price);
  }
}

/**
 * Fallback: Estimate fees when API call fails
 * Uses industry-standard Amazon fee estimates
 */
function estimateFees(price: number): AmazonFeesResponse {
  // Amazon referral fee is typically 15% for most categories
  const referralFee = price * 0.15;
  
  // FBA fee estimate (simplified)
  let fbaFee = 0;
  if (price < 10) {
    fbaFee = 3.22;
  } else if (price < 25) {
    fbaFee = 3.86;
  } else if (price < 50) {
    fbaFee = 4.82;
  } else {
    fbaFee = 5.90;
  }

  const variableClosingFee = 0; // Usually only for media items
  const totalFees = referralFee + fbaFee + variableClosingFee;
  const feePercentage = (totalFees / price) * 100;
  const netProceeds = price - totalFees;

  return {
    referralFee,
    fbaFee,
    variableClosingFee,
    totalFees,
    feePercentage,
    netProceeds,
    feeBreakdown: []
  };
}

/**
 * Batch get fees for multiple products
 * Respects rate limits (1 request per second)
 */
export async function getBatchProductFees(requests: FeeEstimateRequest[]): Promise<Map<string, AmazonFeesResponse>> {
  const results = new Map<string, AmazonFeesResponse>();
  
  for (const request of requests) {
    try {
      const fees = await getProductFees(request);
      results.set(request.asin, fees);
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Amazon Fees] Failed to get fees for ${request.asin}`);
    }
  }
  
  return results;
}
