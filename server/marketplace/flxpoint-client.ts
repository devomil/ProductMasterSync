import axios, { AxiosInstance, AxiosError } from 'axios';

const FLXPOINT_BASE_URL = 'https://api.flxpoint.com';
const RATE_LIMIT_POOL_SIZE = 40;
const RATE_LIMIT_REPLENISH_PER_SECOND = 1;
const MAX_REQUESTS_PER_SECOND = 2;

interface RateLimitState {
  poolUsed: number;
  lastRequestTime: number;
  requestQueue: Array<() => Promise<void>>;
}

interface FlxpointVariantResponse {
  id: string;
  sku: string;
  parent_sku?: string;
  source_sku?: string;
  upc?: string;
  asin?: string;
  walmart_id?: string;
  quantity?: number;
  cost?: number;
  price?: number;
  map_price?: number;
  weight?: number;
  weight_unit?: string;
  title?: string;
  description?: string;
  brand?: string;
  category?: string;
  product_type?: string;
  [key: string]: any;
}

interface FlxpointPaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

interface FlxpointUpdatePayload {
  sku: string;
  wm_comm_rate?: number;
  amz_comm_rate?: number;
  wm_product_type?: string;
  wm_buybox_price?: number;
  amz_buybox_price?: number;
  [key: string]: any;
}

export class FlxpointClient {
  private client: AxiosInstance;
  private rateLimitState: RateLimitState = {
    poolUsed: 0,
    lastRequestTime: 0,
    requestQueue: [],
  };

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: FLXPOINT_BASE_URL,
      headers: {
        'X-API-TOKEN': apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.response.use(
      (response) => {
        const poolUsed = parseInt(response.headers['x-auth-pool-used'] || '0');
        const poolSize = parseInt(response.headers['x-auth-pool-size'] || String(RATE_LIMIT_POOL_SIZE));
        
        this.rateLimitState.poolUsed = poolUsed;
        console.log(`[Flxpoint] Rate limit: ${poolUsed}/${poolSize} requests used`);
        
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          console.warn('[Flxpoint] Rate limit exceeded, waiting before retry...');
          await this.waitForRateLimit();
          return this.client.request(error.config!);
        }
        throw error;
      }
    );
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimitState.lastRequestTime;
    const minWaitTime = 1000 / MAX_REQUESTS_PER_SECOND;
    
