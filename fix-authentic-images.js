import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixAuthenticImages() {
  console.log('🖼️ Fixing authentic CWR product images...');
  
  try {
    // Find the latest CWR CSV file
    const uploadsDir = './uploads';
    const files = fs.readdirSync(uploadsDir)
      .filter(file => file.endsWith('.csv'))
      .sort((a, b) => fs.statSync(path.join(uploadsDir, b)).mtime - fs.statSync(path.join(uploadsDir, a)).mtime);
    
    if (files.length === 0) {
      console.log('❌ No CSV files found in uploads directory');
      return;
    }
    
    const latestFile = path.join(uploadsDir, files[0]);
    console.log(`📄 Processing: ${latestFile}`);
    
    const records = [];
    const parser = fs.createReadStream(latestFile)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }));
    
    for await (const record of parser) {
      records.push(record);
    }
    
    console.log(`📊 Found ${records.length} CWR records with image data`);
    
    let updatedCount = 0;
    
    for (const record of records) {
      const cwrPartNumber = record['CWR Part Number'];
      const image300 = record['Image (300x300) Url'];
      const image1000 = record['Image (1000x1000) Url'];
      const imageAdditional = record['Image Additional (1000x1000) Urls'];
      
      if (!cwrPartNumber) continue;
      
      // Build images array
      const images = [];
      if (image1000 && image1000.trim() !== '') {
        images.push(image1000.trim());
      }
      if (image300 && image300.trim() !== '') {
        images.push(image300.trim());
      }
      if (imageAdditional && imageAdditional.trim() !== '') {
        const additionalImages = imageAdditional.split(',')
          .map(url => url.trim())
          .filter(url => url !== '');
        images.push(...additionalImages);
      }
      
      if (images.length === 0) continue;
      
      const primaryImage = images[0];
      
      try {
        // Find product by CWR Part Number in attributes
        const result = await pool.query(`
          UPDATE products 
          SET 
            "imageUrl" = $1,
            "imageUrlLarge" = $2,
            images = $3::json,
            "primaryImage" = $1,
            "updatedAt" = NOW()
          WHERE attributes->>'cwrPartNumber' = $4
          RETURNING id, sku, name
        `, [primaryImage, image1000 || primaryImage, JSON.stringify(images), cwrPartNumber]);
        
        if (result.rows.length > 0) {
          const product = result.rows[0];
          console.log(`✅ Updated ${product.sku} - ${product.name}`);
          console.log(`   📸 Primary: ${primaryImage}`);
          if (images.length > 1) {
            console.log(`   🖼️  Gallery: ${images.length} total images`);
          }
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${cwrPartNumber}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} products with authentic images!`);
    
  } catch (error) {
    console.error('❌ Error fixing images:', error);
  } finally {
    await pool.end();
  }
}

fixAuthenticImages();