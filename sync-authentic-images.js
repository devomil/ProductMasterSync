import { Client } from 'ssh2';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const sftpConfig = {
  host: 'edi.cwrdistribution.com',
  username: 'eco8',
  password: process.env.SFTP_PASSWORD,
  port: 22
};

async function syncAuthenticImages() {
  console.log('🚀 Connecting to CWR SFTP to sync authentic product images...');
  
  const conn = new Client();
  
  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(sftpConfig);
    });

    console.log('✅ Connected to CWR SFTP server!');
    
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });

    console.log('📥 Downloading authentic catalog data...');
    
    // Stream the catalog file to avoid memory issues with 58MB file
    const catalogPath = '/eco8/out/catalog.csv';
    const localPath = './temp/authentic-catalog.csv';
    
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    // Download with progress tracking
    await new Promise((resolve, reject) => {
      let downloadedBytes = 0;
      const stream = sftp.createReadStream(catalogPath);
      const writeStream = fs.createWriteStream(localPath);
      
      stream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes % (1024 * 1024) === 0) { // Log every MB
          console.log(`Downloaded ${Math.round(downloadedBytes / 1024 / 1024)}MB...`);
        }
      });
      
      stream.on('error', reject);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log('🔄 Processing authentic image URLs from CWR catalog...');
    
    // Process the catalog in chunks to avoid memory issues
    const catalogData = fs.readFileSync(localPath, 'utf8');
    const lines = catalogData.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    
    console.log(`Found ${lines.length - 1} products in authentic catalog`);
    
    // Find image column indices
    const mpnIndex = headers.findIndex(h => h.includes('Manufacturer Part Number'));
    const image300Index = headers.findIndex(h => h.includes('Image 300'));
    const image1000Index = headers.findIndex(h => h.includes('Image 1000'));
    
    console.log(`MPN column: ${mpnIndex}, Image 300: ${image300Index}, Image 1000: ${image1000Index}`);
    
    let updatedCount = 0;
    let processedCount = 0;
    
    // Process products in batches
    for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Limit to first 1000 for performance
      const line = lines[i];
      if (!line.trim()) continue;
      
      const fields = line.split(',').map(f => f.replace(/"/g, ''));
      const mpn = fields[mpnIndex];
      const image300 = fields[image300Index];
      const image1000 = fields[image1000Index];
      
      processedCount++;
      
      if (mpn && (image300 || image1000)) {
        try {
          // Check if image is accessible before updating
          const imageToCheck = image300 || image1000;
          let imageAccessible = false;
          
          try {
            const response = await fetch(imageToCheck, { method: 'HEAD' });
            imageAccessible = response.ok;
          } catch (e) {
            // Image not accessible
          }
          
          if (imageAccessible) {
            const result = await pool.query(`
              UPDATE products 
              SET 
                "imageUrl" = $1,
                "imageUrlLarge" = $2,
                "updatedAt" = NOW()
              WHERE "manufacturerPartNumber" = $3
            `, [image300 || null, image1000 || image300, mpn]);
            
            if (result.rowCount > 0) {
              updatedCount++;
              console.log(`✅ Updated product MPN ${mpn} with authentic image`);
            }
          }
        } catch (err) {
          console.error(`❌ Error updating MPN ${mpn}:`, err.message);
        }
      }
      
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} products, updated ${updatedCount}...`);
      }
    }
    
    console.log(`🎉 Sync complete! Updated ${updatedCount} products with authentic CWR images from live catalog.`);
    
  } catch (error) {
    console.error('❌ Error syncing authentic images:', error.message);
  } finally {
    conn.end();
    await pool.end();
  }
}

syncAuthenticImages();