import { Client as SFTPClient } from 'ssh2';
import { parse } from 'csv-parse';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importCWRAuthentic() {
  console.log('🔄 Importing authentic CWR data from SFTP...');
  
  const client = new SFTPClient();
  
  const connectConfig = {
    host: 'edi.cwrdistribution.com',
    port: 22,
    username: 'eco8',
    password: process.env.SFTP_PASSWORD
  };
  
  return new Promise((resolve) => {
    client.on('ready', () => {
      console.log('✅ Connected to CWR SFTP server');
      
      client.sftp((err, sftp) => {
        if (err) {
          console.error('SFTP error:', err.message);
          client.end();
          resolve(false);
          return;
        }
        
        const remotePath = '/eco8/out/catalog.csv';
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
          
          // Take first 30 authentic records
          if (recordCount <= 30) {
            records.push(record);
          }
          
          // Stop after collecting 30 records
          if (recordCount >= 30) {
            stream.destroy();
            processRecords(records).then(() => {
              client.end();
              resolve(true);
            });
          }
        })
        .on('error', (parseErr) => {
          console.error('Parse error:', parseErr.message);
          client.end();
          resolve(false);
        })
        .on('end', async () => {
          if (records.length > 0) {
            await processRecords(records);
          }
          client.end();
          resolve(true);
        });
      });
    });
    
    client.on('error', (connErr) => {
      console.error('Connection error:', connErr.message);
      resolve(false);
    });
    
    client.connect(connectConfig);
  });
}

async function processRecords(records) {
  console.log(`🔄 Processing ${records.length} authentic CWR records...`);
  
  let imported = 0;
  
  for (const record of records) {
    try {
      const cwrPart = record['CWR Part Number'];
      if (!cwrPart) continue;
      
      // Generate EDC code from CWR part number
      const numericPart = cwrPart.replace(/[^0-9]/g, '') || '1';
      const edcCode = `EDC${numericPart.padStart(6, '0')}`;
      
      // Parse numeric values
      const cost = parseFloat(record['Your Cost']) || null;
      const price = parseFloat(record['List Price']) || null;
      const weight = parseFloat(record['Shipping Weight']) || null;
      const qty = parseInt(record['Quantity Available to Ship (Combined)']) || 0;
      
      await pool.query(`
        INSERT INTO products (
          sku, usin, upc, cost, price, name, description,
          manufacturer_name, manufacturer_part_number, weight,
          inventory_quantity, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [
        edcCode,
        cwrPart,
        record['UPC Code'] || null,
        cost,
        price,
        record['Uppercase Title'] || cwrPart,
        record['Full Description'] || null,
        record['Manufacturer Name'] || null,
        record['Manufacturer Part Number'] || null,
        weight,
        qty,
        'active'
      ]);
      
      console.log(`✅ ${edcCode} - ${record['Uppercase Title'] || cwrPart}`);
      imported++;
      
    } catch (error) {
      console.error(`❌ Error importing ${record['CWR Part Number']}:`, error.message);
    }
  }
  
  console.log(`🎉 Imported ${imported} authentic CWR products`);
  
  // Verify the import
  const result = await pool.query('SELECT COUNT(*) as total FROM products');
  console.log(`📊 Total products in database: ${result.rows[0].total}`);
}

importCWRAuthentic().finally(() => {
  pool.end();
});