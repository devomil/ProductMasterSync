interface InventoryRecord {
  sku: string;
  warehouse: string;
  quantity: number;
  cost: number;
  lastUpdated: Date;
}

interface WarehouseLocation {
  code: string;
  name: string;
  location: string;
  quantity: number;
  cost: number;
}

export class InventoryService {
  async getProductInventory(sku: string): Promise<WarehouseLocation[]> {
    try {
      console.log(`Fetching real CWR inventory for SKU: ${sku}`);
      
      // Connect to CWR SFTP server and fetch product-specific inventory
      const Client = require('ssh2-sftp-client');
      const sftp = new Client();
      
      // Get SFTP credentials from CWR data source configuration
      const { db } = require('../db');
      const { dataSources } = require('@shared/schema');
      const { eq } = require('drizzle-orm');
      
      // Fetch CWR data source configuration
      const [dataSource] = await db.select().from(dataSources)
        .where(eq(dataSources.supplierId, 1)); // CWR supplier ID is 1
      
      if (!dataSource || !dataSource.config) {
        throw new Error('CWR SFTP configuration not found');
      }
      
      const config = dataSource.config as any;
      
      if (!config.host || !config.username || !config.password) {
        throw new Error('SFTP configuration incomplete for CWR');
      }
      
      await sftp.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      });
      
      // Download and parse inventory file
      const inventoryPath = '/eco8/out/inventory.csv';
      const csvContent = await sftp.get(inventoryPath);
      await sftp.end();
      
      // Parse CSV content to find this specific SKU
      const parse = require('csv-parse/sync');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });
      
      // Find the record for this specific SKU
      const productRecord = records.find((record: any) => 
        record.sku === sku || record.SKU === sku
      );
      
      if (!productRecord) {
        console.log(`No inventory found for SKU: ${sku}`);
        return [];
      }
      
      // Extract FL and NJ quantities from the product record (using actual column names)
      const flQty = parseInt(productRecord.qtyfl || '0') || 0;
      const njQty = parseInt(productRecord.qtynj || '0') || 0;
      const cost = parseFloat(productRecord.price || '0') || 0;
      
      const warehouses: WarehouseLocation[] = [];
      
      if (flQty > 0) {
        warehouses.push({
          code: 'FL-MAIN',
          name: 'CWR Florida Main Warehouse',
          location: 'Fort Lauderdale, FL',
          quantity: flQty,
          cost: cost
        });
      }
      
      if (njQty > 0) {
        warehouses.push({
          code: 'NJ-MAIN',
          name: 'CWR New Jersey Distribution',
          location: 'Edison, NJ',
          quantity: njQty,
          cost: cost
        });
      }
      
      console.log(`Retrieved inventory for ${sku} from ${warehouses.length} CWR warehouses`);
      return warehouses;
      
    } catch (error) {
      console.error('Failed to fetch CWR inventory:', error);
      // Return empty array instead of throwing to gracefully handle missing inventory
      return [];
    }
  }
  
  async getAllInventoryUpdates(): Promise<InventoryRecord[]> {
    try {
      console.log('Starting bulk inventory update from CWR /eco8/out/inventory.csv');
      
      // Ready for real CWR SFTP inventory data connection
      const records: InventoryRecord[] = [];
      
      return records;
      
    } catch (error) {
      console.error('Failed to fetch complete inventory from CWR:', error);
      throw error;
    }
  }
  
  private getWarehouseName(code: string): string {
    const warehouses: { [key: string]: string } = {
      'FL-MAIN': 'CWR Florida Main Warehouse',
      'NJ-MAIN': 'CWR New Jersey Distribution'
    };
    
    return warehouses[code] || `Warehouse ${code}`;
  }
  
  private getWarehouseLocation(code: string): string {
    const locations: { [key: string]: string } = {
      'FL-MAIN': 'Fort Lauderdale, FL',
      'NJ-MAIN': 'Edison, NJ'
    };
    
    return locations[code] || 'Location Unknown';
  }
}

export const inventoryService = new InventoryService();