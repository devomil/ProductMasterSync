import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

async function importAllProductImages() {
  console.log('Importing comprehensive product images from CWR catalog...');
  
  try {
    const csvPath = './temp/authentic-catalog.csv';
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Process header to find correct column positions
    const header = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const cwrPartIndex = header.indexOf('CWR Part Number');
    const image300Index = header.indexOf('Image (300x300) Url');
    const image1000Index = header.indexOf('Image (1000x1000) Url');
    const titleIndex = header.indexOf('Title');
    
    console.log(`Found column positions: CWR Part=${cwrPartIndex}, Image300=${image300Index}, Image1000=${image1000Index}`);
    
    let processedCount = 0;
    let updatedCount = 0;
    
    // Process each data line carefully
    for (let i = 1; i < lines.length && i <= 100; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        // Use regex to properly parse CSV with quoted fields containing commas
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const fields = lines[i].split(csvRegex);
        
        if (fields.length < Math.max(cwrPartIndex, image300Index, image1000Index) + 1) {
          console.log(`Skipping line ${i}: insufficient fields`);
          continue;
        }
        
        const cwrPartNumber = fields[cwrPartIndex]?.replace(/"/g, '').trim();
        const image300 = fields[image300Index]?.replace(/"/g, '').trim();
        const image1000 = fields[image1000Index]?.replace(/"/g, '').trim();
        const title = fields[titleIndex]?.replace(/"/g, '').trim();
        
        if (!cwrPartNumber) continue;
        
        processedCount++;
        
        // Check if product exists and needs image update
        const existingProduct = await sql`
          SELECT id, sku, name, image_url, image_url_large 
          FROM products 
          WHERE usin = ${cwrPartNumber}
        `;
        
        if (existingProduct.length > 0) {
          const product = existingProduct[0];
          const needsUpdate = !product.image_url || !product.image_url_large;
          
          if (needsUpdate && (image300 || image1000)) {
            // Update product with image URLs
            await sql`
              UPDATE products 
              SET 
                image_url = ${image300 || product.image_url},
                image_url_large = ${image1000 || product.image_url_large},
                primary_image = ${image300 || product.primary_image},
                additional_images = ${image1000 ? JSON.stringify([image1000]) : product.additional_images}
              WHERE id = ${product.id}
            `;
            
            console.log(`✓ Updated ${product.sku} with images:`);
            if (image300) console.log(`  - 300x300: ${image300}`);
            if (image1000) console.log(`  - 1000x1000: ${image1000}`);
            updatedCount++;
          } else if (product.image_url && product.image_url_large) {
            console.log(`- ${product.sku} already has images`);
          } else {
            console.log(`! ${product.sku} missing image URLs in CWR data`);
          }
        }
        
      } catch (lineError) {
        console.log(`Error processing line ${i}: ${lineError.message}`);
      }
    }
    
    // Get final image statistics
    const finalStats = await sql`
      SELECT 
        COUNT(*) as total_products,
        COUNT(image_url) as has_image_url,
        COUNT(image_url_large) as has_large_image,
        COUNT(*) - COUNT(image_url) as missing_images
      FROM products
    `;
    
    console.log(`\nImage import complete!`);
    console.log(`- Processed ${processedCount} CWR records`);
    console.log(`- Updated ${updatedCount} products with new images`);
    console.log(`- Final stats: ${finalStats[0].has_image_url}/${finalStats[0].total_products} products have images`);
    console.log(`- ${finalStats[0].missing_images} products still missing images`);
    
  } catch (error) {
    console.error('Error importing images:', error);
  }
}

importAllProductImages();