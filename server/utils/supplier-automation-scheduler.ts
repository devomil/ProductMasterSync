import { db } from '../db';
import { dataPullJobs, products, productSuppliers } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import Client from 'ssh2-sftp-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as xlsx from 'xlsx';
import { storage } from '../storage';

const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [automation] ${message}`);
};

/**
 * Download file from SFTP connection
 */
async function downloadSFTPFile(
  dataSourceId: number,
  remotePath: string
): Promise<{ success: boolean; localPath?: string; error?: string; fileSizeBytes?: number }> {
  const sftp = new Client();
  
  try {
    // Get data source configuration from storage
    const dataSource = await storage.getDataSource(dataSourceId);
    
    if (!dataSource) {
      return { success: false, error: 'Data source not found' };
    }
    
    const config = dataSource.config as any;
    
    // Use environment variable for password if available (production environment)
    let password = config.password;
    if (process.env.INGRAM_SFTP_PASSWORD && config.host?.includes('ingrammicro.com')) {
      log('Using INGRAM_SFTP_PASSWORD from environment variables');
      password = process.env.INGRAM_SFTP_PASSWORD;
    } else if (process.env.SFTP_PASSWORD && !password) {
      log('Using SFTP_PASSWORD from environment variables');
      password = process.env.SFTP_PASSWORD;
    }
    
    // Strip protocol prefix if present
    const cleanHost = config.host?.replace(/^(sftp|ftp|ftps):\/\//i, '') || config.host;
    
    // Connect to SFTP
    await sftp.connect({
      host: cleanHost,
      port: config.port || 22,
      username: config.username,
      password: password,
    });
    
    // Create local directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Generate local filename
    const timestamp = Date.now();
    const filename = `automation_${timestamp}_${path.basename(remotePath)}`;
    const localPath = path.join(uploadsDir, filename);
    
    // Try to download file with fallback paths
    log(`Downloading ${remotePath}`);
    let downloaded = false;
    const pathsToTry = [remotePath, `.${remotePath}`, `/${remotePath}`];
    
    for (const pathToTry of pathsToTry) {
      try {
        await sftp.get(pathToTry, localPath);
        log(`Successfully downloaded from ${pathToTry}`);
        downloaded = true;
        break;
      } catch (err) {
        // Try next path
        continue;
      }
    }
    
    if (!downloaded) {
      throw new Error(`Could not download file from any of: ${pathsToTry.join(', ')}`);
    }
    
    // Get file size
    const stats = await fs.stat(localPath);
    
    return { success: true, localPath, fileSizeBytes: stats.size };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error downloading file: ${errorMsg}`);
    return { success: false, error: errorMsg };
  } finally {
    try {
      await sftp.end();
    } catch (e) {
      // Ignore errors on disconnect
    }
  }
}

/**
 * Process downloaded file and update products
 */
