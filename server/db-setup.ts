import { db } from './db';
import * as schema from '@shared/schema';
import { sql } from 'drizzle-orm';

async function createDataSourcesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS data_sources (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        supplier_id INTEGER,
        config JSONB NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('data_sources table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating data_sources table:', error);
    return false;
  }
}

async function createMappingTemplatesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mapping_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        mappings JSONB NOT NULL,
        transformations JSONB DEFAULT '[]',
        validation_rules JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('mapping_templates table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating mapping_templates table:', error);
    return false;
  }
}

async function createUpcAsinMappingsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS upc_asin_mappings (
        id SERIAL PRIMARY KEY,
        upc TEXT NOT NULL,
        asin TEXT NOT NULL,
        discovered_at TIMESTAMP DEFAULT NOW(),
        last_verified_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        confidence INTEGER DEFAULT 100,
        source TEXT DEFAULT 'sp_api',
        marketplace_id TEXT DEFAULT 'ATVPDKIKX0DER',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(upc, asin, marketplace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_upc_asin_mappings_upc ON upc_asin_mappings(upc);
      CREATE INDEX IF NOT EXISTS idx_upc_asin_mappings_asin ON upc_asin_mappings(asin);
    `);
    console.log('upc_asin_mappings table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating upc_asin_mappings table:', error);
    return false;
  }
}

async function createAmazonMarketDataTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS amazon_market_data (
        id SERIAL PRIMARY KEY,
        asin TEXT NOT NULL,
        upc TEXT,
        title TEXT,
        brand TEXT,
        manufacturer TEXT,
        category TEXT,
        subcategory TEXT,
        
        -- Pricing intelligence
        current_price INTEGER,
        list_price INTEGER,
        lowest_price INTEGER,
        highest_price INTEGER,
        price_history JSONB DEFAULT '[]',
        
        -- Sales rank and performance
        sales_rank INTEGER,
        category_rank INTEGER,
        bsr_30_day INTEGER,
        rank_history JSONB DEFAULT '[]',
        
        -- Product details
        image_url TEXT,
        dimensions JSONB DEFAULT '{}',
        weight TEXT,
        features JSONB DEFAULT '[]',
        description TEXT,
        
        -- Availability and fulfillment
        availability TEXT,
        fulfillment_by TEXT,
        is_amazon_choice BOOLEAN DEFAULT FALSE,
        is_prime BOOLEAN DEFAULT FALSE,
        
        -- Variation data
        parent_asin TEXT,
        variation_type TEXT,
        variation_value TEXT,
        total_variations INTEGER,
        
        -- Review and rating data
        rating INTEGER,
        review_count INTEGER,
        qa_count INTEGER,
        
        -- Seller information
        seller_name TEXT,
        seller_type TEXT,
        sold_by TEXT,
        shipped_by TEXT,
        
        -- Intelligence flags
        is_restricted_brand BOOLEAN DEFAULT FALSE,
        has_gating BOOLEAN DEFAULT FALSE,
        is_hazmat BOOLEAN DEFAULT FALSE,
        requires_approval BOOLEAN DEFAULT FALSE,
        
        -- Sync metadata
        data_fetched_at TIMESTAMP DEFAULT NOW(),
        last_price_check TIMESTAMP,
        last_rank_check TIMESTAMP,
        sync_frequency TEXT DEFAULT 'daily',
        marketplace_id TEXT DEFAULT 'ATVPDKIKX0DER',
        
        -- Raw data storage
        raw_api_response JSONB DEFAULT '{}',
        additional_data JSONB DEFAULT '{}',
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(asin, marketplace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_amazon_market_data_upc ON amazon_market_data(upc);
      CREATE INDEX IF NOT EXISTS idx_amazon_market_data_sales_rank ON amazon_market_data(sales_rank);
      CREATE INDEX IF NOT EXISTS idx_amazon_market_data_brand ON amazon_market_data(brand);
    `);
    console.log('amazon_market_data table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating amazon_market_data table:', error);
    return false;
  }
}

async function createAmazonCompetitiveAnalysisTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS amazon_competitive_analysis (
        id SERIAL PRIMARY KEY,
        upc TEXT NOT NULL,
        analysis_date TIMESTAMP DEFAULT NOW(),
        
        -- Market overview
        total_asins_found INTEGER DEFAULT 0,
        price_range_min INTEGER,
        price_range_max INTEGER,
        average_price INTEGER,
        median_price INTEGER,
        
        -- Brand competition
        unique_brands INTEGER DEFAULT 0,
        dominant_brand TEXT,
        brand_distribution JSONB DEFAULT '{}',
        
        -- Sales performance insights
        best_performing_asin TEXT,
        worst_performing_asin TEXT,
        average_sales_rank INTEGER,
        rank_spread INTEGER,
        
        -- Market saturation indicators
        fba_vs_fbm_ratio JSONB DEFAULT '{}',
        prime_eligible_count INTEGER DEFAULT 0,
        amazon_choice_count INTEGER DEFAULT 0,
        
        -- Entry barriers and opportunities
        average_review_count INTEGER,
        review_count_range JSONB DEFAULT '{}',
        gated_brand_count INTEGER DEFAULT 0,
        restricted_asin_count INTEGER DEFAULT 0,
        
        -- Market trends
        price_volatility INTEGER,
        market_concentration INTEGER,
        competition_level TEXT,
        
        -- Strategic recommendations
        recommended_strategy TEXT,
        opportunity_score INTEGER,
        risk_factors JSONB DEFAULT '[]',
        key_insights JSONB DEFAULT '[]',
        
        -- Metadata
        data_quality INTEGER DEFAULT 100,
        next_analysis_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(upc, analysis_date)
      );
      CREATE INDEX IF NOT EXISTS idx_amazon_competitive_analysis_opportunity ON amazon_competitive_analysis(opportunity_score);
    `);
    console.log('amazon_competitive_analysis table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating amazon_competitive_analysis table:', error);
    return false;
  }
}

async function setupDatabase() {
  console.log('Starting database setup...');
  
  // Create the tables we need - execute in parallel for speed
  const results = await Promise.allSettled([
    createDataSourcesTable(),
    createMappingTemplatesTable(),
    createUpcAsinMappingsTable(),
    createAmazonMarketDataTable(),
    createAmazonCompetitiveAnalysisTable()
  ]);
  
  // Log results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) {
        console.log(`Table #${index + 1} created successfully`);
      } else {
        console.log(`Table #${index + 1} creation failed but didn't throw`);
      }
    } else {
      console.error(`Table #${index + 1} creation rejected:`, result.reason);
    }
  });
  
  console.log('Database setup completed');
  return results.some(r => r.status === 'fulfilled' && r.value === true);
}

// Run setup only if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase()
    .then(() => {
      console.log('Database setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error setting up database:', error);
      process.exit(1);
    });
}

export default setupDatabase;