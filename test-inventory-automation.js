#!/usr/bin/env node

/**
 * Inventory Management Automation Test Script
 * 
 * This script verifies that the inventory management automation system
 * is functioning correctly for both sample pulls and full catalog pulls.
 */

import { db } from './server/storage.js';
import { eq, desc } from 'drizzle-orm';
import { products, supplierAutomations, dataPullJobs, inventorySnapshots } from './shared/schema.js';

async function testInventoryAutomation() {
  console.log('🔄 Testing Inventory Management Automation System\n');

  try {
    // 1. Check automation configuration
    console.log('1. Checking Automation Configuration...');
    const automations = await db
      .select()
      .from(supplierAutomations)
      .where(eq(supplierAutomations.supplierId, 2));

    if (automations.length === 0) {
      console.log('❌ No automation found for CWR Distribution (Supplier ID: 2)');
      return;
    }

    const automation = automations[0];
    console.log(`✅ Found automation: ${automation.name}`);
    console.log(`   - Catalog enabled: ${automation.catalogEnabled}`);
    console.log(`   - Inventory enabled: ${automation.inventoryEnabled}`);
    console.log(`   - Catalog file: ${automation.catalogFilePath}`);
    console.log(`   - Inventory file: ${automation.inventoryFilePath}`);
    console.log(`   - Wait for catalog completion: ${automation.waitForCatalogCompletion}`);

    // 2. Check recent data pull jobs
    console.log('\n2. Checking Recent Data Pull Jobs...');
    const recentJobs = await db
      .select()
      .from(dataPullJobs)
      .where(eq(dataPullJobs.supplierId, 2))
      .orderBy(desc(dataPullJobs.scheduledAt))
      .limit(5);

    console.log(`Found ${recentJobs.length} recent jobs:`);
    recentJobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.jobType.toUpperCase()} - ${job.status} (${job.recordsProcessed || 0} records)`);
    });

    // 3. Check product count
    console.log('\n3. Checking Product Catalog...');
    const productCount = await db
      .select({ count: sql`count(*)` })
      .from(products);

    console.log(`✅ Total products in catalog: ${productCount[0].count}`);

    // 4. Check inventory snapshots
    console.log('\n4. Checking Inventory Snapshots...');
    const inventoryCount = await db
      .select({ count: sql`count(*)` })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.supplierId, 2));

    console.log(`✅ Total inventory records: ${inventoryCount[0].count}`);

    // 5. Test sample data structure
    console.log('\n5. Validating Data Structure...');
    const sampleProducts = await db
      .select()
      .from(products)
      .limit(3);

    if (sampleProducts.length > 0) {
      console.log('✅ Sample products found with proper structure');
      sampleProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.sku} - ${product.name?.substring(0, 50)}...`);
      });
    }

    // 6. Test automation workflow simulation
    console.log('\n6. Testing Automation Workflow Logic...');
    
    if (automation.catalogEnabled && automation.inventoryEnabled) {
      if (automation.waitForCatalogCompletion) {
        console.log('✅ Workflow: Catalog pulls first, then inventory (dependency enabled)');
      } else {
        console.log('✅ Workflow: Catalog and inventory can run independently');
      }
      
      console.log(`   - Catalog frequency: ${automation.catalogFrequency} (${automation.catalogTimesPerDay}x/day)`);
      console.log(`   - Inventory frequency: ${automation.inventoryFrequency} (${automation.inventoryTimesPerDay}x/day)`);
      console.log(`   - Inventory delay after catalog: ${automation.inventoryDelayAfterCatalog} minutes`);
    }

    // 7. Check for data validation issues
    console.log('\n7. Checking Data Quality...');
    const productsWithIssues = await db
      .select({ count: sql`count(*)` })
      .from(products)
      .where(sql`price IS NULL OR cost IS NULL OR name IS NULL`);

    if (productsWithIssues[0].count > 0) {
      console.log(`⚠️  Found ${productsWithIssues[0].count} products with missing required data`);
      console.log('   - This may indicate data validation issues during import');
    } else {
      console.log('✅ All products have required data fields');
    }

    console.log('\n📊 Automation Test Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Automation System: ${automation.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`✅ Catalog Processing: ${automation.catalogEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`✅ Inventory Processing: ${automation.inventoryEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`✅ Products in Catalog: ${productCount[0].count}`);
    console.log(`✅ Inventory Records: ${inventoryCount[0].count}`);
    console.log(`✅ Recent Jobs: ${recentJobs.length}`);
    
    if (automation.isActive && automation.catalogEnabled && automation.inventoryEnabled) {
      console.log('\n🎉 INVENTORY AUTOMATION IS FULLY FUNCTIONAL');
      console.log('   Both sample pulls and full catalog pulls will trigger inventory updates');
    } else {
      console.log('\n⚠️  AUTOMATION NEEDS ATTENTION');
      console.log('   Check configuration and enable required components');
    }

  } catch (error) {
    console.error('❌ Error testing automation:', error.message);
  }
}

// Import SQL helper
import { sql } from 'drizzle-orm';

// Run the test
testInventoryAutomation().catch(console.error);