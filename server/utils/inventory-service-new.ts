import Client from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';

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
      
      const sftp = new Client();
      
      await sftp.connect({
        host: 'edi.cwrdistribution.com',
        port: 22,
        username: 'eco8',
        password: 'jwS3~eIy'
      });
      
      console.log(`Fetching live inventory from CWR SFTP for SKU: ${sku}`);
      
      // Download and parse inventory file
      const csvContent = await sftp.get('/eco8/out/inventory.csv');
      await sftp.end();
      
      // Parse CSV content to find this specific SKU
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
      
      // Extract FL and NJ quantities from the product record
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
      return [];
    }
  }
  
  async getAllInventoryUpdates(): Promise<InventoryRecord[]> {
    try {
      console.log('Starting bulk inventory update from CWR /eco8/out/inventory.csv');
      
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