/**
 * Test mapping template synchronization with 50 sample products from CWR
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products, dataSources, mappingTemplates } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/mdm_pim';

async function testMappingSync() {
  console.log('🧪 Starting mapping template sync test with 50 sample products...');
  
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    // Get CWR data source (should be ID 1)
    const dataSource = await db.select().from(dataSources).where(eq(dataSources.id, 1)).limit(1);
    if (!dataSource.length) {
      console.error('❌ CWR data source not found (ID: 1)');
      return;
    }

    console.log(`📋 Found data source: ${dataSource[0].name}`);

    // Get CWR mapping template 
    const template = await db.select().from(mappingTemplates).where(eq(mappingTemplates.name, 'CWR')).limit(1);
    if (!template.length) {
      console.error('❌ CWR mapping template not found');
      return;
    }

    console.log(`🗺️ Found mapping template: ${template[0].name} with ${JSON.parse(template[0].mappings).length} field mappings`);

    // Call the data source pull endpoint with test parameters
    const response = await fetch('http://localhost:5000/api/data-sources/1/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 50,
        test: true,
        applyMappings: true,
        mappingTemplateId: template[0].id
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pull request failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Pull completed successfully!');
    console.log(`📊 Results: ${result.successCount || 0} products processed, ${result.errorCount || 0} errors`);

    // Check current product count
    const allProducts = await db.select().from(products);
    console.log(`📦 Total products in catalog: ${allProducts.length}`);

    // Show sample of mapped products
    const sampleProducts = allProducts.slice(0, 5);
    console.log('\n📋 Sample of mapped products:');
    sampleProducts.forEach(product => {
      console.log(`  • ${product.sku}: ${product.name}`);
      console.log(`    UPC: ${product.upc || 'N/A'}, MPN: ${product.manufacturerPartNumber || 'N/A'}`);
      console.log(`    Price: $${product.price || 'N/A'}, Category: ${product.category || 'N/A'}`);
    });

    console.log('\n🎯 Mapping sync test completed! Check the Master Catalog and Product Details pages to see the mapped fields.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sql.end();
  }
}

testMappingSync();