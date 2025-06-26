/**
 * Full CWR Catalog Import - 28k Products
 * 
 * This script imports the complete CWR catalog with all 28,000+ products
 * including proper category hierarchy creation and image associations.
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
import { products, categories, productSuppliers } from './shared/schema.js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

async function clearExistingData() {
  console.log('🧹 Clearing existing test data...');
  
  try {
    await db.delete(productSuppliers);
    await db.delete(products);
    await db.delete(categories);
    
    console.log('✓ Existing data cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    return false;
  }
}

async function loadCWRCatalog() {
  console.log('📥 Loading full CWR catalog...');
  
  const csvPath = './temp/authentic-catalog.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CWR catalog file not found at:', csvPath);
    return null;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`✓ Loaded ${records.length} products from CWR catalog`);
  return records;
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
      .where(sql`${categories.name} = ${part} AND ${categories.level} = ${currentLevel} AND (${categories.parentId} = ${parentId} OR (${categories.parentId} IS NULL AND ${parentId} IS NULL))`)
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

function cleanHtml(text) {
  if (!text) return null;
  return text.replace(/<[^>]*>/g, '').trim();
}

async function processCWRProducts(records) {
  console.log('🔄 Processing CWR products...');
  
  let processedCount = 0;
  let errorCount = 0;
  const batchSize = 100;
  const categoryMap = new Map();
  
  // Process in batches for better performance
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} (${i + 1}-${Math.min(i + batchSize, records.length)})`);
    
    for (const record of batch) {
      try {
        // Handle category
        let categoryId = null;
        const categoryPath = record['Category'] || record['category'];
        
        if (categoryPath) {
          if (categoryMap.has(categoryPath)) {
            categoryId = categoryMap.get(categoryPath);
          } else {
            categoryId = await createCategoryHierarchy(categoryPath);
            if (categoryId) {
              categoryMap.set(categoryPath, categoryId);
            }
          }
        }
        
        // Parse numeric values safely
        const cost = record['Cost'] ? parseFloat(record['Cost'].toString().replace(/[^0-9.-]/g, '')) : null;
        const weight = record['Weight'] ? parseFloat(record['Weight'].toString().replace(/[^0-9.-]/g, '')) : null;
        const price = record['Price'] ? parseFloat(record['Price'].toString().replace(/[^0-9.-]/g, '')) : null;
        
        // Create product
        const productData = {
          name: record['Product Name'] || record['name'] || 'Unknown Product',
          sku: record['EDC Part Number'] || record['sku'] || `EDC${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          usin: record['CWR Part Number'] || record['usin'],
          description: cleanHtml(record['Description'] || record['description']),
          categoryId: categoryId,
          manufacturerPartNumber: record['CWR Part Number'] || record['mpn'],
          upc: record['UPC'] || record['upc'],
          cost: cost,
          price: price,
          weight: weight,
          status: 'active',
          // Image fields
          image300x300: record['Image (300x300)'] || record['image300x300'],
          image1000x1000: record['Image (1000x1000)'] || record['image1000x1000'],
          // Additional attributes
          manufacturer: record['Manufacturer'] || record['manufacturer'],
          brand: record['Brand'] || record['brand']
        };
        
        // Remove undefined/empty fields
        Object.keys(productData).forEach(key => {
          if (productData[key] === undefined || productData[key] === '' || productData[key] === 'null') {
            delete productData[key];
          }
        });
        
        const [insertedProduct] = await db.insert(products).values(productData).returning();
        processedCount++;
        
        if (processedCount % 500 === 0) {
          console.log(`✓ Processed ${processedCount} products...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing product ${record['EDC Part Number'] || 'unknown'}:`, error.message);
        
        if (errorCount > 100) {
          console.error('❌ Too many errors, stopping import');
          break;
        }
      }
    }
  }
  
  return { processedCount, errorCount, categoryMap };
}

async function validateImport() {
  console.log('\n🔍 Validating import results...');
  
  // Count products
  const [productCount] = await db.select({ count: sql`count(*)` }).from(products);
  console.log(`✓ Total products imported: ${productCount.count}`);
  
  // Count categories
  const [categoryCount] = await db.select({ count: sql`count(*)` }).from(categories);
  console.log(`✓ Total categories created: ${categoryCount.count}`);
  
  // Analyze category hierarchy
  const categoryLevels = await db
    .select({ 
      level: categories.level, 
      count: sql`count(*)` 
    })
    .from(categories)
    .groupBy(categories.level)
    .orderBy(categories.level);
  
  console.log('\n📊 Category Hierarchy:');
  categoryLevels.forEach(level => {
    console.log(`   Level ${level.level}: ${level.count} categories`);
  });
  
  // Check products with images
  const [productsWithImages] = await db
    .select({ count: sql`count(*)` })
    .from(products)
    .where(sql`${products.image300x300} IS NOT NULL OR ${products.image1000x1000} IS NOT NULL`);
  
  console.log(`✓ Products with images: ${productsWithImages.count}`);
  
  // Sample some categories with product counts
  const categoriesWithCounts = await db
    .select({
      name: categories.name,
      level: categories.level,
      productCount: sql`count(${products.id})`
    })
    .from(categories)
    .leftJoin(products, sql`${categories.id} = ${products.categoryId}`)
    .groupBy(categories.id, categories.name, categories.level)
    .having(sql`count(${products.id}) > 0`)
    .orderBy(sql`count(${products.id}) DESC`)
    .limit(10);
  
  console.log('\n🏆 Top Categories by Product Count:');
  categoriesWithCounts.forEach(cat => {
    console.log(`   ${cat.name} (Level ${cat.level}): ${cat.productCount} products`);
  });
  
  return {
    totalProducts: parseInt(productCount.count),
    totalCategories: parseInt(categoryCount.count),
    productsWithImages: parseInt(productsWithImages.count),
    hierarchyLevels: categoryLevels.length
  };
}

async function runFullImport() {
  console.log('🚀 Starting Full CWR Catalog Import');
  console.log('Importing 28,000+ products with complete category hierarchy\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Clear existing data
    const cleared = await clearExistingData();
    if (!cleared) throw new Error('Failed to clear existing data');
    
    // Step 2: Load CWR catalog
    const records = await loadCWRCatalog();
    if (!records) throw new Error('Failed to load CWR catalog');
    
    // Step 3: Process all products
    const { processedCount, errorCount, categoryMap } = await processCWRProducts(records);
    
    // Step 4: Validate results
    const validationResults = await validateImport();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎯 Import Complete - Final Summary:');
    console.log(`✓ Products imported: ${processedCount}`);
    console.log(`✓ Categories created: ${categoryMap.size}`);
    console.log(`✓ Total categories in DB: ${validationResults.totalCategories}`);
    console.log(`✓ Products with images: ${validationResults.productsWithImages}`);
    console.log(`✓ Hierarchy levels: ${validationResults.hierarchyLevels}`);
    console.log(`✓ Error count: ${errorCount}`);
    console.log(`✓ Import duration: ${duration} seconds`);
    
    if (errorCount < 100 && processedCount > 20000) {
      console.log('\n🌟 SUCCESS: Full CWR catalog imported successfully!');
      console.log('Enhanced category management system ready for production use');
      return true;
    } else {
      console.log('\n⚠️ Import completed with issues - please review error logs');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    return false;
  }
}

// Run the full import
runFullImport()
  .then(success => {
    if (success) {
      console.log('\n✅ Full catalog import successful - System ready for production');
      process.exit(0);
    } else {
      console.log('\n❌ Import failed or incomplete - Please review and retry');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });