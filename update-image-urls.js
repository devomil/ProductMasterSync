import { Client } from 'ssh2';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// SFTP configuration
const sftpConfig = {
  host: 'edi.cwrdistribution.com',
  username: 'eco8',
  password: process.env.SFTP_PASSWORD,
  port: 22
};

async function updateProductImages() {
  console.log('Connecting to CWR SFTP to get fresh image URLs...');
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(sftpConfig);
    });

    console.log('Connected! Downloading fresh catalog data...');
    
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });

    // Download the catalog file
    const catalogPath = '/eco8/out/catalog.csv';
    const localPath = './temp/fresh-catalog.csv';
    
    // Ensure temp directory exists
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    await new Promise((resolve, reject) => {
      sftp.fastGet(catalogPath, localPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Catalog downloaded! Processing image URLs...');
    
    // Parse the CSV and extract image URLs
    const catalogData = fs.readFileSync(localPath, 'utf8');
    const records = [];
    
    await new Promise((resolve, reject) => {
      parse(catalogData, {
        columns: true,
        skip_empty_lines: true
      }, (err, data) => {
        if (err) reject(err);
        else {
          records.push(...data);
          resolve();
        }
      });
    });

    console.log(`Processing ${records.length} products from fresh catalog...`);
    
    let updatedCount = 0;
    
    for (const record of records) {
      const mpn = record['Manufacturer Part Number'];
      const image300 = record['Image 300 URL'];
      const image1000 = record['Image 1000 URL'];
      
      if (mpn && (image300 || image1000)) {
        try {
          // Update products with this MPN
          const result = await pool.query(`
            UPDATE products 
            SET 
              "imageUrl" = $1,
              "imageUrlLarge" = $2,
              "updatedAt" = NOW()
            WHERE "manufacturerPartNumber" = $3
          `, [image300 || null, image1000 || null, mpn]);
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`Updated ${result.rowCount} product(s) for MPN ${mpn}`);
            console.log(`  Image 300: ${image300 || 'none'}`);
            console.log(`  Image 1000: ${image1000 || 'none'}`);
          }
        } catch (err) {
          console.error(`Error updating MPN ${mpn}:`, err.message);
        }
      }
    }
    
    console.log(`\nImage update complete! Updated ${updatedCount} products with fresh URLs from CWR catalog.`);
    
  } catch (error) {
    console.error('Error updating images:', error);
  } finally {
    conn.end();
    await pool.end();
  }
}

updateProductImages();