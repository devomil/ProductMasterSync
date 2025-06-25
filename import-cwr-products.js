/**
 * Import CWR products using the mapping template
 */

import { db } from './server/db.js';
import { products, categories } from './shared/schema.js';

async function importCWRProducts() {
  try {
    console.log('Starting CWR product import...');
    
    // Get sample data from CWR to process
    const response = await fetch('http://localhost:5000/api/test-pull/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Failed to get CWR data: ${result.message}`);
    }
    
    const cwrData = result.sample_data || [];
    console.log(`Processing ${cwrData.length} CWR products...`);
    
    let imported = 0;
    
    for (const item of cwrData) {
      try {
        // Map CWR fields to our product schema
        const product = {
          sku: item['CWR Part Number'],
          name: item['Uppercase Title'] || `CWR Product ${item['CWR Part Number']}`,
          manufacturerPartNumber: item['Manufacturer Part Number'] || null,
          upc: item['UPC Code'] || null,
          cost: parseFloat(item['Your Cost']) || 0,
          price: parseFloat(item['List Price']) || 0,
          inventoryQuantity: parseInt(item['Quantity Available to Ship (Combined)']) || 0,
          status: 'active',
          // Store additional CWR specific data
          attributes: {
            cwrPartNumber: item['CWR Part Number'],
            mapPrice: item['M.A.P. Price'] || null,
            mrpPrice: item['M.R.P. Price'] || null,
            njStock: item['Quantity Available to Ship (NJ)'] || null,
            flStock: item['Quantity Available to Ship (FL)'] || null
          }
        };
        
        // Insert product into database
        await db.insert(products).values(product).onConflictDoNothing();
        imported++;
        
      } catch (error) {
        console.error(`Error importing product ${item['CWR Part Number']}:`, error.message);
      }
    }
    
    console.log(`Successfully imported ${imported} CWR products`);
    
    // Get final count
    const totalProducts = await db.select().from(products);
    console.log(`Total products in catalog: ${totalProducts.length}`);
    
  } catch (error) {
    console.error('Import failed:', error.message);
  }
}

importCWRProducts();