/**
 * One-time script to re-check all listing restrictions with the fixed logic
 * This will update amazon_asins.can_list with correct values
 */

import { db } from '../db';
import { amazonAsins } from '@shared/schema';
import { amazonListingsRestrictionsService } from '../marketplace/amazon-listings-restrictions';
import { isNotNull } from 'drizzle-orm';

async function recheckAllListingRestrictions() {
  console.log('[Recheck] Starting batch listing restrictions re-check...');
  
  // Get all ASINs that need checking
  const asins = await db
    .select({ asin: amazonAsins.asin })
    .from(amazonAsins)
    .where(isNotNull(amazonAsins.asin));
  
  console.log(`[Recheck] Found ${asins.length} ASINs to check`);
  console.log(`[Recheck] Rate limit: 5 req/sec (Amazon Listings Restrictions API)`);
  console.log(`[Recheck] Estimated time: ${Math.ceil(asins.length / 5 / 60)} minutes`);
  
  const BATCH_SIZE = 50; // Process 50 at a time
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < asins.length; i += BATCH_SIZE) {
    const batch = asins.slice(i, Math.min(i + BATCH_SIZE, asins.length));
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(asins.length / BATCH_SIZE);
    
    console.log(`\n[Recheck] Processing batch ${batchNumber}/${totalBatches} (ASINs ${i + 1}-${Math.min(i + BATCH_SIZE, asins.length)})`);
    
    try {
      // Use the service's built-in batch method with rate limiting
      const results = await amazonListingsRestrictionsService.batchGetListingsRestrictions(
        batch.map(a => a.asin),
        ['ATVPDKIKX0DER'], // US marketplace
        'new_new'
      );
      
      // Update database with results
      for (const result of results) {
        try {
          if (result.error) {
            console.log(`[Recheck]   ❌ ${result.asin}: ${result.error}`);
            errorCount++;
            continue;
          }
          
          const listingStatus = amazonListingsRestrictionsService.isListingAllowed(result.restrictions, 'new_new');
          
          // Update amazon_asins table
          await db
            .update(amazonAsins)
            .set({ 
              canList: listingStatus.allowed,
              updatedAt: new Date()
            })
            .where(eq(amazonAsins.asin, result.asin));
          
          const status = listingStatus.allowed ? '✅ Approved' : 
                        listingStatus.needsApproval ? '⚠️  Needs Approval' : 
                        '❌ Restricted';
          
          console.log(`[Recheck]   ${status}: ${result.asin}`);
          successCount++;
        } catch (updateError) {
          console.error(`[Recheck]   ❌ Error updating ${result.asin}:`, updateError);
          errorCount++;
        }
      }
    } catch (batchError) {
      console.error(`[Recheck] Batch ${batchNumber} failed:`, batchError);
      errorCount += batch.length;
    }
    
    // Progress update
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const processed = Math.min(i + BATCH_SIZE, asins.length);
    const remaining = asins.length - processed;
    const rate = processed / elapsed;
    const eta = remaining > 0 ? Math.ceil(remaining / rate) : 0;
    
    console.log(`[Recheck] Progress: ${processed}/${asins.length} | Success: ${successCount} | Errors: ${errorCount} | ETA: ${Math.floor(eta / 60)}m ${eta % 60}s`);
  }
  
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n[Recheck] ===== COMPLETE =====`);
  console.log(`[Recheck] Total: ${asins.length}`);
  console.log(`[Recheck] Success: ${successCount}`);
  console.log(`[Recheck] Errors: ${errorCount}`);
  console.log(`[Recheck] Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`[Recheck] Next step: Re-run Purchasing AI analysis to update opportunities`);
}

// Import eq for the update query
import { eq } from 'drizzle-orm';

// Run the script
recheckAllListingRestrictions()
  .then(() => {
    console.log('[Recheck] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Recheck] Script failed:', error);
    process.exit(1);
  });
