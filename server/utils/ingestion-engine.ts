import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../db';
import { 
  products, 
  mappingTemplates, 
  imports, 
  connections, 
  productSuppliers,
  suppliers
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { processCSVFile, processExcelFile, processJSONFile } from './file-processor';
import { validateAndTransformRecords } from './validation';
import { ValidationRule } from '@shared/schema';

interface IngestionResult {
  success: boolean;
  message: string;
  importId?: number;
  recordCount: number;
  processedCount: number;
  validCount: number;
  errorCount: number;
  errors: Array<{
    recordIndex?: number;
    field?: string;
    message: string;
    record?: any;
  }>;
  warnings: Array<{
    recordIndex?: number;
    field?: string;
    message: string;
    record?: any;
  }>;
}

interface IngestionOptions {
  deleteSourceAfterProcessing?: boolean;
  createImportRecord?: boolean;
  skipExistingProducts?: boolean;
}

/**
 * Process data from an SFTP path using a mapping template
 * @param sftpPath The path on the SFTP server
 * @param connectionId The ID of the connection to use
 * @param mappingTemplateId The ID of the mapping template to use
 * @param options Additional options for the ingestion process
 * @returns Result of the ingestion process
 */
export async function processSFTPIngestion(
  sftpPath: string,
  connectionId: number,
  mappingTemplateId: number,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: false,
    message: '',
    recordCount: 0,
    processedCount: 0,
    validCount: 0,
    errorCount: 0,
    errors: [],
    warnings: []
  };

  try {
    // Get connection details
    const connectionDetails = await db.select()
      .from(connections)
      .where(eq(connections.id, connectionId))
      .limit(1);

    if (connectionDetails.length === 0) {
      result.message = `Connection with ID ${connectionId} not found`;
      result.errors.push({ message: 'Connection not found' });
      return result;
    }

    const connection = connectionDetails[0];
    
    if (connection.type !== 'sftp' && connection.type !== 'ftp') {
      result.message = 'Only SFTP/FTP connections are supported for this operation';
      result.errors.push({ message: 'Unsupported connection type' });
      return result;
    }

    if (!connection.supplierId) {
      result.message = 'Connection has no associated supplier';
      result.errors.push({ message: 'No supplier associated with connection' });
      return result;
    }

    // Get mapping template
    const mappingTemplateDetails = await db.select()
      .from(mappingTemplates)
      .where(eq(mappingTemplates.id, mappingTemplateId))
      .limit(1);

    if (mappingTemplateDetails.length === 0) {
      result.message = `Mapping template with ID ${mappingTemplateId} not found`;
      result.errors.push({ message: 'Mapping template not found' });
      return result;
    }
    
    const mappingTemplate = mappingTemplateDetails[0];

    // Create import record if requested
    let importId: number | undefined;
    
    if (options.createImportRecord) {
      // Extract filename from the SFTP path
      const filename = sftpPath.split('/').pop() || path.basename(sftpPath);
      
      // Determine file type from extension
      const fileExt = filename.split('.').pop()?.toLowerCase() || '';
      const fileType = fileExt === 'csv' ? 'csv' : 
                     fileExt === 'xlsx' || fileExt === 'xls' ? 'excel' : 
                     fileExt === 'json' ? 'json' : 'unknown';
      
      // Create import record
      const [importRecord] = await db.insert(imports)
        .values({
          filename: filename,
          supplierId: connection.supplierId,
          status: 'processing',
          type: fileType,
          sourceData: {
            connectionId,
            sftpPath,
            mappingTemplateId
          },
          mappingTemplate: JSON.stringify(mappingTemplate.mappings),
          createdAt: new Date()
        })
        .returning({ id: imports.id });
      
      importId = importRecord.id;
      result.importId = importId;
    }

    // Download and process the file
    // In a real implementation, you'd use the SFTP client to download the file
    // For this prototype, we'll assume the file has been downloaded to a temp directory
    
    // Use the real SFTP client to download the file
    // Using our ftp-ingestion utility that handles authentication and transfer
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }

    // Generate a temporary file name
    const tempFileName = `temp_${Date.now()}_${path.basename(sftpPath)}`;
    const localFilePath = path.join(tempDir, tempFileName);
    
    try {
      // Get connection credentials from the connection details
      const credentials = connection.credentials || {};
      
      if (!credentials.host || !credentials.username) {
        result.message = 'Invalid SFTP credentials: missing host or username';
        result.errors.push({ message: 'Invalid SFTP credentials' });
        
        if (importId) {
          await updateImportStatus(importId, 'error', result);
        }
        
        return result;
      }
      
      // Create an SFTP client
      const SFTPClient = require('ssh2').Client;
      const client = new SFTPClient();
      
      // Download the file
      const fileDownloaded = await new Promise<boolean>((resolve) => {
        // Set a timeout to avoid hanging connections
        const timeout = setTimeout(() => {
          client.end();
          console.error('SFTP connection timed out');
          resolve(false);
        }, 30000); // 30 seconds timeout
        
        client.on('ready', () => {
          clearTimeout(timeout);
          
          client.sftp((err, sftp) => {
            if (err) {
              console.error('Failed to start SFTP session:', err);
              client.end();
              resolve(false);
              return;
            }
            
            sftp.fastGet(sftpPath, localFilePath, {}, (err) => {
              if (err) {
                console.error(`Failed to download ${sftpPath}:`, err);
                client.end();
                resolve(false);
                return;
              }
              
              client.end();
              resolve(true);
            });
          });
        });
        
        client.on('error', (err) => {
          clearTimeout(timeout);
          console.error('SFTP connection error:', err);
          resolve(false);
        });
        
        // Apply environment secrets for authentication if needed
        const sftpPassword = process.env.SFTP_PASSWORD;
        
        // Connect to the SFTP server
        const connectConfig: any = {
          host: credentials.host,
          port: credentials.port || 22,
          username: credentials.username,
        };
        
        // Add authentication method (password or private key)
        if (credentials.password || sftpPassword) {
          connectConfig.password = credentials.password || sftpPassword;
        } else if (credentials.privateKey) {
          connectConfig.privateKey = credentials.privateKey;
          if (credentials.passphrase) {
            connectConfig.passphrase = credentials.passphrase;
          }
        }
        
        client.connect(connectConfig);
      });
      
      if (!fileDownloaded) {
        result.message = `Failed to download file from SFTP path: ${sftpPath}`;
        result.errors.push({ message: 'File download failed' });
        
        if (importId) {
          await updateImportStatus(importId, 'error', result);
        }
        
        return result;
      }
      
      // If we got here, the file was downloaded successfully
      console.log(`Successfully downloaded file to ${localFilePath}`);
      return localFilePath;
    } catch (error) {
      console.error('Error downloading file from SFTP:', error);
      result.message = `Error downloading file from SFTP: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push({ message: 'SFTP download error', details: error });
      
      if (importId) {
        await updateImportStatus(importId, 'error', result);
      }
      
      return null;
    }
    
    // Process the file based on type
    const fileExt = localFilePath.split('.').pop()?.toLowerCase() || '';
    let rawRecords: any[] = [];
    let headers: string[] = [];
    
    try {
      if (fileExt === 'csv') {
        const processed = await processCSVFile(localFilePath, {
          hasHeader: true,
          delimiter: ',',
          encoding: 'utf8'
        });
        rawRecords = processed.records;
        headers = processed.headers;
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        const processed = await processExcelFile(localFilePath);
        rawRecords = processed.records;
        headers = processed.headers;
      } else if (fileExt === 'json') {
        const processed = await processJSONFile(localFilePath);
        rawRecords = processed.records;
        headers = processed.headers;
      } else {
        throw new Error(`Unsupported file type: ${fileExt}`);
      }
      
      // Update record count in the import record
      if (importId) {
        await db.update(imports)
          .set({ recordCount: rawRecords.length })
          .where(eq(imports.id, importId));
      }
      
      result.recordCount = rawRecords.length;
      
      if (rawRecords.length === 0) {
        result.message = 'File contains no records';
        
        if (importId) {
          await updateImportStatus(importId, 'success', result);
        }
        
        return result;
      }
      
      // Parse the mapping template
      const fieldMappings = parseMappingTemplate(mappingTemplate);
      
      // Get validation rules
      const validationRules = Array.isArray(mappingTemplate.validationRules) 
        ? mappingTemplate.validationRules as ValidationRule[]
        : [];
      
      // Validate and transform records
      const { validRecords, invalidRecords } = validateAndTransformRecords(
        rawRecords,
        fieldMappings,
        validationRules
      );
      
      result.validCount = validRecords.length;
      result.errorCount = invalidRecords.length;
      
      // Process valid records
      for (let i = 0; i < validRecords.length; i++) {
        const record = validRecords[i];
        
        try {
          // Check if the product exists by SKU
          if (!record.sku) {
            result.errorCount++;
            result.errors.push({
              recordIndex: i,
              field: 'sku',
              message: 'Product SKU is missing or invalid',
              record
            });
            continue;
          }
          
          // Extract standard product fields
          const productData = {
            sku: record.sku,
            name: record.product_name || record.name || '',
            description: record.description || '',
            categoryId: record.category_id ? parseInt(record.category_id) : null,
            manufacturerId: record.manufacturer_id ? parseInt(record.manufacturer_id) : null,
            manufacturerName: record.manufacturer_name || record.manufacturer || '',
            manufacturerPartNumber: record.manufacturer_part_number || record.mpn || '',
            upc: record.upc || '',
            price: record.price || null,
            cost: record.cost || null,
            weight: record.weight || null,
            dimensions: record.dimensions || null,
            status: record.status || 'active',
            // Special flags
            isRemanufactured: record.is_remanufactured === true || record.remanufactured === true,
            isCloseout: record.is_closeout === true || record.closeout === true,
            isOnSale: record.is_on_sale === true || record.on_sale === true,
            hasRebate: record.has_rebate === true || record.rebate === true,
            hasFreeShipping: record.has_free_shipping === true || record.free_shipping === true,
            // Store any additional attributes
            attributes: extractAdditionalAttributes(record),
            updatedAt: new Date()
          };
          
          // Check if product already exists
          const existingProducts = await db.select({ id: products.id })
            .from(products)
            .where(eq(products.sku, productData.sku))
            .limit(1);
            
          let productId: number;
          
          if (existingProducts.length > 0) {
            // Update existing product if not skipping
            if (!options.skipExistingProducts) {
              productId = existingProducts[0].id;
              await db.update(products)
                .set(productData)
                .where(eq(products.id, productId));
            } else {
              // Skip this product
              productId = existingProducts[0].id;
              result.processedCount++;
              continue;
            }
          } else {
            // Create new product
            const [newProduct] = await db.insert(products)
              .values({
                ...productData,
                createdAt: new Date()
              })
              .returning({ id: products.id });
              
            productId = newProduct.id;
          }
          
          // Update or create product supplier relationship
          const existingRelation = await db.select({ id: productSuppliers.id })
            .from(productSuppliers)
            .where(and(
              eq(productSuppliers.productId, productId),
              eq(productSuppliers.supplierId, connection.supplierId)
            ))
            .limit(1);
            
          const supplierData = {
            supplierSku: record.supplier_sku || record.sku,
            supplierAttributes: record.supplier_attributes || {},
            isPrimary: !!record.is_primary || false
          };
          
          if (existingRelation.length > 0) {
            // Update existing relation
            await db.update(productSuppliers)
              .set(supplierData)
              .where(eq(productSuppliers.id, existingRelation[0].id));
          } else {
            // Create new relation
            await db.insert(productSuppliers)
              .values({
                ...supplierData,
                productId,
                supplierId: connection.supplierId,
                confidence: 100
              });
          }
          
          result.processedCount++;
          
          // Update import progress periodically
          if (importId && (i % 50 === 0 || i === validRecords.length - 1)) {
            await db.update(imports)
              .set({
                processedCount: result.processedCount,
                errorCount: result.errorCount
              })
              .where(eq(imports.id, importId));
          }
        } catch (error) {
          console.error(`Error processing record ${i + 1}:`, error);
          result.errorCount++;
          result.errors.push({
            recordIndex: i,
            message: error instanceof Error ? error.message : String(error),
            record
          });
        }
      }
      
      // Process invalid records - add them to errors
      invalidRecords.forEach((invalidRecord, index) => {
        result.errors.push({
          recordIndex: index,
          message: `Validation failed for record ${index + 1}`,
          record: invalidRecord.record
        });
        
        // Add specific field errors
        invalidRecord.errors.forEach(error => {
          result.errors.push({
            recordIndex: index,
            field: error.field,
            message: error.message
          });
        });
        
        // Add warnings
        invalidRecord.warnings.forEach(warning => {
          result.warnings.push({
            recordIndex: index,
            field: warning.field,
            message: warning.message
          });
        });
      });
      
      // Clean up the local file
      await fs.unlink(localFilePath);
      
      // Delete the source file if requested
      if (options.deleteSourceAfterProcessing) {
        await deleteFileFromSFTP(sftpPath, connection);
      }
      
      // Set success flag based on processed records
      result.success = result.processedCount > 0;
      result.message = `Processed ${result.processedCount} of ${result.recordCount} records. ${result.errorCount} records had errors.`;
      
      // Update import status
      if (importId) {
        const status = result.errorCount === 0 ? 'success' : 
                      result.processedCount > 0 ? 'success' : 'error';
        await updateImportStatus(importId, status, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error processing file:', error);
      result.message = `Error processing file: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push({ message: result.message });
      
      // Update import status
      if (importId) {
        await updateImportStatus(importId, 'error', result);
      }
      
      return result;
    }
  } catch (error) {
    console.error('Error in processSFTPIngestion:', error);
    result.message = `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push({ message: result.message });
    
    return result;
  }
}

/**
 * Parse the mapping template to get field mappings
 */
function parseMappingTemplate(template: any): Record<string, string> {
  if (!template || !template.mappings) {
    return {};
  }
  
  try {
    // If mappings is a string, try to parse it
    const mappings = typeof template.mappings === 'string' 
      ? JSON.parse(template.mappings) 
      : template.mappings;
    
    // Different possible formats for mappings
    if (Array.isArray(mappings)) {
      // Array of objects with source/target properties
      return mappings.reduce((acc, mapping) => {
        if (mapping.source && mapping.target) {
          acc[mapping.source] = mapping.target;
        }
        return acc;
      }, {} as Record<string, string>);
    } else if (typeof mappings === 'object') {
      // Direct object mapping
      return mappings as Record<string, string>;
    }
    
    return {};
  } catch (error) {
    console.error('Error parsing mapping template:', error);
    return {};
  }
}

/**
 * Extract additional attributes from a record
 */
function extractAdditionalAttributes(record: Record<string, any>): Record<string, any> {
  // Standard product fields that should not be included in attributes
  const standardFields = [
    'sku', 'name', 'product_name', 'description', 'category_id', 'manufacturer_id', 
    'manufacturer_name', 'manufacturer', 'manufacturer_part_number', 'mpn', 'upc',
    'price', 'cost', 'weight', 'dimensions', 'status', 'supplier_sku',
    'is_remanufactured', 'remanufactured', 'is_closeout', 'closeout',
    'is_on_sale', 'on_sale', 'has_rebate', 'rebate', 'has_free_shipping', 'free_shipping',
    'is_primary', 'supplier_attributes'
  ];
  
  const attributes: Record<string, any> = {};
  
  Object.entries(record).forEach(([key, value]) => {
    if (!standardFields.includes(key) && value !== undefined && value !== null) {
      attributes[key] = value;
    }
  });
  
  return attributes;
}

/**
 * Update the status of an import record
 */
async function updateImportStatus(
  importId: number, 
  status: string,
  result: IngestionResult
): Promise<void> {
  try {
    await db.update(imports)
      .set({
        status: status as any,
        recordCount: result.recordCount,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        importErrors: result.errors.length > 0 ? result.errors : [],
        completedAt: new Date()
      })
      .where(eq(imports.id, importId));
  } catch (error) {
    console.error('Error updating import status:', error);
  }
}

/**
 * Download a file from SFTP (placeholder implementation)
 * In a real application, this would use an SFTP client to download the file
 */
async function downloadFileFromSFTP(
  remotePath: string,
  connection: any
): Promise<string | null> {
  // This is a placeholder. In a real application, you would:
  // 1. Establish an SFTP connection using the credentials from the connection
  // 2. Download the file to a temp directory
  // 3. Return the local path to the downloaded file
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
    
    // Generate a temporary file name
    const tempFileName = `temp_${Date.now()}_${path.basename(remotePath)}`;
    const localFilePath = path.join(tempDir, tempFileName);
    
    console.log(`Simulating download of ${remotePath} to ${localFilePath}`);
    
    // In a real implementation, you would download the file here
    // For this prototype, we'll just return the local path
    return localFilePath;
  } catch (error) {
    console.error('Error downloading file from SFTP:', error);
    return null;
  }
}

/**
 * Delete a file from SFTP
 */
async function deleteFileFromSFTP(
  remotePath: string,
  connection: any
): Promise<boolean> {
  if (!connection || !connection.credentials) {
    console.error('Invalid connection object for deleting file');
    return false;
  }

  try {
    const credentials = connection.credentials || {};
    
    if (!credentials.host || !credentials.username) {
      console.error('Missing SFTP credentials for deleting file');
      return false;
    }
    
    // Create SFTP client
    const SFTPClient = require('ssh2').Client;
    const client = new SFTPClient();
    
    // Delete the file
    const result = await new Promise<boolean>((resolve) => {
      // Set timeout to avoid hanging
      const timeout = setTimeout(() => {
        client.end();
        console.error('SFTP connection timed out while deleting file');
        resolve(false);
      }, 30000); // 30 seconds timeout
      
      client.on('ready', () => {
        clearTimeout(timeout);
        
        client.sftp((err, sftp) => {
          if (err) {
            console.error('Failed to start SFTP session for deletion:', err);
            client.end();
            resolve(false);
            return;
          }
          
          // Delete the file
          sftp.unlink(remotePath, (err) => {
            if (err) {
              console.error(`Failed to delete ${remotePath}:`, err);
              client.end();
              resolve(false);
              return;
            }
            
            console.log(`Successfully deleted ${remotePath}`);
            client.end();
            resolve(true);
          });
        });
      });
      
      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('SFTP connection error during file deletion:', err);
        resolve(false);
      });
      
      // Apply environment secrets for authentication if needed
      const sftpPassword = process.env.SFTP_PASSWORD;
      
      // Connection config
      const connectConfig: any = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
      };
      
      // Authentication
      if (credentials.password || sftpPassword) {
        connectConfig.password = credentials.password || sftpPassword;
      } else if (credentials.privateKey) {
        connectConfig.privateKey = credentials.privateKey;
        if (credentials.passphrase) {
          connectConfig.passphrase = credentials.passphrase;
        }
      }
      
      client.connect(connectConfig);
    });
    
    return result;
  } catch (error) {
    console.error('Error deleting file from SFTP:', error);
    return false;
  }
}