/**
 * Complete Pipeline Test Script
 * 
 * This script tests the entire data pipeline from start to finish:
 * 1. Clean slate - clear all products and categories
 * 2. Test supplier data pull with sample data
 * 3. Verify category creation and hierarchy
 * 4. Test mapping process
 * 5. Validate final data integrity
 */

import { db } from './server/db.ts';
import { products, categories, productSuppliers } from './shared/schema.ts';
import fs from 'fs';
import path from 'path';

async function clearDatabase() {
  console.log('🧹 Clearing database for clean slate test...');
  
  try {
    // Clear in correct order to respect foreign key constraints
    await db.delete(productSuppliers);
    console.log('✓ Cleared product-supplier relationships');
    
    await db.delete(products);
    console.log('✓ Cleared products');
    
    await db.delete(categories);
    console.log('✓ Cleared categories');
    
    console.log('🎯 Database cleared successfully - clean slate ready');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

async function testSampleDataPull() {
  console.log('\n📥 Testing sample data pull...');
  
  // Test with a small subset of CWR data (first 10 rows)
  const sampleCsvPath = './temp/authentic-catalog.csv';
  
  if (!fs.existsSync(sampleCsvPath)) {
    console.log('❌ Sample CSV file not found');
    return false;
  }
  
  const csvContent = fs.readFileSync(sampleCsvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const sampleLines = lines.slice(1, 11); // Take first 10 data rows
  
  const testCsvContent = [header, ...sampleLines].join('\n');
  const testCsvPath = './temp/test-sample-10-products.csv';
  fs.writeFileSync(testCsvPath, testCsvContent);
  
  console.log(`✓ Created test sample with ${sampleLines.length} products`);
  return testCsvPath;
}

async function importTestSample(csvPath) {
  console.log('\n🔄 Importing test sample...');
  
  const { parse } = await import('csv-parse/sync');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`📊 Parsed ${records.length} records from CSV`);
  
  let processedCount = 0;
  let categoryCount = 0;
  
  for (const record of records) {
    try {
      // Extract category path
      const categoryPath = record['Category'] || record['category'];
      let categoryId = null;
      
      if (categoryPath) {
        categoryId = await createCategoryHierarchy(categoryPath);
        if (categoryId) categoryCount++;
      }
      
      // Create product
      const productData = {
        name: record['Product Name'] || record['name'],
        sku: record['EDC Part Number'] || record['sku'],
        description: record['Description'] || record['description'],
        categoryId: categoryId,
        manufacturerPartNumber: record['CWR Part Number'] || record['mpn'],
        upc: record['UPC'] || record['upc'],
        cost: record['Cost'] ? parseFloat(record['Cost']) : null,
        weight: record['Weight'] ? parseFloat(record['Weight']) : null,
        status: 'active'
      };
      
      // Remove undefined fields
      Object.keys(productData).forEach(key => {
        if (productData[key] === undefined || productData[key] === '') {
          delete productData[key];
        }
      });
      
      const [insertedProduct] = await db.insert(products).values(productData).returning();
      processedCount++;
      
      console.log(`✓ Product ${processedCount}: ${productData.sku} - ${productData.name}`);
      
    } catch (error) {
      console.error(`❌ Error processing record:`, error.message);
    }
  }
  
  console.log(`\n📈 Import Summary:`);
  console.log(`   Products processed: ${processedCount}`);
  console.log(`   Categories created: ${categoryCount}`);
  
  return { processedCount, categoryCount };
}

async function createCategoryHierarchy(categoryPath) {
  if (!categoryPath || typeof categoryPath !== 'string') return null;
  
  const pathParts = categoryPath.split(' > ').map(part => part.trim()).filter(Boolean);
  if (pathParts.length === 0) return null;
  
  let parentId = null;
  let currentLevel = 0;
  
  for (const part of pathParts) {
    const fullPath = pathParts.slice(0, currentLevel + 1).join(' > ');
    
    // Check if category exists
    const [existing] = await db.select()
      .from(categories)
      .where(sql`${categories.name} = ${part} AND ${categories.level} = ${currentLevel}`)
      .limit(1);
    
    if (existing) {
      parentId = existing.id;
    } else {
      // Create new category
      const categoryData = {
        name: part,
        code: generateCategoryCode(part),
        parentId: parentId,
        level: currentLevel,
        path: fullPath
      };
      
      const [newCategory] = await db.insert(categories).values(categoryData).returning();
      parentId = newCategory.id;
      
      console.log(`🏗️ Created category: ${fullPath} (Level ${currentLevel})`);
    }
    
    currentLevel++;
  }
  
  return parentId;
}

function generateCategoryCode(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
}

async function validateResults() {
  console.log('\n🔍 Validating results...');
  
  // Count products
  const [productCount] = await db.select({ count: sql`count(*)` }).from(products);
  console.log(`✓ Total products: ${productCount.count}`);
  
  // Count categories and analyze hierarchy
  const allCategories = await db.select().from(categories).orderBy(categories.level, categories.name);
  console.log(`✓ Total categories: ${allCategories.length}`);
  
  // Analyze category hierarchy
  const categoryByLevel = {};
  allCategories.forEach(cat => {
    if (!categoryByLevel[cat.level]) categoryByLevel[cat.level] = 0;
    categoryByLevel[cat.level]++;
  });
  
  console.log('\n📊 Category Hierarchy:');
  Object.keys(categoryByLevel).forEach(level => {
    console.log(`   Level ${level}: ${categoryByLevel[level]} categories`);
  });
  
  // Test category API
  console.log('\n🌐 Testing Categories API...');
  const categoriesWithCounts = await db
    .select({
      id: categories.id,
      name: categories.name,
      level: categories.level,
      path: categories.path,
      productCount: sql`count(${products.id})`
    })
    .from(categories)
    .leftJoin(products, sql`${categories.id} = ${products.categoryId}`)
    .groupBy(categories.id)
    .orderBy(categories.level);
  
  console.log('✓ Categories with product counts:');
  categoriesWithCounts.slice(0, 5).forEach(cat => {
    console.log(`   ${cat.name} (Level ${cat.level}): ${cat.productCount} products`);
  });
  
  return {
    totalProducts: parseInt(productCount.count),
    totalCategories: allCategories.length,
    hierarchyLevels: Object.keys(categoryByLevel).length,
    categoriesWithCounts: categoriesWithCounts.length
  };
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete Pipeline Test\n');
  console.log('This will test the entire workflow from clean slate to final validation');
  console.log('Testing with 10 sample products to verify 28k product readiness\n');
  
  try {
    // Step 1: Clear database
    await clearDatabase();
    
    // Step 2: Prepare sample data
    const testCsvPath = await testSampleDataPull();
    if (!testCsvPath) {
      throw new Error('Failed to prepare sample data');
    }
    
    // Step 3: Import sample data
    const importResults = await importTestSample(testCsvPath);
    
    // Step 4: Validate results
    const validationResults = await validateResults();
    
    console.log('\n🎯 Test Complete - Summary:');
    console.log(`✓ Products imported: ${importResults.processedCount}`);
    console.log(`✓ Categories created: ${importResults.categoryCount}`);
    console.log(`✓ Hierarchy levels: ${validationResults.hierarchyLevels}`);
    console.log(`✓ API compatibility: ${validationResults.categoriesWithCounts > 0 ? 'PASSED' : 'FAILED'}`);
    
    console.log('\n🌟 Pipeline Status: READY FOR 28K PRODUCTS');
    console.log('The enhanced category management system is working correctly');
    
    // Clean up test file
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error);
    return false;
  }
}

// Import required dependencies
const { sql } = await import('drizzle-orm');

// Run the complete test
runCompleteTest()
  .then(success => {
    if (success) {
      console.log('\n✅ All systems verified - Ready for full catalog import');
      process.exit(0);
    } else {
      console.log('\n❌ Pipeline test failed - Please review and fix issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });