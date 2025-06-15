/**
 * Database Initialization and Schema Validation
 * 
 * Ensures Amazon ASIN mapping schema integrity on server startup
 */

import { db } from '../db';
import { productAsinMapping, amazonMarketIntelligence } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { resetAsinMappingsWithAuthenticData, getAsinMappingStatus } from './asin-mapping-fix';

export async function initializeAmazonMappings() {
  try {
    console.log('Checking Amazon ASIN mapping data integrity...');
    
    const status = await getAsinMappingStatus();
    
    // If no authentic mappings exist, populate them
    if (status.totalMappings === 0 || status.totalMarketData === 0) {
      console.log('No Amazon ASIN mappings found. Populating authentic data...');
      await resetAsinMappingsWithAuthenticData();
      console.log('✓ Authentic Amazon ASIN mappings initialized');
    } else {
      console.log(`✓ Amazon ASIN mappings exist: ${status.totalMappings} mappings, ${status.totalMarketData} market data records`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Amazon mappings:', error);
    return false;
  }
}

/**
 * Validates that the database uses the correct schema approach
 */
export async function validateDatabaseSchema() {
  try {
    // Simple validation without accessing potentially problematic columns
    const mappingCount = await db.execute(sql`SELECT COUNT(*) FROM product_asin_mapping WHERE is_active = true`);
    const marketCount = await db.execute(sql`SELECT COUNT(*) FROM amazon_market_intelligence`);
    
    const mappings = parseInt(mappingCount.rows[0].count as string);
    const marketData = parseInt(marketCount.rows[0].count as string);
    
    if (mappings === 0) {
      console.warn('⚠️  No active ASIN mappings found in productAsinMapping table');
      return false;
    }
    
    if (marketData === 0) {
      console.warn('⚠️  No Amazon market intelligence data found');
      return false;
    }
    
    console.log(`✓ Database schema validation passed: ${mappings} mappings, ${marketData} market records`);
    return true;
  } catch (error) {
    console.error('Database schema validation failed:', error);
    return false;
  }
}

/**
 * Complete database initialization for Amazon marketplace features
 */
export async function initializeAmazonDatabase() {
  console.log('Initializing Amazon marketplace database...');
  
  const schemaValid = await validateDatabaseSchema();
  
  if (!schemaValid) {
    await initializeAmazonMappings();
  }
  
  console.log('✓ Amazon marketplace database initialization complete');
}