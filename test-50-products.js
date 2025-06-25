/**
 * Test 50 product sync with CWR mapping template
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { products, dataSources, mappingTemplates } from './shared/schema.js';
import { eq, count } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function test50ProductSync() {
  console.log('🧪 Testing 50 product sync with CWR mapping template...');

  try {
    // Check current product count
    const beforeCount = await db.select({ count: count() }).from(products);
    console.log(`📦 Current product count: ${beforeCount[0].count}`);

    // Get CWR data source and mapping template
    const dataSource = await db.select().from(dataSources).where(eq(dataSources.id, 1)).limit(1);
    const template = await db.select().from(mappingTemplates).where(eq(mappingTemplates.name, 'CWR')).limit(1);

    if (!dataSource.length) {
      console.log('❌ CWR data source not found');
      return;
    }

    if (!template.length) {
      console.log('❌ CWR mapping template not found');
      return;
    }

    console.log(`✅ Found data source: ${dataSource[0].name}`);
    console.log(`✅ Found mapping template: ${template[0].name}`);

    // Sample CWR product data for testing (50 products)
    const sampleProducts = [
      {
        "EDC CODE": "10001", "MFGN": "X-10-A", "UPC": "123456789001", "DESCRIPTION": "Marine GPS Antenna", 
        "MFG NAME": "Garmin", "CATEGORY": "Electronics", "LIST": "199.99", "COST": "119.99", "QTY FL": "15", "QTY NJ": "8"
      },
      {
        "EDC CODE": "10002", "MFGN": "SS-2001", "UPC": "123456789002", "DESCRIPTION": "Stainless Steel Cleat", 
        "MFG NAME": "Perko", "CATEGORY": "Hardware", "LIST": "45.99", "COST": "27.59", "QTY FL": "25", "QTY NJ": "12"
      },
      {
        "EDC CODE": "10003", "MFGN": "LED-300", "UPC": "123456789003", "DESCRIPTION": "LED Navigation Light", 
        "MFG NAME": "Attwood", "CATEGORY": "Lighting", "LIST": "89.99", "COST": "53.99", "QTY FL": "20", "QTY NJ": "15"
      },
      {
        "EDC CODE": "10004", "MFGN": "PMP-500", "UPC": "123456789004", "DESCRIPTION": "Bilge Pump 500 GPH", 
        "MFG NAME": "Rule", "CATEGORY": "Pumps", "LIST": "129.99", "COST": "77.99", "QTY FL": "10", "QTY NJ": "5"
      },
      {
        "EDC CODE": "10005", "MFGN": "ANK-25", "UPC": "123456789005", "DESCRIPTION": "Fortress Anchor 25lb", 
        "MFG NAME": "Fortress", "CATEGORY": "Anchoring", "LIST": "159.99", "COST": "95.99", "QTY FL": "8", "QTY NJ": "4"
      }
      // Adding 45 more sample products to reach 50 total
    ];

    // Generate remaining 45 products programmatically
    for (let i = 6; i <= 50; i++) {
      const paddedNum = i.toString().padStart(5, '0');
      sampleProducts.push({
        "EDC CODE": `1${paddedNum}`,
        "MFGN": `MPN-${paddedNum}`,
        "UPC": `12345678${paddedNum.padStart(4, '0')}`,
        "DESCRIPTION": `Marine Product ${i}`,
        "MFG NAME": "Marine Manufacturer",
        "CATEGORY": "Marine Equipment",
        "LIST": `${(Math.random() * 500 + 50).toFixed(2)}`,
        "COST": `${(Math.random() * 300 + 30).toFixed(2)}`,
        "QTY FL": `${Math.floor(Math.random() * 50)}`,
        "QTY NJ": `${Math.floor(Math.random() * 30)}`
      });
    }

    // Apply CWR mapping template to transform the data
    const mappings = JSON.parse(template[0].mappings);
    const transformedProducts = [];

    for (const record of sampleProducts) {
      const productData = {};
      
      // Apply each mapping from the template
      mappings.forEach(mapping => {
        const sourceValue = record[mapping.sourceField];
        if (sourceValue) {
          productData[mapping.targetField] = sourceValue;
        }
      });

      // Ensure required fields
      if (!productData.sku && productData.edcCode) productData.sku = productData.edcCode;
      if (!productData.name && productData.description) productData.name = productData.description;
      
      transformedProducts.push(productData);
    }

    console.log(`🔄 Processing ${transformedProducts.length} products with mapping template...`);

    // Insert/update products in batches
    let successCount = 0;
    let errorCount = 0;

    for (const productData of transformedProducts) {
      try {
        // Check if product exists
        const existing = await db.select().from(products).where(eq(products.sku, productData.sku)).limit(1);
        
        if (existing.length > 0) {
          // Update existing
          await db.update(products)
            .set({
              ...productData,
              updatedAt: new Date()
            })
            .where(eq(products.id, existing[0].id));
          console.log(`📝 Updated: ${productData.sku} - ${productData.name}`);
        } else {
          // Create new
          await db.insert(products).values({
            ...productData,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✨ Created: ${productData.sku} - ${productData.name}`);
        }
        successCount++;
      } catch (error) {
        console.error(`❌ Error processing ${productData.sku}:`, error.message);
        errorCount++;
      }
    }

    // Check final count
    const afterCount = await db.select({ count: count() }).from(products);
    console.log(`\n📊 Test Results:`);
    console.log(`   • Successfully processed: ${successCount} products`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Total products before: ${beforeCount[0].count}`);
    console.log(`   • Total products after: ${afterCount[0].count}`);
    console.log(`   • Net change: +${afterCount[0].count - beforeCount[0].count}`);

    console.log('\n🎯 Test completed! Navigate to the Master Catalog to see the mapped products.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test50ProductSync();