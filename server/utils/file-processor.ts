import { promises as fs } from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { db } from '../db';
import { imports, products, productSuppliers, suppliers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { promisify } from 'util';

// Convert csv-parse to promise-based
const parseCSV = promisify(csvParse);

interface ProcessingResult {
  success: boolean;
  message: string;
  recordCount: number;
  processedCount: number;
  errorCount: number;
  errors: any[];
}

/**
 * Get the path to the uploaded file
 */
export const getFilePath = (supplierId: number, filename: string): string => {
  return path.join(process.cwd(), 'uploads', `supplier_${supplierId}`, filename);
};

/**
 * Process a CSV file
 */
export const processCSVFile = async (
  filePath: string,
  options: {
    hasHeader?: boolean;
    delimiter?: string;
    quote?: string;
    encoding?: string;
    mappingTemplate?: any;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  // Read the file
  const fileContent = await fs.readFile(filePath, options.encoding || 'utf8');
  
  // Parse the CSV
  const parseOptions = {
    delimiter: options.delimiter || ',',
    quote: options.quote || '"',
    columns: options.hasHeader !== false, // Auto-detect headers by default
    skip_empty_lines: true,
    trim: true
  };
  
  const records = await parseCSV(fileContent, parseOptions);
  const headers = options.hasHeader !== false 
    ? Object.keys(records[0] || {})
    : [];
    
  return { records, headers };
};

/**
 * Process an Excel file
 */
export const processExcelFile = async (
  filePath: string,
  options: {
    sheetName?: string;
    hasHeader?: boolean;
    mappingTemplate?: any;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);
  
  // Determine which sheet to process
  const sheetName = options.sheetName || workbook.SheetNames[0];
  
  if (!workbook.Sheets[sheetName]) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }
  
  // Convert sheet to JSON
  const jsonOptions: XLSX.Sheet2JSONOpts = {
    header: options.hasHeader !== false ? 1 : undefined,
    raw: false,
    defval: ''
  };
  
  const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], jsonOptions);
  
  // Extract headers
  const headers = options.hasHeader !== false
    ? Object.keys(records[0] || {})
    : [];
    
  return { records, headers };
};

/**
 * Process a JSON file
 */
