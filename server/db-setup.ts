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

async function createAmazonMarketplaceDataTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS amazon_marketplace_data (
        id SERIAL PRIMARY KEY,
        product_id INTEGER,
        asin TEXT,
        marketplace_sku TEXT,
        amazon_status TEXT,
        price DECIMAL,
        rank INTEGER,
        category TEXT,
        rating DECIMAL,
        review_count INTEGER,
        fulfillment_type TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_synced TIMESTAMP,
        full_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('amazon_marketplace_data table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating amazon_marketplace_data table:', error);
    return false;
  }
}

async function setupDatabase() {
  console.log('Starting database setup...');
  
  // Create the tables we need - execute in parallel for speed
  const results = await Promise.allSettled([
    createDataSourcesTable(),
    createMappingTemplatesTable(),
    createAmazonMarketplaceDataTable()
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