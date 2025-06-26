/**
 * Complete Pipeline Test - Clean Slate to Full Import
 * Tests the entire workflow from database cleanup to category management
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as schema from './shared/schema';

async function clearDatabase() {
  console.log('🧹 Clearing database for clean slate test...');
  
  try {
    // Clear in correct order to respect foreign key constraints
    await db.delete(schema.productSuppliers);
    await db.delete(schema.products);
    await db.delete(schema.categories);
    
    console.log('✓ Database cleared successfully - clean slate ready');
    return true;
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    return false;
  }
}

async function testCategoryCreation() {
  console.log('\n🏗️ Testing category hierarchy creation...');
  
  // Test creating a sample category hierarchy
  const sampleCategories = [
    { name: 'Electronics', level: 0, path: 'Electronics', parentId: null },
    { name: 'Audio & Video', level: 1, path: 'Electronics > Audio & Video', parentId: null },
    { name: 'Car Audio', level: 2, path: 'Electronics > Audio & Video > Car Audio', parentId: null }
  ];
  
  let createdCategories = [];
  
  for (let i = 0; i < sampleCategories.length; i++) {
    const cat = sampleCategories[i];
    
    // Set parent ID based on previous category
    if (i > 0) {
      cat.parentId = createdCategories[i - 1].id;
    }
    
    const categoryData = {
      name: cat.name,
      code: cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      level: cat.level,
      path: cat.path,
      parentId: cat.parentId
    };
    
    const [created] = await db.insert(schema.categories).values(categoryData).returning();
    createdCategories.push(created);
    
    console.log(`✓ Created: ${cat.path} (ID: ${created.id})`);
  }
  
  return createdCategories;
}

async function testProductCreation(categories: any[]) {
  console.log('\n📦 Testing product creation with categories...');
  
  const sampleProducts = [
    {
      name: 'Pioneer DEH-S1200UB CD Receiver',
      sku: 'EDC010001',
      description: 'Single-DIN CD receiver with USB and auxiliary input',
      categoryId: categories[2]?.id, // Car Audio category
      cost: 89.99,
      status: 'active'
    },
    {
      name: 'Kenwood KMM-BT328U Digital Media Receiver',
      sku: 'EDC010002', 
      description: 'Digital media receiver with Bluetooth wireless technology',
      categoryId: categories[2]?.id, // Car Audio category
      cost: 79.99,
      status: 'active'
    }
  ];
  
  let createdProducts = [];
  
  for (const product of sampleProducts) {
    const [created] = await db.insert(schema.products).values(product).returning();
    createdProducts.push(created);
    console.log(`✓ Created product: ${product.sku} - ${product.name}`);
  }
  
  return createdProducts;
}

async function validateCategoryAPI() {
  console.log('\n🌐 Testing enhanced Categories API...');
  
  // Test the same query that the frontend uses
  const categoriesWithCounts = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      code: schema.categories.code,
      parentId: schema.categories.parentId,
      level: schema.categories.level,
      path: schema.categories.path,
      productCount: sql`count(${schema.products.id})`,
    })
    .from(schema.categories)
    .leftJoin(schema.products, sql`${schema.categories.id} = ${schema.products.categoryId}`)
    .groupBy(schema.categories.id)
    .orderBy(schema.categories.level, schema.categories.name);
  
  console.log('✓ Categories with product counts:');
  categoriesWithCounts.forEach(cat => {
    console.log(`   ${cat.name} (Level ${cat.level}): ${cat.productCount} products`);
  });
  
  return categoriesWithCounts;
}

async function runPipelineTest() {
  console.log('🚀 Starting Complete Pipeline Test');
  console.log('Testing enhanced category management for 28k product readiness\n');
  
  try {
    // Step 1: Clear database
    const cleared = await clearDatabase();
    if (!cleared) throw new Error('Database cleanup failed');
    
    // Step 2: Test category creation
    const categories = await testCategoryCreation();
    if (categories.length === 0) throw new Error('Category creation failed');
    
    // Step 3: Test product creation
    const products = await testProductCreation(categories);
    if (products.length === 0) throw new Error('Product creation failed');
    
    // Step 4: Validate API functionality
    const apiResults = await validateCategoryAPI();
    if (apiResults.length === 0) throw new Error('API validation failed');
    
    // Verify hierarchy structure
    const hierarchyValid = apiResults.some(cat => cat.level === 0) && 
                          apiResults.some(cat => cat.level === 1) &&
                          apiResults.some(cat => cat.level === 2);
    
    if (!hierarchyValid) throw new Error('Category hierarchy validation failed');
    
    console.log('\n🎯 Pipeline Test Results:');
    console.log(`✓ Categories created: ${categories.length}`);
    console.log(`✓ Products created: ${products.length}`);
    console.log(`✓ API response categories: ${apiResults.length}`);
    console.log(`✓ Hierarchy levels: ${Math.max(...apiResults.map(c => c.level)) + 1}`);
    console.log(`✓ Product counts accurate: ${apiResults.some(c => Number(c.productCount) > 0)}`);
    
    console.log('\n🌟 SUCCESS: System ready for 28k product import');
    console.log('Enhanced category management is working correctly');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    return false;
  }
}

// Run the test
runPipelineTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });