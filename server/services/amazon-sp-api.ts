import axios from 'axios';
import crypto from 'crypto';

interface AmazonCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  region: string;
  marketplace: string;
}

interface AmazonProduct {
  asin: string;
  title: string;
  brand?: string;
  manufacturer?: string;
  imageUrl?: string;
}

interface AmazonPricing {
  asin: string;
  currentPrice?: number;
  listPrice?: number;
  currencyCode: string;
  availability: string;
  seller?: string;
  fulfillmentChannel?: string;
  isPrime: boolean;
}

interface AmazonRanking {
  asin: string;
  salesRank?: number;
  categoryRank?: number;
  category?: string;
}

interface ListingRestriction {
  asin: string;
  canList: boolean;
  reasonCodes: string[];
  messages: string[];
}

export class AmazonSPAPIService {
  private credentials: AmazonCredentials;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor() {
    this.credentials = {
      accessKeyId: process.env.AMAZON_SP_API_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AMAZON_SP_API_SECRET_KEY || '',
      refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
      clientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
      clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
      region: process.env.AMAZON_SP_API_REGION || 'us-east-1',
      marketplace: process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER', // US marketplace
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // Refresh 1 minute early

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon SP-API access token:', error);
      throw new Error('Amazon SP-API authentication failed');
    }
  }

  private createSignedHeaders(method: string, path: string, payload: string = ''): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    
    const credentialScope = `${date}/${this.credentials.region}/execute-api/aws4_request`;
    const canonicalHeaders = `host:sellingpartnerapi-na.amazon.com\nx-amz-date:${timestamp}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${crypto.createHash('sha256').update(payload).digest('hex')}`;
    
