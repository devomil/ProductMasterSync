import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Your 10 CWR marine products with correct image URL patterns
const productImageMappings = [
  { mpn: 'X-10-M', imageFile: 'X-10-M.gif' },
  { mpn: 'SS-1002', imageFile: 'SS-1002.gif' },
  { mpn: 'SS-2000', imageFile: 'SS-2000.gif' },
  { mpn: '1927.3', imageFile: '19273.gif' }, // Remove decimal
  { mpn: '2228', imageFile: '2228.gif' },
  { mpn: '6001', imageFile: '6001.gif' },
  { mpn: '6003', imageFile: '6003.gif' },
  { mpn: '1928.3', imageFile: '19283.gif' }, // Remove decimal
  { mpn: '9283.3', imageFile: '92833.gif' }, // Remove decimal - we know this one works!
];

async function finalImageSync() {
  console.log('🎯 Final sync: Updating your 10 CWR marine products with authentic images...');
  
  let updatedCount = 0;
  
  for (const product of productImageMappings) {
    try {
      const imageUrl = `https://productimageserver.com/product/images/${product.imageFile}`;
      const imageUrlLarge = `https://productimageserver.com/product/xl/${product.imageFile.replace('.gif', 'XL.jpg')}`;
      
      console.log(`Testing authentic image for ${product.mpn}: ${imageUrl}`);
      
      // Check if image is accessible
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ Authentic image accessible for ${product.mpn}`);
          
          // Update the product in your database
          const result = await pool.query(`
            UPDATE products 
            SET 
              "imageUrl" = $1,
              "imageUrlLarge" = $2,
              "updatedAt" = NOW()
            WHERE "manufacturerPartNumber" = $3
          `, [imageUrl, imageUrlLarge, product.mpn]);
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`🎉 Updated ${product.mpn} with authentic CWR marine image!`);
          } else {
            console.log(`⚠️ Product ${product.mpn} not found in database`);
          }
        } else {
          console.log(`❌ Image not available for ${product.mpn} (${response.status})`);
        }
      } catch (fetchError) {
        console.log(`❌ Network error for ${product.mpn}: ${fetchError.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${product.mpn}:`, error.message);
    }
  }
  
  console.log(`\n🚀 Sync complete! Updated ${updatedCount} of ${productImageMappings.length} products.`);
  console.log(`Your Gallery tab now showcases authentic CWR marine product images!`);
  
  await pool.end();
}

finalImageSync();