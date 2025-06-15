/**
 * File Processing Service for CSV/Excel uploads
 * 
 * Handles parsing of uploaded files and extraction of product data
 */

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

interface ProcessedFileResult {
  success: boolean;
  rows: Array<Record<string, string>>;
  headers: string[];
  totalRows: number;
  error?: string;
}

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Process uploaded CSV or Excel file
 */
export async function processUploadedFile(file: UploadedFile): Promise<ProcessedFileResult> {
  try {
    const { buffer, originalname, mimetype } = file;
    
    // Determine file type and process accordingly
    if (mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv')) {
      return processCsvFile(buffer);
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      originalname.toLowerCase().endsWith('.xlsx') ||
      originalname.toLowerCase().endsWith('.xls')
    ) {
      return processExcelFile(buffer);
    } else {
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        error: 'Unsupported file format. Please upload CSV or Excel files.'
      };
    }
  } catch (error) {
    console.error('File processing error:', error);
    return {
      success: false,
      rows: [],
      headers: [],
      totalRows: 0,
      error: error instanceof Error ? error.message : 'Failed to process file'
    };
  }
}

/**
 * Process CSV file
 */
function processCsvFile(buffer: Buffer): ProcessedFileResult {
  try {
    const csvContent = buffer.toString('utf-8');
    
    // Parse CSV with various delimiter options
    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ',',
        quote: '"',
        escape: '"'
      });
    } catch (commaError) {
      // Try semicolon delimiter
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ';',
          quote: '"',
          escape: '"'
        });
      } catch (semicolonError) {
        // Try tab delimiter
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: '\t',
          quote: '"',
          escape: '"'
        });
      }
    }

    if (!records || records.length === 0) {
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        error: 'No data found in CSV file'
      };
    }

    // Normalize column headers to lowercase with underscores
    const normalizedRows = records.map((row: any) => {
      const normalizedRow: Record<string, string> = {};
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        normalizedRow[normalizedKey] = row[key];
      });
      return normalizedRow;
    });

    const headers = Object.keys(normalizedRows[0] || {});

    return {
      success: true,
      rows: normalizedRows,
      headers,
      totalRows: normalizedRows.length
    };
  } catch (error) {
    console.error('CSV processing error:', error);
    return {
      success: false,
      rows: [],
      headers: [],
      totalRows: 0,
      error: error instanceof Error ? error.message : 'Failed to parse CSV file'
    };
  }
}

/**
 * Process Excel file
 */
function processExcelFile(buffer: Buffer): ProcessedFileResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Use the first worksheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        error: 'No worksheets found in Excel file'
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row as keys
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    }) as string[][];

    if (jsonData.length < 2) {
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        error: 'Excel file must contain at least a header row and one data row'
      };
    }

    // Extract headers and normalize
    const rawHeaders = jsonData[0];
    const normalizedHeaders = rawHeaders.map(header => 
      String(header).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    );

    // Process data rows
    const rows = jsonData.slice(1).map(row => {
      const normalizedRow: Record<string, string> = {};
      normalizedHeaders.forEach((header, index) => {
        normalizedRow[header] = String(row[index] || '').trim();
      });
      return normalizedRow;
    }).filter(row => {
      // Filter out completely empty rows
      return Object.values(row).some(value => value !== '');
    });

    return {
      success: true,
      rows,
      headers: normalizedHeaders,
      totalRows: rows.length
    };
  } catch (error) {
    console.error('Excel processing error:', error);
    return {
      success: false,
      rows: [],
      headers: [],
      totalRows: 0,
      error: error instanceof Error ? error.message : 'Failed to parse Excel file'
    };
  }
}

/**
 * Detect and map common column variations
 */
export function detectColumnMapping(headers: string[]): Record<string, string[]> {
  const mappings = {
    upc: ['upc', 'upc_code', 'barcode', 'gtin', 'ean', 'ean13'],
    manufacturerPartNumber: ['mpn', 'manufacturer_part_number', 'part_number', 'model', 'manufacturer_number', 'mfg_part_number'],
    asin: ['asin', 'amazon_asin', 'amazon_id'],
    description: ['description', 'product_description', 'item_description', 'title', 'name', 'product_name'],
    brand: ['brand', 'manufacturer', 'make', 'brand_name'],
    model: ['model', 'model_number', 'model_name'],
    price: ['price', 'cost', 'wholesale_price', 'unit_price'],
    category: ['category', 'product_category', 'type', 'product_type']
  };

  const detectedMappings: Record<string, string[]> = {};
  
  Object.entries(mappings).forEach(([standardField, variations]) => {
    const matchedHeaders = headers.filter(header => 
      variations.some(variation => 
        header.toLowerCase().includes(variation) || variation.includes(header.toLowerCase())
      )
    );
    
    if (matchedHeaders.length > 0) {
      detectedMappings[standardField] = matchedHeaders;
    }
  });

  return detectedMappings;
}