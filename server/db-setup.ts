import { db } from './db';
import * as schema from '@shared/schema';
import { sql } from 'drizzle-orm';

async function setupDatabase() {
  console.log('Starting database setup...');
  
  try {
    // Create enum types first
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS import_status AS ENUM ('pending', 'processing', 'success', 'error');
        CREATE TYPE IF NOT EXISTS approval_status AS ENUM ('pending', 'approved', 'rejected');
        CREATE TYPE IF NOT EXISTS export_status AS ENUM ('pending', 'processing', 'success', 'error');
        CREATE TYPE IF NOT EXISTS data_source_type AS ENUM ('csv', 'excel', 'json', 'xml', 'edi_x12', 'edifact', 'api', 'sftp', 'ftp', 'manual');
        CREATE TYPE IF NOT EXISTS marketplace AS ENUM ('amazon', 'walmart', 'ebay', 'target', 'home_depot');
        CREATE TYPE IF NOT EXISTS schedule_frequency AS ENUM ('once', 'hourly', 'daily', 'weekly', 'monthly', 'custom');
        CREATE TYPE IF NOT EXISTS resolution_strategy AS ENUM ('newest_wins', 'highest_confidence_wins', 'specific_source_wins', 'manual_resolution', 'keep_all');
        CREATE TYPE IF NOT EXISTS connection_type AS ENUM ('ftp', 'sftp', 'api', 'database');
        CREATE TYPE IF NOT EXISTS connection_status AS ENUM ('success', 'error', 'pending');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    console.log('Enum types created successfully');
    
    // Create tables using Drizzle schema definitions
    // This is just for example as we'll use drizzle-kit to push schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        role TEXT DEFAULT 'user'
      );
      
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        active BOOLEAN DEFAULT TRUE
      );
      
      CREATE TABLE IF NOT EXISTS connections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type connection_type NOT NULL,
        description TEXT,
        supplier_id INTEGER REFERENCES suppliers(id),
        is_active BOOLEAN DEFAULT TRUE,
        credentials JSONB NOT NULL,
        last_tested TIMESTAMP,
        last_status connection_status,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Basic tables created successfully');
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
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