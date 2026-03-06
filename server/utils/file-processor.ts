import { promises as fs, createReadStream, statSync } from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { db, pool } from '../db';
import { imports, products, productSuppliers, suppliers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { promisify } from 'util';

const parseCSV = promisify(csvParse);

const BATCH_SIZE = 500;
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;
const PROGRESS_UPDATE_INTERVAL = 2000;

interface ProcessingResult {
  success: boolean;
  message: string;
  recordCount: number;
  processedCount: number;
  errorCount: number;
  errors: any[];
  throughput?: number;
  elapsedMs?: number;
}

export const getFilePath = (supplierId: number, filename: string): string => {
  return path.join(process.cwd(), 'uploads', `supplier_${supplierId}`, filename);
};

export const processCSVFileStreaming = async (
  filePath: string,
  options: {
    hasHeader?: boolean;
    delimiter?: string;
    quote?: string;
    encoding?: string;
    supplierName?: string;
    hostName?: string;
    recordLimit?: number;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  const delimiter = options.delimiter || ',';
  const recordLimit = options.recordLimit || 0;

  let useHeader = options.hasHeader !== false;

  if (useHeader && options.hasHeader === undefined) {
    const fd = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(4096);
    await fd.read(buf, 0, 4096, 0);
    await fd.close();
    const firstLine = buf.toString('utf8').split('\n')[0] || '';
    const firstCols = firstLine.split(delimiter);
    const hasLowercaseLetters = firstCols.some(col => {
      const trimmed = col.trim().replace(/^["']|["']$/g, '');
      if (!trimmed) return false;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
      if (/^[A-Z\s]{20,}$/.test(trimmed)) return false;
      if (/^[A-Z]$/.test(trimmed)) return false;
      if (/^0{3,}/.test(trimmed)) return false;
      return /^[a-zA-Z_]/.test(trimmed) && /[a-z]/.test(trimmed);
    });
    useHeader = hasLowercaseLetters;
  }

  return new Promise((resolve, reject) => {
    const records: any[] = [];
    let headers: string[] = [];
    let headerDetected = false;
    let count = 0;

    const parser = csvParse({
      delimiter: delimiter,
      quote: options.quote || '"',
      columns: useHeader,
      skip_empty_lines: true,
      trim: true
    });

    const stream = createReadStream(filePath, { encoding: (options.encoding || 'utf8') as BufferEncoding });

    stream.pipe(parser);

    parser.on('data', (record: any) => {
      if (!headerDetected && useHeader) {
        headers = Object.keys(record);
        headerDetected = true;
      }
      
      if (recordLimit > 0 && count >= recordLimit) {
        stream.destroy();
        parser.end();
        return;
      }

      records.push(record);
      count++;
    });

    parser.on('end', () => {
      if (!useHeader && records.length > 0) {
        const colCount = Array.isArray(records[0]) ? records[0].length : Object.keys(records[0]).length;
        const isIngram = options.hostName?.includes('ingrammicro.com') || 
          options.supplierName?.toLowerCase().includes('ingram');

        let columnNames: string[];
        if (isIngram && colCount >= 20) {
          columnNames = [
            'Status', 'Ingram Part Number', 'Vendor Number', 'Vendor Name',
            'Description Line 1', 'Description Line 2', 'Customer Price',
            'Vendor Part Number', 'Weight', 'UPC Code', 'Retail Price',
            'MAP Price', 'Freight Cost', 'Availability Flag', 'MSRP',
            'Reserved_15', 'Direct Ship Flag', 'Reserved_17', 'Category',
            'Sub Category', 'Class Code', 'Media Type', 'CPU Type',
            'New Item Flag', 'Special Price'
          ];
          while (columnNames.length < colCount) columnNames.push(`Column_${columnNames.length + 1}`);
          columnNames = columnNames.slice(0, colCount);
        } else {
          columnNames = Array.from({ length: colCount }, (_, i) => `Column_${i + 1}`);
        }

        const namedRecords = records.map(row => {
          if (Array.isArray(row)) {
            const obj: any = {};
            columnNames.forEach((name, i) => { obj[name] = row[i] || ''; });
            return obj;
          }
          return row;
        });

        resolve({ records: namedRecords, headers: columnNames });
        return;
      }

      if (headers.length === 0 && records.length > 0 && useHeader) {
        headers = Object.keys(records[0]);
      }
      resolve({ records, headers });
    });

    parser.on('error', (err: Error) => reject(err));
    stream.on('error', (err: Error) => reject(err));
  });
};

export const processCSVFile = async (
  filePath: string,
  options: {
    hasHeader?: boolean;
    delimiter?: string;
    quote?: string;
    encoding?: string;
    mappingTemplate?: any;
    supplierName?: string;
    hostName?: string;
    recordLimit?: number;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  let fileSize = 0;
  try {
    const stat = statSync(filePath);
    fileSize = stat.size;
  } catch {}

  if (fileSize > LARGE_FILE_THRESHOLD) {
    console.log(`Large file detected (${(fileSize / 1024 / 1024).toFixed(1)}MB), using streaming parser`);
    return processCSVFileStreaming(filePath, options);
  }

  const fileContent = await fs.readFile(filePath, (options.encoding || 'utf8') as BufferEncoding);
  const delimiter = options.delimiter || ',';

  let useHeader = options.hasHeader !== false;

  if (useHeader && options.hasHeader === undefined) {
    const firstLine = fileContent.split('\n')[0] || '';
    const firstCols = firstLine.split(delimiter);
    const hasLowercaseLetters = firstCols.some(col => {
      const trimmed = col.trim().replace(/^["']|["']$/g, '');
      if (!trimmed) return false;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
      if (/^[A-Z\s]{20,}$/.test(trimmed)) return false;
      if (/^[A-Z]$/.test(trimmed)) return false;
      if (/^0{3,}/.test(trimmed)) return false;
      return /^[a-zA-Z_]/.test(trimmed) && /[a-z]/.test(trimmed);
    });
    useHeader = hasLowercaseLetters;
  }

  const parseOptions = {
    delimiter: delimiter,
    quote: options.quote || '"',
    columns: useHeader,
    skip_empty_lines: true,
    trim: true
  };
  
  let records: any[] = await parseCSV(fileContent, parseOptions);

  if (options.recordLimit && options.recordLimit > 0) {
    records = records.slice(0, options.recordLimit);
  }

  if (!useHeader && Array.isArray(records) && records.length > 0) {
    const colCount = (records[0] as any[]).length;
    const isIngram = options.hostName?.includes('ingrammicro.com') || 
      options.supplierName?.toLowerCase().includes('ingram');

    let columnNames: string[];
    if (isIngram && colCount >= 20) {
      columnNames = [
        'Status', 'Ingram Part Number', 'Vendor Number', 'Vendor Name',
        'Description Line 1', 'Description Line 2', 'Customer Price',
        'Vendor Part Number', 'Weight', 'UPC Code', 'Retail Price',
        'MAP Price', 'Freight Cost', 'Availability Flag', 'MSRP',
        'Reserved_15', 'Direct Ship Flag', 'Reserved_17', 'Category',
        'Sub Category', 'Class Code', 'Media Type', 'CPU Type',
        'New Item Flag', 'Special Price'
      ];
      while (columnNames.length < colCount) columnNames.push(`Column_${columnNames.length + 1}`);
      columnNames = columnNames.slice(0, colCount);
    } else {
      columnNames = Array.from({ length: colCount }, (_, i) => `Column_${i + 1}`);
    }

    const namedRecords = (records as any[][]).map(row => {
      const obj: any = {};
      columnNames.forEach((name, i) => { obj[name] = row[i] || ''; });
      return obj;
    });

    return { records: namedRecords, headers: columnNames };
  }

  const headers = useHeader ? Object.keys(records[0] || {}) : [];
  return { records, headers };
};

export const processExcelFile = async (
  filePath: string,
  options: {
    sheetName?: string;
    hasHeader?: boolean;
    mappingTemplate?: any;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  const workbook = XLSX.readFile(filePath);
  
  const sheetName = options.sheetName || workbook.SheetNames[0];
  
  if (!workbook.Sheets[sheetName]) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }
  
  const jsonOptions: XLSX.Sheet2JSONOpts = {
    header: options.hasHeader !== false ? 1 : undefined,
    raw: false,
    defval: ''
  };
  
  const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], jsonOptions);
  
  const headers = options.hasHeader !== false
    ? Object.keys(records[0] || {})
    : [];
    
  return { records, headers };
};

export const processJSONFile = async (
  filePath: string,
  options: {
    rootProperty?: string;
    mappingTemplate?: any;
  } = {}
): Promise<{ records: any[]; headers: string[] }> => {
  const fileContent = await fs.readFile(filePath, 'utf8');
  let data;
  
  try {
    data = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON file: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  let records = Array.isArray(data) ? data : [data];
  
  if (options.rootProperty && data[options.rootProperty]) {
    records = Array.isArray(data[options.rootProperty]) 
      ? data[options.rootProperty] 
      : [data[options.rootProperty]];
  }
  
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  
  return { records, headers };
};

export const applyMappingTemplate = (
  records: any[],
  mappingTemplate: any
): any[] => {
  if (!mappingTemplate) {
    return records;
  }
  
  return records.map(record => {
    const result: Record<string, any> = {};
    
    if (mappingTemplate.fieldMappings && Array.isArray(mappingTemplate.fieldMappings)) {
      if (mappingTemplate.defaultValues) {
        Object.assign(result, mappingTemplate.defaultValues);
      }
      
      for (const mapping of mappingTemplate.fieldMappings) {
        if (record[mapping.source] !== undefined) {
          let value = record[mapping.source];
          
          if (mapping.transform && mappingTemplate.transformations?.[mapping.transform]) {
            value = mappingTemplate.transformations[mapping.transform](value, record);
          }
          
          result[mapping.target] = value;
        }
      }
    } else {
      for (const [targetField, sourceField] of Object.entries(mappingTemplate)) {
        if (typeof sourceField === 'string' && record[sourceField] !== undefined) {
          result[targetField] = record[sourceField];
        }
      }
    }
    
    return result;
  });
};

function buildProductData(record: any): any {
  return {
    sku: record.sku || '',
    name: record.name || '',
    description: record.description || null,
    categoryId: record.categoryId ? parseInt(record.categoryId) : null,
    manufacturerId: record.manufacturerId ? parseInt(record.manufacturerId) : null,
    manufacturerName: record.manufacturerName || null,
    manufacturerPartNumber: record.manufacturerPartNumber || null,
    upc: record.upc || null,
    price: record.price || null,
    cost: record.cost || null,
    weight: record.weight || null,
    dimensions: record.dimensions || null,
    status: record.status || 'active',
    attributes: record.attributes || {},
    imageUrl: record.imageUrl || record['Image (300x300) Url'] || record.image_url || null,
    imageUrlLarge: record.imageUrlLarge || record['Image (1000x1000) Url'] || record.image_url_large || null,
    primaryImage: record.primaryImage || record.primary_image || null,
    additionalImages: record.additionalImages || record['Image Additional (1000x1000) Urls'] || record.additional_images || null,
    thirdPartyMarketplaces: record['3rd Party Marketplaces'] || record.thirdPartyMarketplaces || null,
    caseQuantity: record['Case Qty'] || record['Case Quantity'] || record.caseQuantity || null,
    googleMerchantCategory: record['Google Merchant Category'] || record.googleMerchantCategory || null,
    countryOfOrigin: record['Country of Origin'] || record.countryOfOrigin || null,
    boxHeight: record['Box Height'] || record.boxHeight || null,
    boxLength: record['Box Length'] || record.boxLength || null,
    boxWidth: record['Box Width'] || record.boxWidth || null,
  };
}

function escapeVal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function batchUpsertProducts(
  records: any[],
  supplierId: number
): Promise<{ processedCount: number; errorCount: number; errors: any[]; insertedIds: { id: number; sku: string }[] }> {
  if (records.length === 0) return { processedCount: 0, errorCount: 0, errors: [], insertedIds: [] };

  const productRows = records.map(r => buildProductData(r));
  const validRows = productRows.filter(r => r.sku && r.sku.trim() !== '');

  if (validRows.length === 0) {
    return { processedCount: 0, errorCount: records.length, errors: [{ message: 'All records missing SKU' }], insertedIds: [] };
  }

  const valueRows = validRows.map(r => {
    return `(${escapeVal(r.sku)}, ${escapeVal(r.name)}, ${escapeVal(r.description)}, ${r.categoryId !== null ? r.categoryId : 'NULL'}, ${r.manufacturerId !== null ? r.manufacturerId : 'NULL'}, ${escapeVal(r.manufacturerName)}, ${escapeVal(r.manufacturerPartNumber)}, ${escapeVal(r.upc)}, ${escapeVal(r.price)}, ${escapeVal(r.cost)}, ${escapeVal(r.weight)}, ${escapeVal(r.dimensions)}, ${escapeVal(r.status)}, ${escapeVal(r.attributes)}, ${escapeVal(r.imageUrl)}, ${escapeVal(r.imageUrlLarge)}, ${escapeVal(r.primaryImage)}, ${escapeVal(r.additionalImages)}, ${escapeVal(r.thirdPartyMarketplaces)}, ${escapeVal(r.caseQuantity)}, ${escapeVal(r.googleMerchantCategory)}, ${escapeVal(r.countryOfOrigin)}, ${escapeVal(r.boxHeight)}, ${escapeVal(r.boxLength)}, ${escapeVal(r.boxWidth)}, NOW(), NOW())`;
  });

  const upsertSQL = `
    INSERT INTO products (sku, name, description, category_id, manufacturer_id, manufacturer_name, manufacturer_part_number, upc, price, cost, weight, dimensions, status, attributes, image_url, image_url_large, primary_image, additional_images, third_party_marketplaces, case_quantity, google_merchant_category, country_of_origin, box_height, box_length, box_width, created_at, updated_at)
    VALUES ${valueRows.join(',\n')}
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, products.description),
      category_id = COALESCE(EXCLUDED.category_id, products.category_id),
      manufacturer_id = COALESCE(EXCLUDED.manufacturer_id, products.manufacturer_id),
      manufacturer_name = COALESCE(EXCLUDED.manufacturer_name, products.manufacturer_name),
      manufacturer_part_number = COALESCE(EXCLUDED.manufacturer_part_number, products.manufacturer_part_number),
      upc = COALESCE(EXCLUDED.upc, products.upc),
      price = COALESCE(EXCLUDED.price, products.price),
      cost = COALESCE(EXCLUDED.cost, products.cost),
      weight = COALESCE(EXCLUDED.weight, products.weight),
      dimensions = COALESCE(EXCLUDED.dimensions, products.dimensions),
      status = EXCLUDED.status,
      attributes = EXCLUDED.attributes,
      image_url = COALESCE(EXCLUDED.image_url, products.image_url),
      image_url_large = COALESCE(EXCLUDED.image_url_large, products.image_url_large),
      primary_image = COALESCE(EXCLUDED.primary_image, products.primary_image),
      additional_images = COALESCE(EXCLUDED.additional_images, products.additional_images),
      third_party_marketplaces = COALESCE(EXCLUDED.third_party_marketplaces, products.third_party_marketplaces),
      case_quantity = COALESCE(EXCLUDED.case_quantity, products.case_quantity),
      google_merchant_category = COALESCE(EXCLUDED.google_merchant_category, products.google_merchant_category),
      country_of_origin = COALESCE(EXCLUDED.country_of_origin, products.country_of_origin),
      box_height = COALESCE(EXCLUDED.box_height, products.box_height),
      box_length = COALESCE(EXCLUDED.box_length, products.box_length),
      box_width = COALESCE(EXCLUDED.box_width, products.box_width),
      updated_at = NOW()
    RETURNING id, sku
  `;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(upsertSQL);
      const insertedIds = result.rows as { id: number; sku: string }[];

      if (insertedIds.length > 0) {
        const supplierValues = insertedIds.map(r => 
          `(${r.id}, ${supplierId}, ${escapeVal(r.sku)}, '{}'::jsonb, 100)`
        ).join(',\n');

        await client.query(`
          INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, supplier_attributes, confidence)
          VALUES ${supplierValues}
          ON CONFLICT (product_id, supplier_id) DO UPDATE SET
            supplier_sku = EXCLUDED.supplier_sku,
            confidence = EXCLUDED.confidence
        `);
      }

      return {
        processedCount: insertedIds.length,
        errorCount: records.length - validRows.length,
        errors: [],
        insertedIds
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      processedCount: 0,
      errorCount: validRows.length,
      errors: [{ message: `Batch upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      insertedIds: []
    };
  }
}

export const processImportedFile = async (importId: number): Promise<ProcessingResult> => {
  const result: ProcessingResult = {
    success: false,
    message: '',
    recordCount: 0,
    processedCount: 0,
    errorCount: 0,
    errors: [],
    throughput: 0,
    elapsedMs: 0
  };
  
  const startTime = Date.now();
  let lastProgressUpdate = Date.now();
  
  try {
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
    
    if (!importRecord.supplierId) {
      result.message = 'Import has no associated supplier';
      result.errors.push({ message: 'No supplier associated with import' });
      return result;
    }
    
    await db.update(imports)
      .set({ status: 'processing' })
      .where(eq(imports.id, importId));
    
    const filePath = getFilePath(importRecord.supplierId, importRecord.filename);
    
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
        
        await db.update(imports)
          .set({ 
            status: 'error',
            importErrors: result.errors,
            completedAt: new Date()
          })
          .where(eq(imports.id, importId));
          
        return result;
    }
    
    let processedRecords = fileData.records;
    if (importRecord.mappingTemplate) {
      try {
        const template = JSON.parse(importRecord.mappingTemplate);
        processedRecords = applyMappingTemplate(fileData.records, template);
      } catch (error) {
        console.warn('Error applying mapping template:', error);
      }
    }
    
    result.recordCount = processedRecords.length;
    
    const [supplier] = await db.select()
      .from(suppliers)
      .where(eq(suppliers.id, importRecord.supplierId))
      .limit(1);
      
    if (!supplier) {
      result.message = `Supplier with ID ${importRecord.supplierId} not found`;
      result.errors.push({ message: 'Supplier not found' });
      
      await db.update(imports)
        .set({ 
          status: 'error',
          importErrors: result.errors,
          completedAt: new Date()
        })
        .where(eq(imports.id, importId));
        
      return result;
    }
    
    const totalRecords = processedRecords.length;
    console.log(`Starting bulk import: ${totalRecords} records with batch size ${BATCH_SIZE}`);
    
    for (let batchStart = 0; batchStart < totalRecords; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords);
      const batch = processedRecords.slice(batchStart, batchEnd);
      
      const batchResult = await batchUpsertProducts(batch, importRecord.supplierId);
      
      result.processedCount += batchResult.processedCount;
      result.errorCount += batchResult.errorCount;
      if (batchResult.errors.length > 0) {
        result.errors.push(...batchResult.errors.slice(0, 10));
      }
      
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL || batchEnd >= totalRecords) {
        const elapsedSec = (now - startTime) / 1000;
        const rate = result.processedCount / elapsedSec;
        const remaining = totalRecords - batchEnd;
        const etaSeconds = rate > 0 ? Math.ceil(remaining / rate) : 0;
        
        console.log(`Import progress: ${batchEnd}/${totalRecords} (${(batchEnd/totalRecords*100).toFixed(1)}%) | Rate: ${rate.toFixed(0)} rec/s | ETA: ${etaSeconds}s`);
        
        await db.update(imports)
          .set({ 
            processedCount: result.processedCount,
            errorCount: result.errorCount
          })
          .where(eq(imports.id, importId));
        
        lastProgressUpdate = now;
      }
    }
    
    const elapsedMs = Date.now() - startTime;
    result.elapsedMs = elapsedMs;
    result.throughput = Math.round(result.processedCount / (elapsedMs / 1000));
    
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
    result.message = `Processed ${result.processedCount} of ${result.recordCount} records with ${result.errorCount} errors in ${(elapsedMs/1000).toFixed(1)}s (${result.throughput} rec/s)`;
    
    console.log(`Import complete: ${result.message}`);
    
    return result;
  } catch (error) {
    console.error('Error in processImportedFile:', error);
    
    result.success = false;
    result.elapsedMs = Date.now() - startTime;
    result.message = `Failed to process import: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(error);
    
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
