/**
 * Automated inventory synchronization system for CWR data pulls
 * Connects to authentic CWR SFTP and updates all product inventory
 */

import { parse as parseCsv } from 'csv-parse/sync';
import { db } from '../db';
import { products } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface InventorySyncResult {
  success: boolean;
  totalRecords: number;
  updatedProducts: number;
  newProducts: number;
  errors: string[];
  timestamp: Date;
}

export class InventorySync {
  
  /**
   * Sync all inventory from CWR SFTP /eco8/out/inventory.csv
   */
  async syncFromCWR(): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      success: false,
      totalRecords: 0,
      updatedProducts: 0,
      newProducts: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      console.log('Starting automated CWR inventory sync...');
      
      // Connect to authentic CWR SFTP
      const { default: Client } = await import('ssh2-sftp-client');
      const sftp = new Client();
      
      await sftp.connect({
        host: 'edi.cwrdistribution.com',
        port: 22,
        username: 'eco8',
        password: 'jwS3~eIy'
      });
      
      // Download complete inventory file
      const csvContent = await sftp.get('/eco8/out/inventory.csv');
      await sftp.end();
      
      // Parse all inventory records
      const records = parseCsv(csvContent.toString(), {
        columns: true,
        skip_empty_lines: true
      });
      
      result.totalRecords = records.length;
      console.log(`Processing ${records.length} inventory records from CWR`);
      
      // Get all existing products
      const existingProducts = await db.select().from(products);
      console.log(`[SYNC DEBUG] Found ${existingProducts.length} existing products in database`);
      
      // Create map by manufacturer part number AND SKU for matching
      const productMapByMPN = new Map(existingProducts.map(p => [p.manufacturerPartNumber, p]));
      const productMapBySKU = new Map(existingProducts.map(p => [p.sku, p]));
      
      console.log(`[SYNC DEBUG] Created MPN map with ${productMapByMPN.size} entries`);
      console.log(`[SYNC DEBUG] Created SKU map with ${productMapBySKU.size} entries`);
      
      // Debug: show some sample MPNs in our database
      const sampleMPNs = Array.from(productMapByMPN.keys()).filter(mpn => mpn).slice(0, 10);
      console.log(`[SYNC DEBUG] Sample MPNs in database:`, sampleMPNs);
      
      // Process each inventory record
      for (const record of records) {
        try {
          const inventorySku = record.sku || record.SKU;
          const inventoryMPN = record.mpn || record.MPN || record.manufacturerpartnumber || record.manufacturerPartNumber;
          if (!inventorySku && !inventoryMPN) continue;
          
          // Debug: log first few records to understand field structure
          if (result.updatedProducts + result.newProducts < 3) {
            console.log(`[INVENTORY DEBUG] Record ${result.updatedProducts + result.newProducts + 1}:`);
            console.log('Available fields:', Object.keys(record));
            console.log('Full record:', JSON.stringify(record, null, 2));
          }
          
          const flQty = parseInt(record.qtyfl || '0') || 0;
          const njQty = parseInt(record.qtynj || '0') || 0;
          const totalQty = flQty + njQty;
          const cost = parseFloat(record.price || '0') || 0;
          
          // Try to find product by manufacturer part number first, then by SKU
          let existingProduct = null;
          let matchType = '';
          
          if (inventoryMPN && productMapByMPN.has(inventoryMPN)) {
            existingProduct = productMapByMPN.get(inventoryMPN);
            matchType = 'MPN';
          } else if (inventorySku && productMapBySKU.has(inventorySku)) {
            existingProduct = productMapBySKU.get(inventorySku);
            matchType = 'SKU';
          }
          
          if (existingProduct) {
            // Update existing product with inventory quantity
            const updateData: any = { 
              updatedAt: new Date(),
              inventoryQuantity: totalQty
            };
            
            if (cost > 0) {
              updateData.cost = cost.toString();
            }
            
            console.log(`[UPDATE DEBUG] Updating product ID ${existingProduct.id}, SKU ${existingProduct.sku} with:`, updateData);
            
            const updateResult = await db.update(products)
              .set(updateData)
              .where(eq(products.id, existingProduct.id));
              
            console.log(`[UPDATE RESULT] Updated rows:`, updateResult);
            
            result.updatedProducts++;
            console.log(`Updated product ${existingProduct.sku} (${matchType}): FL=${flQty}, NJ=${njQty}, Total=${totalQty}`);
            
          } else if (totalQty > 0) {
            // Track new products found in inventory (don't auto-create)
            result.newProducts++;
            console.log(`New product found in CWR inventory: SKU ${inventorySku}, MPN ${inventoryMPN} (FL: ${flQty}, NJ: ${njQty})`);
          }
          
        } catch (recordError) {
          const errorMsg = `Failed to process record for SKU ${inventorySku}: ${recordError}`;
          result.errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }
      
      result.success = true;
      console.log(`CWR inventory sync completed: ${result.updatedProducts} updated, ${result.newProducts} new products found`);
      
    } catch (error) {
      const errorMsg = `CWR inventory sync failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
    
    return result;
  }
  
  /**
   * Get current inventory status for a specific SKU
   */
  async getInventoryForSKU(sku: string): Promise<{ fl: number, nj: number, cost: number } | null> {
    try {
      const { default: Client } = await import('ssh2-sftp-client');
      const sftp = new Client();
      
      await sftp.connect({
        host: 'edi.cwrdistribution.com',
        port: 22,
        username: 'eco8',
        password: 'jwS3~eIy'
      });
      
      const csvContent = await sftp.get('/eco8/out/inventory.csv');
      await sftp.end();
      
      const records = parseCsv(csvContent.toString(), {
        columns: true,
        skip_empty_lines: true
      });
      
      const record = records.find((r: any) => r.sku === sku || r.SKU === sku);
      
      if (record) {
        return {
          fl: parseInt(record.qtyfl || '0') || 0,
          nj: parseInt(record.qtynj || '0') || 0,
          cost: parseFloat(record.price || '0') || 0
        };
      }
      
      return null;
      
    } catch (error) {
      console.error(`Failed to get inventory for SKU ${sku}:`, error);
      return null;
    }
  }
}

export const inventorySync = new InventorySync();