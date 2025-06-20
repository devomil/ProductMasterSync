import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Target the exact 10 products from your Master Catalog
const targetProducts = [
  'X-10-M', 'SS-1002', 'SS-2000', '1927.3', '2228', 
  '6001', '6003', '1928.3', '9283.3'
];

async function syncTenProducts() {
  console.log('🎯 Syncing authentic images for your 10 CWR marine products...');
  
  let updatedCount = 0;
  
  for (const mpn of targetProducts) {
    try {
      // Generate the expected image URLs based on CWR's pattern
      const imageUrl = `https://productimageserver.com/product/images/${mpn}.gif`;
      const imageUrlLarge = `https://productimageserver.com/product/xl/${mpn}XL.jpg`;
      
      console.log(`Testing image for MPN ${mpn}: ${imageUrl}`);
      
      // Check if image is accessible
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ Image accessible for ${mpn}`);
          
          // Update the product
          const result = await pool.query(`
            UPDATE products 
            SET 
              "imageUrl" = $1,
              "imageUrlLarge" = $2,
              "updatedAt" = NOW()
            WHERE "manufacturerPartNumber" = $3
          `, [imageUrl, imageUrlLarge, mpn]);
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`✅ Updated product ${mpn} with authentic image`);
          } else {
            console.log(`⚠️ No product found with MPN ${mpn}`);
          }
        } else {
          console.log(`❌ Image not accessible for ${mpn} (${response.status})`);
          
          // Try alternative patterns if the standard one fails
          const altImageUrl = `https://productimageserver.com/product/images/${mpn.replace('.', '')}.gif`;
          const altResponse = await fetch(altImageUrl, { method: 'HEAD' });
          
          if (altResponse.ok) {
            console.log(`✅ Alternative image found for ${mpn}: ${altImageUrl}`);
            const result = await pool.query(`
              UPDATE products 
              SET 
                "imageUrl" = $1,
                "imageUrlLarge" = $2,
                "updatedAt" = NOW()
              WHERE "manufacturerPartNumber" = $3
            `, [altImageUrl, altImageUrl.replace('/images/', '/xl/').replace('.gif', 'XL.jpg'), mpn]);
            
            if (result.rowCount > 0) {
              updatedCount++;
              console.log(`✅ Updated product ${mpn} with alternative image`);
            }
          }
        }
      } catch (fetchError) {
        console.log(`❌ Network error checking ${mpn}: ${fetchError.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing MPN ${mpn}:`, error.message);
    }
  }
  
  console.log(`🎉 Sync complete! Updated ${updatedCount} of ${targetProducts.length} products with authentic CWR images.`);
  await pool.end();
}

syncTenProducts();