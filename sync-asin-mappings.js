/**
 * Sync ASIN mappings from existing Amazon data to product ASIN mapping table
 * This ensures the opportunities endpoint has proper ASIN associations
 */

const { db } = require('./server/db.js');
const { products, productAsinMapping, amazonAsins } = require('./shared/schema.js');
const { eq, and, isNotNull, notExists } = require('drizzle-orm');

async function syncAsinMappings() {
  try {
    console.log('Starting ASIN mapping sync...');

    // Get products that have UPC but no ASIN mappings
    const productsNeedingMappings = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        upc: products.usin
      })
      .from(products)
      .where(and(
        isNotNull(products.usin),
        notExists(
          db.select().from(productAsinMapping).where(eq(productAsinMapping.productId, products.id))
        )
      ))
      .limit(50);

    console.log(`Found ${productsNeedingMappings.length} products needing ASIN mappings`);

    // Get existing Amazon ASINs that match product UPCs
    const existingAsins = await db
      .select({
        asin: amazonAsins.asin,
        upc: amazonAsins.upc,
        title: amazonAsins.title
      })
      .from(amazonAsins)
      .where(isNotNull(amazonAsins.upc));

    console.log(`Found ${existingAsins.length} existing ASINs with UPC data`);

    let mappingsCreated = 0;

    // Create mappings based on UPC matches
    for (const product of productsNeedingMappings) {
      const matchingAsins = existingAsins.filter(asin => asin.upc === product.upc);
      
      if (matchingAsins.length > 0) {
        console.log(`Creating ${matchingAsins.length} ASIN mappings for product ${product.sku} (UPC: ${product.upc})`);
        
        for (const asin of matchingAsins) {
          try {
            await db.insert(productAsinMapping).values({
              productId: product.id,
              asin: asin.asin,
              mappingSource: 'upc_match',
              matchConfidence: 0.9,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            mappingsCreated++;
            console.log(`  ✓ Mapped ASIN ${asin.asin} to product ${product.sku}`);
          } catch (error) {
            console.error(`  ✗ Failed to map ASIN ${asin.asin}:`, error.message);
          }
        }
      }
    }

    console.log(`\nSync complete: Created ${mappingsCreated} ASIN mappings`);

    // Verify mappings
    const totalMappings = await db.select({ count: 'count(*)' }).from(productAsinMapping);
    console.log(`Total ASIN mappings in database: ${totalMappings[0]?.count || 0}`);

  } catch (error) {
    console.error('Error syncing ASIN mappings:', error);
  }
}

syncAsinMappings();