import { Pool } from 'pg';
import SftpClient from 'ssh2-sftp-client';
import { parse as csvParse } from 'csv-parse';

async function updateCatalogFields() {
  console.log('📊 Updating products with authentic CWR catalog fields...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const sftp = new SftpClient();
  
  try {
    // Connect to CWR SFTP
    await sftp.connect({
      host: 'edi.cwrdistribution.com',
      port: 22,
      username: 'eco8',
      password: process.env.SFTP_PASSWORD,
    });
    
    console.log('✅ Connected to CWR SFTP server');
    
    // Get catalog data
    const catalogBuffer = await sftp.get('/eco8/out/catalog.csv');
    const csvContent = catalogBuffer.toString();
    
    console.log('✅ Downloaded catalog.csv from authentic source');
    
    // Parse CSV with headers
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
    
    console.log(`📋 Processing ${records.length} authentic catalog records...`);
    
    let updatedCount = 0;
    
    // Import first 50 products with complete data
    for (const record of records.slice(0, 50)) {
      try {
        const sku = record['CWR Part Number'];
        const mpn = record['Manufacturer Part Number'];
        
        if (!sku) continue;
        
        // Map all available catalog fields
        const productData = {
          sku: sku,
          name: record['Uppercase Title'] || record['Description'] || '',
          description: record['Long Description'] || record['Description'] || '',
          manufacturerPartNumber: mpn,
          manufacturerName: record['Manufacturer'] || '',
          upc: record['UPC Code'] || null,
          price: record['List Price'] || null,
          cost: record['Your Cost'] || null,
          weight: record['Weight'] || null,
          
          // Additional catalog fields from your authentic data
          thirdPartyMarketplaces: record['3rd Party Marketplaces'] || null,
          caseQuantity: record['Case Qty'] || record['Case Quantity'] || null,
          googleMerchantCategory: record['Google Merchant Category'] || record['Google Category'] || null,
          countryOfOrigin: record['Country of Origin'] || record['Origin Country'] || null,
          boxHeight: record['Box Height'] || record['Height'] || null,
          boxLength: record['Box Length'] || record['Length'] || null,
          boxWidth: record['Box Width'] || record['Width'] || null,
          
          status: 'active',
          updatedAt: new Date()
        };
        
        // Insert or update product
        const insertQuery = `
          INSERT INTO products (
            sku, name, description, manufacturer_part_number, manufacturer_name, 
            upc, price, cost, weight, third_party_marketplaces, case_quantity,
            google_merchant_category, country_of_origin, box_height, box_length, 
            box_width, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
          )
          ON CONFLICT (sku) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            manufacturer_part_number = EXCLUDED.manufacturer_part_number,
            manufacturer_name = EXCLUDED.manufacturer_name,
            upc = EXCLUDED.upc,
            price = EXCLUDED.price,
            cost = EXCLUDED.cost,
            weight = EXCLUDED.weight,
            third_party_marketplaces = EXCLUDED.third_party_marketplaces,
            case_quantity = EXCLUDED.case_quantity,
            google_merchant_category = EXCLUDED.google_merchant_category,
            country_of_origin = EXCLUDED.country_of_origin,
            box_height = EXCLUDED.box_height,
            box_length = EXCLUDED.box_length,
            box_width = EXCLUDED.box_width,
            updated_at = NOW()
        `;
        
        const values = [
          productData.sku,
          productData.name,
          productData.description,
          productData.manufacturerPartNumber,
          productData.manufacturerName,
          productData.upc,
          productData.price,
          productData.cost,
          productData.weight,
          productData.thirdPartyMarketplaces,
          productData.caseQuantity,
          productData.googleMerchantCategory,
          productData.countryOfOrigin,
          productData.boxHeight,
          productData.boxLength,
          productData.boxWidth,
          productData.status
        ];
        
        await pool.query(insertQuery, values);
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`✅ Processed ${updatedCount} products with authentic catalog data...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${record['CWR Part Number']}:`, error.message);
      }
    }
    
    console.log(`🎉 Successfully imported ${updatedCount} products with complete catalog fields from authentic CWR data!`);
    
  } catch (error) {
    console.error('❌ Import error:', error);
  } finally {
    await sftp.end();
    await pool.end();
  }
}

updateCatalogFields().catch(console.error);