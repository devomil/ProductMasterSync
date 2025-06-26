import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

async function importCatalogFields() {
  console.log('Importing CWR catalog fields and categories...');
  
  try {
    const csvPath = './temp/authentic-catalog.csv';
    const records = [];
    const categoryMap = new Map();
    
    // Parse first 100 lines to avoid quote parsing errors
    let lineCount = 0;
    const maxLines = 100;
    
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const lines = fileContent.split('\n');
    
    console.log(`Processing first ${maxLines} lines from CSV...`);
    
    // Process header
    const header = lines[0].split(',').map(h => h.replace(/"/g, ''));
    
    for (let i = 1; i < Math.min(lines.length, maxLines); i++) {
      if (!lines[i].trim()) continue;
      
      try {
        // Simple CSV parsing for category extraction
        const fields = lines[i].split(',');
        if (fields.length < 18) continue;
        
        const cwrPartNumber = fields[0]?.replace(/"/g, '');
        const categoryName = fields[17]?.replace(/"/g, '');
        
        if (cwrPartNumber && categoryName) {
          records.push({
            cwrPartNumber,
            categoryName
          });
          
          // Parse hierarchical categories (e.g., "Lighting | Bulbs")
          if (categoryName.includes('|')) {
            const categoryParts = categoryName.split('|').map(c => c.trim());
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
            if (!categoryMap.has(categoryName)) {
              categoryMap.set(categoryName, {
                name: categoryName,
                code: categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                level: 0,
                path: categoryName,
                parentPath: null
              });
            }
          }
        }
      } catch (error) {
        console.log(`Skipping line ${i} due to parsing error`);
      }
    }
    
    console.log(`Found ${records.length} products with categories`);
    console.log(`Discovered ${categoryMap.size} unique categories`);
    
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
    
    for (const record of records) {
      try {
        const categoryId = categoryIdMap.get(record.categoryName);
        if (categoryId) {
          const result = await sql`
            UPDATE products 
            SET category_id = ${categoryId}
            WHERE usin = ${record.cwrPartNumber}
            RETURNING id, sku, name
          `;
          
          if (result.length > 0) {
            const product = result[0];
            console.log(`✓ Updated ${product.sku} with category: ${record.categoryName}`);
            updatedProductCount++;
          }
        }
      } catch (error) {
        console.error(`Error updating product ${record.cwrPartNumber}:`, error.message);
      }
    }
    
    console.log(`\nCategory import complete!`);
    console.log(`- Created ${categoryMap.size} categories`);
    console.log(`- Updated ${updatedProductCount} products with categories`);
    
  } catch (error) {
    console.error('Error importing catalog fields:', error);
  }
}

importCatalogFields();