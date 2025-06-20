import { db } from './server/db.js';
import { products, categories, productSuppliers } from './shared/schema.js';
import SftpClient from 'ssh2-sftp-client';
import { parse as csvParse } from 'csv-parse';
import { eq } from 'drizzle-orm';

async function importAuthenticCatalog() {
  console.log('🎯 Importing authentic catalog data with new fields...');
  
  const sftp = new SftpClient();
  
  try {
    // Connect using existing SFTP credentials
    await sftp.connect({
      host: 'ftp.centuryboatparts.com',
      port: 22,
      username: 'ecommdatafeed',
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
    
    // Process first 50 records to test field mapping
    for (const record of records.slice(0, 50)) {
      try {
        // Map the catalog fields with multiple possible column names
        const productData = {
          sku: record.ItemNumber || record.sku || record.item_number,
          name: record.Description || record.name || record.description,
          description: record.LongDescription || record.long_description || record.Description,
          manufacturerPartNumber: record.ManufacturerPartNumber || record.manufacturer_part_number || record.mpn,
          manufacturerName: record.Manufacturer || record.manufacturer || record.brand,
          upc: record.UPC || record.upc,
          price: record.MSRP || record.msrp || record.price,
          cost: record.Cost || record.cost,
          weight: record.Weight || record.weight,
          status: 'active',
          
          // New catalog fields with multiple possible column names
          thirdPartyMarketplaces: record['3rd Party Marketplaces'] || record.thirdPartyMarketplaces || record['Third Party Marketplaces'] || record.marketplaces,
          caseQuantity: record['Case Qty'] || record.caseQuantity || record.case_qty || record.caseQty,
          googleMerchantCategory: record['Google Merchant Category'] || record.googleMerchantCategory || record.google_merchant_category,
          countryOfOrigin: record['Country of Origin'] || record.countryOfOrigin || record.country_of_origin,
          boxHeight: record['Box Height'] || record.boxHeight || record.box_height,
          boxLength: record['Box Length'] || record.boxLength || record.box_length,
          boxWidth: record['Box Width'] || record.boxWidth || record.box_width,
          
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if product exists
        const existingProduct = await db.select()
          .from(products)
          .where(eq(products.sku, productData.sku))
          .limit(1);
          
        if (existingProduct.length > 0) {
          // Update existing product with new fields
          await db.update(products)
            .set(productData)
            .where(eq(products.id, existingProduct[0].id));
        } else {
          // Insert new product
          await db.insert(products).values(productData);
        }
        
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`✅ Processed ${processedCount} products...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing record ${record.ItemNumber}:`, error.message);
      }
    }
    
    console.log(`🎉 Import complete! Processed ${processedCount} products with new catalog fields.`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await sftp.end();
  }
}

importAuthenticCatalog().catch(console.error);