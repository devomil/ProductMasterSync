const SftpClient = require('ssh2-sftp-client');
const { parse: csvParse } = require('csv-parse');
const { Pool } = require('pg');

async function importCatalogFields() {
  console.log('📊 Importing authentic CWR catalog data with missing fields...');
  
  const sftp = new SftpClient();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Connect to CWR SFTP server
    await sftp.connect({
      host: 'edi.cwrdistribution.com',
      port: 22,
      username: 'eco8',
      password: process.env.SFTP_PASSWORD,
    });
    
    console.log('✅ Connected to CWR SFTP server');
    
    // Download catalog.csv
    const catalogData = await sftp.get('/eco8/out/catalog.csv');
    const csvContent = catalogData.toString();
    
    console.log('✅ Downloaded catalog.csv');
    
    // Parse CSV
    const records = await new Promise((resolve, reject) => {
      csvParse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ',',
        quote: '"'
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    console.log(`📊 Processing ${records.length} catalog records...`);
    
    let processedCount = 0;
    
    // Process catalog records to update missing fields
    for (const record of records.slice(0, 100)) {
      try {
        const sku = record['CWR Part Number'];
        if (!sku) continue;
        
        // Map additional fields from your authentic catalog
        const updateFields = {
          third_party_marketplaces: record['3rd Party Marketplaces'] || null,
          case_quantity: record['Case Qty'] || record['Case Quantity'] || null,
          google_merchant_category: record['Google Merchant Category'] || record['Google Category'] || null,
          country_of_origin: record['Country of Origin'] || record['Origin Country'] || null,
          box_height: record['Box Height'] || record['Height'] || null,
          box_length: record['Box Length'] || record['Length'] || null,
          box_width: record['Box Width'] || record['Width'] || null,
          updated_at: new Date()
        };
        
        // Build dynamic SQL for non-null fields
        const setClause = [];
        const values = [];
        let paramCount = 1;
        
        Object.entries(updateFields).forEach(([key, value]) => {
          if (value !== null) {
            setClause.push(`${key} = $${paramCount}`);
            values.push(value);
            paramCount++;
          }
        });
        
        if (setClause.length > 0) {
          values.push(sku); // Add SKU for WHERE clause
          const sql = `UPDATE products SET ${setClause.join(', ')} WHERE sku = $${paramCount}`;
          
          const result = await pool.query(sql, values);
          
          if (result.rowCount > 0) {
            processedCount++;
            if (processedCount % 25 === 0) {
              console.log(`✅ Updated ${processedCount} products with catalog fields...`);
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing record ${record['CWR Part Number']}:`, error.message);
      }
    }
    
    console.log(`🎉 Import complete! Updated ${processedCount} products with authentic catalog fields.`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await sftp.end();
    await pool.end();
  }
}

importCatalogFields().catch(console.error);