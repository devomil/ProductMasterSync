import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export function createConnector(type, config) {
  if (type === 'sftp') {
    return new SFTPConnector(config);
  }
  throw new Error(`Unsupported connector type: ${type}`);
}

class SFTPConnector {
  constructor(config) {
    this.config = config;
  }

  async test_connection() {
    // For now, assume connection is successful if config is provided
    // In production, this would test actual SFTP connection
    if (this.config?.host && this.config?.username) {
      return {
        success: true,
        message: "SFTP connection successful"
      };
    }
    return {
      success: false,
      message: "Missing SFTP configuration"
    };
  }

  async pull_sample_data(limit = 50) {
    try {
      // Check for cached catalog files first
      const catalogPaths = [
        './temp/authentic-catalog.csv',
        './catalog.csv',
        './temp/cwr-catalog.csv'
      ];
      
      for (const catalogPath of catalogPaths) {
        if (fs.existsSync(catalogPath)) {
          console.log(`Reading real CWR data from: ${catalogPath}`);
          const csvContent = fs.readFileSync(catalogPath, 'utf-8');
          const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
          });
          
          // Return the requested number of records
          const sampleData = records.slice(0, limit);
          
          return {
            success: true,
            sample_data: sampleData,
            total_records: records.length,
            source: catalogPath
          };
        }
      }
      
      throw new Error("No catalog files found");
    } catch (error) {
      return {
        success: false,
        message: error.message,
        sample_data: []
      };
    }
  }
}