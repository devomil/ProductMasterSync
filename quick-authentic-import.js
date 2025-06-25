import { Client as SFTPClient } from 'ssh2';
import { parse } from 'csv-parse';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function quickAuthenticImport() {
  console.log('🔄 Quick import of authentic CWR data...');
  
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    const connectConfig = {
      host: 'edi.cwrdistribution.com',
      port: 22,
      username: 'eco8',
      password: process.env.SFTP_PASSWORD
    };
    
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          console.error('SFTP session error:', err.message);
          client.end();
          resolve(false);
          return;
        }
        
        const remotePath = '/eco8/out/catalog.csv';
        console.log(`Streaming first 50 records from authentic CWR catalog...`);
        
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
          
          // Only take first 50 authentic records
          if (recordCount <= 50) {
            records.push(record);
          } else {
            stream.destroy(); // Stop reading after 50 records
          }
        })
        .on('error', (parseErr) => {
          console.error('CSV parsing error:', parseErr.message);
          client.end();
          resolve(false);
        })
        .on('end', async () => {
          console.log(`📊 Processing ${records.length} authentic CWR records...`);
          client.end();
          
          await processAuthenticRecords(records);
          resolve(true);
        })
        .on('close', async () => {
          if (records.length > 0) {
            console.log(`📊 Stream closed, processing ${records.length} authentic CWR records...`);
            client.end();
            await processAuthenticRecords(records);
            resolve(true);
          }
        });
      });
    });
    
    client.on('error', (err) => {
      console.error('Connection error:', err.message);
      resolve(false);
    });
    
    client.connect(connectConfig);
  });
}

async function processAuthenticRecords(records) {
  console.log('🔄 Processing authentic CWR data...');
  
  // Clear mock data
  await pool.query('DELETE FROM products WHERE sku LIKE \'EDC%\' OR sku LIKE \'10%\' OR sku LIKE \'100%\'');
  console.log('🗑️ Cleared mock data');
  
  let successCount = 0;
  
  for (const record of records) {
    try {
      // Generate proper EDC code
      const cwrPart = record['CWR Part Number'];
      if (!cwrPart) continue;
      
      const edcCode = `EDC${cwrPart.replace(/[^0-9]/g, '').padStart(6, '0')}`;
      
      const productData = {
        sku: edcCode,
        usin: cwrPart,
        upc: record['UPC Code'] || null,
        cost: record['Your Cost'] || null,
        price: record['List Price'] || null,
        name: record['Uppercase Title'] || record['Full Description'] || cwrPart,
        description: record['Full Description'] || null,
        manufacturer_name: record['Manufacturer Name'] || null,
        manufacturer_part_number: record['Manufacturer Part Number'] || null,
        weight: record['Shipping Weight'] || null,
        inventory_quantity: parseInt(record['Quantity Available to Ship (Combined)']) || 0,
        status: 'active'
      };
      
      // Insert authentic product
      await pool.query(`
        INSERT INTO products (
          sku, usin, upc, cost, price, name, description, 
          manufacturer_name, manufacturer_part_number, weight, 
          "inventoryQuantity", status, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (sku) DO UPDATE SET
          usin = $2, upc = $3, cost = $4, price = $5, name = $6,
          description = $7, manufacturer_name = $8, manufacturer_part_number = $9,
          weight = $10, "inventoryQuantity" = $11, "updatedAt" = NOW()
      `, [
        productData.sku, productData.usin, productData.upc, productData.cost,
        productData.price, productData.name, productData.description,
        productData.manufacturer_name, productData.manufacturer_part_number,
        productData.weight, productData.inventory_quantity, productData.status
      ]);
      
      console.log(`✅ ${productData.sku} - ${productData.name}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
  }
  
  console.log(`🎉 Imported ${successCount} authentic CWR products`);
  
  const result = await pool.query('SELECT COUNT(*) as total FROM products');
  console.log(`📊 Total products: ${result.rows[0].total}`);
  
  await pool.end();
}

quickAuthenticImport();