async function processFile(
  filePath: string,
  supplierId: number,
  jobType: 'catalog' | 'inventory'
): Promise<{
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
}> {
  let recordsProcessed = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;
  
  try {
    const fileContent = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    let records: any[] = [];
    
    // Parse file based on type
    if (ext === '.csv') {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.read(fileContent);
      const sheetName = workbook.SheetNames[0];
      records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }
    
    log(`Parsed ${records.length} records from file`);
    
    const mappingTemplatesResult = await storage.getMappingTemplates(supplierId);
    let templatePurpose: string | null = null;
    if (mappingTemplatesResult && mappingTemplatesResult.length > 0) {
      const template = mappingTemplatesResult[0];
      templatePurpose = (template as any).purpose || null;
      if (template.mappings) {
        log(`Applying field mapping template: ${template.name} (purpose: ${templatePurpose || 'unset'})`);
        const mappings = typeof template.mappings === 'string' 
          ? JSON.parse(template.mappings) 
          : template.mappings;
        
        records = records.map(record => {
          const mapped: any = { ...record };
          for (const [targetField, sourceField] of Object.entries(mappings)) {
            if (typeof sourceField === 'string' && record[sourceField] !== undefined) {
              mapped[targetField] = record[sourceField];
            }
          }
          return mapped;
        });
        
        log(`Applied ${Object.keys(mappings).length} field mappings`);
      }
    }
    
    const effectiveJobType = templatePurpose === 'inventory_pricing' ? 'inventory' 
      : templatePurpose === 'catalog' ? 'catalog' 
      : jobType;
    
    log(`Effective job type: ${effectiveJobType} (template purpose: ${templatePurpose}, original: ${jobType})`);
    
    for (const record of records) {
      recordsProcessed++;
      
      try {
        const partNumber = record['Part Number'] || record.partNumber || record.PartNumber || 
          record.SKU || record.sku || record.manufacturerPartNumber || record.usin;
        
        if (!partNumber) {
          recordsFailed++;
          continue;
        }
        
        if (effectiveJobType === 'catalog') {
          // Check if product exists
          const [existing] = await db.select()
            .from(products)
            .where(eq(products.manufacturerPartNumber, partNumber))
            .limit(1);
          
          if (existing) {
            // Update existing product
            await db.update(products)
              .set({
                name: record.Description || record.description || record.Title || existing.name,
                price: String(record.Price || record.price || existing.price || '0'),
                cost: String(record.Cost || record.cost || existing.cost || '0'),
                weight: String(record.Weight || record.weight || existing.weight || '0'),
                imageUrl: record['Image (300x300) Url'] || record.imageUrl || record.ImageURL || existing.imageUrl,
                upc: record.UPC || record.upc || existing.upc,
                inventoryQuantity: parseInt(record['Qty On Hand'] || record.quantity || String(existing.inventoryQuantity) || '0'),
                updatedAt: new Date(),
              })
              .where(eq(products.id, existing.id));
            
            recordsUpdated++;
          } else {
            // Insert new product
            const [newProduct] = await db.insert(products).values({
              sku: partNumber,
              manufacturerPartNumber: partNumber,
              name: record.Description || record.description || record.Title || partNumber,
              description: record['Long Description'] || record.longDescription || '',
              price: String(record.Price || record.price || '0'),
              cost: String(record.Cost || record.cost || '0'),
              weight: String(record.Weight || record.weight || '0'),
              imageUrl: record['Image (300x300) Url'] || record.imageUrl || record.ImageURL || null,
              upc: record.UPC || record.upc || null,
              inventoryQuantity: parseInt(record['Qty On Hand'] || record.quantity || '0'),
            }).returning();
            
            // Create product-supplier relationship
            try {
              await db.insert(productSuppliers).values({
                productId: newProduct.id,
                supplierId,
                supplierSku: partNumber,
              });
            } catch (e) {
              // Ignore if relationship already exists
            }
            
            recordsInserted++;
          }
        }
        // For inventory jobs, only update stock levels
        else if (effectiveJobType === 'inventory') {
          const qtyOnHand = parseInt(record['Qty On Hand'] || record.quantity || record.QtyOnHand || 
            record.inventoryQuantity || record.quantityAvailableCombined || '0');
          
          const updateFields: any = {
            inventoryQuantity: qtyOnHand,
            updatedAt: new Date(),
          };
          
          const costVal = record.yourCost || record.cost || record.Cost;
          if (costVal) updateFields.cost = String(costVal);
          
          const priceVal = record.listPrice || record.price || record.Price;
          if (priceVal) updateFields.price = String(priceVal);
          
          const result = await db.update(products)
            .set(updateFields)
            .where(eq(products.manufacturerPartNumber, partNumber));
          
          if (result.rowCount && result.rowCount > 0) {
            recordsUpdated++;
          } else {
            recordsFailed++;
          }
        }
      } catch (error) {
        log(`Error processing record: ${error instanceof Error ? error.message : String(error)}`);
        recordsFailed++;
      }
    }
    
    log(`Processing complete: ${recordsProcessed} processed, ${recordsInserted} inserted, ${recordsUpdated} updated, ${recordsFailed} failed`);
  } catch (error) {
    log(`Error processing file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
  
  return { recordsProcessed, recordsInserted, recordsUpdated, recordsFailed };
}

/**
 * Execute a single automation job
 */
async function executeAutomationJob(
  automation: any,
  jobType: 'catalog' | 'inventory'
): Promise<void> {
  const filePath = jobType === 'catalog' ? automation.catalogFilePath : automation.inventoryFilePath;
  
  if (!filePath) {
    log(`No file path configured for ${jobType} job on automation ${automation.id}`);
    return;
  }
  
  // Create job record
  const [job] = await db.insert(dataPullJobs).values({
    supplierId: automation.supplierId,
    dataSourceId: automation.dataSourceId,
    jobType,
    filePath,
    status: 'running',
    scheduledAt: new Date(),
    startedAt: new Date(),
  }).returning();
  
  log(`Started ${jobType} job ${job.id} for automation ${automation.id} (${automation.name})`);
  
  try {
    // Download file from SFTP
    const startTime = Date.now();
    const download = await downloadSFTPFile(automation.dataSourceId, filePath);
    
    if (!download.success || !download.localPath) {
      throw new Error(download.error || 'Failed to download file');
    }
    
    // Process the file
    const results = await processFile(download.localPath, automation.supplierId, jobType);
    const processingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    // Update job record with success
    await db.update(dataPullJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: results.recordsProcessed,
        recordsInserted: results.recordsInserted,
        recordsUpdated: results.recordsUpdated,
        fileSize: download.fileSizeBytes || null,
        updatedAt: new Date(),
      })
      .where(eq(dataPullJobs.id, job.id));
    
    log(`✅ Completed ${jobType} job ${job.id}: ${results.recordsProcessed} processed, ${results.recordsUpdated} updated, ${results.recordsInserted} inserted`);
    
    // Clean up downloaded file
    await fs.unlink(download.localPath);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Failed ${jobType} job ${job.id}: ${errorMsg}`);
    
    // Update job record with failure
    await db.update(dataPullJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: errorMsg.substring(0, 500), // Limit error message length
        updatedAt: new Date(),
      })
      .where(eq(dataPullJobs.id, job.id));
  }
}