    const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    const signingKey = this.getSignatureKey(this.credentials.secretAccessKey, date, this.credentials.region, 'execute-api');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return {
      'Authorization': authorization,
      'x-amz-date': timestamp,
      'host': 'sellingpartnerapi-na.amazon.com',
    };
  }

  private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  async searchProductsByUPC(upc: string): Promise<AmazonProduct[]> {
    try {
      const accessToken = await this.getAccessToken();
      const path = `/catalog/2022-04-01/items`;
      const queryParams = new URLSearchParams({
        marketplaceIds: this.credentials.marketplace,
        identifiers: upc,
        identifiersType: 'UPC',
        includedData: 'attributes,identifiers,images,productTypes,relationships,salesRanks',
      });

      const headers = {
        ...this.createSignedHeaders('GET', `${path}?${queryParams}`),
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com${path}?${queryParams}`, {
        headers,
      });

      return response.data.items?.map((item: any) => ({
        asin: item.asin,
        title: item.attributes?.item_name?.[0]?.value || '',
        brand: item.attributes?.brand?.[0]?.value || '',
        manufacturer: item.attributes?.manufacturer?.[0]?.value || '',
        imageUrl: item.images?.[0]?.images?.[0]?.link || '',
      })) || [];

    } catch (error: any) {
      console.error('Amazon SP-API UPC search failed:', error?.response?.data || error.message);
      throw new Error(`Failed to search Amazon products by UPC: ${error.message}`);
    }
  }

  async searchProductsByMFG(mfgNumber: string): Promise<AmazonProduct[]> {
    try {
      const accessToken = await this.getAccessToken();
      const path = `/catalog/2022-04-01/items`;
      const queryParams = new URLSearchParams({
        marketplaceIds: this.credentials.marketplace,
        keywords: mfgNumber,
        includedData: 'attributes,identifiers,images,productTypes,relationships,salesRanks',
      });

      const headers = {
        ...this.createSignedHeaders('GET', `${path}?${queryParams}`),
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com${path}?${queryParams}`, {
        headers,
      });

      // Filter results that match MFG number in model or part number fields
      const matchingItems = response.data.items?.filter((item: any) => {
        const modelNumber = item.attributes?.model_number?.[0]?.value || '';
        const partNumber = item.attributes?.part_number?.[0]?.value || '';
        const manufacturerPartNumber = item.attributes?.manufacturer_part_number?.[0]?.value || '';
        
        return modelNumber.includes(mfgNumber) || 
               partNumber.includes(mfgNumber) || 
               manufacturerPartNumber.includes(mfgNumber);
      }) || [];

      return matchingItems.map((item: any) => ({
        asin: item.asin,
        title: item.attributes?.item_name?.[0]?.value || '',
        brand: item.attributes?.brand?.[0]?.value || '',
        manufacturer: item.attributes?.manufacturer?.[0]?.value || '',
        imageUrl: item.images?.[0]?.images?.[0]?.link || '',
      }));

    } catch (error: any) {
      console.error('Amazon SP-API MFG search failed:', error?.response?.data || error.message);
      throw new Error(`Failed to search Amazon products by MFG#: ${error.message}`);
    }
  }

  async getProductPricing(asins: string[]): Promise<AmazonPricing[]> {
    try {
      const accessToken = await this.getAccessToken();
      const path = `/products/pricing/v0/price`;
      const queryParams = new URLSearchParams({
        MarketplaceId: this.credentials.marketplace,
        Asins: asins.join(','),
        ItemType: 'Asin',
      });

      const headers = {
        ...this.createSignedHeaders('GET', `${path}?${queryParams}`),
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com${path}?${queryParams}`, {
        headers,
      });

      return response.data.payload?.map((item: any) => {
        const pricing = item.Product?.Offers?.[0]?.BuyingPrice;
        const listPrice = item.Product?.Offers?.[0]?.RegularPrice;
        
        return {
          asin: item.ASIN,
          currentPrice: pricing?.Amount ? Math.round(parseFloat(pricing.Amount) * 100) : undefined,
          listPrice: listPrice?.Amount ? Math.round(parseFloat(listPrice.Amount) * 100) : undefined,
          currencyCode: pricing?.CurrencyCode || 'USD',
          availability: item.Product?.Offers?.[0]?.ItemCondition || 'Unknown',
          seller: item.Product?.Offers?.[0]?.SellerName || '',
          fulfillmentChannel: item.Product?.Offers?.[0]?.FulfillmentChannel || '',
          isPrime: item.Product?.Offers?.[0]?.PrimeInformation?.IsNationalPrime || false,
        };
      }) || [];

    } catch (error: any) {
      console.error('Amazon SP-API pricing failed:', error?.response?.data || error.message);
      throw new Error(`Failed to get Amazon pricing: ${error.message}`);
    }
  }

  async getProductRanking(asins: string[]): Promise<AmazonRanking[]> {
    try {
      const accessToken = await this.getAccessToken();
      const rankings: AmazonRanking[] = [];

      // Process ASINs in batches to respect rate limits
      for (const asin of asins) {
        const path = `/catalog/2022-04-01/items/${asin}`;
        const queryParams = new URLSearchParams({
          marketplaceIds: this.credentials.marketplace,
          includedData: 'salesRanks',
        });

        const headers = {
          ...this.createSignedHeaders('GET', `${path}?${queryParams}`),
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json',
        };

        const response = await axios.get(`https://sellingpartnerapi-na.amazon.com${path}?${queryParams}`, {
          headers,
        });

        const salesRanks = response.data.salesRanks || [];
        const overallRank = salesRanks.find((rank: any) => rank.title === 'Amazon Best Sellers Rank');
        const categoryRank = salesRanks.find((rank: any) => rank.title !== 'Amazon Best Sellers Rank');

        rankings.push({
          asin,
          salesRank: overallRank?.rank || undefined,
          categoryRank: categoryRank?.rank || undefined,
          category: categoryRank?.title || undefined,
        });

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      return rankings;

    } catch (error: any) {
      console.error('Amazon SP-API ranking failed:', error?.response?.data || error.message);
      throw new Error(`Failed to get Amazon rankings: ${error.message}`);
    }
  }

  async getListingRestrictions(asin: string, sellerId: string): Promise<ListingRestriction> {
    try {
      const accessToken = await this.getAccessToken();
      const path = `/listings/2021-08-01/restrictions`;
      const queryParams = new URLSearchParams({
        asin,
        sellerId,
        marketplaceIds: this.credentials.marketplace,
      });

      const headers = {
        ...this.createSignedHeaders('GET', `${path}?${queryParams}`),
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com${path}?${queryParams}`, {
        headers,
      });

      const restrictions = response.data.restrictions || [];
      const canList = restrictions.length === 0 || !restrictions.some((r: any) => r.flowRequired);
      
      return {
        asin,
        canList,
        reasonCodes: restrictions.map((r: any) => r.reasonCode).filter(Boolean),
        messages: restrictions.map((r: any) => r.message).filter(Boolean),
      };

    } catch (error: any) {
      console.error('Amazon SP-API restrictions failed:', error?.response?.data || error.message);
      
      // If seller ID is missing, return appropriate error
      if (error?.response?.status === 400) {
        throw new Error('Seller ID is required for listing restrictions check');
      }
      
      throw new Error(`Failed to get listing restrictions: ${error.message}`);
    }
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.accessKeyId &&
      this.credentials.secretAccessKey &&
      this.credentials.refreshToken &&
      this.credentials.clientId &&
      this.credentials.clientSecret
    );
  }
}

export const amazonService = new AmazonSPAPIService();