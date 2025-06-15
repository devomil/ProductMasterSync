/**
 * Amazon SP-API Pricing Service (2022-05-01)
 * Implements the official Amazon Pricing API endpoints
 */

interface PricingRequest {
  asin: string;
  marketplaceId: string;
}

interface CompetitiveSummaryResponse {
  asin: string;
  marketplaceId: string;
  featuredBuyingOptions?: Array<{
    buyingOptionType: string;
    segmentedFeaturedOffers: Array<{
      sellerId: string;
      condition: string;
      fulfillmentType: string;
      listingPrice: {
        amount: number;
        currencyCode: string;
      };
      shippingOptions?: Array<{
        shippingOptionType: string;
        price: {
          amount: number;
          currencyCode: string;
        };
      }>;
    }>;
  }>;
  referencePrices?: Array<{
    name: string;
    price: {
      amount: number;
      currencyCode: string;
    };
  }>;
  lowestPricedOffers?: Array<{
    offers: Array<{
      listingPrice: {
        amount: number;
        currencyCode: string;
      };
      sellerId: string;
      fulfillmentType: string;
    }>;
  }>;
}

class AmazonPricingServiceV2022 {
  private readonly CLIENT_ID = process.env.AMAZON_SP_API_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.AMAZON_SP_API_CLIENT_SECRET;
  private readonly REFRESH_TOKEN = process.env.AMAZON_SP_API_REFRESH_TOKEN;
  private readonly ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
  private readonly MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace

  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.REFRESH_TOKEN!,
          client_id: this.CLIENT_ID!,
          client_secret: this.CLIENT_SECRET!
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Token request failed: ${data.error_description || data.error}`);
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // 60 second buffer

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  async getCompetitiveSummaryBatch(asins: string[]): Promise<Map<string, CompetitiveSummaryResponse>> {
    const accessToken = await this.getAccessToken();
    const results = new Map<string, CompetitiveSummaryResponse>();

    // Process in batches of 20 (API limit is 20 ASINs per request)
    for (let i = 0; i < asins.length; i += 20) {
      const batchAsins = asins.slice(i, i + 20);
      
      const requests = batchAsins.map(asin => ({
        asin,
        marketplaceId: this.MARKETPLACE_ID,
        method: 'GET',
        uri: '/products/pricing/2022-05-01/competitiveSummary'
      }));

      try {
        const response = await fetch(`${this.ENDPOINT}/batches/products/pricing/2022-05-01/competitiveSummary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        });

        if (!response.ok) {
          console.error(`Batch pricing API failed: ${response.status} - ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        
        if (data.responses) {
          for (const item of data.responses) {
            if (item.status?.statusCode === 200 && item.body) {
              results.set(item.body.asin, item.body);
            }
          }
        }

        // Rate limiting: 0.033 requests per second (30 second intervals)
        if (i + 20 < asins.length) {
          await new Promise(resolve => setTimeout(resolve, 31000));
        }

      } catch (error) {
        console.error(`Error fetching competitive summary for batch starting at ${i}:`, error);
      }
    }

    return results;
  }

  extractPricingData(summary: CompetitiveSummaryResponse) {
    let buyBoxPrice = null;
    let lowestPrice = null;
    let listPrice = null;
    let offerCount = 0;

    // Extract buy box price from featured offers
    if (summary.featuredBuyingOptions?.[0]?.segmentedFeaturedOffers) {
      const featuredOffers = summary.featuredBuyingOptions[0].segmentedFeaturedOffers;
      if (featuredOffers.length > 0) {
        buyBoxPrice = featuredOffers[0].listingPrice.amount;
        offerCount = featuredOffers.length;
      }
    }

    // Extract lowest price from lowest priced offers
    if (summary.lowestPricedOffers?.[0]?.offers) {
      const offers = summary.lowestPricedOffers[0].offers;
      if (offers.length > 0) {
        lowestPrice = Math.min(...offers.map(offer => offer.listingPrice.amount));
        offerCount = Math.max(offerCount, offers.length);
      }
    }

    // Extract list price from reference prices
    if (summary.referencePrices) {
      const wasPrice = summary.referencePrices.find(ref => ref.name === 'WasPrice');
      if (wasPrice) {
        listPrice = wasPrice.price.amount;
      }
    }

    return {
      asin: summary.asin,
      buyBoxPrice: buyBoxPrice ? Math.round(buyBoxPrice * 100) : null, // Convert to cents
      lowestPrice: lowestPrice ? Math.round(lowestPrice * 100) : null, // Convert to cents
      listPrice: listPrice ? Math.round(listPrice * 100) : null, // Convert to cents
      offerCount,
      lastUpdated: new Date()
    };
  }
}

export const amazonPricingServiceV2022 = new AmazonPricingServiceV2022();