/**
 * Calculate if a scheduled time has passed
 */
function isTimeDue(scheduledTime: string): boolean {
  const now = new Date();
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes || 0, 0, 0);
  
  // Check if the scheduled time is within the last check interval (2 minutes)
  const timeSince = now.getTime() - scheduled.getTime();
  return timeSince >= 0 && timeSince < 120000; // Within last 2 minutes
}

/**
 * Check if hourly job is due
 */
function isHourlyJobDue(automation: any): boolean {
  if (!automation.inventoryEnabled || automation.inventoryFrequency !== 'hourly') {
    return false;
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const startTime = automation.inventoryStartTime || '06:00';
  const endTime = automation.inventoryEndTime || '22:00';
  
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  
  // Check if we're within the time window
  if (currentHour < startHour || currentHour >= endHour) {
    return false;
  }
  
  // Check if we're at the start of an hour (within first 2 minutes)
  return currentMinute <= 1;
}

/**
 * Check and execute due automation jobs
 */
async function checkAutomations() {
  try {
    // Get all active automations
    const automations = await storage.getSupplierAutomations();
    const now = new Date();
    log(`Checking automations at ${now.toISOString().substring(11, 19)} (${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}) - found ${automations.length} automation(s)`);
    
    for (const automation of automations) {
      if (!automation.isActive) {
        log(`  Skipping inactive automation: ${automation.name}`);
        continue;
      }
      
      // Check catalog jobs
      if (automation.catalogEnabled && automation.catalogScheduleTimes) {
        for (const time of automation.catalogScheduleTimes) {
          if (isTimeDue(time)) {
            log(`📅 Catalog job due for ${automation.name} at ${time}`);
            await executeAutomationJob(automation, 'catalog');
          }
        }
      }
      
      // Check hourly inventory jobs
      if (isHourlyJobDue(automation)) {
        log(`⏰ Hourly inventory job due for ${automation.name}`);
        await executeAutomationJob(automation, 'inventory');
      }
    }
  } catch (error) {
    log(`Error checking automations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start the supplier automation scheduler
 */
export async function startSupplierAutomationScheduler() {
  log('🚀 Starting supplier automation scheduler');
  
  // Run immediate initial check
  try {
    log('Running initial automation check...');
    await checkAutomations();
  } catch (error) {
    log(`Error in initial check: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Check for due jobs every minute
  const checkInterval = 60 * 1000; // 1 minute
  
  setInterval(async () => {
    try {
      await checkAutomations();
    } catch (error) {
      log(`Error in scheduled check: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, checkInterval);
  
  log('✅ Supplier automation scheduler started (checking every 60 seconds)');
}
