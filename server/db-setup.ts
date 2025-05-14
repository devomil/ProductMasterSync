import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '../shared/schema';

neonConfig.webSocketConstructor = ws;

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function setup() {
  console.log('Setting up database tables...');
  
  // Create database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  
  try {
    // Create tables based on schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        role TEXT
      );
      
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        path TEXT,
        parent_id INTEGER REFERENCES categories(id),
        level INTEGER,
        attributes JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        manufacturer_part_number TEXT,
        upc TEXT,
        description TEXT,
        category_id INTEGER REFERENCES categories(id),
        manufacturer_id INTEGER,
        manufacturer_name TEXT,
        price TEXT,
        cost TEXT,
        weight TEXT,
        dimensions TEXT,
        status TEXT DEFAULT 'active',
        is_remanufactured BOOLEAN DEFAULT false,
        is_closeout BOOLEAN DEFAULT false,
        is_on_sale BOOLEAN DEFAULT false,
        has_rebate BOOLEAN DEFAULT false,
        has_free_shipping BOOLEAN DEFAULT false,
        inventory_quantity INTEGER DEFAULT 0,
        reorder_threshold INTEGER DEFAULT 10,
        attributes JSONB,
        amazon_asin TEXT,
        amazon_sync_status TEXT,
        amazon_last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS product_suppliers (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        supplier_sku TEXT,
        cost TEXT,
        lead_time TEXT,
        moq INTEGER,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE import_status AS ENUM ('pending', 'processing', 'success', 'error');
      
      CREATE TABLE IF NOT EXISTS imports (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        source_type TEXT NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        status import_status DEFAULT 'pending',
        row_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        import_mapping JSONB,
        import_errors JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE export_status AS ENUM ('pending', 'processing', 'success', 'error');
      
      CREATE TABLE IF NOT EXISTS exports (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        target_type TEXT NOT NULL,
        status export_status DEFAULT 'pending',
        row_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        export_format TEXT,
        export_mapping JSONB,
        export_errors JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
      
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status approval_status DEFAULT 'pending',
        requested_by TEXT,
        approved_by TEXT,
        request_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        user_id INTEGER,
        username TEXT,
        changes JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE data_source_type AS ENUM ('csv', 'excel', 'json', 'xml', 'edi_x12', 'edifact', 'api', 'sftp', 'ftp', 'manual');
      
      CREATE TABLE IF NOT EXISTS data_sources (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type data_source_type NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        connection_details JSONB,
        authentication JSONB,
        active BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE schedule_frequency AS ENUM ('once', 'hourly', 'daily', 'weekly', 'monthly', 'custom');
      
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        data_source_id INTEGER REFERENCES data_sources(id),
        frequency schedule_frequency NOT NULL,
        cron_expression TEXT,
        active BOOLEAN DEFAULT true,
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS mapping_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        source_type data_source_type NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        field_mappings JSONB NOT NULL,
        transformation_rules JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS data_lineage (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        source_id INTEGER,
        source_type TEXT,
        confidence_score REAL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TYPE resolution_strategy AS ENUM ('newest_wins', 'highest_confidence_wins', 'specific_source_wins', 'manual_resolution', 'keep_all');
      
      CREATE TABLE IF NOT EXISTS data_merging_config (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        strategy resolution_strategy NOT NULL,
        active BOOLEAN DEFAULT false,
        description TEXT,
        preferred_source_id INTEGER,
        confidence_threshold REAL,
        field_strategies JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps JSONB NOT NULL,
        trigger_type TEXT,
        trigger_config JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id),
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        results JSONB,
        error TEXT
      );
      
      CREATE TYPE marketplace AS ENUM ('amazon', 'walmart', 'ebay', 'target', 'home_depot');
      
      CREATE TABLE IF NOT EXISTS amazon_market_data (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        asin TEXT NOT NULL,
        marketplace marketplace DEFAULT 'amazon',
        title TEXT,
        brand TEXT,
        manufacturer TEXT,
        description TEXT,
        bullet_points JSONB,
        image_url TEXT,
        price NUMERIC,
        currency TEXT,
        sales_rank INTEGER,
        sales_rank_category TEXT,
        category_path TEXT,
        product_type TEXT,
        attributes JSONB,
        review_rating REAL,
        review_count INTEGER,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS amazon_sync_logs (
        id SERIAL PRIMARY KEY,
        batch_id TEXT,
        products_total INTEGER DEFAULT 0,
        products_processed INTEGER DEFAULT 0,
        products_successful INTEGER DEFAULT 0,
        products_failed INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        status TEXT DEFAULT 'running',
        error TEXT,
        details JSONB
      );
    `);
    
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error creating database tables:', err);
  } finally {
    await pool.end();
  }
}

setup().catch(console.error);