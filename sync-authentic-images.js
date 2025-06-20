import Client from 'ssh2-sftp-client';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function syncAuthenticImages() {
  console.log('🚀 Connecting to CWR SFTP to sync authentic product images...');
  
  const sftp = new Client();
  
  try {
    // Connect to your live CWR SFTP server
    await sftp.connect({
      host: 'ftp.cwrmarine.com',
      username: 'edc_data',
      password: process.env.SFTP_PASSWORD,
      port: 22
    });
    
    console.log('✅ Connected to CWR SFTP server!');
    
    // Download the current catalog with image mappings
    console.log('📥 Downloading authentic catalog data...');
    const catalogData = await sftp.get('/CWR_Products.csv');
    
    console.log('🔍 Processing catalog to extract image mappings...');
    
    const imageMapping = {};
    let processedCount = 0;
    
    // Parse the CSV to extract MPN to image ID mappings
    return new Promise((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true
      });
      
      parser.on('data', (row) => {
        try {
          const mpn = row['Mfg Part Number'] || row['MPN'] || row['Part Number'];
          const imageUrl300 = row['300 Image URL'] || row['Image 300'] || row['ImageURL300'];
          const imageUrl1000 = row['1000 Image URL'] || row['Image 1000'] || row['ImageURL1000'];
          
          if (mpn && (imageUrl300 || imageUrl1000)) {
            // Extract the actual image filename from URLs
            const image300File = imageUrl300 ? imageUrl300.split('/').pop() : null;
            const image1000File = imageUrl1000 ? imageUrl1000.split('/').pop() : null;
            
            imageMapping[mpn] = {
              imageUrl300: imageUrl300,
              imageUrl1000: imageUrl1000,
              image300File: image300File,
              image1000File: image1000File
            };
            
            processedCount++;
            
            if (processedCount % 500 === 0) {
              console.log(`Processed ${processedCount} image mappings...`);
            }
          }
        } catch (error) {
          console.log(`Error processing row: ${error.message}`);
        }
      });
      
      parser.on('end', async () => {
        console.log(`📊 Found ${Object.keys(imageMapping).length} authentic image mappings!`);
        
        // Update your 10 products with authentic image URLs
        let updatedCount = 0;
        
        const targetProducts = await pool.query(`
          SELECT id, "manufacturerPartNumber" 
          FROM products 
          WHERE "manufacturerPartNumber" IN ('X-10-M', 'SS-1002', 'SS-2000', '1927.3', '2228', '6001', '6003', '1928.3', '9283.3')
        `);
        
        for (const product of targetProducts.rows) {
          const mpn = product.manufacturerPartNumber;
          const mapping = imageMapping[mpn];
          
          if (mapping && mapping.imageUrl300) {
            console.log(`🎯 Updating ${mpn} with authentic image: ${mapping.imageUrl300}`);
            
            await pool.query(`
              UPDATE products 
              SET 
                "imageUrl" = $1,
                "imageUrlLarge" = $2,
                "updatedAt" = NOW()
              WHERE id = $3
            `, [mapping.imageUrl300, mapping.imageUrl1000 || mapping.imageUrl300, product.id]);
            
            updatedCount++;
            console.log(`✅ Updated ${mpn} with authentic CWR marine image!`);
          } else {
            console.log(`⚠️ No authentic image found for ${mpn} in current catalog`);
          }
        }
        
        console.log(`\n🎉 Sync complete! Updated ${updatedCount} products with authentic CWR images.`);
        console.log('🖼️ Your Gallery tab now showcases authentic marine product photos!');
        
        await pool.end();
        await sftp.end();
        resolve();
      });
      
      parser.on('error', (error) => {
        console.error('❌ Error parsing catalog data:', error);
        reject(error);
      });
      
      // Pipe the catalog data through the parser
      if (catalogData instanceof Buffer) {
        parser.write(catalogData);
        parser.end();
      } else {
        catalogData.pipe(parser);
      }
    });
    
  } catch (error) {
    console.error('❌ Error connecting to CWR SFTP:', error.message);
    await sftp.end();
    await pool.end();
  }
}

syncAuthenticImages();