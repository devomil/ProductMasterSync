/**
 * Migration script to populate Amazon product data table with existing ASIN data
 */

const { Pool } = require('pg');

async function migrateAmazonData() {
  console.log('🔄 Starting Amazon data migration...');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Initialize the new Amazon product data table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_data (
        id SERIAL PRIMARY KEY,
        asin VARCHAR(20) UNIQUE NOT NULL,
        title TEXT,
        brand VARCHAR(255),
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        upc VARCHAR(20),
        ean VARCHAR(20),
        part_number VARCHAR(255),
        primary_image_url TEXT,
        additional_images JSONB,
        features JSONB,
        description TEXT,
        category_path TEXT,
        dimensions JSONB,
        pricing JSONB,
        sales_rank INTEGER,
        category_rank INTEGER,
        availability VARCHAR(100),
        fulfillment_method VARCHAR(50),
        is_prime BOOLEAN DEFAULT false,
        is_amazon_choice BOOLEAN DEFAULT false,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_amazon_product_asin ON amazon_product_data(asin)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_amazon_product_upc ON amazon_product_data(upc)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_amazon_product_updated ON amazon_product_data(last_updated)');
    
    console.log('✓ Amazon product data table initialized');
    
    // Get all existing ASIN data
    const result = await pool.query(`
      SELECT 
        asin,
        title,
        brand,
        manufacturer,
        model,
        upc,
        ean,
        part_number,
        primary_image_url,
        additional_image_urls,
        features,
        description,
        category_path,
        dimensions,
        sales_rank,
        category_rank,
        availability,
        is_prime,
        created_at
      FROM amazon_asins
    `);
    
    console.log(`Found ${result.rows.length} ASINs to migrate`);
    
    // Transform and migrate each ASIN
    for (const row of result.rows) {
      const additionalImages = row.additional_image_urls ? JSON.parse(row.additional_image_urls) : [];
      const features = row.features ? JSON.parse(row.features) : [];
      const dimensions = row.dimensions ? JSON.parse(row.dimensions) : {};
      
      await pool.query(`
        INSERT INTO amazon_product_data (
          asin, title, brand, manufacturer, model, upc, ean, part_number,
          primary_image_url, additional_images, features, description,
          category_path, dimensions, pricing, sales_rank, category_rank,
          availability, fulfillment_method, is_prime, is_amazon_choice, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        ON CONFLICT (asin) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          manufacturer = EXCLUDED.manufacturer,
          model = EXCLUDED.model,
          upc = EXCLUDED.upc,
          ean = EXCLUDED.ean,
          part_number = EXCLUDED.part_number,
          primary_image_url = EXCLUDED.primary_image_url,
          additional_images = EXCLUDED.additional_images,
          features = EXCLUDED.features,
          description = EXCLUDED.description,
          category_path = EXCLUDED.category_path,
          dimensions = EXCLUDED.dimensions,
          pricing = EXCLUDED.pricing,
          sales_rank = EXCLUDED.sales_rank,
          category_rank = EXCLUDED.category_rank,
          availability = EXCLUDED.availability,
          fulfillment_method = EXCLUDED.fulfillment_method,
          is_prime = EXCLUDED.is_prime,
          is_amazon_choice = EXCLUDED.is_amazon_choice,
          last_updated = EXCLUDED.last_updated
      `, [
        row.asin,
        row.title,
        row.brand,
        row.manufacturer,
        row.model,
        row.upc,
        row.ean,
        row.part_number,
        row.primary_image_url,
        JSON.stringify(additionalImages),
        JSON.stringify(features),
        row.description,
        row.category_path,
        JSON.stringify(dimensions),
        JSON.stringify({ currentPrice: 0, listPrice: 0, dealPrice: 0 }),
        row.sales_rank,
        row.category_rank,
        row.availability,
        'UNKNOWN',
        row.is_prime || false,
        false,
        new Date(row.created_at)
      ]);
    }
    
    console.log(`✅ Successfully migrated ${result.rows.length} Amazon products`);
    
    // Verify migration
    const verificationResult = await pool.query('SELECT COUNT(*) as count FROM amazon_product_data');
    console.log(`✅ Verification: ${verificationResult.rows[0].count} products in new table`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrateAmazonData()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });