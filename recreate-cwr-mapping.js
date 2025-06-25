/**
 * Recreate CWR mapping template and import product catalog
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function recreateCWRMapping() {
  try {
    console.log('🔄 Getting CWR sample data to understand structure...');
    
    // Get sample data using the data source directly
    const sampleResponse = await axios.post(`${API_BASE}/test-pull/1`, {
      limit: 3
    });

    if (!sampleResponse.data.success) {
      throw new Error(`Failed to get sample data: ${sampleResponse.data.message}`);
    }

    const sampleRecord = sampleResponse.data.data[0];
    console.log('📋 Sample CWR record structure:', Object.keys(sampleRecord));
    console.log('📋 Sample values:', sampleRecord);

    // Create mapping template for CWR
    const mappingTemplate = {
      name: 'CWR Product Catalog Mapping',
      supplier_id: 2,
      data_source_id: 1,
      source_type: 'csv',
      field_mappings: {
        // Core product fields
        sku: 'CWR Part Number',
        name: 'Uppercase Title',
        manufacturerPartNumber: 'Manufacturer Part Number',
        upc: 'UPC Code',
        cost: 'Your Cost',
        price: 'List Price',
        
        // Inventory fields
        inventoryQuantity: 'Quantity Available to Ship (Combined)',
        
        // Pricing fields
        mapPrice: 'M.A.P. Price',
        mrpPrice: 'M.R.P. Price'
      },
      validation_rules: {
        required_fields: ['CWR Part Number', 'Uppercase Title', 'Your Cost'],
        data_types: {
          'Your Cost': 'decimal',
          'List Price': 'decimal',
          'Quantity Available to Ship (Combined)': 'integer',
          'UPC Code': 'string'
        }
      },
      transformation_rules: {
        // Convert empty strings to null for numeric fields
        numeric_fields: ['Your Cost', 'List Price', 'M.A.P. Price', 'M.R.P. Price'],
        // Handle inventory quantity
        inventory_calculation: 'Combined'
      }
    };

    console.log('📝 Creating CWR mapping template...');
    const mappingResponse = await axios.post(`${API_BASE}/mapping-templates`, mappingTemplate);
    
    if (mappingResponse.status !== 201) {
      throw new Error(`Failed to create mapping template: ${mappingResponse.status}`);
    }

    console.log('✅ CWR mapping template created successfully');
    console.log('🚀 Starting product catalog import...');

    // Trigger full import
    const importResponse = await axios.post(`${API_BASE}/test-pull/1`, {
      limit: 1000, // Import up to 1000 products
      apply_mapping: true,
      create_products: true
    });

    if (!importResponse.data.success) {
      console.error('❌ Import failed:', importResponse.data.message);
      return;
    }

    console.log('✅ CWR product catalog import completed successfully');
    console.log(`📊 Imported ${importResponse.data.products_created || 0} products`);

    // Get final statistics
    const statsResponse = await axios.get(`${API_BASE}/statistics`);
    console.log('📈 Final statistics:', {
      totalProducts: statsResponse.data.totalProducts,
      activeSuppliers: statsResponse.data.activeSuppliers
    });

  } catch (error) {
    console.error('❌ Error recreating CWR mapping:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the recreation process
recreateCWRMapping();