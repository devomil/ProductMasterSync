import axios from 'axios';

interface ListingRestriction {
  marketplaceId: string;
  conditionType?: string;
  reasons: {
    message: string;
    reasonCode: 'APPROVAL_REQUIRED' | 'ASIN_NOT_FOUND' | 'NOT_ELIGIBLE';
  }[];
  links?: {
    resource: string;
    verb: string;
    title?: string;
    type?: string;
  }[];
}

interface ListingsRestrictionsResponse {
  restrictions: ListingRestriction[];
}

export class AmazonListingsRestrictionsService {
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://sellingpartnerapi-na.amazon.com';

  constructor() {
    this.accessToken = process.env.AMAZON_SP_API_ACCESS_TOKEN || '';
    this.refreshToken = process.env.AMAZON_SP_API_REFRESH_TOKEN || '';
    this.clientId = process.env.AMAZON_SP_API_CLIENT_ID || '';
    this.clientSecret = process.env.AMAZON_SP_API_CLIENT_SECRET || '';
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
    } catch (error) {
      console.error('Failed to refresh Amazon SP-API access token:', error);
      throw new Error('Amazon SP-API authentication failed');
    }
  }

  async getListingsRestrictions(
    asin: string,
    sellerId: string,
    marketplaceIds: string[],
    conditionType: string = 'new_new',
    reasonLocale: string = 'en_US'
  ): Promise<ListingsRestrictionsResponse> {
    try {
      const params = new URLSearchParams({
        asin,
        sellerId,
        marketplaceIds: marketplaceIds.join(','),
        conditionType,
        reasonLocale,
      });

      const response = await axios.get(
        `${this.baseUrl}/listings/2021-08-01/restrictions?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'x-amz-access-token': this.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token expired, try to refresh
        await this.refreshAccessToken();
        
        // Retry the request with new token
        const params = new URLSearchParams({
          asin,
          sellerId,
          marketplaceIds: marketplaceIds.join(','),
          conditionType,
          reasonLocale,
        });

        const retryResponse = await axios.get(
          `${this.baseUrl}/listings/2021-08-01/restrictions?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'x-amz-access-token': this.accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

        return retryResponse.data;
      }

      console.error('Amazon SP-API getListingsRestrictions error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch listing restrictions: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // Batch process multiple ASINs with rate limiting (5 requests per second)
  async batchGetListingsRestrictions(
    asinSellerId: { asin: string; sellerId: string }[],
    marketplaceIds: string[],
    conditionType: string = 'new_new'
  ): Promise<{ asin: string; restrictions: ListingRestriction[]; error?: string }[]> {
    const results: { asin: string; restrictions: ListingRestriction[]; error?: string }[] = [];
    const delay = 200; // 200ms delay for 5 requests per second rate limit

    for (const { asin, sellerId } of asinSellerId) {
      try {
        const response = await this.getListingsRestrictions(
          asin,
          sellerId,
          marketplaceIds,
          conditionType
        );
        
        results.push({
          asin,
          restrictions: response.restrictions,
        });
      } catch (error: any) {
        results.push({
          asin,
          restrictions: [],
          error: error.message,
        });
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return results;
  }

  // Helper method to determine if listing is allowed
  isListingAllowed(restrictions: ListingRestriction[]): {
    allowed: boolean;
    reasonCodes: string[];
    messages: string[];
  } {
    if (!restrictions || restrictions.length === 0) {
      return { allowed: true, reasonCodes: [], messages: [] };
    }

    const reasonCodes: string[] = [];
    const messages: string[] = [];

    for (const restriction of restrictions) {
      for (const reason of restriction.reasons) {
        reasonCodes.push(reason.reasonCode);
        messages.push(reason.message);
      }
    }

    // If any restriction has NOT_ELIGIBLE, listing is not allowed
    const notEligible = reasonCodes.includes('NOT_ELIGIBLE');
    const approvalRequired = reasonCodes.includes('APPROVAL_REQUIRED');

    return {
      allowed: !notEligible,
      reasonCodes,
      messages,
    };
  }
}

export const amazonListingsRestrictionsService = new AmazonListingsRestrictionsService();