import { Client as SFTPClient } from 'ssh2';
import { parse } from 'csv-parse';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importAuthenticCWRData() {
  console.log('🔄 Importing authentic CWR catalog data from SFTP...');
  
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    const timeout = setTimeout(() => {
      client.end();
      console.log('Connection timed out');
      resolve(false);
    }, 60000); // 60 seconds timeout
    
    const connectConfig = {
      host: 'edi.cwrdistribution.com',
      port: 22,
      username: 'eco8',
      password: process.env.SFTP_PASSWORD
    };
    
    console.log('Connecting to CWR SFTP server...');
    
    client.on('ready', () => {
      clearTimeout(timeout);
      console.log('Connected to CWR SFTP server!');
      
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          console.error('SFTP session error:', err.message);
          resolve(false);
          return;
        }
        
        const remotePath = '/eco8/out/catalog.csv';
        console.log(`Downloading authentic CWR catalog from ${remotePath}...`);
        
        // Stream the file and parse it
        const stream = sftp.createReadStream(remotePath);
        const records = [];
        let recordCount = 0;
        
        stream.pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (record) => {
          recordCount++;
          
          // Only process first 100 records for initial import
          if (recordCount <= 100) {
            records.push(record);
          }
          
          if (recordCount % 1000 === 0) {
            console.log(`Processed ${recordCount} records...`);
          }
        })
        .on('error', (parseErr) => {
          console.error('CSV parsing error:', parseErr.message);
          client.end();
          resolve(false);
        })
        .on('end', async () => {
          console.log(`📊 Downloaded ${recordCount} total records, processing first 100...`);
          client.end();
          
          // Process the authentic CWR data
          await processAuthenticCWRData(records);
          resolve(true);
        });
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Connection error:', err.message);
      resolve(false);
    });
    
    client.connect(connectConfig);
  });
}

async function processAuthenticCWRData(records) {
  console.log('🔄 Processing authentic CWR data with mapping template...');
  
  // Clear existing mock data first
  await pool.query('DELETE FROM products WHERE sku LIKE \'10%\' OR sku LIKE \'100%\'');
  console.log('🗑️ Cleared mock data');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const record of records) {
    try {
      // Generate application EDC code
      const edcCode = generateEDCCode(record['CWR Part Number']);
      
      // Map authentic CWR fields using the mapping template
      const productData = {
        sku: edcCode, // EDC - application generated
        usin: record['CWR Part Number'], // USIN from authentic CWR data
        upc: record['UPC Code'] || null,
        cost: record['Your Cost'] || null,
        price: record['List Price'] || null,
        name: record['Uppercase Title'] || record['CWR Part Number'],
        description: record['Full Description'] || null,
        manufacturerName: record['Manufacturer Name'] || null,
        manufacturerPartNumber: record['Manufacturer Part Number'] || null,
        weight: record['Shipping Weight'] || null,
        primaryImageUrl: record['Image (300x300) Url'] || null,
        categoryName: record['Category Name'] || 'Uncategorized',
        status: 'active',
        inventoryQuantity: parseInt(record['Quantity Available to Ship (Combined)']) || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert authentic product data
      await pool.query(`
        INSERT INTO products (
          sku, usin, upc, cost, price, name, description, 
          manufacturer_name, manufacturer_part_number, weight, 
          "primaryImageUrl", status, "inventoryQuantity", 
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (sku) DO UPDATE SET
          usin = $2, upc = $3, cost = $4, price = $5, name = $6,
          description = $7, manufacturer_name = $8, manufacturer_part_number = $9,
          weight = $10, "primaryImageUrl" = $11, status = $12, 
          "inventoryQuantity" = $13, "updatedAt" = $15
      `, [
        productData.sku, productData.usin, productData.upc, productData.cost,
        productData.price, productData.name, productData.description,
        productData.manufacturerName, productData.manufacturerPartNumber,
        productData.weight, productData.primaryImageUrl, productData.status,
        productData.inventoryQuantity, productData.createdAt, productData.updatedAt
      ]);
      
      console.log(`✅ Imported: ${productData.sku} - ${productData.name}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error processing record:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`🎉 Import complete! Success: ${successCount}, Errors: ${errorCount}`);
  
  // Verify the import
  const result = await pool.query('SELECT COUNT(*) as total FROM products');
  console.log(`📊 Total products in database: ${result.rows[0].total}`);
  
  await pool.end();
}

function generateEDCCode(cwrPartNumber) {
  // Generate unique EDC code based on CWR Part Number
  // Use a hash-based approach for consistency
  const hash = cwrPartNumber.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return `EDC${Math.abs(hash).toString().padStart(6, '0')}`;
}

importAuthenticCWRData();