import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Remaining 8 products with their authentic image patterns discovered from your catalog
const remainingProducts = [
  { mpn: 'X-10-M', id: 128, imageFile: 'X-10-M.gif' },
  { mpn: 'SS-1002', id: 123, imageFile: 'SS-1002.gif' },
  { mpn: 'SS-2000', id: 130, imageFile: 'SS-2000.gif' },
  { mpn: '1927.3', id: 126, imageFile: '19273.gif' },
  { mpn: '2228', id: 121, imageFile: '2228.gif' },
  { mpn: '6001', id: 122, imageFile: '6001.gif' },
  { mpn: '6003', id: 125, imageFile: '6003.gif' },
  { mpn: '1928.3', id: 124, imageFile: '19283.gif' }
];

async function updateRemainingImages() {
  console.log('🎯 Updating remaining 8 CWR marine products with authentic images...');
  
  let updatedCount = 0;
  
  for (const product of remainingProducts) {
    try {
      const imageUrl = `https://productimageserver.com/product/images/${product.imageFile}`;
      const imageUrlLarge = `https://productimageserver.com/product/xl/${product.imageFile.replace('.gif', 'XL.jpg')}`;
      
      console.log(`\n🔍 Testing ${product.mpn} (ID: ${product.id}): ${imageUrl}`);
      
      // Test if image is accessible
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        
        if (response.ok) {
          console.log(`✅ Authentic image found for ${product.mpn}!`);
          
          // Update via API endpoint
          const updateResponse = await fetch(`http://localhost:5000/api/products/${product.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageUrl: imageUrl,
              imageUrlLarge: imageUrlLarge
            })
          });
          
          if (updateResponse.ok) {
            updatedCount++;
            console.log(`🎉 Updated ${product.mpn} with authentic CWR marine image!`);
          } else {
            console.log(`❌ Failed to update ${product.mpn}: ${updateResponse.status}`);
          }
        } else {
          console.log(`⚠️ Image not available for ${product.mpn} (${response.status})`);
          
          // Try alternative naming patterns for MPNs with special characters
          const altImageFile = product.imageFile.replace(/[-.]/g, '');
          if (altImageFile !== product.imageFile) {
            const altImageUrl = `https://productimageserver.com/product/images/${altImageFile}.gif`;
            console.log(`🔄 Trying alternative pattern: ${altImageUrl}`);
            
            const altResponse = await fetch(altImageUrl, { method: 'HEAD' });
            if (altResponse.ok) {
              console.log(`✅ Alternative image found for ${product.mpn}!`);
              
              const updateResponse = await fetch(`http://localhost:5000/api/products/${product.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  imageUrl: altImageUrl,
                  imageUrlLarge: altImageUrl.replace('/images/', '/xl/').replace('.gif', 'XL.jpg')
                })
              });
              
              if (updateResponse.ok) {
                updatedCount++;
                console.log(`🎉 Updated ${product.mpn} with alternative authentic image!`);
              }
            }
          }
        }
      } catch (fetchError) {
        console.log(`❌ Network error testing ${product.mpn}: ${fetchError.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${product.mpn}:`, error.message);
    }
  }
  
  console.log(`\n🚀 Update complete! Successfully updated ${updatedCount} of ${remainingProducts.length} products.`);
  console.log(`Your Gallery tab now showcases ${updatedCount + 1} authentic CWR marine product images!`);
  
  await pool.end();
}

updateRemainingImages();