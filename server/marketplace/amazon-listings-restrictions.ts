import axios from 'axios';
import { getAmazonConfigFromDb } from '../utils/get-amazon-config-from-db';
import { db } from '../db';
import { marketplaceCredentials } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

interface SPAPIConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId?: string;
  endpoint?: string;
  sellerId?: string;
}

// Token cache
let tokenCache: { access_token: string; expires_at: number } | null = null;

export class AmazonListingsRestrictionsService {
  private config: SPAPIConfig | null = null;
  private baseUrl = 'https://sellingpartnerapi-na.amazon.com';

  constructor() {
    // No longer using hardcoded env vars - will load config when needed
  }

  /**
   * Load Amazon config from database (database-first approach)
   */
  private async getConfig(): Promise<SPAPIConfig> {
    if (this.config) {
      return this.config;
    }

    // Load config from database
    const baseConfig = await getAmazonConfigFromDb();
    
    // Also get sellerId from database
    const dbCredentials = await db
      .select()
      .from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, 'amazon'))
      .limit(1);
    
    this.config = {
      ...baseConfig,
      sellerId: dbCredentials[0]?.sellerId || 'A10D4VTYI7RMZ2' // Fallback seller ID
    };
    
    return this.config;
  }

  /**
   * Get access token (with caching)
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (tokenCache && tokenCache.expires_at > Date.now()) {
      return tokenCache.access_token;
    }

    const config = await this.getConfig();

    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const expiresIn = response.data.expires_in || 3600;
      tokenCache = {
        access_token: response.data.access_token,
        expires_at: Date.now() + (expiresIn * 1000) - 60000 // Expire 1 minute early for safety
      };

      return tokenCache.access_token;
    } catch (error) {
      console.error('Failed to refresh Amazon SP-API access token:', error);
      throw new Error('Amazon SP-API authentication failed');
    }
  }

  async getListingsRestrictions(
    asin: string,
    sellerId?: string,
    marketplaceIds?: string[],
    conditionType: string = 'new_new',
    reasonLocale: string = 'en_US'
  ): Promise<ListingsRestrictionsResponse> {
    try {
      const config = await this.getConfig();
      const accessToken = await this.getAccessToken();
      
      // Use config values if not provided
      const finalSellerId = sellerId || config.sellerId || '';
      const finalMarketplaceIds = marketplaceIds || [config.marketplaceId || 'ATVPDKIKX0DER'];
      
      const params = new URLSearchParams({
        asin,
        sellerId: finalSellerId,
        marketplaceIds: finalMarketplaceIds.join(','),
        conditionType,
        reasonLocale,
      });

      const response = await axios.get(
        `${this.baseUrl}/listings/2021-08-01/restrictions?${params}`,
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Amazon SP-API getListingsRestrictions error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch listing restrictions: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  // Batch process multiple ASINs with rate limiting (5 requests per second)
  async batchGetListingsRestrictions(
    asins: string[],
    marketplaceIds?: string[],
    conditionType: string = 'new_new'
  ): Promise<{ asin: string; restrictions: ListingRestriction[]; error?: string }[]> {
    const results: { asin: string; restrictions: ListingRestriction[]; error?: string }[] = [];
    const delay = 200; // 200ms delay for 5 requests per second rate limit
    const config = await this.getConfig();

    for (const asin of asins) {
      try {
        const response = await this.getListingsRestrictions(
          asin,
          config.sellerId,
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

  // Helper method to determine if listing is allowed for a specific condition
  isListingAllowed(
    restrictions: ListingRestriction[],
    targetConditionType: string = 'new_new'
  ): {
    allowed: boolean;
    needsApproval: boolean;
    reasonCodes: string[];
    messages: string[];
  } {
    if (!restrictions || restrictions.length === 0) {
      return { allowed: true, needsApproval: false, reasonCodes: [], messages: [] };
    }

    const reasonCodes: string[] = [];
    const messages: string[] = [];

    // CRITICAL FIX: Filter restrictions by conditionType
    // Only check restrictions that match the target condition (e.g., "new_new")
    // If a restriction has no conditionType, it applies to all conditions
    const relevantRestrictions = restrictions.filter(
      r => !r.conditionType || r.conditionType === targetConditionType
    );

    // If no relevant restrictions for this condition, it's allowed
    if (relevantRestrictions.length === 0) {
      return { allowed: true, needsApproval: false, reasonCodes: [], messages: [] };
    }

    for (const restriction of relevantRestrictions) {
      for (const reason of restriction.reasons) {
        reasonCodes.push(reason.reasonCode);
        messages.push(reason.message);
      }
    }

    // Check restriction types
    const notEligible = reasonCodes.includes('NOT_ELIGIBLE');
    const approvalRequired = reasonCodes.includes('APPROVAL_REQUIRED');
    const asinNotFound = reasonCodes.includes('ASIN_NOT_FOUND');

    // CRITICAL FIX: Both NOT_ELIGIBLE and APPROVAL_REQUIRED mean you cannot list
    // - NOT_ELIGIBLE: Permanently blocked
    // - APPROVAL_REQUIRED: Blocked until approval granted
    // - ASIN_NOT_FOUND: Invalid ASIN
    const canList = !notEligible && !approvalRequired && !asinNotFound;

    return {
      allowed: canList,
      needsApproval: approvalRequired,
      reasonCodes,
      messages,
    };
  }
}

export const amazonListingsRestrictionsService = new AmazonListingsRestrictionsService();