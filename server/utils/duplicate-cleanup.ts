import { DatabaseStorage } from '../database-storage-simplified';

const storage = new DatabaseStorage();

export async function cleanupDuplicateUPCs() {
  try {
    // Get all products
    const allProducts = await storage.getProducts();
    
    // Group products by UPC
    const upcGroups: { [key: string]: any[] } = {};
    
    allProducts.forEach(product => {
      if (product.upc) {
        if (!upcGroups[product.upc]) {
          upcGroups[product.upc] = [];
        }
        upcGroups[product.upc].push(product);
      }
    });
    
    // Find duplicates
    const duplicates = Object.entries(upcGroups).filter(([upc, products]) => products.length > 1);
    
    let mergedCount = 0;
    let deletedCount = 0;
    
    // Process each set of duplicates
    for (const [upc, products] of duplicates) {
      // Sort by ID to keep the first one and merge others into it
      products.sort((a, b) => a.id - b.id);
      const primaryProduct = products[0];
      const duplicatesToRemove = products.slice(1);
      
      console.log(`Processing UPC ${upc}: keeping product ${primaryProduct.id}, removing ${duplicatesToRemove.length} duplicates`);
      
      // Delete the duplicate products
      for (const duplicate of duplicatesToRemove) {
        await storage.deleteProduct(duplicate.id);
        deletedCount++;
      }
      
      mergedCount++;
    }
    
    return {
      success: true,
      duplicatesFound: duplicates.length,
      productsDeleted: deletedCount,
      upcGroupsProcessed: mergedCount,
      details: duplicates.map(([upc, products]) => ({
        upc,
        duplicateCount: products.length,
        productIds: products.map(p => p.id)
      }))
    };
    
  } catch (error) {
    console.error('Error in duplicate cleanup:', error);
    throw error;
  }
}