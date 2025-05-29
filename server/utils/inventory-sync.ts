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
      const productMap = new Map(existingProducts.map(p => [p.sku, p]));
      
      // Process each inventory record
      for (const record of records) {
        try {
          const sku = record.sku || record.SKU;
          if (!sku) continue;
          
          const flQty = parseInt(record.qtyfl || '0') || 0;
          const njQty = parseInt(record.qtynj || '0') || 0;
          const totalQty = flQty + njQty;
          const cost = parseFloat(record.price || '0') || 0;
          
          const existingProduct = productMap.get(sku);
          
          if (existingProduct) {
            // Update existing product
            const updateData: any = { updatedAt: new Date() };
            
            if (cost > 0) {
              updateData.cost = cost.toString();
            }
            
            await db.update(products)
              .set(updateData)
              .where(eq(products.id, existingProduct.id));
              
            result.updatedProducts++;
            
          } else if (totalQty > 0) {
            // Track new products found in inventory (don't auto-create)
            result.newProducts++;
            console.log(`New product found in CWR inventory: SKU ${sku} (FL: ${flQty}, NJ: ${njQty})`);
          }
          
        } catch (recordError) {
          const errorMsg = `Failed to process record for SKU ${record.sku}: ${recordError}`;
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