/**
 * Get Amazon SP-API configuration from database with environment variable fallback
 */

import { db } from '../db';
import { marketplaceCredentials } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface SPAPIConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId?: string;
  endpoint?: string;
}

/**
 * Load Amazon SP-API configuration from database first, then fallback to environment variables
 * This is the PREFERRED way to get Amazon config in all API calls
 */
export async function getAmazonConfigFromDb(): Promise<SPAPIConfig> {
  try {
    // First try to get credentials from database
    const dbCredentials = await db
      .select()
      .from(marketplaceCredentials)
      .where(eq(marketplaceCredentials.marketplace, 'amazon'))
      .limit(1);
    
    if (dbCredentials.length > 0 && dbCredentials[0].isActive) {
      const cred = dbCredentials[0];
      
      // Validate that required fields are present
      if (cred.clientId && cred.clientSecret && cred.refreshToken) {
        console.log('[Amazon Config] Using database credentials');
        return {
          clientId: cred.clientId,
          clientSecret: cred.clientSecret,
          refreshToken: cred.refreshToken,
          marketplaceId: cred.marketplaceId || 'ATVPDKIKX0DER',
          endpoint: cred.endpoint || 'https://sellingpartnerapi-na.amazon.com'
        };
      }
    }
  } catch (error) {
    console.error('[Amazon Config] Error reading from database, falling back to environment:', error);
  }
  
  // Fallback to environment variables
  console.log('[Amazon Config] Using environment variable credentials');
  return {
    clientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
    clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
    refreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
    marketplaceId: process.env.AMAZON_SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
    endpoint: process.env.AMAZON_SP_API_ENDPOINT || 'https://sellingpartnerapi-na.amazon.com'
  };
}

/**
 * Validate Amazon SP-API configuration
 */
export function validateAmazonConfig(config: SPAPIConfig): boolean {
  return !!(
    config.clientId &&
    config.clientSecret &&
    config.refreshToken
  );
}
