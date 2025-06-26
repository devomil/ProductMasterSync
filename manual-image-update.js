import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function updateAuthenticImages() {
  console.log('Updating products with authentic CWR image URLs...');
  
  // Authentic image data from CWR catalog
  const imageUpdates = [
    {
      usin: '10020',
      imageUrl: 'https://productimageserver.com/product/images/10020.gif',
      imageUrlLarge: 'https://productimageserver.com/product/xl/10020XL.jpg'
    },
    {
      usin: '10021', 
      imageUrl: 'https://productimageserver.com/product/images/10021.gif',
      imageUrlLarge: 'https://productimageserver.com/product/xl/10021XL.jpg'
    },
    {
      usin: '10024',
      imageUrl: 'https://productimageserver.com/product/images/10024.gif', 
      imageUrlLarge: 'https://productimageserver.com/product/xl/10024XL.jpg'
    },
    {
      usin: '10025',
      imageUrl: 'https://productimageserver.com/product/images/10025.gif',
      imageUrlLarge: 'https://productimageserver.com/product/xl/10025XL.jpg'
    }
  ];
  
  let updatedCount = 0;
  
  for (const update of imageUpdates) {
    try {
      const result = await sql`
        UPDATE products 
        SET 
          image_url = ${update.imageUrl},
          image_url_large = ${update.imageUrlLarge},
          primary_image = ${update.imageUrlLarge}
        WHERE usin = ${update.usin}
        RETURNING id, sku, name
      `;
      
      if (result.length > 0) {
        const product = result[0];
        console.log(`✓ Updated ${product.sku} - ${product.name}`);
        console.log(`  300x300: ${update.imageUrl}`);
        console.log(`  1000x1000: ${update.imageUrlLarge}`);
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating USIN ${update.usin}:`, error.message);
    }
  }
  
  console.log(`\nSuccessfully updated ${updatedCount} products with authentic CWR images!`);
}

updateAuthenticImages();