export const processJSONFile = async (
  filePath: string,
  options: {
    rootProperty?: string;
    mappingTemplate?: any;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  // Read and parse the JSON file
  const fileContent = await fs.readFile(filePath, 'utf8');
  let data;
  
  try {
    data = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON file: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Extract records based on root property if specified
  let records = Array.isArray(data) ? data : [data];
  
  if (options.rootProperty && data[options.rootProperty]) {
    records = Array.isArray(data[options.rootProperty]) 
      ? data[options.rootProperty] 
      : [data[options.rootProperty]];
  }
  
  // Extract headers from the first record
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  
  return { records, headers };
};

/**
 * Apply mapping template to transform raw data
 */
export const applyMappingTemplate = (
  records: any[],
  mappingTemplate: {
    fieldMappings: { source: string; target: string; transform?: string }[];
    defaultValues?: Record<string, any>;
    transformations?: Record<string, Function>;
  }
): any[] => {
  if (!mappingTemplate || !mappingTemplate.fieldMappings) {
    return records;
  }
  
  return records.map(record => {
    const result: Record<string, any> = { ...(mappingTemplate.defaultValues || {}) };
    
    // Apply field mappings
    for (const mapping of mappingTemplate.fieldMappings) {
      if (record[mapping.source] !== undefined) {
        let value = record[mapping.source];
        
        // Apply transformation if specified
        if (mapping.transform && mappingTemplate.transformations?.[mapping.transform]) {
          value = mappingTemplate.transformations[mapping.transform](value, record);
        }
        
        result[mapping.target] = value;
      }
    }
    
    return result;
  });
};

/**
 * Process an imported file
 */
export const processImportedFile = async (importId: number): Promise<ProcessingResult> => {
  const result: ProcessingResult = {
    success: false,
    message: '',
    recordCount: 0,
    processedCount: 0,
    errorCount: 0,
    errors: []
  };
  
  try {
    // Get import details
    const importDetails = await db.select()
      .from(imports)
      .where(eq(imports.id, importId))
      .limit(1);
      
    if (importDetails.length === 0) {
      result.message = `Import with ID ${importId} not found`;
      result.errors.push({ message: 'Import not found' });
      return result;
    }
    
    const importRecord = importDetails[0];
    
    // Ensure we have a supplier ID
    if (!importRecord.supplierId) {
      result.message = 'Import has no associated supplier';
      result.errors.push({ message: 'No supplier associated with import' });
      return result;
    }
    
    // Update import status to processing
    await db.update(imports)
      .set({ status: 'processing' })
      .where(eq(imports.id, importId));
    
    // Determine the file path
    const filePath = getFilePath(importRecord.supplierId, importRecord.filename);
    
    // Process file based on type
    let fileData: { records: any[]; headers: string[] };
    
    switch (importRecord.type) {
      case 'csv':
        fileData = await processCSVFile(filePath, {
          hasHeader: true,
          delimiter: ',',
          encoding: 'utf8',
          mappingTemplate: importRecord.mappingTemplate
        });
        break;
        
      case 'excel':
        fileData = await processExcelFile(filePath, {
          hasHeader: true,
          mappingTemplate: importRecord.mappingTemplate
        });
        break;
        
      case 'json':
        fileData = await processJSONFile(filePath, {
          mappingTemplate: importRecord.mappingTemplate
        });
        break;
        
      default:
        result.message = `Unsupported file type: ${importRecord.type}`;
        result.errors.push({ message: `Unsupported file type: ${importRecord.type}` });
        
        // Update import status to error
        await db.update(imports)
          .set({ 
            status: 'error',
            importErrors: result.errors,
            completedAt: new Date()
          })
          .where(eq(imports.id, importId));
          
        return result;
    }
    
    // Apply mapping template if available
    let processedRecords = fileData.records;
    if (importRecord.mappingTemplate) {
      try {
        const template = JSON.parse(importRecord.mappingTemplate);
        processedRecords = applyMappingTemplate(fileData.records, template);
      } catch (error) {
        console.warn('Error applying mapping template:', error);
        // Continue with original records
      }
    }
    
    result.recordCount = processedRecords.length;
    
    // Get supplier details
    const [supplier] = await db.select()
      .from(suppliers)
      .where(eq(suppliers.id, importRecord.supplierId))
      .limit(1);
      
    if (!supplier) {
      result.message = `Supplier with ID ${importRecord.supplierId} not found`;
      result.errors.push({ message: 'Supplier not found' });
      
      // Update import status to error
      await db.update(imports)
        .set({ 
          status: 'error',
          importErrors: result.errors,
          completedAt: new Date()
        })
        .where(eq(imports.id, importId));
        
      return result;
    }
    
    // Process records in batches for better performance with large files
    const BATCH_SIZE = 50;
    const totalRecords = processedRecords.length;
    
    for (let batchStart = 0; batchStart < totalRecords; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords);
      const batch = processedRecords.slice(batchStart, batchEnd);
      
      const newProducts: any[] = [];
      const updateProducts: { id: number; data: any }[] = [];
      
      // Process batch to determine inserts vs updates
      for (const record of batch) {
        try {
          const productData = {
            sku: record.sku || '',
            name: record.name || '',
            description: record.description,
            categoryId: record.categoryId ? parseInt(record.categoryId) : null,
            manufacturerId: record.manufacturerId ? parseInt(record.manufacturerId) : null,
            manufacturerName: record.manufacturerName,
            manufacturerPartNumber: record.manufacturerPartNumber,
            upc: record.upc,
            price: record.price,
            cost: record.cost,
            weight: record.weight,
            dimensions: record.dimensions,
            status: record.status || 'active',
            attributes: record.attributes || {},
            // Catalog fields from authentic CWR data structure
            thirdPartyMarketplaces: record['3rd Party Marketplaces'] || record.thirdPartyMarketplaces,
            caseQuantity: record['Case Qty'] || record['Case Quantity'] || record.caseQuantity,
            googleMerchantCategory: record['Google Merchant Category'] || record.googleMerchantCategory,
            countryOfOrigin: record['Country of Origin'] || record.countryOfOrigin,
            boxHeight: record['Box Height'] || record.boxHeight,
            boxLength: record['Box Length'] || record.boxLength,
            boxWidth: record['Box Width'] || record.boxWidth,
            updatedAt: new Date()
          };
          
          // Check if product exists
          const existingProducts = await db.select({ id: products.id })
            .from(products)
            .where(eq(products.sku, productData.sku))
            .limit(1);
            
          if (existingProducts.length > 0) {
            updateProducts.push({ id: existingProducts[0].id, data: productData });
          } else {
            newProducts.push({ ...productData, createdAt: new Date() });
          }
        } catch (error) {
          result.errors.push({
            record: batchStart + newProducts.length + updateProducts.length + 1,
            message: error instanceof Error ? error.message : 'Error processing record'
          });
          result.errorCount++;
        }
      }
      
      // Batch insert new products
      if (newProducts.length > 0) {
        try {
          const insertedProducts = await db.insert(products)
            .values(newProducts)
            .returning({ id: products.id });
          result.processedCount += insertedProducts.length;
        } catch (error) {
          result.errors.push({
            batch: Math.floor(batchStart / BATCH_SIZE) + 1,
            message: `Batch insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          result.errorCount += newProducts.length;
        }
      }
      
      // Batch update existing products
      for (const update of updateProducts) {
        try {
          await db.update(products)
            .set(update.data)
            .where(eq(products.id, update.id));
          result.processedCount++;
        } catch (error) {
          result.errors.push({
            productId: update.id,
            message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          result.errorCount++;
        }
      }
        });
      }
      
      // Update import progress periodically 
      if (i % 100 === 0 || i === processedRecords.length - 1) {
        await db.update(imports)
          .set({ 
            processedCount: result.processedCount,
            errorCount: result.errorCount
          })
          .where(eq(imports.id, importId));
      }
    }
    
    // Update final status
    const finalStatus = result.errorCount === 0 ? 'success' : 
                        result.processedCount > 0 ? 'success' : 'error';
                        
    await db.update(imports)
      .set({ 
        status: finalStatus,
        recordCount: result.recordCount,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        importErrors: result.errors.length > 0 ? result.errors : [],
        completedAt: new Date()
      })
      .where(eq(imports.id, importId));
      
    result.success = finalStatus === 'success';
    result.message = `Processed ${result.processedCount} of ${result.recordCount} records with ${result.errorCount} errors`;
    
    return result;
  } catch (error) {
    console.error('Error in processImportedFile:', error);
    
    result.success = false;
    result.message = `Failed to process import: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(error);
    
    // Update import status to error
    try {
      await db.update(imports)
        .set({ 
          status: 'error',
          importErrors: result.errors,
          completedAt: new Date()
        })
        .where(eq(imports.id, importId));
    } catch (updateError) {
      console.error('Error updating import status:', updateError);
    }
    
    return result;
  }
};