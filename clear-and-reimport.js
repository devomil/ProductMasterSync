import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function clearAndPrepareForReimport() {
  console.log('🧹 Clearing existing data for fresh import with new CWR processor...');
  
  try {
    // Clear existing products and categories to start fresh
    await pool.query('DELETE FROM product_suppliers WHERE TRUE');
    console.log('✅ Cleared product-supplier relationships');
    
    await pool.query('DELETE FROM products WHERE TRUE');
    console.log('✅ Cleared all products');
    
    await pool.query('DELETE FROM categories WHERE TRUE');
    console.log('✅ Cleared all categories');
    
    await pool.query('DELETE FROM imports WHERE TRUE');
    console.log('✅ Cleared import history');
    
    console.log('\n🎉 Database cleared successfully! Ready for fresh import with authentic CWR data.');
    console.log('✅ The new CWR processor will now properly handle:');
    console.log('   📂 Category hierarchies like "Paddlesports | Safety,Marine Safety | Accessories"');
    console.log('   🖼️  Authentic image URLs from your SFTP server');
    console.log('   🏷️  All product attributes and metadata');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await pool.end();
  }
}

clearAndPrepareForReimport();