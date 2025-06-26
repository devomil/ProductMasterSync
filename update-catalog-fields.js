import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function updateCatalogFields() {
  console.log('Creating categories from CWR catalog data...');
  
  // Manual extraction of category data from the first few records to establish correct categories
  const categoryData = [
    { usin: '10020', categoryName: 'Paddlesports | Safety' },
    { usin: '10021', categoryName: 'Lighting | Bulbs' },
    { usin: '10024', categoryName: 'Lighting | Bulbs' },
    { usin: '10025', categoryName: 'Lighting | Accessories' },
    { usin: '10026', categoryName: 'Lighting | Bulbs' },
    { usin: '10027', categoryName: 'Lighting | Accessories' },
    { usin: '10030', categoryName: 'Lighting | Accessories' },
    { usin: '10341', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10342', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10345', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10348', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10349', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10350', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10351', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10352', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10353', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10354', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10355', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10357', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10360', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10361', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10366', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10367', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10368', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10369', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10373', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10374', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10377', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10378', categoryName: 'Marine Navigation & Instruments | Compasses' },
    { usin: '10391', categoryName: 'Communication | Hailer Horns' }
  ];
  
  const categoryMap = new Map();
  
  // Process hierarchical categories
  for (const item of categoryData) {
    if (item.categoryName.includes('|')) {
      const categoryParts = item.categoryName.split('|').map(c => c.trim());
      let currentPath = '';
      
      for (let level = 0; level < categoryParts.length; level++) {
        const categoryPart = categoryParts[level];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath} | ${categoryPart}` : categoryPart;
        
        if (!categoryMap.has(currentPath)) {
          categoryMap.set(currentPath, {
            name: categoryPart,
            code: categoryPart.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            level: level,
            path: currentPath,
            parentPath: parentPath || null
          });
        }
      }
    } else {
      // Single level category
      if (!categoryMap.has(item.categoryName)) {
        categoryMap.set(item.categoryName, {
          name: item.categoryName,
          code: item.categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          level: 0,
          path: item.categoryName,
          parentPath: null
        });
      }
    }
  }
  
  console.log(`Creating ${categoryMap.size} categories from CWR data...`);
  
  // Insert categories in hierarchical order (parents first)
  const categoriesByLevel = Array.from(categoryMap.values()).sort((a, b) => a.level - b.level);
  const categoryIdMap = new Map();
  
  for (const category of categoriesByLevel) {
    try {
      // Find parent category ID if exists
      let parentId = null;
      if (category.parentPath) {
        parentId = categoryIdMap.get(category.parentPath);
      }
      
      // Insert or get existing category
      const existingCategory = await sql`
        SELECT id FROM categories WHERE code = ${category.code} AND name = ${category.name}
      `;
      
      let categoryId;
      if (existingCategory.length > 0) {
        categoryId = existingCategory[0].id;
        console.log(`✓ Found existing category: ${category.path}`);
      } else {
        const result = await sql`
          INSERT INTO categories (name, code, level, path, parent_id, created_at, updated_at)
          VALUES (${category.name}, ${category.code}, ${category.level}, ${category.path}, ${parentId}, NOW(), NOW())
          RETURNING id
        `;
        categoryId = result[0].id;
        console.log(`✓ Created category: ${category.path}`);
      }
      
      categoryIdMap.set(category.path, categoryId);
    } catch (error) {
      console.error(`Error creating category ${category.name}:`, error.message);
    }
  }
  
  // Update products with their categories
  let updatedProductCount = 0;
  
  for (const item of categoryData) {
    try {
      const categoryId = categoryIdMap.get(item.categoryName);
      if (categoryId) {
        const result = await sql`
          UPDATE products 
          SET category_id = ${categoryId}
          WHERE usin = ${item.usin}
          RETURNING id, sku, name
        `;
        
        if (result.length > 0) {
          const product = result[0];
          console.log(`✓ Updated ${product.sku} with category: ${item.categoryName}`);
          updatedProductCount++;
        }
      }
    } catch (error) {
      console.error(`Error updating product ${item.usin}:`, error.message);
    }
  }
  
  console.log(`\nCategory update complete!`);
  console.log(`- Created/verified ${categoryMap.size} categories`);
  console.log(`- Updated ${updatedProductCount} products with proper categories`);
}

updateCatalogFields();