    if (timeSinceLastRequest < minWaitTime) {
      const waitTime = minWaitTime - timeSinceLastRequest;
      console.log(`[Flxpoint] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    if (this.rateLimitState.poolUsed >= RATE_LIMIT_POOL_SIZE - 2) {
      const waitTime = Math.ceil((this.rateLimitState.poolUsed - RATE_LIMIT_POOL_SIZE + 5) / RATE_LIMIT_REPLENISH_PER_SECOND) * 1000;
      console.log(`[Flxpoint] Pool nearly exhausted, waiting ${waitTime}ms for replenishment`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimitState.lastRequestTime = Date.now();
  }

  async getProductVariants(page: number = 1, perPage: number = 50): Promise<FlxpointPaginatedResponse<FlxpointVariantResponse>> {
    await this.waitForRateLimit();
    
    try {
      const response = await this.client.get('/product/variants', {
        params: {
          page,
          pageSize: perPage,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('[Flxpoint] Error fetching product variants:', error);
      throw error;
    }
  }

  async getInventoryVariants(page: number = 1, perPage: number = 50): Promise<FlxpointPaginatedResponse<FlxpointVariantResponse>> {
    await this.waitForRateLimit();
    
    try {
      const response = await this.client.get('/inventory/variants', {
        params: {
          page,
          per_page: Math.min(perPage, 100),
        },
      });
      
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
        throw new Error('Flxpoint API returned HTML instead of JSON - authentication may have failed.');
      }
      
      // Check for pagination info in response headers
      const totalCount = parseInt(response.headers['x-total-count'] || response.headers['x-total'] || '0');
      const totalPages = parseInt(response.headers['x-total-pages'] || '0');
      
      console.log(`[Flxpoint] Inventory variants response:`, {
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : 'N/A',
        keys: Array.isArray(response.data) ? [] : Object.keys(response.data || {}),
        totalCount,
        totalPages,
      });
      
      if (Array.isArray(response.data)) {
        const FLXPOINT_MAX_PAGE_SIZE = 50;
        const gotFullPage = response.data.length >= FLXPOINT_MAX_PAGE_SIZE;
        
        return {
          data: response.data,
          meta: {
            current_page: page,
            total_pages: totalPages > 0 ? totalPages : (gotFullPage ? page + 1 : page),
            total_count: totalCount > 0 ? totalCount : (gotFullPage ? -1 : response.data.length),
            per_page: FLXPOINT_MAX_PAGE_SIZE,
          },
        };
      }
      
      return response.data;
    } catch (error) {
      console.error('[Flxpoint] Error fetching inventory variants:', error);
      throw error;
    }
  }

  async getListingParents(page: number = 1, perPage: number = 100): Promise<FlxpointPaginatedResponse<FlxpointVariantResponse>> {
    await this.waitForRateLimit();
    
    try {
      // Correct endpoint is /product/variants (not /inventory/variants)
      // Flxpoint uses 'per_page' not 'pageSize' for pagination
      const response = await this.client.get('/product/variants', {
        params: {
          page,
          per_page: Math.min(perPage, 100),
        },
      });
      
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
        throw new Error('Flxpoint API returned HTML instead of JSON - authentication may have failed. Please verify your API token.');
      }
      
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Flxpoint API returned invalid response format');
      }
      
      // Check for pagination info in response headers
      const totalCount = parseInt(response.headers['x-total-count'] || response.headers['x-total'] || '0');
      const totalPages = parseInt(response.headers['x-total-pages'] || '0');
      
      console.log(`[Flxpoint] Raw response structure for product/variants:`, {
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : 'N/A',
        keys: Array.isArray(response.data) ? [] : Object.keys(response.data || {}),
        headers: {
          totalCount: response.headers['x-total-count'] || response.headers['x-total'],
          totalPages: response.headers['x-total-pages'],
        },
      });
      
      if (Array.isArray(response.data)) {
        // Flxpoint has a max page size of 50, regardless of what we request
        // If we got any results, assume there might be more pages
        // Only stop if we get 0 results or fewer than a typical full page (50)
        const FLXPOINT_MAX_PAGE_SIZE = 50;
        const gotResults = response.data.length > 0;
        const gotFullPage = response.data.length >= FLXPOINT_MAX_PAGE_SIZE;
        
        return {
          data: response.data,
          meta: {
            current_page: page,
            // If we have header info, use it. Otherwise, assume more pages if we got a full page
            total_pages: totalPages > 0 ? totalPages : (gotFullPage ? page + 1 : page),
            total_count: totalCount > 0 ? totalCount : (gotFullPage ? -1 : response.data.length), // -1 means unknown
            per_page: FLXPOINT_MAX_PAGE_SIZE,
          },
        };
      }
      
      return response.data;
    } catch (error) {
      console.error('[Flxpoint] Error fetching product variants:', error);
      throw error;
    }
  }

  async updateInventoryVariants(variants: FlxpointUpdatePayload[]): Promise<{ success: boolean; updated: number; errors: any[] }> {
    await this.waitForRateLimit();
    
    if (variants.length > 50) {
      throw new Error('Cannot update more than 50 variants per request');
    }
    
    try {
      // Correct endpoint is /product/variants (not /inventory/variants)
      const response = await this.client.put('/product/variants', {
        variants,
      });
      
      return {
        success: true,
        updated: variants.length,
        errors: [],
      };
    } catch (error: any) {
      console.error('[Flxpoint] Error updating product variants:', error);
      return {
        success: false,
        updated: 0,
        errors: [error.response?.data || error.message],
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.waitForRateLimit();
      // Correct endpoint is /product/variants (not /inventory/variants)
      const response = await this.client.get('/product/variants', {
        params: { page: 1, pageSize: 1 },
      });
      
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
        return {
          success: false,
          message: 'Authentication failed - Flxpoint returned login page. Please verify your API token.',
        };
      }
      
      if (Array.isArray(response.data)) {
        return {
          success: true,
          message: `Connected successfully. API returned ${response.data.length} variant(s).`,
        };
      }
      
      if (!response.data || typeof response.data !== 'object') {
        return {
          success: false,
          message: 'Invalid response from Flxpoint API',
        };
      }
      
      return {
        success: true,
        message: `Connected successfully. Found ${response.data?.meta?.total_count || 0} variants.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  formatCommissionRate(percentRate: number): number {
    return 1 + (percentRate / 100);
  }

  parseCommissionRate(multiplier: number): number {
    return (multiplier - 1) * 100;
  }
}

export function createFlxpointClient(): FlxpointClient | null {
  const apiToken = process.env.FLXPOINT_API_TOKEN;
  
  if (!apiToken) {
    console.warn('[Flxpoint] No API token configured');
    return null;
  }
  
  // Debug: show token length and first/last characters
  const maskedToken = apiToken.length > 8 
    ? `${apiToken.substring(0, 4)}...${apiToken.substring(apiToken.length - 4)} (${apiToken.length} chars)`
    : `[too short: ${apiToken.length} chars]`;
  console.log(`[Flxpoint] Using API token: ${maskedToken}`);
  
  return new FlxpointClient(apiToken);
}

export type { FlxpointVariantResponse, FlxpointPaginatedResponse, FlxpointUpdatePayload };
