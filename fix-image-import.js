/**
 * Fix Image Import - Clear and reimport products with proper image mapping
 */

import { db } from './server/db.ts';
import { products } from './shared/schema.ts';

async function clearAndReimportWithImages() {
  console.log('🖼️  Fixing product image import...');
  
  try {
    // Clear existing products
    console.log('Clearing existing products...');
    await db.delete(products);
    console.log('✓ Products cleared');
    
    // Trigger fresh import with corrected image mappings
    console.log('Triggering fresh import with image mappings...');
    const response = await fetch('http://localhost:5000/api/datasources/10/sample-pull-with-mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: 5 })
    });
    
    const result = await response.json();
    console.log('Import result:', result);
    
    // Check if images were imported
    console.log('\nChecking imported products for images...');
    const importedProducts = await db.select().from(products).limit(5);
    
    for (const product of importedProducts) {
      console.log(`\nProduct: ${product.sku} - ${product.name}`);
      console.log(`  Image URL: ${product.imageUrl || 'NOT SET'}`);
      console.log(`  Large Image URL: ${product.imageUrlLarge || 'NOT SET'}`);
      console.log(`  Additional Images: ${product.additionalImages || 'NOT SET'}`);
    }
    
    const hasImages = importedProducts.some(p => p.imageUrl || p.imageUrlLarge);
    
    if (hasImages) {
      console.log('\n✅ Images successfully imported! Product gallery should now show images.');
    } else {
      console.log('\n❌ Images still not importing. Need to debug mapping process.');
    }
    
  } catch (error) {
    console.error('Error fixing image import:', error);
  }
}

clearAndReimportWithImages()
  .then(() => {
    console.log('\n🎯 Image import fix complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });