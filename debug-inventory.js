import SftpClient from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';

async function debugInventoryData() {
  const sftp = new SftpClient();
  
  try {
    // Connect to CWR SFTP
    await sftp.connect({
      host: 'ftp.cwrwholesale.com',
      username: 'authentic',
      password: process.env.SFTP_PASSWORD,
      port: 22
    });
    
    console.log('Connected to CWR SFTP');
    
    // Download first few lines of inventory file
    const inventoryPath = '/eco8/out/inventory.csv';
    const fileStream = await sftp.get(inventoryPath);
    
    let csvData = '';
    for await (const chunk of fileStream) {
      csvData += chunk.toString();
      // Stop after getting enough data for analysis
      if (csvData.length > 5000) break;
    }
    
    // Parse the CSV to understand structure
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log('\n=== INVENTORY FILE STRUCTURE ===');
    console.log('Field names:', Object.keys(records[0]));
    console.log('\nFirst 3 records:');
    records.slice(0, 3).forEach((record, i) => {
      console.log(`\nRecord ${i + 1}:`, record);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sftp.end();
  }
}

debugInventoryData();