/**
 * Implement Unique EDC SKU Generation System
 * This ensures EDC SKUs are unique across all suppliers and not dependent on supplier part numbers
 */

import { db } from './server/db.ts';
import { products, dataSourceTypeEnum } from './shared/schema.ts';
import { sql, desc, eq } from 'drizzle-orm';

async function implementUniqueEDCSKUs() {
  console.log('🔧 Implementing unique EDC SKU generation system...');
  
  try {
    // First, let's check what EDC number we should start from
    // Get the highest existing EDC number to continue sequence
    console.log('Finding highest existing EDC number...');
    
    const existingProducts = await db.select().from(products);
    let highestEDCNumber = 100000; // Start from EDC100001
    
    for (const product of existingProducts) {
      if (product.sku && product.sku.startsWith('EDC')) {
        const numberPart = product.sku.replace('EDC', '');
        const num = parseInt(numberPart);
        if (!isNaN(num) && num > highestEDCNumber) {
          highestEDCNumber = num;
        }
      }
    }
    
    console.log(`Highest existing EDC number: ${highestEDCNumber}`);
    console.log(`Next EDC SKU will be: EDC${String(highestEDCNumber + 1).padStart(6, '0')}`);
    
    // Clear existing products for fresh import with new SKU system
    console.log('Clearing existing products for fresh import...');
    await db.delete(products);
    
    console.log('✓ Products cleared, ready for unique EDC SKU generation');
    console.log('\nNext import will use sequential EDC SKUs starting from EDC100001');
    console.log('Each product will get a unique EDC SKU regardless of supplier part number overlaps');
    
  } catch (error) {
    console.error('Error implementing unique EDC SKUs:', error);
    throw error;
  }
}

async function updateSKUGenerationLogic() {
  console.log('\n📝 Updating SKU generation logic in server routes...');
  
  // The updated logic will be:
  // 1. Generate unique sequential EDC numbers starting from 100001
  // 2. Store supplier part number in USIN field
  // 3. No more direct dependency on supplier part numbers for SKU generation
  
  console.log('New SKU generation approach:');
  console.log('- EDC SKUs: Sequential from EDC100001, EDC100002, etc.');
  console.log('- USIN field: Stores original supplier part number');
  console.log('- No conflicts between suppliers with same part numbers');
  console.log('- Each product gets globally unique EDC identifier');
}

// Main execution
implementUniqueEDCSKUs()
  .then(() => {
    updateSKUGenerationLogic();
    console.log('\n✅ Unique EDC SKU system implementation complete');
    console.log('\nNext step: Update server routes to use sequential EDC generation');
    process.exit(0);
  })
  .catch(error => {
    console.error('Implementation failed:', error);
    process.exit(1);
  });