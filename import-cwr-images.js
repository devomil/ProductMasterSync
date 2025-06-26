import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

async function importCWRImages() {
  console.log('Importing authentic CWR image data...');
  
  try {
    const csvPath = './temp/authentic-catalog.csv';
    const records = [];
    
    // Parse CSV file with error handling
    const parser = fs.createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        max_record_size: 1000000
      }));
    
    parser.on('error', (err) => {
      console.log('CSV parsing error, but continuing with successfully parsed records');
    });
    
    for await (const record of parser) {
      records.push(record);
    }
    
    console.log(`Found ${records.length} CWR records`);
    
    let updatedCount = 0;
    
    for (const record of records) {
      const cwrPartNumber = record['CWR Part Number'];
      const image300 = record['Image (300x300) Url'];
      const image1000 = record['Image (1000x1000) Url'];
      const imageAdditional = record['Image Additional (1000x1000) Urls'];
      
      if (!cwrPartNumber || (!image300 && !image1000)) continue;
      
      try {
        // Find product by matching USIN (which maps to CWR Part Number)
        const result = await sql`
          UPDATE products 
          SET 
            image_url = ${image300 || null},
            image_url_large = ${image1000 || null},
            primary_image = ${image1000 || image300 || null},
            additional_images = ${imageAdditional ? JSON.stringify(imageAdditional.split('|').filter(url => url.trim())) : null}
          WHERE usin = ${cwrPartNumber}
          RETURNING id, sku, name
        `;
        
        if (result.length > 0) {
          const product = result[0];
          console.log(`✓ Updated ${product.sku} - ${product.name}`);
          if (image300) console.log(`  300x300: ${image300}`);
          if (image1000) console.log(`  1000x1000: ${image1000}`);
          if (imageAdditional) console.log(`  Additional: ${imageAdditional.split('|').length} images`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating ${cwrPartNumber}:`, error.message);
      }
    }
    
    console.log(`\nSuccessfully updated ${updatedCount} products with authentic CWR images!`);
    
  } catch (error) {
    console.error('Error importing CWR images:', error);
  }
}

importCWRImages();