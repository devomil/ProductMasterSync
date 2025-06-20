import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Quick fix for known working image patterns
const imageUpdates = [
  { mpn: '6001', imageUrl: 'https://productimageserver.com/product/images/6001.gif' },
  { mpn: '6002', imageUrl: 'https://productimageserver.com/product/images/6002.gif' },
  { mpn: 'SS-1002', imageUrl: 'https://productimageserver.com/product/images/SS-1002.gif' },
  { mpn: 'SS-2000', imageUrl: 'https://productimageserver.com/product/images/SS-2000.gif' },
  { mpn: '1928.3', imageUrl: 'https://productimageserver.com/product/images/1928.3.gif' },
  { mpn: '9283.3', imageUrl: 'https://productimageserver.com/product/images/9283.3.gif' },
  { mpn: 'X-10-M', imageUrl: 'https://productimageserver.com/product/images/X-10-M.gif' }
];

async function quickImageFix() {
  console.log('Updating products with corrected image URLs...');
  
  for (const update of imageUpdates) {
    try {
      // First check if image URL is accessible
      const response = await fetch(update.imageUrl, { method: 'HEAD' });
      
      if (response.ok) {
        console.log(`✓ Image accessible: ${update.imageUrl}`);
        
        // Update the product
        const result = await pool.query(`
          UPDATE products 
          SET 
            "imageUrl" = $1,
            "imageUrlLarge" = $2,
            "updatedAt" = NOW()
          WHERE "manufacturerPartNumber" = $3
        `, [
          update.imageUrl, 
          update.imageUrl.replace('/images/', '/xl/').replace('.gif', 'XL.jpg'),
          update.mpn
        ]);
        
        if (result.rowCount > 0) {
          console.log(`✓ Updated ${result.rowCount} product(s) for MPN ${update.mpn}`);
        }
      } else {
        console.log(`✗ Image not accessible: ${update.imageUrl} (${response.status})`);
      }
    } catch (error) {
      console.log(`✗ Error checking ${update.mpn}: ${error.message}`);
    }
  }
  
  console.log('Quick image fix complete!');
  await pool.end();
}

quickImageFix();